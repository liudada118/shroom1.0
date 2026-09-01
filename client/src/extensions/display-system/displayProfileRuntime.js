// 显式带上 .js 后缀：这个模块同时被 backend/tests/sdk 用原生 Node ESM 直接加载，
// 省略后缀只有打包器能解析。
import { DEFAULT_COLORMAP_ID, isKnownColormapId } from './colormaps.js';
import { isAgentRendererId } from './agentRendererBridge.js';

const DATA_RENDERER_TYPES = new Set(['heatmap', 'matrix', 'raw2d']);

/**
 * 画布叠加层白名单。配置器的零件栏和渲染器都从这里取，避免两边各写一份而漂移。
 * 叠加层只影响绘制，不修改 values，所以压力统计、采集和导出都不受影响。
 */
export const OVERLAY_OPTIONS = [
  { id: 'valueLabels', label: '数值标签', description: '在每个点位上显示数值' },
  { id: 'gridLines', label: '网格线', description: '加深单元格之间的分隔' },
  { id: 'legend', label: '图例色带', description: '底部显示配色与最小/最大值' },
  { id: 'axes', label: '坐标轴', description: '标注行号与列号' },
  { id: 'peakMarker', label: '最大值标记', description: '给峰值点加描边环' },
];

const OVERLAY_IDS = new Set(OVERLAY_OPTIONS.map((item) => item.id));

function toNumericValues(values = []) {
  return values.map((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  });
}

function smoothValues(values, matrix, radius = 1) {
  const cols = Math.max(1, Number(matrix?.width || matrix?.cols || Math.sqrt(values.length) || 1));
  const rows = Math.max(1, Number(matrix?.height || matrix?.rows || Math.ceil(values.length / cols)));
  const safeRadius = Math.max(1, Math.min(4, Number(radius) || 1));
  return values.map((_, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    let total = 0;
    let count = 0;
    for (let rowOffset = -safeRadius; rowOffset <= safeRadius; rowOffset += 1) {
      for (let colOffset = -safeRadius; colOffset <= safeRadius; colOffset += 1) {
        const nextRow = row + rowOffset;
        const nextCol = col + colOffset;
        const nextIndex = nextRow * cols + nextCol;
        if (nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols && nextIndex < values.length) {
          total += values[nextIndex];
          count += 1;
        }
      }
    }
    return count ? total / count : values[index];
  });
}

export function applyVisualizationAlgorithm(values = [], algorithm = {}, matrix = {}) {
  const numeric = toNumericValues(values);
  const type = algorithm?.type || algorithm?.id || 'identity';
  const options = algorithm?.options || {};

  if (type === 'normalize') {
    const targetMax = Number(options.max || 100);
    const currentMax = Math.max(0, ...numeric);
    return currentMax > 0 ? numeric.map((value) => (value / currentMax) * targetMax) : numeric;
  }
  if (type === 'threshold') {
    const threshold = Number(options.threshold || 0);
    return numeric.map((value) => (value >= threshold ? value : 0));
  }
  if (type === 'smooth') {
    return smoothValues(numeric, matrix, options.radius);
  }
  return numeric;
}

export function calculatePressureMetrics(values = [], sidebar = {}) {
  const numeric = toNumericValues(values);
  const threshold = Math.max(0, Number(sidebar?.area?.threshold) || 0);
  const pointArea = Math.max(0, Number(sidebar?.area?.pointArea) || 0);
  const totalPressure = numeric.reduce((sum, value) => sum + value, 0);
  const activePoints = numeric.filter((value) => value > threshold).length;
  return {
    totalPressure,
    maxPressure: numeric.length ? Math.max(...numeric) : 0,
    averagePressure: activePoints ? totalPressure / activePoints : 0,
    activePoints,
    area: activePoints * pointArea,
  };
}

function normalizeCatalog(items = [], fallback = []) {
  const source = Array.isArray(items) && items.length ? items : fallback;
  return source.map((item) => (
    typeof item === 'string'
      ? { id: item, type: item, label: item, options: {} }
      : { options: {}, ...item }
  ));
}

/**
 * 归一化配色选择。未知 id 回落到默认方案，坏偏好不该让界面无法出图。
 *
 * @param {object | string} colormap 配色声明。
 * @returns {{id: string, reverse: boolean}} 标准配色选择。
 */
function normalizeColormap(colormap) {
  const id = typeof colormap === 'string' ? colormap : colormap?.id;
  return {
    id: isKnownColormapId(id) ? String(id) : DEFAULT_COLORMAP_ID,
    reverse: Boolean(typeof colormap === 'object' && colormap?.reverse),
  };
}

/**
 * 过滤叠加层，只保留白名单里的值并去重，顺序按声明顺序保持稳定。
 *
 * @param {string[]} overlays 叠加层声明。
 * @returns {string[]} 合法叠加层。
 */
function normalizeOverlays(overlays) {
  if (!Array.isArray(overlays)) return [];
  return overlays
    .map((item) => String(item || ''))
    .filter((item, index, list) => OVERLAY_IDS.has(item) && list.indexOf(item) === index);
}

function normalizeCanvasWidgets(widgets, fallback = []) {
  const source = Array.isArray(widgets) && widgets.length ? widgets : fallback;
  return source.filter((widget) => widget && widget.id);
}

/**
 * 解析画布配置段。canvas 缺省时回落到顶层 widgets，
 * 因此没有 canvas 字段的 v1/v2/v3 manifest 行为与引入前完全一致。
 *
 * @param {object} source 携带 canvas 的对象（page 或 profile 或用户偏好）。
 * @param {object} fallback 上一层已解析的画布配置。
 * @returns {{colormap: object, overlays: string[], widgets: object[]}} 画布配置。
 */
function normalizeCanvas(source, fallback) {
  const canvas = source?.canvas;
  const base = fallback || { colormap: normalizeColormap(null), overlays: [], widgets: [] };
  if (!canvas || typeof canvas !== 'object') return base;
  return {
    colormap: canvas.colormap == null ? base.colormap : normalizeColormap(canvas.colormap),
    overlays: canvas.overlays == null ? base.overlays : normalizeOverlays(canvas.overlays),
    widgets: normalizeCanvasWidgets(canvas.widgets, base.widgets),
  };
}

/**
 * 图表叠加层是画布那份白名单的**子集**，不含 `legend` ——
 * 曲线画布只有 300×150，色带画上去会盖住曲线。
 */
export const CHART_OVERLAY_OPTIONS = OVERLAY_OPTIONS
  .filter((item) => item.id !== 'legend');

const CHART_OVERLAY_IDS = new Set(CHART_OVERLAY_OPTIONS.map((item) => item.id));

function normalizeChartOverlays(overlays) {
  if (!Array.isArray(overlays)) return [];
  return overlays
    .map((item) => String(item || ''))
    .filter((item, index, list) => CHART_OVERLAY_IDS.has(item) && list.indexOf(item) === index);
}

/**
 * 解析图表外观。
 *
 * 图表（Aside 的 Pressure Data / Pressure Area 曲线，以及拖出来的图表卡片）和画布是
 * 两块独立的表面：换画布配色不该顺手把曲线也换掉，所以它们在同一份 selection 里
 * 各占一个字段。返回值故意和画布配置同构（多一个空的 `widgets`），这样能直接喂给
 * 零件栏，不必再写一套零件应用逻辑。
 *
 * 两层覆盖，和 `normalizeCanvas` 同一套写法：**manifest 的 `display.chartAppearance`
 * ＜ 用户偏好 `selection.charts`**，逐字段合并 —— 用户只换了配色时，manifest 声明的
 * 叠加层仍然生效。两层都没声明就是改动前的样子（classic 纯色、无叠加层）。
 *
 * @param {object} [model] `buildDisplayProfileModel` 的结果，提供 manifest 基线层。
 * @param {object} [selection] 用户偏好，即 localStorage 里那份 selection。
 * @returns {{colormap: {id: string, reverse: boolean}, overlays: string[], widgets: object[]}} 图表外观。
 */
export function resolveChartAppearance(model = {}, selection = {}) {
  const base = model?.chartAppearance || { colormap: normalizeColormap(null), overlays: [] };
  const charts = selection?.charts;
  if (!charts || typeof charts !== 'object') {
    return { colormap: base.colormap, overlays: base.overlays, widgets: [] };
  }
  return {
    colormap: charts.colormap == null ? base.colormap : normalizeColormap(charts.colormap),
    overlays: charts.overlays == null ? base.overlays : normalizeChartOverlays(charts.overlays),
    widgets: [],
  };
}

export function buildDisplayProfileModel(page = {}) {
  const widgets = Array.isArray(page.widgets) ? page.widgets : [];
  const viewTypes = (Array.isArray(page.views) ? page.views : [])
    .map((view) => view.type)
    .filter((type, index, values) => DATA_RENDERER_TYPES.has(type) && values.indexOf(type) === index);
  const renderers = normalizeCatalog(page.renderers, (viewTypes.length ? viewTypes : ['heatmap']).map((type) => ({
    id: type,
    type,
    label: type,
  })));
  const visualizationAlgorithms = normalizeCatalog(page.visualizationAlgorithms, [{
    id: 'identity',
    type: 'identity',
    label: '原始数据',
  }]);
  const profiles = Array.isArray(page.profiles) && page.profiles.length
    ? page.profiles
    : [{
      id: 'default',
      label: '默认方案',
      renderer: renderers[0]?.id,
      visualizationAlgorithm: visualizationAlgorithms[0]?.id,
      widgets: widgets.map((widget) => widget.id),
    }];
  const defaultProfile = profiles.some((profile) => profile.id === page.defaultProfile)
    ? page.defaultProfile
    : profiles[0]?.id;
  const canvas = normalizeCanvas(page, {
    colormap: normalizeColormap(null),
    overlays: [],
    widgets: widgets.filter((widget) => widget && widget.id),
  });
  // manifest 声明的图表默认外观。没声明就是 classic 纯色、无叠加层，
  // 也就是引入这个字段之前的样子。
  const chartAppearance = {
    colormap: normalizeColormap(page.chartAppearance?.colormap),
    overlays: normalizeChartOverlays(page.chartAppearance?.overlays),
  };
  return {
    widgets,
    renderers,
    visualizationAlgorithms,
    profiles,
    defaultProfile,
    canvas,
    chartAppearance,
  };
}

export function resolveDisplayProfile(model, selection = {}) {
  const profile = model.profiles.find((item) => item.id === selection.profileId)
    || model.profiles.find((item) => item.id === model.defaultProfile)
    || model.profiles[0]
    || {};
  const rendererId = model.renderers.some((item) => item.id === selection.rendererId)
    ? selection.rendererId
    : profile.renderer || model.renderers[0]?.id;
  const algorithmId = model.visualizationAlgorithms.some((item) => item.id === selection.algorithmId)
    ? selection.algorithmId
    : profile.visualizationAlgorithm || model.visualizationAlgorithms[0]?.id;
  const renderer = model.renderers.find((item) => item.id === rendererId) || model.renderers[0];
  const algorithm = model.visualizationAlgorithms.find((item) => item.id === algorithmId)
    || model.visualizationAlgorithms[0];
  // 画布配置三层覆盖：manifest 顶层 < profile < 用户偏好。
  // 每层只覆盖自己声明的字段，所以只换配色不会把布局一起重置。
  const canvas = normalizeCanvas(
    selection,
    normalizeCanvas(profile, model.canvas),
  );
  const canvasWidgets = canvas.widgets.length ? canvas.widgets : model.widgets;
  const manifestWidgetIds = new Set(model.widgets.map((widget) => widget.id));
  // profile.widgets 的作用是从 manifest 声明里隐藏一部分；
  // 用户后来拖进画布的 widget 不在 manifest 里，它们始终可见。
  const visibleWidgetIds = new Set(
    Array.isArray(profile.widgets) && profile.widgets.length
      ? [
        ...profile.widgets,
        ...canvasWidgets
          .map((widget) => widget.id)
          .filter((id) => !manifestWidgetIds.has(id)),
      ]
      : canvasWidgets.map((widget) => widget.id)
  );
  return {
    profile,
    profileId: profile.id,
    renderer,
    rendererId: renderer?.id,
    algorithm,
    algorithmId: algorithm?.id,
    visibleWidgetIds,
    canvas,
    colormap: canvas.colormap,
    overlays: new Set(canvas.overlays),
    canvasWidgets,
  };
}

export function isDataRendererType(type) {
  return DATA_RENDERER_TYPES.has(type) || isAgentRendererId(type);
}
