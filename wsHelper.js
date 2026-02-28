/**
 * wsHelper.js
 * WebSocket 广播工具模块
 *
 * 将 server.js 中大量重复的 server.clients.forEach 广播逻辑
 * 统一抽取为可复用的工具函数，消除重复代码。
 */

const WebSocket = require('ws');

/**
 * 向指定 WebSocket 服务器的所有已连接客户端广播 JSON 数据
 * @param {WebSocket.Server} wsServer - WebSocket 服务器实例
 * @param {object} data - 要广播的数据对象，将被序列化为 JSON
 */
function broadcast(wsServer, data) {
  if (!wsServer || !wsServer.clients) return;
  const jsonData = JSON.stringify(data);
  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonData);
    }
  });
}

/**
 * 向单个 WebSocket 客户端安全地发送 JSON 数据
 * @param {WebSocket} client - WebSocket 客户端实例
 * @param {object} data - 要发送的数据对象
 */
function sendToClient(client, data) {
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(data));
  }
}

/**
 * 向多个 WebSocket 服务器同时广播相同数据
 * @param {WebSocket.Server[]} servers - WebSocket 服务器实例数组
 * @param {object} data - 要广播的数据对象
 */
function broadcastAll(servers, data) {
  servers.forEach((srv) => broadcast(srv, data));
}

module.exports = { broadcast, sendToClient, broadcastAll };
