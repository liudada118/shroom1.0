function createWebSocketCommandRouter({ logger } = {}) {
  const handlers = [];

  function register(handler) {
    if (!handler || typeof handler.handle !== 'function') {
      throw new Error('command handler requires handle(message, context)');
    }
    handlers.push(handler);
    return handler;
  }

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
