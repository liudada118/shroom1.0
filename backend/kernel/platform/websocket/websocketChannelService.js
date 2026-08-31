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

/**
 * 把待发送内容变成 WebSocket 能发的字符串。
 *
 * **已经是字符串就原样返回，这一步是必需的而不是优化**：再 `JSON.stringify` 一次会
 * 把整个 JSON 文本当成一个字符串值编码（`{"a":1}` → `"{\"a\":1}"`），前端 `JSON.parse`
 * 之后拿到的是一个字符串而不是对象，然后在读字段时静默得到 undefined。
 *
 * 之所以要容忍两种输入：本仓的发送方确实两种都有 —— 例如
 * `historyAnalysisService.publishHistoryDiffFrames` 传的是 `JSON.stringify(...)` 的结果，
 * 而同文件另外三处传的是对象（那里也标注了这是历史不一致）。统一在这一层吸收掉，
 * 比去改所有调用方安全。
 *
 * @param {string|object} data 对象或已序列化的字符串。
 * @returns {string} 可直接 `ws.send` 的字符串。
 */
function toPayload(data) {
  return typeof data === 'string' ? data : JSON.stringify(data);
}

/**
 * 数某个 WebSocket Server 上的在线连接数。
 *
 * 两层可选链 + `|| 0` 是给三种「没有服务器」的情况兜底，它们都**不是错误**：
 * 通道还没启动、该型号不使用这个通道、测试里传的是没有 `clients` 的假对象。
 * 这个值只用于状态查询和诊断接口，「查不到」的正确答案是 0 而不是抛异常 ——
 * 让一个状态接口因为某个通道没开就整体 500 是不可接受的。
 *
 * 注意 `clients` 是 `ws` 库在**没有** `clientTracking: false` 时才维护的 Set。
 * 如果哪天为了省内存关掉了 clientTracking，这里会静默恒返回 0。
 *
 * @param {import('ws').Server|null|undefined} wsServer WebSocket Server 实例。
 * @returns {number} 在线连接数；拿不到时为 0。
 */
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
 * manifest 提供稳定业务身份，managed status 提供当前物理 COM 与连接状态；两者不能互相覆盖。
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
  const managedByRole = new Map(managedList.map((status) => [status.role || status.portId, status]));
  const unmanagedDescriptors = managedList
    .filter((status) => !manifestByRole.has(status.role || status.portId))
    .map((status) => {
      const serialRole = status.role || status.portId;
      return {
        channelId: `${sensorType || 'legacy'}:${serialRole}`,
        displaySystemId: sensorType || 'legacy',
        sensorId: serialRole,
        serialRole,
        outputChannel: status.outputChannel || serialRole,
        label: status.label || serialRole,
        legacy: true,
        ...status,
      };
    });
  const manifestDescriptors = manifestList.map((channel) => ({
    ...channel,
    serialStatus: managedByRole.get(channel.serialRole) || null,
  }));

  [...unmanagedDescriptors, ...manifestDescriptors].forEach((channel) => {
    const serialRole = normalizeChannel(channel?.serialRole || channel?.sensorId, '');
    const outputChannel = normalizeChannel(channel?.outputChannel || serialRole, '');
    const channelId = normalizeChannel(channel?.channelId || channel?.id, '')
      || `${normalizeChannel(channel?.displaySystemId || sensorType, 'legacy')}:${serialRole}`;
    if (!channelId) return;
    const status = channel.serialStatus || channel;
    const rawParserChannel = status?.parserChannel ?? channel?.parserChannel;
    const parserChannel = rawParserChannel && typeof rawParserChannel === 'object'
      ? (rawParserChannel.id || rawParserChannel.role || null)
      : (rawParserChannel || null);
    const sensorLabel = channel.sensorLabel || channel.label || channel.sensorId || serialRole;
    const serial = {
      role: serialRole,
      portId: status?.portId || serialRole,
      path: status?.path || null,
      baudRate: Number(status?.baudRate || channel?.baudRate || channel?.protocol?.baudRate) || null,
      parserChannel,
      isOpen: status?.isOpen === true,
      status: status?.status || 'unregistered',
      openedAt: status?.openedAt || null,
      updatedAt: status?.updatedAt || null,
      lastError: status?.lastError || null,
    };
    channelsById.set(channelId, {
      channelId,
      name: sensorLabel || `${channelId} realtime channel`,
      port: SHARED_WEBSOCKET_PORT,
      displaySystemId: channel.displaySystemId || sensorType || 'legacy',
      sensorId: channel.sensorId || serialRole,
      sensorLabel,
      serialRole,
      outputChannel,
      sensorType: channel.sensorType || sensorType,
      serial,
      serialPortPath: serial.path,
      baudRate: serial.baudRate,
      parserChannel: serial.parserChannel,
      isOpen: serial.isOpen,
      status: serial.status,
      openedAt: serial.openedAt,
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
