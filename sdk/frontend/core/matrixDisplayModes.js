import {
  LEGACY_PRESETS as BLOB_HEATMAP_PRESETS,
  normalizeBlobHeatmapParams,
} from '../renderers/blobHeatmap/core/params.js';
import {
  LEGACY_PRESETS as NUM_MATRIX_PRESETS,
  normalizeNumMatrixParams,
} from '../renderers/numMatrix/core/params.js';
import {
  LEGACY_PRESETS as POINT_GRID_PRESETS,
  normalizePointGridParams,
} from '../renderers/pointGrid/core/params.js';
import {
  LEGACY_PRESETS as WEBGL_HEATMAP_PRESETS,
  normalizeWebglHeatmapParams,
} from '../renderers/webglHeatmap/core/params.js';

/**
 * 面向配置页面的矩阵展示形式目录。
 *
 * 这里仅描述“用户想看到什么”，渲染器的底层参数由
 * createMatrixDisplayRenderers 根据矩阵和坐标文件统一生成。
 */
export const MATRIX_DISPLAY_MODES = Object.freeze([
  {
    id: 'matrix-points-3d',
    rendererId: 'pointGrid',
    label: '3D 点图',
    description: '点位坐标决定形状，数值决定点的高度和颜色',
    dimension: '3d',
    kind: 'points',
    shapeAware: true,
  },
  {
    id: 'matrix-values-2d',
    rendererId: 'numMatrix',
    label: '2D 数字',
    description: '使用原生蓝色平面数字矩阵，支持缩放和平移',
    dimension: '2d',
    kind: 'values',
    shapeAware: false,
  },
  {
    id: 'native-heatmap-2d',
    rendererId: 'webglHeatmap',
    label: '热力图',
    description: '使用系统原生 WebGL 热力图显示同一传感器矩阵',
    dimension: '2d',
    kind: 'heatmap',
    shapeAware: false,
  },
  {
    id: 'soft-heatmap-2d',
    rendererId: 'blobHeatmap',
    label: '柔和热力图',
    description: '将矩阵点融合成连续的平面热力分布',
    dimension: '2d',
    kind: 'heatmap',
    shapeAware: false,
  },
]);

const MODE_BY_ID = new Map(MATRIX_DISPLAY_MODES.map((mode) => [mode.id, mode]));
const MODE_BY_RENDERER_ID = new Map(
  MATRIX_DISPLAY_MODES.map((mode) => [mode.rendererId, mode]),
);
// 旧名称仅用于兼容已保存选择，不再作为第二种数字模式出现在目录中。
MODE_BY_ID.set('matrix-values-3d', MODE_BY_ID.get('matrix-values-2d'));
MODE_BY_RENDERER_ID.set('numMatrix2d', MODE_BY_ID.get('matrix-values-2d'));

function positiveInteger(value, fallback = 1) {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

/** 将二维坐标矩阵压平成与帧数据一致的 row-major 点位表。 */
function flattenCoordinateMap(coordinateMap) {
  const coordinates = Array.isArray(coordinateMap)
    ? coordinateMap
    : coordinateMap?.coordinates;
  if (!Array.isArray(coordinates)) return null;

  const points = coordinates.flatMap((row) => (
    Array.isArray(row)
      ? row.map((point) => [Number(point?.[0]), Number(point?.[1])])
      : []
  ));
  return points.length && points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    ? points
    : null;
}

export function getMatrixDisplayMode(modeId) {
  return MODE_BY_ID.get(modeId) || null;
}

export function inferMatrixDisplayModeId(rendererId) {
  return MODE_BY_RENDERER_ID.get(rendererId)?.id || MATRIX_DISPLAY_MODES[0].id;
}

/** 将展示模式 ID 解析成注册表类型，旧数字别名统一到原生平面矩阵。 */
export function resolveMatrixRendererType(rendererId) {
  const mode = MODE_BY_RENDERER_ID.get(rendererId);
  return mode?.rendererType || mode?.rendererId || rendererId;
}

/** 生成统一蓝底原始数字参数；保留尺寸、方向和小数单位，索引只供显示。 */
export function createRawMatrixRendererParams(params = {}) {
  const defaults = normalizeNumMatrixParams(NUM_MATRIX_PRESETS.webglRawDefault);
  const source = params && typeof params === 'object' && !Array.isArray(params) ? params : {};
  return {
    ...NUM_MATRIX_PRESETS.webglRawDefault,
    ...source,
    backend: 'webgl',
    frameInput: 'raw',
    webgl: {
      ...NUM_MATRIX_PRESETS.webglRawDefault.webgl,
      ...source.webgl,
      whiteOnZero: false,
      gridColor: defaults.webgl.gridColor,
      textColor: defaults.webgl.textColor,
      zeroTextColor: null,
      indexRow: true,
      indexColumn: true,
    },
  };
}

/**
 * 根据矩阵定义生成所有展示形式的渲染器描述。
 *
 * @param {object} options 传感器矩阵上下文。
 * @param {{rows?: number, cols?: number, width?: number, height?: number}} options.matrix 矩阵尺寸。
 * @param {object|Array} [options.coordinateMap] 物理点位坐标矩阵。
 * @returns {Array<object>} 可直接写入 display.renderers 的描述列表。
 */
export function createMatrixDisplayRenderers({ matrix = {}, coordinateMap = null } = {}) {
  const rows = positiveInteger(matrix.rows || matrix.height);
  const cols = positiveInteger(matrix.cols || matrix.width);
  const points = flattenCoordinateMap(coordinateMap);
  const hasPhysicalPoints = points?.length === rows * cols;
  const pointInterp = hasPhysicalPoints ? 1 : 2;
  // 四层零边仅参与渲染；物理点位不能新增传感点或改变真实外形。
  const pointOrder = hasPhysicalPoints ? 0 : 4;

  return MATRIX_DISPLAY_MODES.map((mode) => {
    let params = {};
    if (mode.rendererId === 'pointGrid') {
      params = {
        sit: { num1: rows, num2: cols, interp: pointInterp, order: pointOrder },
        back: { num1: rows, num2: cols, interp: pointInterp, order: pointOrder },
        ...(hasPhysicalPoints ? { points } : {}),
      };
    } else if (resolveMatrixRendererType(mode.rendererId) === 'numMatrix') {
      params = createRawMatrixRendererParams({
        gridWidth: cols,
        gridHeight: rows,
        manageSidebar: false,
      });
    } else if (mode.rendererId === 'webglHeatmap') {
      // 通用矩阵不继承 64×64 床垫的裁边、镜像和 4096 点门槛。
      params = { ...WEBGL_HEATMAP_PRESETS.plain, dataWidth: cols, dataHeight: rows, minFrameLength: rows * cols };
    } else if (mode.rendererId === 'blobHeatmap') {
      params = {
        dataWidth: cols,
        dataHeight: rows,
      };
    }

    return {
      id: mode.rendererId,
      type: resolveMatrixRendererType(mode.rendererId),
      label: mode.label,
      description: mode.description,
      params,
    };
  });
}

/** 生成用于检查行列方向和点位顺序的一帧 1..N 数据。 */
export function createDirectionCheckFrame(length) {
  const count = Math.max(0, Math.round(Number(length)) || 0);
  return Array.from({ length: count }, (_, index) => index + 1);
}

/** SDK 内可以直接接收规则矩阵的一组通用渲染器。 */
export const BUILTIN_MATRIX_RENDERER_OPTIONS = Object.freeze([
  { id: 'numMatrix', label: '数字矩阵' },
  { id: 'pointGrid', label: '点阵热力（3D）' },
  { id: 'webglHeatmap', label: '斑点热力（WebGL）' },
  { id: 'blobHeatmap', label: '柔和热力（Canvas 2D）' },
]);

/**
 * 根据同一份矩阵定义生成内置渲染器参数。
 *
 * 这个入口用于配置页和产品实验室：调用方只维护行列、坐标和量程，不需要理解每个
 * 渲染器历史预设里不同的字段名。返回值可直接传给 `RendererHost.params`。
 *
 * @param {string} rendererId 内置矩阵渲染器 id。
 * @param {object} options 矩阵输入。
 * @param {{rows?: number, cols?: number, width?: number, height?: number}} options.matrix 行列定义。
 * @param {object|Array} [options.coordinateMap] rows × cols × [x, y] 坐标矩阵。
 * @param {number} [options.valueMax] 当前数据量程上限。
 * @returns {object} 已归一化的渲染参数。
 */
export function createBuiltinMatrixRendererParams(
  rendererId,
  { matrix = {}, coordinateMap = null, valueMax = 200 } = {},
) {
  const rows = positiveInteger(matrix.rows || matrix.height);
  const cols = positiveInteger(matrix.cols || matrix.width);
  const normalizedMax = Math.max(1, Number(valueMax) || 1);
  const points = flattenCoordinateMap(coordinateMap);
  const pointParams = points?.length === rows * cols ? { points } : {};
  const pointInterp = pointParams.points ? 1 : 2;
  const pointOrder = pointParams.points ? 0 : 4;

  if (rendererId === 'numMatrix') {
    return normalizeNumMatrixParams(createRawMatrixRendererParams({
      gridWidth: cols,
      gridHeight: rows,
      manageSidebar: false,
      textureValueMax: normalizedMax,
    }));
  }

  if (rendererId === 'pointGrid') {
    return normalizePointGridParams({
      ...POINT_GRID_PRESETS.matCol,
      sit: { num1: rows, num2: cols, interp: pointInterp, order: pointOrder },
      back: { num1: rows, num2: cols, interp: pointInterp, order: pointOrder },
      ...pointParams,
    });
  }

  if (rendererId === 'webglHeatmap') {
    return normalizeWebglHeatmapParams({
      ...WEBGL_HEATMAP_PRESETS.plain,
      dataWidth: cols,
      dataHeight: rows,
      max: normalizedMax,
      minFrameLength: rows * cols,
    });
  }

  if (rendererId === 'blobHeatmap') {
    return normalizeBlobHeatmapParams({
      ...BLOB_HEATMAP_PRESETS.default,
      dataWidth: cols,
      dataHeight: rows,
      max: normalizedMax,
    });
  }

  throw new Error(`不支持的矩阵渲染器: ${rendererId}`);
}
