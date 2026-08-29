/**
 * WebSocket 通道服务。
 *
 * 统一动态逻辑通道命名、共享 server 获取、序列化和连接数统计。
 * 所有 manifest sensor.frame 共用一个物理 WebSocket 端口，通道隔离由订阅服务负责。
 */
const {
  SENSOR_FRAME_SCHEMA_VERSION,
  SENSOR_FRAME_TYPE,
} = require('../../realtime/sensorFrameEnvelope');

const SHARED_WEBSOCKET_PORT = 19999;
const LEGACY_DEFAULT_WEBSOCKET_CHANNEL = 'sit';

function toPayload(data) {
  return typeof data === 'string' ? data : JSON.stringify(data);
}

function getClientCount(wsServer) {
  return wsServer?.clients?.size || 0;
}

/**
 * 归一化 WebSocket 逻辑通道名称。
 *
 * 不再维护 sit/back/head 白名单；manifest 新增 sensor 后可直接进入同一条链路。
 * 空值仍回退到 sit，仅用于兼容旧调用方未传 channel 的行为。
 *
 * @param {string} channel 业务通道名称。
 * @param {string} fallback 空值回退通道。
 * @returns {string} 标准通道名称。
 */
function normalizeChannel(channel, fallback = LEGACY_DEFAULT_WEBSOCKET_CHANNEL) {
  const normalized = String(channel || '').trim();
  return normalized || fallback;
}

/**
 * 从 manifest 通道描述或字符串中提取 canonical channelId 列表。
 *
 * @param {Array<string | object>} channels 通道名或通道描述。
 * @returns {string[]} 去重后的通道名。
 */
function normalizeChannelList(channels = []) {
  const normalized = [];
  const seen = new Set();
  for (const channel of Array.isArray(channels) ? channels : [channels]) {
    const candidate = typeof channel === 'string'
      ? channel
      : channel?.channelId || channel?.id || channel?.outputChannel || channel?.serialRole || channel?.key;
    const channelId = normalizeChannel(candidate, '');
    if (!channelId || seen.has(channelId)) continue;
    seen.add(channelId);
    normalized.push(channelId);
  }
  return normalized;
}

/**
 * 把 manifest 声明和 SerialManager 已注册端口合并成实时通道元数据。
 * manifest 放在后面，若同一 channelId 同时存在，会用它的完整身份覆盖运行态占位信息。
 *
 * @param {object} options 元数据来源。
 * @param {string} options.sensorType 当前传感器类型。
 * @param {object[]} options.manifestChannels manifest 声明的串口通道。
 * @param {object[]} options.managedChannels SerialManager 状态列表。
 * @returns {object[]} 动态实时通道列表。
 */
function buildRealtimeChannelMetadata({
  sensorType,
  manifestChannels = [],
  managedChannels = [],
} = {}) {
  const channelsById = new Map();
  const manifestList = Array.isArray(manifestChannels) ? manifestChannels : [];
  const managedList = Array.isArray(managedChannels) ? managedChannels : [];
  const manifestByRole = new Map(manifestList.map((channel) => [channel.serialRole, channel]));
  const managedDescriptors = managedList.map((status) => {
    const serialRole = status.role || status.portId;
    return manifestByRole.get(serialRole) || {
      channelId: `${sensorType || 'legacy'}:${serialRole}`,
      displaySystemId: sensorType || 'legacy',
      sensorId: serialRole,
      serialRole,
      outputChannel: status.outputChannel || serialRole,
      label: status.label || serialRole,
      legacy: true,
    };
  });

  [...managedDescriptors, ...manifestList].forEach((channel) => {
    const serialRole = normalizeChannel(channel?.serialRole || channel?.sensorId, '');
    const outputChannel = normalizeChannel(channel?.outputChannel || serialRole, '');
    const channelId = normalizeChannel(channel?.channelId || channel?.id, '')
      || `${normalizeChannel(channel?.displaySystemId || sensorType, 'legacy')}:${serialRole}`;
    if (!channelId) return;
    channelsById.set(channelId, {
      channelId,
      name: channel.label || `${channelId} realtime channel`,
      port: SHARED_WEBSOCKET_PORT,
      displaySystemId: channel.displaySystemId || sensorType || 'legacy',
      sensorId: channel.sensorId || serialRole,
      serialRole,
      outputChannel,
      sensorType: channel.sensorType || sensorType,
      transport: 'websocket',
      messageType: SENSOR_FRAME_TYPE,
      schemaVersion: SENSOR_FRAME_SCHEMA_VERSION,
      legacy: channel.legacy === true,
    });
  });

  return [...channelsById.values()];
}

/**
 * 根据业务通道从提供方读取对应 WebSocket Server。
 *
 * @param {(channel: string) => import('ws').Server | null | undefined} getServer WebSocket Server 提供函数。
 * @param {string} channel 业务通道名称。
 * @returns {import('ws').Server | null | undefined} WebSocket Server 实例。
 */
function getChannelServer(getServer, channel = LEGACY_DEFAULT_WEBSOCKET_CHANNEL) {
  if (typeof getServer !== 'function') return null;
  return getServer(normalizeChannel(channel));
}

/**
 * 获取给定动态通道的共享 WebSocket 在线客户端数量。
 *
 * @param {(channel: string) => import('ws').Server | null | undefined} getServer WebSocket Server 提供函数。
 * @param {Array<string | object>} channels 当前 manifest 或运行时声明的通道。
 * @returns {Record<string, number>} 通道客户端数量。
 */
function getChannelClientCounts(getServer, channels = []) {
  return normalizeChannelList(channels).reduce((counts, channel) => {
    counts[channel] = getClientCount(getChannelServer(getServer, channel));
    return counts;
  }, {});
}

module.exports = {
  LEGACY_DEFAULT_WEBSOCKET_CHANNEL,
  SHARED_WEBSOCKET_PORT,
  buildRealtimeChannelMetadata,
  getClientCount,
  getChannelClientCounts,
  getChannelServer,
  normalizeChannel,
  normalizeChannelList,
  toPayload,
};
