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
  const logSubscribers = new Set();
  const logGenerations = new WeakMap();
  let logSequence = 0;

  function removeClient(client) {
    logSubscribers.delete(client);
    logGenerations.delete(client);
  }

  function captureLogSubscribers() {
    const recipients = [];
    for (const client of logSubscribers) {
      if (client?.readyState !== 1) {
        removeClient(client);
      } else {
        recipients.push({ client, generation: logGenerations.get(client) });
      }
    }
    return recipients;
  }

  function hasLogSubscribers() {
    return captureLogSubscribers().length > 0;
  }

  function publishLog(outputs, context, recipients = []) {
    if (!context?.licenseValid || context.activeFile !== 'jqbed' || !context.realtime
      || !outputs || typeof outputs !== 'object' || Array.isArray(outputs)) return 0;
    const currentRecipients = recipients.filter(({ client, generation }) => (
      client?.readyState === 1 && logSubscribers.has(client) && logGenerations.get(client) === generation
    ));
    if (!currentRecipients.length) return 0;
    const payload = {
      jqbedAlgorithmLog: {
        sensorType: 'jqbed',
        sequence: ++logSequence,
        receivedAt: new Date().toISOString(),
        outputs,
      },
    };
    let delivered = 0;
    for (const { client } of currentRecipients) {
      try {
        sendJson(client, payload);
        delivered += 1;
      } catch (_error) {
        removeClient(client);
      }
    }
    return delivered;
  }

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
    if (Object.prototype.hasOwnProperty.call(message || {}, 'subscribeJqbedAlgorithmLog')) {
      const { client, licenseValid, activeFile, realtime } = context;
      const requested = message.subscribeJqbedAlgorithmLog;
      const validRequest = typeof requested === 'boolean';
      const allowed = validRequest && (!requested || (
        licenseValid && activeFile === 'jqbed' && realtime && client?.readyState === 1
      ));
      if (!requested && validRequest) {
        removeClient(client);
      } else if (allowed) {
        logSubscribers.add(client);
        logGenerations.set(client, Symbol('jqbed algorithm log subscription'));
      } else if (requested === true) {
        removeClient(client);
      }
      sendJson(client, {
        jqbedAlgorithmLogSubscription: {
          ok: Boolean(allowed),
          subscribed: logSubscribers.has(client),
          ...(message.requestId !== undefined ? { requestId: message.requestId } : {}),
          ...(!allowed ? { message: 'jqbed realtime algorithm log is unavailable' } : {}),
        },
      });
      return true;
    }
    if (!isConfigMessage(message)) return false;

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

  return { handle, hasLogSubscribers, captureLogSubscribers, publishLog, removeClient };
}

module.exports = {
  buildJqbedGetDataArgs,
  createJqbedAlgorithmProtocol,
};
