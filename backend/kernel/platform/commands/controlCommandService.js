/**
 * 创建控制命令应用服务。
 *
 * HTTP 和 WebSocket 都通过该服务执行控制命令，入口层不再直接依赖
 * WebSocket command router。当前实现复用既有 router，后续可以继续
 * 将具体命令 handler 下沉到 application service。
 */
function createControlCommandService({ commandRouter, logger } = {}) {
  if (!commandRouter || typeof commandRouter.handle !== 'function') {
    throw new Error('commandRouter with handle(command, context) is required');
  }

  function execute(command, context = {}) {
    try {
      return commandRouter.handle(command || {}, context);
    } catch (error) {
      logger?.warn?.('[ControlCommandService] command failed', error.message || error);
      throw error;
    }
  }

  function executeHttp(command, context = {}) {
    return execute(command, {
      clientName: 'http',
      scope: 'http',
      transport: 'http',
      ...context,
    });
  }

  function executeWs(command, context = {}) {
    const isNewCommand = !!(
      command &&
      typeof command === 'object' &&
      Object.prototype.hasOwnProperty.call(command, 'payload') &&
      Object.prototype.hasOwnProperty.call(command, 'requestId')
    );
    if (isNewCommand) {
      return {
        handled: false,
        stop: true,
        ok: false,
        command,
        error: {
          code: 'TRANSPORT_NOT_ALLOWED',
          message: 'control commands must use HTTP POST /api/commands',
        },
      };
    }
    return execute(command, {
      transport: 'websocket',
      ...context,
    });
  }

  return {
    execute,
    executeHttp,
    executeWs,
    registerHandler: (handler) => commandRouter.register(handler),
  };
}

module.exports = {
  createControlCommandService,
};
