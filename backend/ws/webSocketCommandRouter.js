/**
 * 创建 WebSocket/HTTP 共用的命令路由器。
 *
 * 这里不关心命令来自哪里，只负责：
 * 1. 按 handler.when 判断是否命中。
 * 2. 调用 handler.handle 执行业务。
 * 3. 支持 handler 返回 { stop: true } 中断后续处理。
 */
function createWebSocketCommandRouter({ logger } = {}) {
  const handlers = [];

  /**
   * 注册一个命令处理器。
   *
   * @param {{name?: string, when?: Function, handle: Function}} handler 命令处理器。
   * @returns {object} 原 handler，便于测试或链式使用。
   */
  function register(handler) {
    if (!handler || typeof handler.handle !== 'function') {
      throw new Error('command handler requires handle(message, context)');
    }
    handlers.push(handler);
    return handler;
  }

  /**
   * 处理一条命令。
   *
   * @param {object} message 标准化后的命令对象，兼容旧 WebSocket 字段。
   * @param {object} context 调用上下文，例如 scope/transport/clientName。
   * @returns {{handled: boolean, stop: boolean, results: object[]}} 执行摘要。
   */
  function handle(message, context = {}) {
    const results = [];
    for (const handler of handlers) {
      try {
        const shouldHandle = typeof handler.when === 'function'
          ? handler.when(message, context)
          : true;
        if (!shouldHandle) continue;

        const result = handler.handle(message, context) || {};
        results.push({
          name: handler.name || 'anonymous',
          ...result,
        });
        if (result.stop === true) {
          return {
            handled: true,
            stop: true,
            results,
          };
        }
      } catch (error) {
        logger?.warn?.(`[WSCommand] ${handler.name || 'anonymous'} failed`, error.message || error);
        results.push({
          name: handler.name || 'anonymous',
          error: error.message || String(error),
        });
      }
    }

    return {
      handled: results.length > 0,
      stop: false,
      results,
    };
  }

  return {
    handle,
    register,
  };
}

module.exports = {
  createWebSocketCommandRouter,
};
