/**
 * display.canvas 的可选值白名单。
 *
 * 配色的色值实现在前端（client/src/extensions/display-system/colormaps.js），
 * 后端只需要知道合法的 id 和中文名：Builder 的零件栏按这份目录渲染，
 * manifest 校验按同一份目录判断合法性，两边不会各写一套而漂移。
 */

const CANVAS_COLORMAPS = Object.freeze([
  Object.freeze({ id: 'classic', label: '经典蓝红' }),
  Object.freeze({ id: 'thermal', label: '热成像' }),
  Object.freeze({ id: 'viridis', label: 'Viridis' }),
  Object.freeze({ id: 'inferno', label: 'Inferno' }),
  Object.freeze({ id: 'grayscale', label: '灰度' }),
  Object.freeze({ id: 'iceFire', label: '冰火' }),
  // jet 是老 3D 场景一直在用的那条彩虹阶梯（`assets/util/util.js` 的 `jetRgb`），
  // 2026-08-03 才登记成可显式选择的配色。顺序必须与前端 `COLORMAPS` 一致，
  // Builder 的零件栏按这份目录渲染，插在中间会改掉用户的下拉顺序。
  Object.freeze({ id: 'jet', label: '彩虹 Jet' }),
]);

const CANVAS_OVERLAYS = Object.freeze([
  Object.freeze({ id: 'valueLabels', label: '数值标签' }),
  Object.freeze({ id: 'gridLines', label: '网格线' }),
  Object.freeze({ id: 'legend', label: '图例色带' }),
  Object.freeze({ id: 'axes', label: '坐标轴' }),
  Object.freeze({ id: 'peakMarker', label: '最大值标记' }),
]);

/**
 * 图表表面能落地的叠加层，是画布那份的**子集**。
 *
 * 不含 `legend` —— 侧栏那块曲线画布只有 300×150，色带画上去会盖住曲线本身。
 * 前端 `client/src/components/aside/chartAppearance.js` 的 `CHART_OVERLAY_IDS`
 * 已经是这四个，两边必须保持一致：这份目录是 manifest 校验的依据，
 * 那份是绘制时的依据，任一边多一个都会出现"声明了但画不出来"。
 */
const CHART_OVERLAYS = Object.freeze(CANVAS_OVERLAYS.filter((item) => item.id !== 'legend'));

const CANVAS_COLORMAP_IDS = new Set(CANVAS_COLORMAPS.map((item) => item.id));
const CANVAS_OVERLAY_IDS = new Set(CANVAS_OVERLAYS.map((item) => item.id));
const CHART_OVERLAY_IDS = new Set(CHART_OVERLAYS.map((item) => item.id));

/** manifest 能声明的图表卡片数上限，与前端 `FORMULA_CHART_LIMIT` 同值。 */
const DISPLAY_CHART_CARD_LIMIT = 6;

module.exports = {
  CANVAS_COLORMAPS,
  CANVAS_COLORMAP_IDS,
  CANVAS_OVERLAYS,
  CANVAS_OVERLAY_IDS,
  CHART_OVERLAYS,
  CHART_OVERLAY_IDS,
  DISPLAY_CHART_CARD_LIMIT,
};
