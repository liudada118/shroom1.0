/**
 * params.js - 数字矩阵渲染器（numMatrix）参数 schema
 *
 * 参数维度不是设计出来的，是从 `components/three/` 那三份 NumThreeColor
 * 逐行比对提炼的。比对结论比预想的乐观得多：
 *
 * **三份的布局公式与格子尺寸是代数等价的**，不是三套算法。
 *
 * | 文件 | 原写法 | 化简 |
 * | :--- | :--- | :--- |
 * | `NumThreeColor copy`（size=4，grid 16） | `(x - (32/size - 0.5)) / 32 * size` | `(x - 7.5) × 0.125` |
 * | `NumThreeColor1024`（通用） | `(x - (gw-1)/2) * worldCellSize` | 同上（gw=16 时） |
 * | `NumThreeColor1024sit`（grid 23） | `(x - (23/2 - 0.5)) / (23/2)` | `(x - 11) × 2/23` |
 *
 * 通用式 `(x - (gw-1)/2) * 2/max(gw,gh)` 三份都满足。格子尺寸同理：
 * `0.032*size` = `2.048/gridSize` = `worldCellSize * 1.024`，三份逐位相同。
 * 逐点验算见 `pipeline.test.js`。
 *
 * 所以真正的差异只剩五个开关（画布高度比例、分压、纹理是否跟随阈值、
 * 有没有缩放拖拽、阈值对象是否共享），这就是下面这份 schema 的全部内容。
 */

/** 一格精灵图的边长（像素）。三份原实现都写死 32，纹理尺寸由它乘格数得出。 */
export const TEXTURE_CELL_SIZE = 32;

/**
 * 参数取值范围，用于 Builder 表单校验与用户输入兜底。
 *
 * 上界防的是误填导致实例数爆炸：gridWidth × gridHeight 直接是 InstancedMesh
 * 的实例数，而每个实例每帧都要写 uvOffset 与 instanceColor。
 */
export const PARAM_RANGES = {
  size: { min: 1, max: 64 },
  gridWidth: { min: 0, max: 256 },
  gridHeight: { min: 0, max: 256 },
  textureValueMax: { min: 0, max: 4095 },
  decimalScale: { min: 1, max: 100 },
  chartWindow: { min: 2, max: 600 },
  chartPadding: { min: 0, max: 100000 },
  pressureRows: { min: 1, max: 256 },
  pressureCols: { min: 1, max: 256 },
};

/** 画布边长占视口高度的比例。`compact` 用于 <750px 的小屏。 */
const DEFAULT_CANVAS_HEIGHT_RATIO = { compact: 0.6, normal: 0.8 };

function clampNumber(value, fallback, range) {
  // null / undefined / 空串一律视为「未提供」而非 0：Number('') === 0 且有限，
  // 不先拦掉的话缺省字段会被夹到 range.min 而不是回落默认值。
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < range.min) return range.min;
  if (parsed > range.max) return range.max;
  return parsed;
}

function clampInteger(value, fallback, range) {
  const parsed = clampNumber(value, fallback, range);
  return Math.round(parsed);
}

function normalizeBoolean(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  return value !== false && value !== 'false' && value !== 0;
}

function normalizeRatio(ratio = {}, defaults = DEFAULT_CANVAS_HEIGHT_RATIO) {
  const range = { min: 0.1, max: 1 };
  return {
    compact: clampNumber(ratio.compact, defaults.compact, range),
    normal: clampNumber(ratio.normal, defaults.normal, range),
  };
}

/**
 * 归一化分压重分配设置。
 *
 * 只有 `NumThreeColor1024sit` 启用它（`press(ndata1, 23, 23, valuep, valueprop, 'col')`），
 * 另外两份把这段注释掉了。enabled 为假时 rows/cols 仍然归一化，避免用户先填了
 * 尺寸再打开开关时读到 0。
 *
 * @param {object} redistribution 原始设置。
 * @returns {{enabled: boolean, rows: number, cols: number, axis: string}} 归一化结果。
 */
function normalizePressureRedistribution(redistribution = {}) {
  return {
    enabled: normalizeBoolean(redistribution.enabled, false),
    rows: clampInteger(redistribution.rows, 23, PARAM_RANGES.pressureRows),
    cols: clampInteger(redistribution.cols, 23, PARAM_RANGES.pressureCols),
    axis: redistribution.axis === 'row' ? 'row' : 'col',
  };
}

/**
 * 归一化数字矩阵渲染器参数。
 *
 * 任何非法输入都退回默认值而非抛错：用户手写的 manifest 参数不全时应当
 * 降级渲染，而不是让整个模块加载失败。
 *
 * @param {object} params manifest 中的 display.renderers[].params。
 * @returns {object} 归一化后的完整参数。
 */
/**
 * 已实现的后端。
 *
 * 计划里的另两个后端（`canvas2d` = `num/NumWs.jsx`、`webgl` =
 * `num/Num2D.jsx` + `Num2Doriginal.jsx`）还没搬过来，所以这里只有一个。
 * 填了未知值会退回 `sprite3d` 而不是报错 —— 二开的人手写 manifest 拼错
 * 后端名时，看到画面出来了比看到白屏更容易发现自己写错了。
 */
export const BACKENDS = ['sprite3d'];

export function normalizeNumMatrixParams(params = {}) {
  return {
    /** 画法。见 `BACKENDS`。 */
    backend: BACKENDS.includes(params.backend) ? params.backend : 'sprite3d',
    /** 格子放大倍率。gridWidth/gridHeight 为 0 时用 64/size 推导网格。 */
    size: clampInteger(params.size, 2, PARAM_RANGES.size),
    /** 显式网格宽高；0 表示「由 size 推导」，对应原实现的 `64 / size`。 */
    gridWidth: clampInteger(params.gridWidth, 0, PARAM_RANGES.gridWidth),
    gridHeight: clampInteger(params.gridHeight, 0, PARAM_RANGES.gridHeight),
    canvasHeightRatio: normalizeRatio(params.canvasHeightRatio),
    /**
     * 精灵图覆盖的最大数值。0 表示自动：>255 时按 32 列铺，否则 16×16 的 256 格。
     *
     * **缺省就该是 0。** 原实现的三份文件都没有调用方传这一项，走的是
     * `decimalScale > 1 ? valuej1 * decimalScale : 255` 这条动态推导，
     * 拖 `valuej` 会重烘纹理。这里留出显式覆盖只为让 manifest 能锁死量程
     * （数据范围已知时省掉重烘），不是给内置预设用的。
     */
    textureValueMax: clampInteger(params.textureValueMax, 0, PARAM_RANGES.textureValueMax),
    /** 定点小数倍率。10 表示数据是放大 10 倍的定点数，显示时除回去并保留一位。 */
    decimalScale: clampInteger(params.decimalScale, 1, PARAM_RANGES.decimalScale),
    pressureRedistribution: normalizePressureRedistribution(params.pressureRedistribution),
    /**
     * 阈值（valuej）变化时是否重烘精灵图。
     * `NumThreeColor1024sit` 是唯一不重烘的 —— 它的纹理写死 `jet(0, 30)`，
     * 拖颜色滑块画面不动。照抄这个行为，要不要修单独决定。
     */
    retintOnThresholdChange: normalizeBoolean(params.retintOnThresholdChange, true),
    /** 是否装滚轮缩放与拖拽平移。`NumThreeColor1024sit` 没装。 */
    cameraControls: normalizeBoolean(params.cameraControls, true),
    /** 侧栏滚动曲线的窗口长度。三份原实现都是 20（不是别处那 8 份的 60）。 */
    chartWindow: clampInteger(params.chartWindow, 20, PARAM_RANGES.chartWindow),
    /** 曲线 Y 轴留白。12 位传感器用 5，其余 1000。 */
    chartPadding: clampInteger(params.chartPadding, 1000, PARAM_RANGES.chartPadding),
    /** 侧栏「合力」读数取和还是取最大值。smallBed12B 取最大值。 */
    totalMetric: params.totalMetric === 'max' ? 'max' : 'sum',
    /** 是否由本渲染器回写侧栏统计。minzhen 那路由外层接管。 */
    manageSidebar: normalizeBoolean(params.manageSidebar, true),
    /**
     * 共享阈值对象的键。非空时不建实例私有阈值，改用那个模块级单例
     * —— Fast256 与 Bed4096 靠这个做到「切换模式时调参不重置」。
     */
    sharedTuningKey: params.sharedTuningKey ? String(params.sharedTuningKey) : null,
  };
}

/**
 * 推导实际渲染网格。
 *
 * 公式取自 `NumThreeColor1024.jsx:54-55`，逐字保留：显式宽高优先，
 * 否则 `64 / size`。
 *
 * @param {object} config 归一化后的参数。
 * @returns {{gridWidth: number, gridHeight: number, count: number}} 网格尺寸。
 */
export function deriveGrid(config) {
  const gridWidth = config.gridWidth > 0 ? config.gridWidth : 64 / config.size;
  const gridHeight = config.gridHeight > 0 ? config.gridHeight : 64 / config.size;
  return { gridWidth, gridHeight, count: gridWidth * gridHeight };
}

/**
 * 从 manifest 的 sensor 段推导参数。
 *
 * 用户在 Builder 里填过矩阵尺寸后，渲染器参数自动带出来，不必再填一遍。
 * 显式配置的 params 优先。
 *
 * @param {object} sensor manifest 的 sensor 段。
 * @param {object} params 用户显式配置的渲染器参数。
 * @returns {object} 归一化后的完整参数。
 */
export function paramsFromManifest(sensor = {}, params = {}) {
  const matrix = sensor.matrix || {};
  return normalizeNumMatrixParams({
    gridWidth: matrix.cols,
    gridHeight: matrix.rows,
    ...params,
  });
}

/**
 * 现有场景组件对应的参数预设。
 *
 * 这三组数字直接抄自三份 NumThreeColor 的常量区，是参数化前后逐帧
 * 一致性验证的基准。**下拉框文案与后端的对应关系反直觉，写在这里备查**：
 *
 * | 下拉框 | 走的组件 | 本预设 |
 * | :--- | :--- | :--- |
 * | 原始数据 `numoriginal` | `NumThreeColor*`（真 three.js 精灵图） | 本文件三条 |
 * | 3D数据 `num3D` | `num/NumWs.jsx`（2D canvas + CSS 透视，**不是** WebGL） | 待接 canvas2d 后端 |
 */
export const LEGACY_PRESETS = {
  /** `three/NumThreeColor copy.jsx` —— Home.jsx 里的 Fast256，16×16。 */
  fast256: {
    size: 4,
    canvasHeightRatio: { compact: 0.6, normal: 0.8 },
    sharedTuningKey: 'bed4096',
  },
  /** `three/NumThreeColor1024.jsx` —— Fast1024，矩阵尺寸由 manifest 决定。 */
  fast1024: {
    size: 2,
  },
  /** `three/NumThreeColor1024sit.jsx` —— Fast1024sit，23×23，带分压，无缩放。 */
  fast1024sit: {
    size: 2,
    gridWidth: 23,
    gridHeight: 23,
    canvasHeightRatio: { compact: 0.5, normal: 0.65 },
    pressureRedistribution: { enabled: true, rows: 23, cols: 23, axis: 'col' },
    retintOnThresholdChange: false,
    cameraControls: false,
  },
  /**
   * 12 位小床垫：定点数除 10 显示，合力读数取最大值。
   *
   * **不设 `textureValueMax`。** 原实现的式子是
   * `props.textureValueMax || (decimalScale > 1 ? valuej1 * decimalScale : 255)`，
   * 而全仓没有任何调用方传过 `textureValueMax` —— 所以它走的一直是右边那支
   * （默认 200×10 = 2000），且 `valuej` 变化时会跟着重烘纹理。写死一个常量会
   * 改掉 `classicTint` 的分母，是看得出来的配色变化。
   */
  smallBed12B: {
    size: 2,
    decimalScale: 10,
    chartPadding: 5,
    totalMetric: 'max',
  },
};
