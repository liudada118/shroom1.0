const { JqbedAlgorithmConfigValidationError } = require('./jqbedAlgorithmConfig');

function buildJqbedGetDataArgs(data, activeFile, configEnvelope) {
  return activeFile === 'jqbed' && configEnvelope?.values
    ? { data, config: configEnvelope.values }
    : { data };
}

function isJqbedAlgorithmConfigMessage(message) {
  return Boolean(
    message?.getJqbedAlgorithmConfig
    || message?.setJqbedAlgorithmConfig
    || message?.resetJqbedAlgorithmConfig,
  );
}

function createJqbedAlgorithmProtocol({ store, sendJson, broadcastJson, getAlgorithmStatus }) {
  function sendResult(client, ok, action, errors = {}, message = null, requestId) {
    sendJson(client, {
      jqbedAlgorithmConfigResult: {
        ok,
        action,
        errors,
        message,
        ...(requestId !== undefined ? { requestId } : {}),
      },
    });
  }

  function handle(message, context) {
    if (!isJqbedAlgorithmConfigMessage(message)) return false;

    const { client, licenseValid, activeFile, realtime } = context;
    const action = message.setJqbedAlgorithmConfig ? 'save' : message.resetJqbedAlgorithmConfig ? 'reset' : 'load';
    const { requestId } = message;
    if (!licenseValid || activeFile !== 'jqbed' || !realtime) {
      sendResult(
        client,
        false,
        action,
        {},
        action === 'load'
          ? 'jqbedAlgorithmConfig.backend.unavailable'
          : 'jqbed realtime configuration is unavailable',
        requestId,
      );
      return true;
    }

    if (message.getJqbedAlgorithmConfig) {
      sendJson(client, {
        jqbedAlgorithmConfig: store.getSnapshot(),
        jqbedAlgorithmStatus: getAlgorithmStatus(),
        jqbedAlgorithmConfigResult: {
          ok: true,
          action: 'load',
          errors: {},
          message: null,
          ...(requestId !== undefined ? { requestId } : {}),
        },
      });
      return true;
    }

    try {
      const snapshot = action === 'save'
        ? store.save(message.setJqbedAlgorithmConfig)
        : store.reset();
      broadcastJson({ jqbedAlgorithmConfig: snapshot });
      sendResult(client, true, action, {}, null, requestId);
    } catch (error) {
      if (error instanceof JqbedAlgorithmConfigValidationError) {
        sendResult(client, false, action, { ...error.errors }, error.message, requestId);
      } else {
        sendResult(client, false, action, {}, 'Unable to save jqbed algorithm configuration', requestId);
      }
    }
    return true;
  }

  return { handle };
}

/**
 * 构造可挂载到 codeOpi 命令路由器的隔离处理器。
 *
 * 配置协议只允许主 WebSocket 入口调用；授权、当前传感器和回放状态由
 * runtimeContextFactory 的读取函数在每次请求时提供，模块本身不持有串口或
 * Electron 状态。
 */
function createJqbedAlgorithmCommandHandler({ protocol, getRuntimeContext }) {
  if (!protocol || typeof protocol.handle !== 'function') {
    throw new Error('jqbed algorithm protocol is required');
  }
  if (typeof getRuntimeContext !== 'function') {
    throw new Error('getRuntimeContext is required');
  }

  return {
    name: 'jqbed-algorithm-config',
    when: (message, context) => (
      context.scope === 'main' && isJqbedAlgorithmConfigMessage(message)
    ),
    handle: (message, context) => {
      const handled = protocol.handle(message, {
        ...getRuntimeContext(),
        client: context.client,
      });
      return { stop: handled };
    },
  };
}

module.exports = {
  buildJqbedGetDataArgs,
  createJqbedAlgorithmCommandHandler,
  createJqbedAlgorithmProtocol,
  isJqbedAlgorithmConfigMessage,
};
