import { buildCoordinatePointLayout } from './coordinatePointLayout.js';
import {
  deriveTransformedMatrix,
  transformCoordinateMap,
} from '../../displays/matrixTransform.js';
import { getManifestSourceSensor } from './manifestSceneAdapter.js';

function matrixShapeMatchesLayout(matrix, layout) {
  if (!layout) return false;
  const rows = Number(matrix?.rows || matrix?.height || 0);
  const cols = Number(matrix?.cols || matrix?.width || 0);
  return rows > 0
    && cols > 0
    && layout.rows === rows
    && layout.cols === cols
    && layout.pointCount === rows * cols;
}

function flattenCoordinatePoints(coordinateMap) {
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

/**
 * 给 SDK 矩阵渲染器覆写当前 widget 的逐路几何参数。
 *
 * display.renderers 是方案级配置，旧 Builder 只按第一路生成一次。多传感器卡片若直接
 * 复用它，3D 点图、3D 数字和柔和热力图仍会拿第一路行列/坐标。这里保留其它调参，
 * 只替换必须随 sensor 变化的尺寸与 points；当前路没有坐标时还会删掉旧 points，避免
 * 第二路继续套用第一路物理形状。
 */
export function buildManifestWidgetRendererParams({
  rendererId,
  params = {},
  matrix = {},
  coordinateMap = null,
} = {}) {
  const rows = Math.max(0, Math.round(Number(matrix?.rows || matrix?.height || 0)));
  const cols = Math.max(0, Math.round(Number(matrix?.cols || matrix?.width || 0)));
  const base = params && typeof params === 'object' && !Array.isArray(params)
    ? params
    : {};
  if (!rows || !cols) return base;

  if (rendererId === 'pointGrid') {
    const next = {
      ...base,
      sit: { ...(base.sit || {}), num1: rows, num2: cols },
      back: { ...(base.back || {}), num1: rows, num2: cols },
    };
    const points = flattenCoordinatePoints(coordinateMap);
    if (points?.length === rows * cols) next.points = points;
    else delete next.points;
    return next;
  }
  if (rendererId === 'numMatrix') {
    return { ...base, gridWidth: cols, gridHeight: rows };
  }
  if (rendererId === 'blobHeatmap' || rendererId === 'webglHeatmap') {
    return { ...base, dataWidth: cols, dataHeight: rows };
  }
  return base;
}

/**
 * 为一个 manifest widget 解析它自己的传感器矩阵与物理坐标。
 *
 * 顶层 coordinateMap 是第一路传感器的兼容投影。多传感器系统中，只有第一路
 * 可以在缺少逐路 coordinateMap 时使用它；其它路直接退回规则矩阵，避免把第一路
 * 的手形/座椅形状错误套到第二路。
 *
 * @param {object} options 解析参数。
 * @returns {{sourceSensor: object|null, sourceMatrix: object|undefined,
 *            sourceCoordinateMap: object|Array|null, coordinateMap: object|Array|null,
 *            coordinatePointLayout: object|null}}
 */
export function resolveManifestWidgetGeometry({
  source,
  sensors = [],
  definition = {},
  matrixTransform = { type: 'none' },
} = {}) {
  const declaredSensors = Array.isArray(sensors) ? sensors : [];
  const sourceSensor = getManifestSourceSensor(source, declaredSensors);
  const sourceMatrix = sourceSensor?.sourceMatrix
    || sourceSensor?.matrix
    || definition?.sourceMatrix
    || definition?.matrix;
  const sensorCoordinateMap = sourceSensor?.sourceCoordinateMap
    || sourceSensor?.coordinateMap
    || null;
  const canUseTopLevelCoordinateMap = !sourceSensor
    || declaredSensors.length <= 1
    || sourceSensor === declaredSensors[0];
  const rawCoordinateMap = sensorCoordinateMap
    || (canUseTopLevelCoordinateMap
      ? definition?.sourceCoordinateMap || definition?.coordinateMap || null
      : null);
  const coordinateMap = transformCoordinateMap(rawCoordinateMap, matrixTransform);
  const candidateLayout = buildCoordinatePointLayout(coordinateMap);
  const renderMatrix = deriveTransformedMatrix(sourceMatrix, matrixTransform);
  const coordinatePointLayout = matrixShapeMatchesLayout(renderMatrix, candidateLayout)
    ? candidateLayout
    : null;

  return {
    sourceSensor,
    sourceMatrix,
    sourceCoordinateMap: rawCoordinateMap,
    coordinateMap: coordinatePointLayout ? coordinateMap : null,
    coordinatePointLayout,
  };
}

/**
 * 把 manifest sensors[] 转成画布配置器的数据源清单。
 * option value 使用唯一的 outputChannel；旧的 `seatData` / `sensorId.metrics`
 * 会在 resolveManifestWidgetSourceValue 中解析回这个稳定值。
 */
export function buildManifestWidgetSourceOptions(sensors = []) {
  const used = new Set();
  return (Array.isArray(sensors) ? sensors : []).flatMap((sensor) => {
    if (!sensor || typeof sensor !== 'object') return [];
    const value = String(
      sensor.outputChannel || sensor.sensorId || sensor.id || sensor.channelId || '',
    ).trim();
    if (!value || used.has(value)) return [];
    used.add(value);
    const sensorLabel = String(
      sensor.sensorLabel || sensor.label || sensor.sensorId || sensor.id || value,
    ).trim() || value;
    return [{
      value,
      label: sensorLabel === value ? sensorLabel : `${sensorLabel} · ${value}`,
    }];
  });
}

/**
 * 将 widget 的历史 source 写法归一到配置器 option value，不改原 manifest。
 */
export function resolveManifestWidgetSourceValue(source, sensors = []) {
  const sensor = getManifestSourceSensor(source, sensors);
  return String(
    sensor?.outputChannel
    || sensor?.sensorId
    || sensor?.id
    || sensor?.channelId
    || source
    || '',
  ).trim();
}
