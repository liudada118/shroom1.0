import { calculatePressureMetrics } from './displayProfileRuntime.js';
import { applyMatrixTransform } from '../../displays/matrixTransform.js';

function normalizeFrameValues(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 从侧栏数据源中解析标准通道名称。
 *
 * @param {string} source manifest 中的 source 字段。
 * @returns {'sit' | 'back' | 'head' | 'sensor'} 标准通道名称。
 */
export function getManifestSourceChannel(source = '') {
  if (source.startsWith('back')) return 'back';
  if (source.startsWith('head')) return 'head';
  if (source.startsWith('sensor')) return 'sensor';
  return 'sit';
}

/**
 * 判断实时帧是否属于当前主界面展示系统。
 *
 * 新链路使用 displaySystemId 严格隔离数据。没有该字段的旧帧，仅在当前已经
 * 选中 manifest 系统时作为兼容输入处理。
 *
 * @param {object} message WebSocket 实时消息。
 * @param {object} definition 当前展示系统定义。
 * @returns {boolean} 是否允许送入当前场景。
 */
export function isManifestFrameForDefinition(message, definition) {
  if (!message || definition?.source !== 'manifest') return false;
  if (!message.displaySystemId) return true;
  return message.displaySystemId === definition.displaySystemId;
}

/**
 * 把 Display System 实时帧适配为现有主场景需要的数据结构。
 *
 * 绘图使用后端算法输出；左侧统计严格使用 line-order/point-order 之后、
 * 可视化算法之前的 normalizedData，保证统计值不受渲染滤波影响。
 *
 * @param {object} message WebSocket 实时消息。
 * @param {object} definition 当前展示系统定义。
 * @returns {object | null} 主场景帧；非当前系统或非目标通道时返回 null。
 */
export function buildManifestSceneFrame(message, definition) {
  if (!isManifestFrameForDefinition(message, definition)) return null;

  const sidebar = definition.page?.sidebar || {};
  const channel = getManifestSourceChannel(sidebar.source);
  const outputChannel = message.outputChannel || channel;
  if (message.outputChannel && outputChannel !== channel) return null;

  const dataField = `${channel}Data`;
  const renderValues = normalizeFrameValues(message.data)
    || normalizeFrameValues(message[dataField]);
  if (!renderValues) return null;

  const normalizedValues = normalizeFrameValues(message.normalizedData) || renderValues;
  const rawValues = normalizeFrameValues(message.rawData) || normalizedValues;

  const transformed = applyMatrixTransform(
    renderValues,
    definition.sourceMatrix || definition.matrix,
    definition.matrixTransform || definition.page?.matrixTransform,
  );

  return {
    channel,
    renderValues: transformed.values,
    renderMatrix: transformed.matrix,
    rawValues,
    normalizedValues,
    metrics: calculatePressureMetrics(normalizedValues, sidebar),
    algorithmMetrics: message.algorithmMetrics || message.metrics?.algorithm || {},
  };
}
