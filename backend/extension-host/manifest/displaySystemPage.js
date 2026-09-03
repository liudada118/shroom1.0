const {
  CANVAS_COLORMAP_IDS,
  CANVAS_OVERLAY_IDS,
  CHART_OVERLAY_IDS,
  DISPLAY_CHART_CARD_LIMIT,
} = require('./displaySystemCanvasCatalog');

const DEFAULT_VIEW_SOURCES = Object.freeze({
  heatmap: 'data',
  matrix: 'data',
  raw2d: 'data',
  model: 'data',
  lineChart: 'metrics.totalPressure',
  pressureStats: 'metrics',
});

const DEFAULT_CANVAS_COLORMAP_ID = 'classic';

const DEFAULT_RENDERER_TYPES = Object.freeze(['heatmap', 'matrix', 'raw2d']);
const DEFAULT_VISUALIZATION_ALGORITHM = Object.freeze({
  id: 'identity',
  type: 'identity',
  label: 'Original data',
  options: {},
});
const MATRIX_TRANSFORM_TYPES = Object.freeze(['none', 'interpolate', 'downsample']);

/**
 * 归一矩阵变换声明（插值放大 / 降采样 / 不变）。
 *
 * **本文件所有 normalize 的通则：永不抛错、永远返回可用结构。** 它也跑在读取存量配置的
 * 路径上，一个坏值不该让整个展示系统打不开，只该退回默认外观；报错是
 * `validateDisplayConfig` 在 Builder 保存时的事。
 *
 * ⚠️ 由此有一处**有意的宽严不一**：这里把 factor clamp 到 2..4，而校验器只收 2 或 4 ——
 * factor=3 存不进来但已存在的能跑。**要收紧改校验器，别改这里**，改这里等于让存量配置
 * 打不开。`method` 一律由 type 推出、**忽略 manifest 写的值**（每种变换只有一个实现）。
 * `Number(x) || 默认` 顺带把 0 吃成默认值 —— 放大 0 倍无意义，是想要的行为。
 *
 * @param {*} transform manifest 声明的矩阵变换。
 * @returns {{type: string, factor: number, method: string}} 归一后的变换。
 */
function normalizeMatrixTransform(transform) {
  if (!transform || typeof transform !== 'object' || Array.isArray(transform)) {
    return { type: 'none', factor: 1, method: 'none' };
  }
  const type = MATRIX_TRANSFORM_TYPES.includes(transform.type)
    ? transform.type
    : 'none';
  if (type === 'interpolate') {
    return {
      type,
      factor: Math.max(2, Math.min(4, Number(transform.factor) || 2)),
      method: 'bilinear',
    };
  }
  if (type === 'downsample') {
    return {
      type,
      factor: [0.25, 0.5].includes(Number(transform.factor))
        ? Number(transform.factor)
        : 0.5,
      method: 'average',
    };
  }
  return { type: 'none', factor: 1, method: 'none' };
}

const SIDEBAR_METRIC_IDS = Object.freeze([
  'totalPressure',
  'averagePressure',
  'maxPressure',
  'activePoints',
  'area',
]);
const SAFE_ALGORITHM_METRIC_ID = /^[A-Za-z][A-Za-z0-9._-]*$/;
const AGENT_CHART_ID_PATTERN = /^agent-chart:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/**
 * 判断一个侧栏指标 id 是否合法。
 *
 * 两类合法：内置五项（`SIDEBAR_METRIC_IDS`），或 `algorithm.` 前缀 + 安全标识符。前缀
 * 命名空间保证二开的自定义指标永不与内置撞名（内置不带点，自定义必须带前缀）。
 *
 * ⚠️ `slice(10)` 里的 10 是写死的 `'algorithm.'.length`，**改前缀要连改四处**（本文件
 * `validateDisplayConfig` 里还有三处）。
 *
 * @param {*} id 待判 id。
 * @returns {boolean} 是否为合法侧栏指标 id。
 */
function isSidebarMetricId(id) {
  const value = String(id || '');
  return SIDEBAR_METRIC_IDS.includes(value)
    || (value.startsWith('algorithm.') && SAFE_ALGORITHM_METRIC_ID.test(value.slice(10)));
}

/**
 * 归一算法指标的**声明**（id / 显示名 / 单位 / 小数位）。
 *
 * 声明的是「侧栏显示哪几个、怎么显示」，**不是指标怎么算**（算什么由算法数据文件决定，
 * 见 `displaySystemConfigFileValidator`）。
 *
 * id 不合法的条目**静默丢弃**（归一通则），报错交给校验器。`decimals` clamp 到 0..6 ——
 * 无上界会让前端 `toFixed()` 在 >100 时抛 RangeError。
 *
 * @param {*} metrics manifest 声明的算法指标数组。
 * @returns {Array<{id: string, label: string, unit: string, decimals: number}>} 归一后的声明。
 */
function normalizeAlgorithmMetricDefinitions(metrics) {
  if (!Array.isArray(metrics)) return [];
  return metrics
    .filter((metric) => metric && SAFE_ALGORITHM_METRIC_ID.test(String(metric.id || '')))
    .map((metric) => ({
      id: String(metric.id),
      label: String(metric.label || metric.id),
      unit: String(metric.unit || ''),
      decimals: Math.max(0, Math.min(6, Number(metric.decimals) || 0)),
    }));
}

/**
 * 归一一组指标 id：套用默认值、去掉非法项、去重。
 *
 * ⚠️ `fallback` 在「没声明」**和「声明了空数组」两种情况下都会顶上**，所以
 * **空数组表达不了「这块一个指标都不要」** —— 要隐藏整块请用 `visible: false`。
 * （空数组更常见的来源是配置写漏，顶默认值比显示空白区块好。）
 *
 * `indexOf(id) === index` 是保序去重 —— 指标顺序就是侧栏显示顺序，用 Set 会丢掉。
 *
 * @param {*} metrics manifest 声明的 id 数组。
 * @param {string[]} fallback 未声明或为空时使用的默认 id 列表。
 * @returns {string[]} 去重后的合法 id 列表，保持声明顺序。
 */
function normalizeMetricIds(metrics, fallback) {
  const source = Array.isArray(metrics) && metrics.length ? metrics : fallback;
  return source.map(String).filter((id, index, values) => (
    isSidebarMetricId(id) && values.indexOf(id) === index
  ));
}

/**
 * 归一侧栏配置（压力区 + 面积区）。
 *
 * ⚠️ **本文件唯一一个「没声明返回 null 而不是默认值」的归一函数**：前端把「没有侧栏
 * 配置」和「一份全默认配置」当两种行为（前者走自己的历史默认布局），编个默认值会静默
 * 改掉所有老 manifest 的界面。
 *
 * 三条细节：`visible !== false` 是「缺省可见」（写成 `Boolean(...)` 会让老配置整块消失）；
 * `primaryMetric` 回落链 声明值 → 指标首项 → `'totalPressure'`，不能空（大字主读数）；
 * `threshold`/`pointArea` 夹到非负，负阈值会让所有点都算有效、面积读数失去意义。
 *
 * @param {*} sidebar manifest 声明的侧栏配置。
 * @returns {object|null} 归一后的侧栏配置；未声明时为 null。
 */
function normalizeSidebarConfig(sidebar) {
  if (!sidebar || typeof sidebar !== 'object' || Array.isArray(sidebar)) return null;
  const pressure = sidebar.pressure || {};
  const area = sidebar.area || {};
  const pressureMetrics = normalizeMetricIds(
    pressure.metrics,
    ['averagePressure', 'maxPressure', 'totalPressure'],
  );
  const areaMetrics = normalizeMetricIds(area.metrics, ['activePoints', 'area']);
  const primaryMetric = isSidebarMetricId(pressure.primaryMetric)
    ? pressure.primaryMetric
    : pressureMetrics[0] || 'totalPressure';

  return {
    source: String(sidebar.source || 'sitData'),
    algorithmMetrics: normalizeAlgorithmMetricDefinitions(sidebar.algorithmMetrics),
    pressure: {
      visible: pressure.visible !== false,
      title: String(pressure.title || 'Pressure Data'),
      primaryMetric,
      metrics: pressureMetrics,
    },
    area: {
      visible: area.visible !== false,
      title: String(area.title || 'Pressure Area'),
      threshold: Math.max(0, Number(area.threshold) || 0),
      pointArea: Math.max(0, Number(area.pointArea) || 0),
      unit: String(area.unit || 'cm²'),
      metrics: areaMetrics,
    },
  };
}

/**
 * 归一一个视图/零件声明。
 *
 * 用法：支持**字符串简写**，`"heatmap"` 等价于 `{id, type, label} = 'heatmap'` +
 * `source: 'data'`。`source` 缺省走 `DEFAULT_VIEW_SOURCES`（曲线类读
 * `metrics.totalPressure`、画布类读 `data`），写错的现象是「曲线画的是原始矩阵」。
 *
 * 返回 `{...view, ...}` **保留未知字段**：渲染器自己的选项原样透传到前端 —— 这是渲染器
 * 不改后端就能加参数的关键。
 *
 * ⚠️ 兜底 id（`view-N`）与**位置**绑定：中间插入一个视图会让后面所有未命名视图的 id
 * 位移，引用它们的 profile 随之失配。生产 manifest 应显式写 id。
 *
 * @param {object|string} view manifest 声明的视图。
 * @param {number} index 在数组中的下标，仅用于兜底 id。
 * @returns {object|null} 归一后的视图；形状非法或缺 type 时为 null（调用方 filter 掉）。
 */
function normalizeView(view, index) {
  if (typeof view === 'string') {
    return {
      id: view,
      type: view,
      label: view,
      source: DEFAULT_VIEW_SOURCES[view] || 'data',
    };
  }
  if (!view || typeof view !== 'object' || Array.isArray(view)) return null;
  const type = String(view.type || '').trim();
  const id = String(view.id || type || `view-${index + 1}`).trim();
  if (!type || !id) return null;
  return {
    ...view,
    id,
    type,
    label: String(view.label || id),
    source: String(view.source || DEFAULT_VIEW_SOURCES[type] || 'data'),
  };
}

/**
 * 归一「目录项」——渲染器清单和可视化算法清单共用这一个形状。
 *
 * 与 `normalizeView` 同构，两处差别：① `type` 可回落到 `id`（视图那边不行，视图的 id 与
 * type 经常故意不同，比如同一个 heatmap 开两块）；② `options` **浅拷一份**，否则运行时和
 * 前端持有的就是 manifest 里那个对象、能改到加载结果本身。
 *
 * `fallbackPrefix` 由调用方传（`'renderer'`/`'algorithm'`），免得两张清单都出现 `item-1`。
 *
 * @param {object|string} item manifest 声明的目录项。
 * @param {number} index 数组下标，仅用于兜底 id。
 * @param {string} fallbackPrefix 兜底 id 前缀。
 * @returns {object|null} 归一后的目录项；非法时为 null。
 */
function normalizeCatalogItem(item, index, fallbackPrefix) {
  if (typeof item === 'string') {
    return { id: item, type: item, label: item, options: {} };
  }
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const type = String(item.type || item.id || '').trim();
  const id = String(item.id || type || `${fallbackPrefix}-${index + 1}`).trim();
  if (!id || !type) return null;
  return {
    ...item,
    id,
    type,
    label: String(item.label || id),
    options: item.options && typeof item.options === 'object' ? { ...item.options } : {},
  };
}

/**
 * 归一一个展示预设（把「用哪个渲染器 + 哪个可视化算法 + 显示哪些零件」打成一包）。
 *
 * `visualizationAlgorithm || profile.algorithm` 是**兼容旧字段名** —— 旧名 `algorithm` 与
 * 传感器层的数据算法同名却是两回事，所以改长了；旧名只读不推荐写。
 *
 * `renderer` 故意**没有默认值**（指向哪个渲染器猜不出来），空串由校验器报
 * `references unknown renderer`；`visualizationAlgorithm` 默认 `'identity'` 是安全的。
 *
 * @param {*} profile manifest 声明的预设。
 * @param {number} index 数组下标，仅用于兜底 id。
 * @returns {object|null} 归一后的预设；形状非法时为 null。
 */
function normalizeProfile(profile, index) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null;
  const id = String(profile.id || `profile-${index + 1}`).trim();
  if (!id) return null;
  return {
    ...profile,
    id,
    label: String(profile.label || id),
    renderer: String(profile.renderer || '').trim(),
    visualizationAlgorithm: String(
      profile.visualizationAlgorithm || profile.algorithm || 'identity'
    ).trim(),
    widgets: Array.isArray(profile.widgets)
      ? profile.widgets.map(String).filter(Boolean)
      : [],
  };
}

/**
 * 没声明 renderers 时，从 views/widgets 反推一份渲染器清单。
 *
 * 老 manifest（只写 views、没有 renderers/profiles）的升级路径：把 views 里属于
 * `DEFAULT_RENDERER_TYPES` 的挑出来当渲染器，v1 配置不改一个字也能拿到 v3 结构。
 *
 * ⚠️ **必须保证返回非空**（挑不出来时给 `['heatmap']`）：`normalizeDisplayConfig` 直接取
 * `normalizedRenderers[0].id` 建默认预设，空数组会在那里抛 TypeError。
 *
 * @param {object[]} views 已归一的 views。
 * @param {object[]} widgets 已归一的 widgets。
 * @returns {Array<{id: string, type: string, label: string, options: object}>}
 *          渲染器清单，保证至少一项。
 */
function buildDefaultRenderers(views, widgets) {
  const rendererTypes = [...views, ...widgets]
    .map((item) => item.type)
    .filter((type, index, values) => (
      DEFAULT_RENDERER_TYPES.includes(type) && values.indexOf(type) === index
    ));
  return (rendererTypes.length ? rendererTypes : ['heatmap']).map((type) => ({
    id: type,
    type,
    label: type,
    options: {},
  }));
}

/**
 * 归一 display.canvas。
 *
 * canvas 是可选段：老 manifest 没有它，就用顶层 widgets 反推一份等价配置，
 * 因此 v1/v2/v3 的展示系统都能拿到同一个结构，前端不必再分版本。
 * 未知的配色 id 和叠加层名一律丢弃而不是报错——坏配置只该退回默认外观，
 * 不该把整个展示系统卡死。
 *
 * @param {object} canvas manifest 声明的画布配置。
 * @param {object[]} widgets 已归一的顶层 widgets，作为 canvas.widgets 的回落。
 * @returns {{colormap: object, overlays: string[], widgets: object[]}} 画布配置。
 */
function normalizeCanvasConfig(canvas, widgets) {
  const source = canvas && typeof canvas === 'object' && !Array.isArray(canvas) ? canvas : {};
  const colormapId = typeof source.colormap === 'string'
    ? source.colormap
    : source.colormap?.id;
  const canvasWidgets = (Array.isArray(source.widgets) ? source.widgets : widgets)
    .map(normalizeView)
    .filter(Boolean);
  const seenOverlays = new Set();
  const overlays = (Array.isArray(source.overlays) ? source.overlays : [])
    .map((item) => String(item || ''))
    .filter((item) => {
      if (!CANVAS_OVERLAY_IDS.has(item) || seenOverlays.has(item)) return false;
      seenOverlays.add(item);
      return true;
    });

  return {
    colormap: {
      id: CANVAS_COLORMAP_IDS.has(String(colormapId || ''))
        ? String(colormapId)
        : DEFAULT_CANVAS_COLORMAP_ID,
      reverse: Boolean(typeof source.colormap === 'object' && source.colormap?.reverse),
    },
    overlays,
    widgets: canvasWidgets,
  };
}

/**
 * 归一 display.chartAppearance —— 侧栏曲线的默认外观。
 *
 * 结构和 `normalizeCanvasConfig` 同构，只少一个 `widgets`（曲线没有可拖的零件）。
 * 叠加层按 `CHART_OVERLAY_IDS` 过滤，所以 manifest 里写了 `legend` 也不会漏到
 * 运行时 —— 曲线画布放不下色带。和画布一样：坏值丢弃，不报错。
 *
 * @param {object} chartAppearance manifest 声明的图表外观。
 * @returns {{colormap: object, overlays: string[]}} 图表外观。
 */
function normalizeChartAppearanceConfig(chartAppearance) {
  const source = chartAppearance && typeof chartAppearance === 'object' && !Array.isArray(chartAppearance)
    ? chartAppearance
    : {};
  const colormapId = typeof source.colormap === 'string'
    ? source.colormap
    : source.colormap?.id;
  const seen = new Set();
  const overlays = (Array.isArray(source.overlays) ? source.overlays : [])
    .map((item) => String(item || ''))
    .filter((item) => {
      if (!CHART_OVERLAY_IDS.has(item) || seen.has(item)) return false;
      seen.add(item);
      return true;
    });

  return {
    colormap: {
      id: CANVAS_COLORMAP_IDS.has(String(colormapId || ''))
        ? String(colormapId)
        : DEFAULT_CANVAS_COLORMAP_ID,
      reverse: Boolean(typeof source.colormap === 'object' && source.colormap?.reverse),
    },
    overlays,
  };
}

/**
 * 归一 display.chartCards —— manifest 声明的默认公式图表卡片。
 *
 * **不校验公式本身。** AST 解析器 `formulaChartRuntime.js` 是前端 ESM 模块，
 * 在后端复制一份会立刻变成两份漂移的白名单。这里只要求公式是非空字符串；
 * 真正的关卡是绘制时的 `compileFormulaChartExpression`，它对坏公式返回 0。
 *
 * 每条不带 `id`：运行时播种到 localStorage 时会 stamp 新 id，
 * manifest 里写死 id 只会和用户已有的卡片撞上。
 *
 * @param {object[]} cards manifest 声明的卡片清单。
 * @returns {object[]} 归一后的卡片清单。
 */
function normalizeChartCardsConfig(cards) {
  return (Array.isArray(cards) ? cards : [])
    .filter((card) => card && typeof card === 'object' && (
      String(card.formula || '').trim() || String(card.agentChartId || '').trim()
    ))
    .slice(0, DISPLAY_CHART_CARD_LIMIT)
    .map((card, index) => {
      const templateId = String(card.templateId || card.id || `chart-${index + 1}`);
      const name = String(card.name || card.templateId || card.id || `图表 ${index + 1}`);
      const agentChartId = String(card.agentChartId || '').trim();
      if (agentChartId) {
        return {
          templateId,
          name,
          agentChartId,
          source: String(card.source || ''),
          options: card.options && typeof card.options === 'object' && !Array.isArray(card.options)
            ? { ...card.options }
            : {},
        };
      }
      return {
        templateId,
        name,
        formula: String(card.formula),
        unit: String(card.unit || ''),
        // 缺省 2 位不是 0 位，和前端模板的 `template.decimals ?? 2` 对齐。
        decimals: Math.max(0, Math.min(6, Number(card.decimals ?? 2) || 0)),
        color: String(card.color || ''),
      };
    });
}

/**
 * 归一整个 `display` 段 —— manifest v1/v2/v3 都经这里出成同一个结构。
 *
 * 本文件主入口，前端和运行时只认它的输出，所以**每个字段都有保底值** —— 免得前后端各有
 * 一套默认值慢慢漂移。三条升级链让老 manifest 免改：`widgets` 缺省回落到 `views`、
 * `renderers` 空则走 `buildDefaultRenderers`、`profiles` 空则编一个 `default` 预设。
 *
 * ⚠️ 下游（校验器、前端）**直接取 `[0]`**，依赖这组不变式：`renderers` /
 * `visualizationAlgorithms` / `profiles` 一定非空，`defaultView` / `defaultProfile` 一定
 * 是字符串。而 `views`/`widgets` **可以为空**（纯采集不出图），所以 defaultView 的回落链
 * 末尾还兜了字面量 `'heatmap'`。
 *
 * @param {object} [display={}] manifest 的 display 段。
 * @returns {object} 归一后的展示配置。
 */
function normalizeDisplayConfig(display = {}) {
  const views = (Array.isArray(display.views) ? display.views : [])
    .map(normalizeView)
    .filter(Boolean);
  const widgets = (Array.isArray(display.widgets) ? display.widgets : views)
    .map(normalizeView)
    .filter(Boolean);
  const defaultView = display.defaultView || views[0]?.id || widgets[0]?.id || 'heatmap';
  const renderers = (Array.isArray(display.renderers) ? display.renderers : [])
    .map((item, index) => normalizeCatalogItem(item, index, 'renderer'))
    .filter(Boolean);
  const visualizationAlgorithms = (
    Array.isArray(display.visualizationAlgorithms) ? display.visualizationAlgorithms : []
  )
    .map((item, index) => normalizeCatalogItem(item, index, 'algorithm'))
    .filter(Boolean);
  const normalizedRenderers = renderers.length ? renderers : buildDefaultRenderers(views, widgets);
  const normalizedAlgorithms = visualizationAlgorithms.length
    ? visualizationAlgorithms
    : [{ ...DEFAULT_VISUALIZATION_ALGORITHM }];
  const profiles = (Array.isArray(display.profiles) ? display.profiles : [])
    .map(normalizeProfile)
    .filter(Boolean);
  const normalizedProfiles = profiles.length ? profiles : [{
    id: 'default',
    label: 'Default',
    renderer: normalizedRenderers[0].id,
    visualizationAlgorithm: normalizedAlgorithms[0].id,
    widgets: widgets.map((widget) => widget.id),
  }];
  const defaultProfile = display.defaultProfile || normalizedProfiles[0].id;

  return {
    layout: display.layout || { type: 'grid', columns: 12 },
    matrixTransform: normalizeMatrixTransform(display.matrixTransform),
    views,
    widgets,
    canvas: normalizeCanvasConfig(display.canvas, widgets),
    // 图表外观和卡片清单刻意分成两个字段。`chartAppearance` 对应用户偏好里的
    // `selection.charts`（配色 / 叠加层），`chartCards` 对应另一个存储键里的
    // 卡片清单 —— 合成一个 `display.charts` 会让两种完全不同的东西共用一个名字。
    chartAppearance: normalizeChartAppearanceConfig(display.chartAppearance),
    chartCards: normalizeChartCardsConfig(display.chartCards),
    defaultView,
    controls: display.controls || {},
    sidebar: normalizeSidebarConfig(display.sidebar),
    renderers: normalizedRenderers,
    visualizationAlgorithms: normalizedAlgorithms,
    profiles: normalizedProfiles,
    defaultProfile,
  };
}

/**
 * 检查一组条目的 id 是否唯一，并**把 id 集合返回**。
 *
 * 返回那个集合才是它的主要理由：调用方紧接着用它做交叉引用检查，单独再建一遍就有
 * 「查唯一性的集合」和「查引用的集合」不同步的可能。
 *
 * `errors` 是**传入数组、就地 push**（`validateDisplayConfig` 全程往同一个数组攒，最后
 * 一次性把所有问题报给用户）。重复 id 仍会 `add` 进集合 —— 免得同一个错误再连带引发一条
 * 「引用了不存在的 xxx」。
 *
 * @param {Array<{id: string}>} items 已归一的条目。
 * @param {string} field 用于拼错误信息的字段名。
 * @param {string[]} errors 错误累积数组，会被就地修改。
 * @param {string} source 出错来源（manifest 路径）。
 * @returns {Set<string>} 全部 id 的集合。
 */
function validateUniqueIds(items, field, errors, source) {
  const ids = new Set();
  items.forEach((item) => {
    if (ids.has(item.id)) errors.push(`${source}: duplicate ${field} id ${item.id}`);
    ids.add(item.id);
  });
  return ids;
}

/**
 * 校验 `display` 段，一次性返回所有问题。
 *
 * 与归一函数是**互补的一对**，合起来才达成「Builder 保存时看得见错误、运行时看不见崩溃」。
 * `display == null` 返回空数组（display 段可选，纯采集型系统不出图）。全程只 push
 * 不提前返回 —— 一次把所有问题报全。
 *
 * ⚠️ 本函数的骨架是**「先查原始、后查归一」**，改动时不要打乱：前段形状检查
 * （matrixTransform / sidebar / canvas / chartAppearance / chartCards）看**原始声明**，
 * 因为归一会把坏值吃掉、之后就查不出「用户写错了」；中段 `normalizeDisplayConfig` 之后的
 * 交叉引用检查（预设→渲染器/算法/零件、defaultView→views）必须**针对归一结果**，否则老
 * manifest 会因为「没写 renderers」被判成引用失败。
 *
 * @param {*} display manifest 的 display 段；null/undefined 视为未配置。
 * @param {{source?: string}} [options] 上下文，`source` 用于拼错误信息。
 * @returns {string[]} 错误列表；通过为空数组。
 */
function validateDisplayConfig(display, { source = 'display system manifest' } = {}) {
  if (display == null) return [];
  if (typeof display !== 'object' || Array.isArray(display)) {
    return [`${source}: display must be an object`];
  }

  const errors = [];
  if (display.matrixTransform != null) {
    if (typeof display.matrixTransform !== 'object' || Array.isArray(display.matrixTransform)) {
      errors.push(`${source}: display.matrixTransform must be an object`);
    } else {
      const type = display.matrixTransform.type || 'none';
      const factor = Number(display.matrixTransform.factor ?? 1);
      if (!MATRIX_TRANSFORM_TYPES.includes(type)) {
        errors.push(`${source}: display.matrixTransform.type must be none, interpolate or downsample`);
      } else if (type === 'interpolate' && ![2, 4].includes(factor)) {
        errors.push(`${source}: interpolate matrix factor must be 2 or 4`);
      } else if (type === 'downsample' && ![0.25, 0.5].includes(factor)) {
        errors.push(`${source}: downsample matrix factor must be 0.25 or 0.5`);
      }
    }
  }
  if (display.sidebar != null) {
    if (typeof display.sidebar !== 'object' || Array.isArray(display.sidebar)) {
      errors.push(`${source}: display.sidebar must be an object`);
    } else {
      const pressure = display.sidebar.pressure;
      const area = display.sidebar.area;
      const algorithmMetricIds = new Set();
      if (display.sidebar.algorithmMetrics != null && !Array.isArray(display.sidebar.algorithmMetrics)) {
        errors.push(`${source}: display.sidebar.algorithmMetrics must be an array`);
      }
      (Array.isArray(display.sidebar.algorithmMetrics) ? display.sidebar.algorithmMetrics : [])
        .forEach((metric, index) => {
          if (!metric || !SAFE_ALGORITHM_METRIC_ID.test(String(metric.id || ''))) {
            errors.push(`${source}: display.sidebar.algorithmMetrics[${index}].id is invalid`);
            return;
          }
          if (algorithmMetricIds.has(metric.id)) {
            errors.push(`${source}: duplicate sidebar algorithm metric id ${metric.id}`);
          }
          algorithmMetricIds.add(metric.id);
        });
      [
        ['pressure', pressure],
        ['area', area],
      ].forEach(([section, config]) => {
        if (config?.metrics != null && !Array.isArray(config.metrics)) {
          errors.push(`${source}: display.sidebar.${section}.metrics must be an array`);
        }
        (Array.isArray(config?.metrics) ? config.metrics : []).forEach((metric) => {
          if (!isSidebarMetricId(metric)) {
            errors.push(`${source}: display.sidebar.${section} references unknown metric ${metric}`);
          } else if (
            String(metric).startsWith('algorithm.')
            && !algorithmMetricIds.has(String(metric).slice(10))
          ) {
            errors.push(`${source}: display.sidebar.${section} references undeclared algorithm metric ${metric}`);
          }
        });
      });
      if (pressure?.primaryMetric && !isSidebarMetricId(pressure.primaryMetric)) {
        errors.push(`${source}: display.sidebar.pressure.primaryMetric is unknown`);
      } else if (
        String(pressure?.primaryMetric || '').startsWith('algorithm.')
        && !algorithmMetricIds.has(String(pressure.primaryMetric).slice(10))
      ) {
        errors.push(`${source}: display.sidebar.pressure.primaryMetric references undeclared algorithm metric`);
      }
      if (area?.threshold != null && (!Number.isFinite(Number(area.threshold)) || Number(area.threshold) < 0)) {
        errors.push(`${source}: display.sidebar.area.threshold must be a non-negative number`);
      }
      if (area?.pointArea != null && (!Number.isFinite(Number(area.pointArea)) || Number(area.pointArea) < 0)) {
        errors.push(`${source}: display.sidebar.area.pointArea must be a non-negative number`);
      }
    }
  }
  const normalized = normalizeDisplayConfig(display);
  const ids = new Set();
  normalized.widgets.forEach((widget, index) => {
    if (!widget.type) errors.push(`${source}: display.widgets[${index}].type is required`);
    if (ids.has(widget.id)) errors.push(`${source}: duplicate display widget id ${widget.id}`);
    ids.add(widget.id);
  });
  // display.canvas 是可选段。未知配色/叠加层在归一时已被丢弃，这里对显式写错的值报错，
  // 让 Builder 保存时就能看到问题，而不是保存成功却静默变回默认外观。
  if (display.canvas != null) {
    if (typeof display.canvas !== 'object' || Array.isArray(display.canvas)) {
      errors.push(`${source}: display.canvas must be an object`);
    } else {
      const colormapId = typeof display.canvas.colormap === 'string'
        ? display.canvas.colormap
        : display.canvas.colormap?.id;
      if (colormapId != null && !CANVAS_COLORMAP_IDS.has(String(colormapId))) {
        errors.push(`${source}: display.canvas.colormap.id must be one of ${[...CANVAS_COLORMAP_IDS].join(', ')}`);
      }
      if (display.canvas.overlays != null && !Array.isArray(display.canvas.overlays)) {
        errors.push(`${source}: display.canvas.overlays must be an array`);
      } else {
        (display.canvas.overlays || []).forEach((overlay) => {
          if (!CANVAS_OVERLAY_IDS.has(String(overlay))) {
            errors.push(`${source}: display.canvas.overlays contains unknown overlay ${overlay}`);
          }
        });
      }
      if (display.canvas.widgets != null && !Array.isArray(display.canvas.widgets)) {
        errors.push(`${source}: display.canvas.widgets must be an array`);
      } else {
        const canvasIds = new Set();
        normalized.canvas.widgets.forEach((widget, index) => {
          if (!widget.type) errors.push(`${source}: display.canvas.widgets[${index}].type is required`);
          if (canvasIds.has(widget.id)) {
            errors.push(`${source}: duplicate display canvas widget id ${widget.id}`);
          }
          canvasIds.add(widget.id);
        });
      }
    }
  }
  // display.chartAppearance 和 display.canvas 同一套待遇：归一时丢弃，
  // 显式写错时报错。差别只有一处 —— `legend` 在这块表面上就是非法的。
  if (display.chartAppearance != null) {
    if (typeof display.chartAppearance !== 'object' || Array.isArray(display.chartAppearance)) {
      errors.push(`${source}: display.chartAppearance must be an object`);
    } else {
      const colormapId = typeof display.chartAppearance.colormap === 'string'
        ? display.chartAppearance.colormap
        : display.chartAppearance.colormap?.id;
      if (colormapId != null && !CANVAS_COLORMAP_IDS.has(String(colormapId))) {
        errors.push(`${source}: display.chartAppearance.colormap.id must be one of ${[...CANVAS_COLORMAP_IDS].join(', ')}`);
      }
      if (display.chartAppearance.overlays != null && !Array.isArray(display.chartAppearance.overlays)) {
        errors.push(`${source}: display.chartAppearance.overlays must be an array`);
      } else {
        (display.chartAppearance.overlays || []).forEach((overlay) => {
          if (!CHART_OVERLAY_IDS.has(String(overlay))) {
            errors.push(`${source}: display.chartAppearance.overlays contains unknown overlay ${overlay}`);
          }
        });
      }
    }
  }
  // display.chartCards 只检查形状，**不检查公式的语义** —— 解析器在前端。
  if (display.chartCards != null) {
    if (!Array.isArray(display.chartCards)) {
      errors.push(`${source}: display.chartCards must be an array`);
    } else {
      if (display.chartCards.length > DISPLAY_CHART_CARD_LIMIT) {
        errors.push(`${source}: display.chartCards must contain at most ${DISPLAY_CHART_CARD_LIMIT} cards`);
      }
      const templateIds = new Set();
      display.chartCards.forEach((card, index) => {
        if (!card || typeof card !== 'object' || Array.isArray(card)) {
          errors.push(`${source}: display.chartCards[${index}] must be an object`);
          return;
        }
        const hasFormula = Boolean(String(card.formula || '').trim());
        const agentChartId = String(card.agentChartId || '').trim();
        const hasAgentChart = Boolean(agentChartId);
        if (hasFormula === hasAgentChart) {
          errors.push(`${source}: display.chartCards[${index}] must declare exactly one of formula or agentChartId`);
        }
        if (hasAgentChart && !AGENT_CHART_ID_PATTERN.test(agentChartId)) {
          errors.push(`${source}: display.chartCards[${index}].agentChartId is invalid`);
        }
        if (card.source != null && !String(card.source).trim()) {
          errors.push(`${source}: display.chartCards[${index}].source must be a non-empty string`);
        }
        if (card.options != null && (
          typeof card.options !== 'object' || Array.isArray(card.options)
        )) {
          errors.push(`${source}: display.chartCards[${index}].options must be an object`);
        }
        if (hasFormula && card.decimals != null
          && (!Number.isInteger(Number(card.decimals))
            || Number(card.decimals) < 0
            || Number(card.decimals) > 6)) {
          errors.push(`${source}: display.chartCards[${index}].decimals must be an integer between 0 and 6`);
        }
        const templateId = String(card.templateId || card.id || '');
        if (templateId && templateIds.has(templateId)) {
          errors.push(`${source}: duplicate display chart card templateId ${templateId}`);
        }
        templateIds.add(templateId);
      });
    }
  }
  if (
    normalized.views.length > 0
    && !normalized.views.some((view) => view.id === normalized.defaultView || view.type === normalized.defaultView)
  ) {
    errors.push(`${source}: display.defaultView must reference a configured view`);
  }
  const rendererIds = validateUniqueIds(normalized.renderers, 'display renderer', errors, source);
  const algorithmIds = validateUniqueIds(
    normalized.visualizationAlgorithms,
    'display visualization algorithm',
    errors,
    source,
  );
  const profileIds = validateUniqueIds(normalized.profiles, 'display profile', errors, source);
  normalized.profiles.forEach((profile) => {
    if (!rendererIds.has(profile.renderer)) {
      errors.push(`${source}: display profile ${profile.id} references unknown renderer ${profile.renderer}`);
    }
    if (!algorithmIds.has(profile.visualizationAlgorithm)) {
      errors.push(`${source}: display profile ${profile.id} references unknown visualization algorithm ${profile.visualizationAlgorithm}`);
    }
    profile.widgets.forEach((widgetId) => {
      if (!ids.has(widgetId)) {
        errors.push(`${source}: display profile ${profile.id} references unknown widget ${widgetId}`);
      }
    });
  });
  if (!profileIds.has(normalized.defaultProfile)) {
    errors.push(`${source}: display.defaultProfile must reference a configured profile`);
  }
  return errors;
}

module.exports = {
  DEFAULT_RENDERER_TYPES,
  MATRIX_TRANSFORM_TYPES,
  SIDEBAR_METRIC_IDS,
  isSidebarMetricId,
  normalizeCanvasConfig,
  normalizeChartAppearanceConfig,
  normalizeChartCardsConfig,
  normalizeDisplayConfig,
  normalizeMatrixTransform,
  normalizeSidebarConfig,
  normalizeProfile,
  normalizeView,
  validateDisplayConfig,
};
