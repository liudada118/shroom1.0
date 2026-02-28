/**
 * wsHelper.js
 * WebSocket 广播与服务器管理工具模块
 *
 * 将 server.js 中 77 处重复的 server.clients.forEach 广播逻辑
 * 统一抽取为可复用的工具函数，并提供消息路由能力。
 */

const WebSocket = require('ws');
const logger = require('./logger');

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

/**
 * WebSocket 消息路由器
 * 根据消息中的字段自动分发到对应的处理函数，
 * 替代 server.js 中巨大的 if-else 消息处理链。
 *
 * 使用示例：
 *   const router = new MessageRouter();
 *   router.on('port', (data, ws) => { ... });
 *   router.on('file', (data, ws) => { ... });
 *   router.dispatch(getMessage, ws);
 */
class MessageRouter {
  constructor() {
    this._handlers = new Map();
  }

  /**
   * 注册消息处理器
   * @param {string} field - 消息中的字段名
   * @param {function} handler - 处理函数 (value, fullMessage, ws) => void
   */
  on(field, handler) {
    this._handlers.set(field, handler);
    return this;
  }

  /**
   * 分发消息到对应的处理器
   * @param {object} message - 解析后的 JSON 消息对象
   * @param {WebSocket} ws - 发送消息的客户端
   * @returns {boolean} 是否有处理器被调用
   */
  dispatch(message, ws) {
    let handled = false;
    for (const [field, handler] of this._handlers) {
      if (message[field] !== undefined && message[field] !== null) {
        try {
          handler(message[field], message, ws);
          handled = true;
        } catch (err) {
          logger.error(`消息处理器 [${field}] 执行出错`, err);
        }
      }
    }
    if (!handled) {
      logger.debug('未匹配到消息处理器', message);
    }
    return handled;
  }
}

/**
 * 创建 WebSocket 服务器并绑定基础事件
 * @param {number} port - 监听端口
 * @param {string} name - 服务器名称（用于日志）
 * @returns {WebSocket.Server}
 */
function createWsServer(port, name = '') {
  const server = new WebSocket.Server({ port });
  logger.info(`WebSocket 服务器 [${name}] 已启动，端口: ${port}`);

  server.on('error', (err) => {
    logger.error(`WebSocket 服务器 [${name}] 错误`, err);
  });

  return server;
}

/**
 * 获取 WebSocket 服务器当前连接数
 * @param {WebSocket.Server} wsServer
 * @returns {number}
 */
function getClientCount(wsServer) {
  if (!wsServer || !wsServer.clients) return 0;
  let count = 0;
  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) count++;
  });
  return count;
}

module.exports = {
  broadcast,
  sendToClient,
  broadcastAll,
  MessageRouter,
  createWsServer,
  getClientCount,
};
