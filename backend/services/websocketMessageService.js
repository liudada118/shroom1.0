/**
 * 解析 WebSocket JSON 消息。
 *
 * 业务层只接收普通对象；非法 JSON 或非对象消息会被丢弃并记录日志，
 * 避免单条异常消息打断整个连接处理回调。
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
  parseJsonMessage,
};
