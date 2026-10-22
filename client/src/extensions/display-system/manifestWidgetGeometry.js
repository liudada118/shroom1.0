import { buildCoordinatePointLayout } from './coordinatePointLayout.js';
import {
  deriveTransformedMatrix,
  transformCoordinateMap,
} from '../../displays/matrixTransform.js';
import { getManifestSourceSensor } from './manifestSceneAdapter.js';
import { createRawMatrixRendererParams } from '@shroom/frontend/core/matrixDisplayModes.js';

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

/** 规则矩阵沿用手部监测的两倍插值与四层零边，物理坐标表保持逐点对应。 */
function buildPointGridChannel(channel = {}, rows, cols, hasPhysicalPoints) {
  const order = Number(channel.order);
  return {
    ...channel,
    num1: rows,
    num2: cols,
    interp: hasPhysicalPoints ? 1 : Math.max(2, Number(channel.interp) || 2),
    order: hasPhysicalPoints ? 0 : Number.isFinite(order) && order > 0 ? order : 4,
  };
}

/**
 * 给 SDK 矩阵渲染器覆写当前 widget 的逐路几何参数。
 *
 * display.renderers 是方案级配置，每路必须使用自己的行列和坐标。
 * 规则点图至少使用两倍显示插值和默认四层零边；物理点表保持逐点对应且不补边。
 * 当前路没有坐标时清除旧 points，避免第二路继续套用第一路物理形状。
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
    const points = flattenCoordinatePoints(coordinateMap);
    const hasPhysicalPoints = points?.length === rows * cols;
    const next = {
      ...base,
      sit: buildPointGridChannel(base.sit || {}, rows, cols, hasPhysicalPoints),
      back: buildPointGridChannel(base.back || {}, rows, cols, hasPhysicalPoints),
    };
    // ⚠️ 仅规则矩阵交换绘图轴，物理点位表已定义真实形状，不能再次转置。
    next.transposeAxes = !hasPhysicalPoints;
    next.workspaceTools = true;
    if (hasPhysicalPoints) next.points = points;
    else delete next.points;
    return next;
  }
  if (rendererId === 'numMatrix' || rendererId === 'numMatrix2d') {
    const rawMatrix = base.backend !== 'canvas2d' && (rendererId === 'numMatrix2d' || base.frameInput === 'raw'
      || base.backend === 'webgl' || !base.backend);
    const next = rawMatrix ? createRawMatrixRendererParams(base) : base;
    return { ...next, gridWidth: cols, gridHeight: rows };
  }
  if (rendererId === 'blobHeatmap' || rendererId === 'webglHeatmap') {
    return {
      ...base,
      dataWidth: cols,
      dataHeight: rows,
      ...(rendererId === 'webglHeatmap' ? { minFrameLength: rows * cols } : {}),
      ...(rendererId === 'blobHeatmap' ? { transposeAxes: true } : {}),
      ...(rendererId === 'webglHeatmap' ? { workspaceTuning: true } : {}),
    };
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
