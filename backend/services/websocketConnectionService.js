const WebSocket = require('ws');

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

module.exports = {
  attachHeartbeat,
};
