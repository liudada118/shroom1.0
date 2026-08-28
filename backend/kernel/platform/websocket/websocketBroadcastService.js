/**
 * WebSocket 广播基础服务。
 *
 * 负责把结构化对象转换成可发送载荷、读取 server 客户端列表、
 * 判断连接状态并向在线客户端广播。该文件不关心业务通道含义。
 */
const WebSocket = require('ws');

/**
 * 将待发送数据统一转换为 WebSocket 可发送的字符串载荷。
 *
 * @param {string | object} data 待发送的字符串或结构化对象。
 * @returns {string} WebSocket 发送载荷。
 */
function toPayload(data) {
  return typeof data === 'string' ? data : JSON.stringify(data);
}

/**
 * 读取 WebSocket Server 当前维护的客户端列表。
 *
 * @param {import('ws').Server | null | undefined} wsServer WebSocket 服务实例。
 * @returns {Array<import('ws')>} 客户端连接数组。
 */
function getClients(wsServer) {
  if (!wsServer?.clients) return [];
  return Array.from(wsServer.clients);
}

/**
 * 获取指定 WebSocket Server 的连接数量。
 *
 * @param {import('ws').Server | null | undefined} wsServer WebSocket 服务实例。
 * @returns {number} 当前连接数。
 */
function getClientCount(wsServer) {
  return wsServer?.clients?.size || 0;
}

/**
 * 判断客户端连接是否处于可发送状态。
 *
 * @param {import('ws') | null | undefined} client WebSocket 客户端连接。
 * @returns {boolean} 连接是否已打开。
 */
function isOpenClient(client) {
  return client?.readyState === WebSocket.OPEN;
}

/**
 * 向指定 WebSocket Server 的所有在线客户端广播数据。
 *
 * @param {import('ws').Server | null | undefined} wsServer WebSocket 服务实例。
 * @param {string | object} data 待广播的数据。
 * @returns {number} 实际发送成功的客户端数量。
 */
function broadcast(wsServer, data) {
  const payload = toPayload(data);
  let sent = 0;

  for (const client of getClients(wsServer)) {
    if (isOpenClient(client)) {
      client.send(payload);
      sent += 1;
    }
  }

  return sent;
}

module.exports = {
  broadcast,
  getClientCount,
  getClients,
  isOpenClient,
  toPayload,
};
