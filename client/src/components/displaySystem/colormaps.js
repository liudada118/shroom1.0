/**
 * 压力图配色方案。
 *
 * 引入之前颜色写死在 ManifestDisplayRenderer 的两处（矩阵格背景和坐标点填充），
 * 公式是 `hsl(195 - ratio * 195, 88%, 42% + ratio * 8%)`。这里把它登记成
 * `classic` 并逐字复刻，保证既有展示系统换用本模块后观感零变化；其余方案按
 * 色标插值。sample 返回 CSS 颜色字符串，SVG fill 和 DOM background 都能直接用。
 */

// 走 jetLadder.js 而不是 util.js：本文件会被后端测试用裸 Node ESM 加载
// （backend/tests/sdk/displayProfileRuntime.test.js），import 不了 util.js
// —— 它内部的导入没写扩展名，且顶层就在读 localStorage。详见 jetLadder.js 头部。
import { jetRgb } from '../../assets/util/jetLadder.js';

const CLASSIC_ID = 'classic';

/**
 * 把 ratio 夹到 [0, 1]，非有限值按 0 处理。
 *
 * @param {number} ratio 归一化比例。
 * @returns {number} 合法比例。
 */
function clampRatio(ratio) {
  const numeric = Number(ratio);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 1) return 1;
  return numeric;
}

/**
 * 在色标数组上做线性插值。
 *
 * @param {Array<[number, number, number]>} stops RGB 色标，等距分布。
 * @param {number} ratio 归一化比例。
 * @returns {[number, number, number]} 0-255 的 RGB 三元组。
 */
function interpolateStops(stops, ratio) {
  const position = clampRatio(ratio) * (stops.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.min(stops.length - 1, lowerIndex + 1);
  const weight = position - lowerIndex;
  const lower = stops[lowerIndex];
  const upper = stops[upperIndex];
  const channel = (index) => Math.round(lower[index] + (upper[index] - lower[index]) * weight);
  return [channel(0), channel(1), channel(2)];
}

function buildPreviewCss(sample) {
  const steps = Array.from({ length: 6 }, (_, index) => sample(index / 5));
  return `linear-gradient(90deg, ${steps.join(', ')})`;
}

function createStopColormap(id, label, stops) {
  const sampleRgb = (ratio) => interpolateStops(stops, ratio);
  const sample = (ratio) => {
    const [red, green, blue] = sampleRgb(ratio);
    return `rgb(${red} ${green} ${blue})`;
  };
  return { id, label, sample, sampleRgb, previewCss: buildPreviewCss(sample) };
}

/**
 * classic 的采样函数就是引入本模块之前的硬编码公式，不要改动它的数值。
 */
function sampleClassic(ratio) {
  const safeRatio = clampRatio(ratio);
  const hue = 195 - safeRatio * 195;
  return `hsl(${hue} 88% ${42 + safeRatio * 8}%)`;
}

/**
 * classic 的数值形式。CSS 侧必须继续输出上面那条 hsl 字符串（有断言守着），
 * 所以这里单独把同一组 HSL 参数换算成 RGB，供 WebGL / Canvas 之类只认数值的地方用。
 *
 * @param {number} ratio 归一化比例。
 * @returns {[number, number, number]} 0-255 的 RGB 三元组。
 */
function sampleClassicRgb(ratio) {
  const safeRatio = clampRatio(ratio);
  const hue = (195 - safeRatio * 195) / 360;
  const lightness = (42 + safeRatio * 8) / 100;
  const saturation = 0.88;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = hue * 6;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = lightness - chroma / 2;
  const table = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ];
  const [red, green, blue] = table[Math.min(5, Math.floor(sector))];
  return [
    Math.round((red + base) * 255),
    Math.round((green + base) * 255),
    Math.round((blue + base) * 255),
  ];
}

/**
 * jet 的数值形式。走 `assets/util/util.js` 的 `jetRgb`，也就是全仓那条唯一的
 * 分支阶梯 —— 老场景组件的 `jet()` 出口同样挂在它下面，两处不会漂移。
 *
 * **这里用 `Math.round`，不是老场景那个 `parseInt`。** `jet()` 的取整是
 * `parseInt(255 * r + '')`，撞上科学计数法会出错（`parseInt('7.1e-12') === 7`，
 * 详见 `util.jet.test.js` 里那条锁 bug 的断言）。配色栏是新通路，没有观感要保，
 * 所以从一开始就用正确的取整；差异只在段界附近的 1/255，肉眼无别。
 *
 * @param {number} ratio 归一化比例。
 * @returns {[number, number, number]} 0-255 的 RGB 三元组。
 */
function sampleJetRgb(ratio) {
  const { r, g, b } = jetRgb(0, 1, clampRatio(ratio));
  return [Math.round(255 * r), Math.round(255 * g), Math.round(255 * b)];
}

/**
 * jet 的 CSS 形式。写法与 `createStopColormap` 一致（空格分隔的 `rgb()`），
 * 让「数值通路与 CSS 通路同色」那条断言能逐字比对。
 *
 * @param {number} ratio 归一化比例。
 * @returns {string} CSS 颜色字符串。
 */
function sampleJet(ratio) {
  const [red, green, blue] = sampleJetRgb(ratio);
  return `rgb(${red} ${green} ${blue})`;
}

export const COLORMAPS = [
  {
    id: CLASSIC_ID,
    label: '经典蓝红',
    sample: sampleClassic,
    sampleRgb: sampleClassicRgb,
    previewCss: buildPreviewCss(sampleClassic),
  },
  createStopColormap('thermal', '热成像', [
    [8, 8, 20], [120, 20, 90], [220, 50, 40], [250, 160, 30], [255, 255, 220],
  ]),
  createStopColormap('viridis', 'Viridis', [
    [68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37],
  ]),
  createStopColormap('inferno', 'Inferno', [
    [0, 0, 4], [87, 16, 110], [188, 55, 84], [249, 142, 9], [252, 255, 164],
  ]),
  createStopColormap('grayscale', '灰度', [
    [24, 24, 24], [128, 128, 128], [245, 245, 245],
  ]),
  createStopColormap('iceFire', '冰火', [
    [24, 90, 190], [130, 190, 235], [245, 245, 245], [240, 150, 80], [200, 40, 40],
  ]),
  // jet 不是插值色标，是一条四段折线公式，所以不走 createStopColormap。
  // 它是全仓 18 处老配色用的那条阶梯，登记进来之后画布配置器和 manifest
  // 渲染器第一次能显式选到它 —— 在此之前 jet 只能通过「不选配色」隐式命中。
  {
    id: 'jet',
    label: '彩虹 Jet',
    sample: sampleJet,
    sampleRgb: sampleJetRgb,
    previewCss: buildPreviewCss(sampleJet),
  },
];

const COLORMAP_BY_ID = new Map(COLORMAPS.map((item) => [item.id, item]));

export const DEFAULT_COLORMAP_ID = CLASSIC_ID;

/**
 * 按 id 取配色方案，未知 id 回落到 classic，避免坏配置让整张图无法上色。
 *
 * @param {string} id 配色方案 id。
 * @returns {{id: string, label: string, sample: Function, previewCss: string}} 配色方案。
 */
export function getColormap(id) {
  return COLORMAP_BY_ID.get(String(id || '')) || COLORMAP_BY_ID.get(CLASSIC_ID);
}

export function isKnownColormapId(id) {
  return COLORMAP_BY_ID.has(String(id || ''));
}

/**
 * 判断一份配色选择是否等于"改动前的样子"。
 *
 * 3D 场景组件（`NumThreeColor1024`、`hand`）的 classic 通路不是本模块的 hsl 公式，
 * 而是各自原有的 `jet()`。这些组件必须能在循环外一次性判断"要不要走原来那条分支"，
 * 让老展示系统的观感逐字不变。规则收在这里，避免每个场景各写一遍 `id === 'classic'`。
 *
 * @param {{id?: string} | string | null | undefined} colormap 配色选择。
 * @returns {boolean} 不传、没有 id、或 id 就是 classic 时为 true。
 */
export function isClassicColormap(colormap) {
  const id = typeof colormap === 'string' ? colormap : colormap?.id;
  return !id || id === CLASSIC_ID;
}

/**
 * 采样一个颜色。
 *
 * @param {string} id 配色方案 id。
 * @param {number} ratio 归一化比例。
 * @param {{reverse?: boolean}} [options] 是否反向取色。
 * @returns {string} CSS 颜色字符串。
 */
export function sampleColormap(id, ratio, options = {}) {
  const colormap = getColormap(id);
  const safeRatio = clampRatio(ratio);
  return colormap.sample(options?.reverse ? 1 - safeRatio : safeRatio);
}

/**
 * 采样成数值 RGB。WebGL、Canvas 2D 这类只接受数值的渲染路径用这个，
 * 与 `sampleColormap` 取的是同一条色带，两处不会漂移。
 *
 * @param {string} id 配色方案 id。
 * @param {number} ratio 归一化比例。
 * @param {{reverse?: boolean}} [options] 是否反向取色。
 * @returns {[number, number, number]} 0-255 的 RGB 三元组。
 */
export function sampleColormapRgb(id, ratio, options = {}) {
  const colormap = getColormap(id);
  const safeRatio = clampRatio(ratio);
  return colormap.sampleRgb(options?.reverse ? 1 - safeRatio : safeRatio);
}

/**
 * 取预览用的渐变。reverse 时把渐变方向翻过来，色卡与实际出图一致。
 *
 * @param {string} id 配色方案 id。
 * @param {{reverse?: boolean}} [options] 是否反向。
 * @returns {string} CSS linear-gradient。
 */
export function colormapPreviewCss(id, options = {}) {
  const colormap = getColormap(id);
  return options?.reverse
    ? colormap.previewCss.replace('90deg', '270deg')
    : colormap.previewCss;
}
