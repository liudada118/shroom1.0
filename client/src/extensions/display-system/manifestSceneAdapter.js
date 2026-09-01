import { calculatePressureMetrics } from './displayProfileRuntime.js';
import { applyMatrixTransform } from '../../displays/matrixTransform.js';
import {
  getSensorFrameChannelValue,
  getSensorFrameOutputChannel,
  getSensorFrameStageValue,
  isSensorFrameForDisplay,
  isSensorFrameEnvelope,
} from '../../services/ws/sensorFrameDecoder.js';

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function firstAcceptedIdentity(acceptedIdentities) {
  const identities = Array.isArray(acceptedIdentities)
    ? acceptedIdentities
    : [acceptedIdentities];
  return identities.map((identity) => String(identity || '').trim()).find(Boolean) || '';
}

/**
 * 从 widget/sidebar 的 source 找到 manifest 中对应的传感器声明。
 */
export function getManifestSourceSensor(source = '', sensors = []) {
  const key = String(source || '').trim();
  const candidates = (Array.isArray(sensors) ? sensors : [])
    .filter((sensor) => sensor && (sensor.id || sensor.outputChannel || sensor.channelId));

  const exact = candidates.find((sensor) => (
    key === sensor.channelId
    || key === sensor.id
    || key === sensor.sensorId
    || key === sensor.outputChannel
  ));
  if (exact) return exact;

  const prefixed = candidates
    .flatMap((sensor) => [sensor.channelId, sensor.outputChannel, sensor.sensorId, sensor.id]
      .filter(Boolean)
      .filter((identity) => key.startsWith(identity))
      .map((identity) => ({ identity, sensor })))
    .sort((left, right) => right.identity.length - left.identity.length)[0];
  if (prefixed) return prefixed.sensor;

  const legacyChannel = key.startsWith('back') ? 'back'
    : key.startsWith('head') ? 'head'
      : key.startsWith('sensor') ? 'sensor'
        : key.startsWith('sit') ? 'sit' : '';
  if (legacyChannel) {
    const legacySensor = candidates.find((sensor) => (
      (sensor.outputChannel || sensor.id) === legacyChannel
    ));
    if (legacySensor) return legacySensor;
  }

  // `data`/`metrics` 是 v1 示例中的单通道 source；多通道 manifest 应显式写 sensor id。
  if (!key || key === 'data' || key === 'metrics' || key === 'value') {
    return candidates[0] || null;
  }
  return null;
}

/**
 * 从侧栏数据源中解析标准通道名称。
 *
 * @param {string} source manifest 中的 source 字段。
 * @param {Array<{id: string, outputChannel: string}>} sensors manifest 声明的传感器。
 * @returns {string} 逻辑输出通道名称。
 */
export function getManifestSourceChannel(source = '', sensors = []) {
  const key = String(source || '');
  const sensor = getManifestSourceSensor(key, sensors);
  if (sensor) return sensor.outputChannel || sensor.id;

  if (key.startsWith('back')) return 'back';
  if (key.startsWith('head')) return 'head';
  if (key.startsWith('sensor')) return 'sensor';
  return 'sit';
}

/**
 * 将 manifest source 解析成完整 channelId；outputChannel 仅作为旧配置回退。
 */
export function getManifestSourceChannelId(source = '', sensors = [], displaySystemId = '') {
  const sensor = getManifestSourceSensor(source, sensors);
  if (sensor?.channelId) return sensor.channelId;
  const sensorId = String(sensor?.sensorId || sensor?.id || getManifestSourceChannel(source, sensors)).trim();
  const displayId = String(displaySystemId || '').trim();
  return displayId && sensorId ? `${displayId}:${sensorId}` : sensorId;
}

/**
 * 过滤其它展示系统的帧，并按 outputChannel 读取 canonical/legacy 通道数据。
 * 没有 displaySystemId 的旧消息仍由 selector 兼容。
 *
 * @param {object} message WebSocket 实时消息。
 * @param {string | string[]} acceptedIdentities 当前展示系统可接受的身份。
 * @returns {object[]} 已路由的通道帧列表。
 */
export function readManifestChannelFrames(message, acceptedIdentities, sensors = []) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return [];
  if (!isSensorFrameForDisplay(message, acceptedIdentities)) return [];

  const canonical = isSensorFrameEnvelope(message);
  const declaredChannel = getSensorFrameOutputChannel(message);
  const channels = canonical
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
    const declaredSensor = getManifestSourceSensor(channel, sensors);
    const displaySystemId = String(
      message.displaySystemId || firstAcceptedIdentity(acceptedIdentities),
    ).trim();
    const sensorId = String(
      message.sensorId || declaredSensor?.sensorId || declaredSensor?.id || channel,
    ).trim();
    const sensorLabel = String(
      message.sensorLabel
      || declaredSensor?.sensorLabel
      || declaredSensor?.label
      || sensorId,
    ).trim();
    const channelId = canonical && String(message.channelId || '').trim()
      ? String(message.channelId).trim()
      : (declaredSensor?.channelId
        || (displaySystemId && sensorId ? `${displaySystemId}:${sensorId}` : sensorId));
    const frameSerial = isObject(message.serial)
      ? message.serial
      : (isObject(message.payload?.serial) ? message.payload.serial : null);
    const declaredSerial = isObject(declaredSensor?.serial) ? declaredSensor.serial : null;
    const serial = frameSerial || declaredSerial
      ? { ...(declaredSerial || {}), ...(frameSerial || {}) }
      : null;
    const normalizedValues = getSensorFrameStageValue(message, 'normalized') || renderValues;
    const rawValues = getSensorFrameStageValue(message, 'decoded') || normalizedValues;
    return [{
      channel,
      channelId,
      displaySystemId,
      sensorId,
      sensorLabel,
      outputChannel: channel,
      timestamp: message.timestamp ?? message.payload?.timestamp ?? null,
      serial,
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
export function readManifestChannelFrame(message, acceptedIdentities, sensors = []) {
  return readManifestChannelFrames(message, acceptedIdentities, sensors)[0] || null;
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
  const channelId = getManifestSourceChannelId(
    sidebar.source,
    definition.sensors,
    definition.displaySystemId,
  );
  const routedFrame = readManifestChannelFrames(message, [
    definition.displaySystemId,
    definition.type,
  ], definition.sensors).find((frame) => (
    frame.channelId === channelId || frame.outputChannel === channel
  ));
  if (!routedFrame) return null;

  const transformed = applyMatrixTransform(
    routedFrame.renderValues,
    definition.sourceMatrix || definition.matrix,
    definition.matrixTransform || definition.page?.matrixTransform,
  );

  return {
    channel,
    channelId: routedFrame.channelId,
    displaySystemId: routedFrame.displaySystemId,
    sensorId: routedFrame.sensorId,
    sensorLabel: routedFrame.sensorLabel,
    outputChannel: routedFrame.outputChannel,
    serial: routedFrame.serial,
    renderValues: transformed.values,
    renderMatrix: transformed.matrix,
    rawValues: routedFrame.rawValues,
    normalizedValues: routedFrame.normalizedValues,
    metrics: calculatePressureMetrics(routedFrame.normalizedValues, sidebar),
    algorithmMetrics: routedFrame.algorithmMetrics,
  };
}
