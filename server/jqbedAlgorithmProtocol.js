const { JqbedAlgorithmConfigValidationError } = require('./jqbedAlgorithmConfig');

function buildJqbedGetDataArgs(data, activeFile, configEnvelope) {
  return activeFile === 'jqbed'
    ? { data, config: configEnvelope.values }
    : { data };
}

function isConfigMessage(message) {
  return Boolean(
    message?.getJqbedAlgorithmConfig
    || message?.setJqbedAlgorithmConfig
    || message?.resetJqbedAlgorithmConfig,
  );
}

function createJqbedAlgorithmProtocol({ store, sendJson, broadcastJson, getAlgorithmStatus }) {
  function sendResult(client, ok, action, errors = {}, message = null) {
    sendJson(client, {
      jqbedAlgorithmConfigResult: { ok, action, errors, message },
    });
  }

  function handle(message, context) {
    if (!isConfigMessage(message)) return false;

    const { client, licenseValid, activeFile, realtime } = context;
    const action = message.setJqbedAlgorithmConfig ? 'save' : message.resetJqbedAlgorithmConfig ? 'reset' : null;
    if (!licenseValid || activeFile !== 'jqbed' || !realtime) {
      if (action) {
        sendResult(client, false, action, {}, 'jqbed realtime configuration is unavailable');
      }
      return true;
    }

    if (message.getJqbedAlgorithmConfig) {
      sendJson(client, {
        jqbedAlgorithmConfig: store.getSnapshot(),
        jqbedAlgorithmStatus: getAlgorithmStatus(),
      });
      return true;
    }

    try {
      const snapshot = action === 'save'
        ? store.save(message.setJqbedAlgorithmConfig)
        : store.reset();
      broadcastJson({ jqbedAlgorithmConfig: snapshot });
      sendResult(client, true, action);
    } catch (error) {
      if (error instanceof JqbedAlgorithmConfigValidationError) {
        sendResult(client, false, action, { ...error.errors }, error.message);
      } else {
        sendResult(client, false, action, {}, 'Unable to save jqbed algorithm configuration');
      }
    }
    return true;
  }

  return { handle };
}

module.exports = {
  buildJqbedGetDataArgs,
  createJqbedAlgorithmProtocol,
};
