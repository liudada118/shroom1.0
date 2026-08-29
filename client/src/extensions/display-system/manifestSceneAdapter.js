import { calculatePressureMetrics } from './displayProfileRuntime.js';
import { applyMatrixTransform } from '../../displays/matrixTransform.js';
import {
  getSensorFrameChannelValue,
  getSensorFrameOutputChannel,
  getSensorFrameStageValue,
  isSensorFrameForDisplay,
} from '../../services/ws/sensorFrameDecoder.js';

/**
 * 从侧栏数据源中解析标准通道名称。
 *
 * @param {string} source manifest 中的 source 字段。
 * @param {Array<{id: string, outputChannel: string}>} sensors manifest 声明的传感器。
 * @returns {string} 逻辑输出通道名称。
 */
export function getManifestSourceChannel(source = '', sensors = []) {
  const key = String(source || '');
  const candidates = sensors
    .map((sensor) => ({ channel: sensor?.outputChannel || sensor?.id, id: sensor?.id }))
    .filter((item) => item.channel);

  const exact = candidates.find((item) => key === item.channel || key === item.id);
  if (exact) return exact.channel;
  const prefixed = candidates.find((item) => (
    (item.channel && key.startsWith(item.channel)) || (item.id && key.startsWith(item.id))
  ));
  if (prefixed) return prefixed.channel;

  if (key.startsWith('back')) return 'back';
  if (key.startsWith('head')) return 'head';
  if (key.startsWith('sensor')) return 'sensor';
  return 'sit';
}

/**
 * 过滤其它展示系统的帧，并按 outputChannel 读取 canonical/legacy 通道数据。
 * 没有 displaySystemId 的旧消息仍由 selector 兼容。
 *
 * @param {object} message WebSocket 实时消息。
 * @param {string | string[]} acceptedIdentities 当前展示系统可接受的身份。
 * @returns {object[]} 已路由的通道帧列表。
 */
export function readManifestChannelFrames(message, acceptedIdentities) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return [];
  if (!isSensorFrameForDisplay(message, acceptedIdentities)) return [];

  const declaredChannel = getSensorFrameOutputChannel(message);
  const channels = message.type === 'sensor.frame'
    ? [declaredChannel]
    : [...new Set([declaredChannel, 'sit', 'back', 'head', 'sensor'].filter(Boolean))];

  const algorithmMetrics = message.payload?.algorithmMetrics
    || message.algorithmMetrics
    || message.payload?.metrics?.algorithm
    || message.metrics?.algorithm
    || {};

  return channels.flatMap((channel) => {
    const renderValues = getSensorFrameChannelValue(message, channel);
    if (!Array.isArray(renderValues)) return [];
    const normalizedValues = getSensorFrameStageValue(message, 'normalized') || renderValues;
    const rawValues = getSensorFrameStageValue(message, 'decoded') || normalizedValues;
    return [{
      channel,
      renderValues,
      rawValues,
      normalizedValues,
      algorithmMetrics: algorithmMetrics && typeof algorithmMetrics === 'object'
        ? algorithmMetrics
        : {},
    }];
  });
}

/**
 * 单通道兼容入口；新渲染器应使用 readManifestChannelFrames 处理旧合并消息。
 */
export function readManifestChannelFrame(message, acceptedIdentities) {
  return readManifestChannelFrames(message, acceptedIdentities)[0] || null;
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
  const channel = getManifestSourceChannel(sidebar.source, definition.sensors);
  const routedFrame = readManifestChannelFrames(message, [
    definition.displaySystemId,
    definition.type,
  ]).find((frame) => frame.channel === channel);
  if (!routedFrame) return null;

  const transformed = applyMatrixTransform(
    routedFrame.renderValues,
    definition.sourceMatrix || definition.matrix,
    definition.matrixTransform || definition.page?.matrixTransform,
  );

  return {
    channel,
    renderValues: transformed.values,
    renderMatrix: transformed.matrix,
    rawValues: routedFrame.rawValues,
    normalizedValues: routedFrame.normalizedValues,
    metrics: calculatePressureMetrics(routedFrame.normalizedValues, sidebar),
    algorithmMetrics: routedFrame.algorithmMetrics,
  };
}
