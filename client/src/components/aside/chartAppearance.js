import { isClassicColormap, sampleColormapRgb } from '../displaySystem/colormaps';

/**
 * 图表能落地的叠加层。
 *
 * 白名单本身在 `displayProfileRuntime.js` 的 `OVERLAY_OPTIONS`，这里只挑出
 * 曲线画得出来的那几个：`legend`（色带）故意不列 —— 图例是零件栏自己画在 DOM 上的
 * 那条带子，塞进 300x150 的小画布里只会盖住曲线。摆一个拖上去没反应的方块
 * 比少一个方块更糟，所以宁可不列。
 */
export const CHART_OVERLAY_IDS = ['gridLines', 'axes', 'peakMarker', 'valueLabels'];

const GRID_COLOR = 'rgba(255, 255, 255, 0.12)';
const AXIS_TEXT_COLOR = 'rgba(255, 255, 255, 0.55)';
const GRID_ROWS = 4;
const GRID_COLS = 6;

/**
 * 找出曲线的峰值位置。
 *
 * 峰值标记要落在"看得见的那个最高点"上，也就是绘制用的 data 数组的最大项，
 * 而不是原始压力值的最大项 —— 两者在 normalize 分支下并不是同一个下标。
 *
 * @param {number[]} data 绘制用的高度数组。
 * @returns {number} 峰值下标；数组为空时返回 -1。
 */
export function findPeakIndex(data) {
  if (!Array.isArray(data) || !data.length) return -1;
  let peak = 0;
  for (let index = 1; index < data.length; index += 1) {
    if (data[index] > data[peak]) peak = index;
  }
  return peak;
}

/**
 * 决定曲线的描边样式。
 *
 * `classic`（以及压根没选配色）必须继续用公式自己那个纯色，老界面的观感一个
 * 像素都不能变；只有显式选了别的配色才换成纵向渐变 —— 纵向是因为曲线的高度就是
 * 压力大小，低在下、高在上，和压力图的色带含义对齐。
 *
 * @param {CanvasRenderingContext2D} ctx 画布上下文。
 * @param {object} options 参数。
 * @param {number} options.height 画布高度。
 * @param {{id?: string, reverse?: boolean} | null} [options.colormap] 配色选择。
 * @param {string} options.fallbackColor classic 时使用的纯色。
 * @returns {string | CanvasGradient} 可直接赋给 strokeStyle 的值。
 */
export function resolveChartStroke(ctx, { height, colormap, fallbackColor }) {
  if (isClassicColormap(colormap) || !ctx?.createLinearGradient) return fallbackColor;
  const gradient = ctx.createLinearGradient(0, height, 0, 0);
  const stopCount = 6;
  for (let step = 0; step < stopCount; step += 1) {
    const ratio = step / (stopCount - 1);
    const [red, green, blue] = sampleColormapRgb(colormap.id, ratio, colormap);
    gradient.addColorStop(ratio, `rgb(${red} ${green} ${blue})`);
  }
  return gradient;
}

/**
 * 画背景网格。必须在曲线之前调用，否则网格会压在曲线上面。
 *
 * @param {CanvasRenderingContext2D} ctx 画布上下文。
 * @param {object} options 参数。
 * @param {number} options.width 画布宽度。
 * @param {number} options.height 画布高度。
 * @param {Set<string> | string[]} options.overlays 已启用的叠加层。
 * @returns {void}
 */
export function drawChartGrid(ctx, { width, height, overlays }) {
  if (!ctx || !hasOverlay(overlays, 'gridLines')) return;
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([]);
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  for (let row = 1; row < GRID_ROWS; row += 1) {
    const y = (height / GRID_ROWS) * row;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  for (let col = 1; col < GRID_COLS; col += 1) {
    const x = (width / GRID_COLS) * col;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * 画曲线之上的叠加层：坐标刻度、峰值标记、末值数字。
 *
 * 这些全是纯绘制，不碰传入的数组，所以压力统计、采集、回放和导出都不受影响。
 *
 * @param {CanvasRenderingContext2D} ctx 画布上下文。
 * @param {object} options 参数。
 * @param {number} options.width 画布宽度。
 * @param {number} options.height 画布高度。
 * @param {Set<string> | string[]} options.overlays 已启用的叠加层。
 * @param {number[]} options.data 绘制用的高度数组（0 在底边）。
 * @param {number} options.gap 相邻点的横向间距。
 * @param {number[]} options.values 原始数值，用于刻度和末值文字。
 * @param {string} options.color 文字与标记颜色。
 * @returns {void}
 */
export function drawChartDecorations(ctx, {
  width,
  height,
  overlays,
  data,
  gap,
  values,
  color,
}) {
  if (!ctx || !Array.isArray(data) || !data.length) return;
  const showAxes = hasOverlay(overlays, 'axes');
  const showPeak = hasOverlay(overlays, 'peakMarker');
  const showValue = hasOverlay(overlays, 'valueLabels');
  if (!showAxes && !showPeak && !showValue) return;

  ctx.save();
  ctx.setLineDash([]);

  if (showPeak) {
    const peak = findPeakIndex(data);
    // 横坐标沿用 drawChart 的 `gap * (i + 1)` 排布，标记才会落在曲线上。
    const x = gap * (peak + 1);
    const y = height - data[peak];
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  if (showAxes || showValue) {
    const numeric = Array.isArray(values) && values.length ? values : data;
    ctx.font = '11px sans-serif';
    ctx.textBaseline = 'top';
    if (showAxes) {
      ctx.fillStyle = AXIS_TEXT_COLOR;
      ctx.textAlign = 'left';
      ctx.fillText(formatTick(Math.max(...numeric)), 3, 3);
      ctx.textBaseline = 'bottom';
      ctx.fillText(formatTick(Math.min(...numeric)), 3, height - 3);
    }
    if (showValue) {
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(formatTick(numeric[numeric.length - 1]), width - 3, 3);
    }
  }

  ctx.restore();
}

/**
 * 判断某个叠加层是否启用。`Set` 和数组两种写法都接受，
 * 调用方就不必为了这一个判断先转一次类型。
 *
 * @param {Set<string> | string[] | null | undefined} overlays 叠加层集合。
 * @param {string} id 叠加层 id。
 * @returns {boolean} 是否启用。
 */
export function hasOverlay(overlays, id) {
  if (!overlays) return false;
  if (typeof overlays.has === 'function') return overlays.has(id);
  return Array.isArray(overlays) && overlays.includes(id);
}

/**
 * 生成缩略曲线的 SVG path。
 *
 * 三处共用这一份路径数学：公式编辑器里的模板卡片、零件栏里的图表方块，
 * 以及以后任何需要"一小条示意曲线"的地方。自适应缩放到给定画框，
 * 上下各留 4px 免得线贴边被裁掉。
 *
 * @param {number[]} values 数值序列。
 * @param {number} [width] 画框宽度。
 * @param {number} [height] 画框高度。
 * @returns {string} SVG path 的 d 属性；序列为空时返回空串。
 */
export function buildSparklinePath(values, width = 240, height = 68) {
  if (!Array.isArray(values) || !values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const horizontalStep = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((value, index) => {
    const x = index * horizontalStep;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${index ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

/**
 * 把刻度数字压到画布上放得下的长度。
 *
 * @param {number} value 数值。
 * @returns {string} 显示文本。
 */
export function formatTick(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  if (Math.abs(numeric) >= 1000) return String(Math.round(numeric));
  if (Number.isInteger(numeric)) return String(numeric);
  return numeric.toFixed(1);
}
