import { COLORMAPS, colormapPreviewCss } from '../colormaps';
import { OVERLAY_OPTIONS } from '../displayProfileRuntime';

export const PART_DRAG_TYPE = 'application/x-display-part';

export const PART_CATEGORIES = [
  { id: 'colormap', label: '配色方案', hint: '拖一张色卡到画布，整张压力图立刻换色' },
  { id: 'overlay', label: '叠加层', hint: '拖到画布上叠加显示元素，拖出画布移除' },
  { id: 'widget', label: '画布组件', hint: '拖到画布上新增卡片，拖出画布删除' },
  { id: 'chartColormap', label: '图表配色', hint: '给侧栏的压力曲线换色，纯色变纵向渐变' },
  { id: 'chartOverlay', label: '图表叠加层', hint: '给压力曲线加网格、刻度和峰值标记；再拖一次移除' },
  { id: 'chartWidget', label: '图表卡片', hint: '拖一张图表到页面，侧栏立刻多一张实时曲线；把卡片拖回这里删除' },
];

/**
 * 图表零件到画布零件的语义映射。
 *
 * 图表和画布是两块独立表面，但零件语义完全一样（配色是替换、叠加层是开关），
 * 所以不另写一套 apply 逻辑，只把 kind 换回基础形式后复用 `applyCanvasPart`。
 */
const CHART_PART_BASE_KINDS = {
  chartColormap: 'colormap',
  chartOverlay: 'overlay',
};

/**
 * 可以拖进画布的组件类型。渲染器插件通过 rendererCatalog 传入，
 * 这里不直接依赖 renderers/registry，配置器在没有插件时也能工作。
 */
const BUILTIN_WIDGET_PARTS = [
  { id: 'heatmap', label: '热力图', type: 'heatmap', columnSpan: 8, icon: '▦' },
  { id: 'matrix', label: '数字矩阵', type: 'matrix', columnSpan: 8, icon: '⊞' },
  { id: 'raw2d', label: '原始二维', type: 'raw2d', columnSpan: 8, icon: '⊟' },
  { id: 'pressureStats', label: '压力统计', type: 'pressureStats', columnSpan: 4, icon: '∑' },
];

const OVERLAY_ICONS = {
  valueLabels: '12',
  gridLines: '#',
  legend: '▭',
  axes: '⌐',
  peakMarker: '◎',
};

/**
 * 生成零件栏的三类零件清单。
 *
 * @param {object} [options] 生成参数。
 * @param {Array<{id: string, label: string, type?: string}>} [options.renderers]
 *        catalog 或 manifest 声明的渲染器，用来把插件渲染器也列成可拖零件。
 * @param {string[]} [options.colormapIds] 后端 catalog 允许的配色 id，缺省时用全部内置方案。
 * @param {string[]} [options.overlayIds] 只列这几个叠加层。主界面的 3D 场景只认图例，
 *        用它把渲染不出来的叠加层从零件栏里去掉，而不是让用户拖一个没效果的方块。
 * @param {string[]} [options.chartOverlayIds] 图表能落地的叠加层，缺省时不列图表类别。
 * @param {Array<{id: string, name: string, description?: string, preview?: number[]}>} [options.chartTemplates]
 *        可以拖出来的图表卡片模板。由调用方注入（和 `renderers` 一个套路），
 *        所以这个模块不反向依赖 `components/aside/`；不传就一张卡片零件都不列。
 * @returns {{colormap: object[], overlay: object[], widget: object[], chartColormap: object[], chartOverlay: object[], chartWidget: object[]}}
 *          按类别分组的零件。
 */
export function buildCanvasParts({
  renderers = [],
  colormapIds = null,
  overlayIds = null,
  chartOverlayIds = null,
  chartTemplates = null,
} = {}) {
  const allowedColormaps = Array.isArray(colormapIds) && colormapIds.length
    ? COLORMAPS.filter((item) => colormapIds.includes(item.id))
    : COLORMAPS;
  const colormapParts = (allowedColormaps.length ? allowedColormaps : COLORMAPS).map((item) => ({
    kind: 'colormap',
    id: item.id,
    label: item.label,
    previewCss: colormapPreviewCss(item.id),
  }));

  const allowedOverlays = Array.isArray(overlayIds) && overlayIds.length
    ? OVERLAY_OPTIONS.filter((item) => overlayIds.includes(item.id))
    : OVERLAY_OPTIONS;
  const overlayParts = (allowedOverlays.length ? allowedOverlays : OVERLAY_OPTIONS).map((item) => ({
    kind: 'overlay',
    id: item.id,
    label: item.label,
    description: item.description,
    icon: OVERLAY_ICONS[item.id] || '＋',
  }));

  // 插件渲染器排在内置类型之后；重名以内置为准，避免同一个 type 出现两块方块。
  const builtinTypes = new Set(BUILTIN_WIDGET_PARTS.map((item) => item.type));
  const pluginParts = renderers
    .filter((renderer) => renderer?.id && !builtinTypes.has(renderer.type || renderer.id))
    .map((renderer) => ({
      kind: 'widget',
      id: renderer.type || renderer.id,
      type: renderer.type || renderer.id,
      label: renderer.label || renderer.id,
      columnSpan: 8,
      icon: '◈',
    }));

  // 图表零件用同一份配色和叠加层清单，只换 kind —— 两块表面的可选项本来就该
  // 是同一套，用户不必学两遍。chartOverlayIds 不传就一个都不列，调用方没接
  // 图表表面时零件栏里就不会出现空类别。
  const chartOverlayParts = Array.isArray(chartOverlayIds) && chartOverlayIds.length
    ? OVERLAY_OPTIONS
      .filter((item) => chartOverlayIds.includes(item.id))
      .map((item) => ({
        kind: 'chartOverlay',
        id: item.id,
        label: item.label,
        description: item.description,
        icon: OVERLAY_ICONS[item.id] || '＋',
      }))
    : [];

  // 图表卡片零件：拖一个出来侧栏就多一张实时曲线。这类零件不是值变换
  // （见 partSurface 的说明），方块上带一条模板自带的缩略曲线当预览。
  const chartWidgetParts = (Array.isArray(chartTemplates) ? chartTemplates : [])
    .filter((template) => template?.id)
    .map((template) => ({
      kind: 'chartWidget',
      id: template.id,
      label: template.name || template.id,
      description: template.description,
      previewPoints: Array.isArray(template.preview) ? template.preview : null,
    }));

  return {
    colormap: colormapParts,
    overlay: overlayParts,
    widget: [...BUILTIN_WIDGET_PARTS.map((item) => ({ kind: 'widget', ...item })), ...pluginParts],
    chartColormap: chartOverlayParts.length
      ? colormapParts.map((item) => ({ ...item, kind: 'chartColormap' }))
      : [],
    chartOverlay: chartOverlayParts,
    chartWidget: chartWidgetParts,
  };
}

/**
 * 判断一个零件作用在哪块表面上。
 *
 * `chartWidget` 是第三块表面，和另外两块的性质不一样：配色和叠加层是**纯值变换**
 * （改的是同一个 `display-profile:<id>` 键里的字段），而"加一张图表卡片"写的是
 * 另一个 localStorage 键（`shroom.formulaCharts.v1.<matrixName>`）。硬塞进画布或
 * 图表配置里会造出两套真相，所以它不走 `applySurfacePart`，由调用方给回调处理。
 *
 * @param {{kind?: string} | null | undefined} part 零件描述。
 * @returns {'chart' | 'chartWidget' | 'canvas'} 表面名。
 */
export function partSurface(part) {
  if (part?.kind === 'chartWidget') return 'chartWidget';
  return CHART_PART_BASE_KINDS[part?.kind] ? 'chart' : 'canvas';
}

/**
 * 把零件应用到它所属表面的配置上。图表零件先换回基础 kind 再走同一段逻辑。
 *
 * `chartWidget` 不是值变换，这里必须原样返回 —— 它一旦被当成 widget 追加进
 * `canvas.widgets`，画布上就会多出一个没人渲染的卡片。
 *
 * @param {object} value 该表面当前的配置（与画布配置同构）。
 * @param {{kind: string, id: string}} part 零件描述。
 * @returns {object} 新配置；零件无法识别时原样返回。
 */
export function applySurfacePart(value, part) {
  if (part?.kind === 'chartWidget') return value;
  const baseKind = CHART_PART_BASE_KINDS[part?.kind];
  return applyCanvasPart(value, baseKind ? { ...part, kind: baseKind } : part);
}

/**
 * 判断零件在它所属表面上是否已经生效，用来给零件方块加高亮。
 *
 * @param {object} value 该表面当前的配置。
 * @param {{kind: string, id: string}} part 零件描述。
 * @returns {boolean} 是否生效。
 */
export function isSurfacePartActive(value, part) {
  if (part?.kind === 'chartWidget') return false;
  const baseKind = CHART_PART_BASE_KINDS[part?.kind];
  return isCanvasPartActive(value, baseKind ? { ...part, kind: baseKind } : part);
}

/**
 * 为新拖入的 widget 生成不冲突的 id。
 *
 * @param {string} type widget 类型。
 * @param {object[]} widgets 画布上已有的 widget。
 * @returns {string} 新 id。
 */
export function createWidgetId(type, widgets = []) {
  const used = new Set(widgets.map((widget) => widget.id));
  if (!used.has(type)) return type;
  let index = 2;
  while (used.has(`${type}-${index}`)) index += 1;
  return `${type}-${index}`;
}

/**
 * 把零件转成画布 widget。source 沿用画布上第一个 widget 的通道，
 * 单传感器系统就不必再手填一次；画布为空时回落到 sitData。
 *
 * @param {object} part widget 零件。
 * @param {object[]} widgets 画布上已有的 widget。
 * @returns {object} 新 widget。
 */
export function createWidgetFromPart(part, widgets = []) {
  return {
    id: createWidgetId(part.type || part.id, widgets),
    type: part.type || part.id,
    label: part.label || part.id,
    source: widgets[0]?.source || 'sitData',
    columnSpan: part.columnSpan || 8,
  };
}

/**
 * 把一个零件应用到画布上。三类零件语义不同：
 * 配色是替换，叠加层是开关，画布组件是追加。
 *
 * 这是纯函数而不是组件内的闭包，拖放和点击两条通路走同一段逻辑，
 * 测试也不需要 DOM。
 *
 * @param {{colormap?: object, overlays?: string[], widgets?: object[]}} canvas 当前画布配置。
 * @param {{kind: string, id: string, type?: string}} part 零件描述。
 * @returns {object} 新的画布配置；零件无法识别时原样返回。
 */
export function applyCanvasPart(canvas, part) {
  if (!canvas || !part) return canvas;
  if (part.kind === 'colormap') {
    return { ...canvas, colormap: { ...canvas.colormap, id: part.id } };
  }
  if (part.kind === 'overlay') {
    const overlays = canvas.overlays || [];
    return {
      ...canvas,
      overlays: overlays.includes(part.id)
        ? overlays.filter((item) => item !== part.id)
        : [...overlays, part.id],
    };
  }
  if (part.kind === 'widget') {
    const widgets = canvas.widgets || [];
    return { ...canvas, widgets: [...widgets, createWidgetFromPart(part, widgets)] };
  }
  return canvas;
}

/**
 * 从画布上移除一个 widget。
 *
 * @param {object} canvas 当前画布配置。
 * @param {string} widgetId 要移除的 widget id。
 * @returns {object} 新的画布配置。
 */
export function removeCanvasWidget(canvas, widgetId) {
  if (!canvas) return canvas;
  return {
    ...canvas,
    widgets: (canvas.widgets || []).filter((widget) => widget.id !== widgetId),
  };
}

/**
 * 把一个 widget 移到目标 widget 的位置上，实现换序。
 *
 * @param {object} canvas 当前画布配置。
 * @param {string} sourceId 被拖动的 widget id。
 * @param {string} targetId 落点 widget id。
 * @returns {object} 新的画布配置；任一 id 不存在时原样返回。
 */
export function moveCanvasWidget(canvas, sourceId, targetId) {
  if (!canvas || sourceId === targetId) return canvas;
  const widgets = canvas.widgets || [];
  const sourceIndex = widgets.findIndex((widget) => widget.id === sourceId);
  const targetIndex = widgets.findIndex((widget) => widget.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return canvas;
  const next = [...widgets];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return { ...canvas, widgets: next };
}

/**
 * 判断零件在当前画布上是否已经生效，用来给零件方块加高亮。
 *
 * @param {object} canvas 当前画布配置。
 * @param {object} part 零件描述。
 * @returns {boolean} 是否生效。
 */
export function isCanvasPartActive(canvas, part) {
  if (!canvas || !part) return false;
  if (part.kind === 'colormap') return canvas.colormap?.id === part.id;
  if (part.kind === 'overlay') return (canvas.overlays || []).includes(part.id);
  return (canvas.widgets || []).some((widget) => widget.type === (part.type || part.id));
}
