const {
  broadcast,
  getClientCount,
} = require('./websocketBroadcastService');

const CHANNELS = Object.freeze({
  sit: Object.freeze({ key: 'sit', port: 19999, legacyName: 'server' }),
  back: Object.freeze({ key: 'back', port: 19998, legacyName: 'server1' }),
  head: Object.freeze({ key: 'head', port: 19997, legacyName: 'server2' }),
});

/**
 * 归一化 WebSocket 通道名称，避免调用方散落判断 server/server1/server2。
 *
 * @param {string} channel 业务通道名称。
 * @returns {'sit' | 'back' | 'head'} 标准通道名称。
 */
function normalizeChannel(channel = 'sit') {
  return CHANNELS[channel] ? channel : 'sit';
}

/**
 * 根据业务通道从提供方读取对应 WebSocket Server。
 *
 * @param {(channel: string) => import('ws').Server | null | undefined} getServer WebSocket Server 提供函数。
 * @param {string} channel 业务通道名称。
 * @returns {import('ws').Server | null | undefined} WebSocket Server 实例。
 */
function getChannelServer(getServer, channel = 'sit') {
  if (typeof getServer !== 'function') return null;
  return getServer(normalizeChannel(channel));
}

/**
 * 向指定业务通道广播实时数据。
 *
 * @param {(channel: string) => import('ws').Server | null | undefined} getServer WebSocket Server 提供函数。
 * @param {string | object} data 待广播数据。
 * @param {string} channel 业务通道名称。
 * @returns {number} 实际发送成功的客户端数量。
 */
function broadcastToChannel(getServer, data, channel = 'sit') {
  return broadcast(getChannelServer(getServer, channel), data);
}

/**
 * 获取三路 WebSocket 通道的在线客户端数量。
 *
 * @param {(channel: string) => import('ws').Server | null | undefined} getServer WebSocket Server 提供函数。
 * @returns {{sit: number, back: number, head: number}} 通道客户端数量。
 */
function getChannelClientCounts(getServer) {
  return Object.keys(CHANNELS).reduce((counts, channel) => {
    counts[channel] = getClientCount(getChannelServer(getServer, channel));
    return counts;
  }, {});
}

module.exports = {
  CHANNELS,
  broadcastToChannel,
  getChannelClientCounts,
  getChannelServer,
  normalizeChannel,
};
