const WebSocket = require('ws');

/**
 * WebSocket 传输服务。
 *
 * 这里只处理连接级心跳和 JSON 解码，不承载命令、订阅或传感器业务。
 */

/**
 * 给 WebSocket 客户端挂载心跳检测。
 *
 * @param {object} ws WebSocket 客户端。
 * @param {object} options 心跳配置。
 * @param {string} options.clientName 客户端名称，用于日志。
 * @param {object} options.logger 日志对象。
 * @param {number} options.intervalMs 心跳间隔。
 * @returns {NodeJS.Timeout} 心跳定时器。
 */
function attachHeartbeat(ws, {
  clientName = 'unknown',
  logger,
  intervalMs = 30000,
} = {}) {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  ws.on('close', () => {
    ws.isAlive = false;
  });

  const heartbeatInterval = setInterval(() => {
    if (ws.isAlive === false) {
      logger?.warn?.(`[WS] heartbeat timeout, terminate client: ${clientName}`);
      clearInterval(heartbeatInterval);
      return ws.terminate();
    }
    ws.isAlive = false;
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }, intervalMs);

  ws.on('close', () => clearInterval(heartbeatInterval));
  return heartbeatInterval;
}

/**
 * 将原始 WebSocket 消息解析为普通 JSON 对象。
 * 非法 JSON、数组和基础类型会被记录并丢弃，避免中断连接回调。
 */
function parseJsonMessage(message, { logger, clientName = 'unknown' } = {}) {
  try {
    const text = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      logger?.warn?.('[WebSocket] ignored non-object message from %s', clientName);
      return null;
    }
    return parsed;
  } catch (err) {
    logger?.warn?.('[WebSocket] ignored invalid JSON from %s: %s', clientName, err.message);
    return null;
  }
}

module.exports = {
  attachHeartbeat,
  parseJsonMessage,
};
