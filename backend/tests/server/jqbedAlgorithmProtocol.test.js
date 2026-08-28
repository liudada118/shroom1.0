const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_JQBED_ALGORITHM_VALUES,
  JqbedAlgorithmConfigValidationError,
} = require('../../kernel/algorithm-channel/jqbedAlgorithmConfig');
const {
  buildJqbedGetDataArgs,
  createJqbedAlgorithmCommandHandler,
  createJqbedAlgorithmProtocol,
} = require('../../kernel/algorithm-channel/jqbedAlgorithmProtocol');

function createProtocol({ save, reset } = {}) {
  const sent = [];
  const broadcasts = [];
  const snapshot = {
    version: 2,
    values: structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES),
    savedAt: null,
  };
  const store = {
    getSnapshot: () => structuredClone(snapshot),
    save: save || ((values) => {
      snapshot.values = structuredClone(values);
      return structuredClone(snapshot);
    }),
    reset: reset || (() => {
      snapshot.values = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
      return structuredClone(snapshot);
    }),
  };
  const protocol = createJqbedAlgorithmProtocol({
    store,
    sendJson: (_client, payload) => sent.push(payload),
    broadcastJson: (payload) => broadcasts.push(payload),
    getAlgorithmStatus: () => ({ state: 'ready', error: null }),
  });
  return { broadcasts, protocol, sent, store };
}

const authorizedContext = {
  client: {},
  licenseValid: true,
  activeFile: 'jqbed',
  realtime: true,
};

test('returns the authoritative snapshot only to an authorized realtime jqbed client', () => {
  const { broadcasts, protocol, sent, store } = createProtocol();

  assert.equal(protocol.handle({
    getJqbedAlgorithmConfig: true,
    requestId: 'load-1',
  }, authorizedContext), true);

  assert.deepEqual(sent[0].jqbedAlgorithmConfig, store.getSnapshot());
  assert.equal(sent[0].jqbedAlgorithmStatus.state, 'ready');
  assert.equal(sent[0].jqbedAlgorithmConfigResult.requestId, 'load-1');
  assert.deepEqual(broadcasts, []);
});

test('rejects unlicensed, non-jqbed and playback requests without mutation', () => {
  for (const context of [
    { ...authorizedContext, licenseValid: false },
    { ...authorizedContext, activeFile: 'smallBed' },
    { ...authorizedContext, realtime: false },
  ]) {
    let saveCalls = 0;
    const { broadcasts, protocol, sent } = createProtocol({
      save: () => { saveCalls += 1; },
    });

    assert.equal(protocol.handle({
      setJqbedAlgorithmConfig: DEFAULT_JQBED_ALGORITHM_VALUES,
      requestId: 'save-1',
    }, context), true);
    assert.equal(sent[0].jqbedAlgorithmConfigResult.ok, false);
    assert.equal(sent[0].jqbedAlgorithmConfigResult.requestId, 'save-1');
    assert.equal(saveCalls, 0);
    assert.deepEqual(broadcasts, []);
  }
});

test('broadcasts snapshots after save and reset but keeps validation errors private', () => {
  const values = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
  values.threshold_factor = 2.5;
  const success = createProtocol();

  success.protocol.handle({ setJqbedAlgorithmConfig: values }, authorizedContext);
  success.protocol.handle({ resetJqbedAlgorithmConfig: true }, authorizedContext);
  assert.deepEqual(success.broadcasts[0].jqbedAlgorithmConfig.values, values);
  assert.deepEqual(success.broadcasts[1].jqbedAlgorithmConfig.values, DEFAULT_JQBED_ALGORITHM_VALUES);

  const rejected = createProtocol({
    save: () => {
      throw new JqbedAlgorithmConfigValidationError({ threshold_factor: 'nonnegative' });
    },
  });
  rejected.protocol.handle({ setJqbedAlgorithmConfig: values }, authorizedContext);
  assert.deepEqual(rejected.sent[0].jqbedAlgorithmConfigResult.errors, {
    threshold_factor: 'nonnegative',
  });
  assert.deepEqual(rejected.broadcasts, []);
});

test('isolates dynamic Python arguments to jqbed', () => {
  const envelope = {
    version: 2,
    values: structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES),
    savedAt: null,
  };
  const data = [1, 2, 3];

  assert.deepEqual(buildJqbedGetDataArgs(data, 'jqbed', envelope), {
    data,
    config: envelope.values,
  });
  assert.deepEqual(buildJqbedGetDataArgs(data, 'smallBed', envelope), { data });
  assert.deepEqual(buildJqbedGetDataArgs(data, 'jqbed', null), { data });
});

test('command handler mounts the protocol only on the primary websocket scope', () => {
  const calls = [];
  const client = { readyState: 1 };
  const handler = createJqbedAlgorithmCommandHandler({
    protocol: {
      handle: (message, context) => {
        calls.push({ message, context });
        return true;
      },
    },
    getRuntimeContext: () => ({
      activeFile: 'jqbed',
      licenseValid: true,
      realtime: true,
    }),
  });
  const message = { getJqbedAlgorithmConfig: true };

  assert.equal(handler.when(message, { scope: 'back' }), false);
  assert.equal(handler.when(message, { scope: 'main' }), true);
  assert.deepEqual(handler.handle(message, { client, scope: 'main' }), { stop: true });
  assert.equal(calls[0].context.client, client);
  assert.equal(calls[0].context.activeFile, 'jqbed');
});

test('ignores unrelated websocket messages', () => {
  const { broadcasts, protocol, sent } = createProtocol();
  assert.equal(protocol.handle({ play: true }, authorizedContext), false);
  assert.deepEqual(sent, []);
  assert.deepEqual(broadcasts, []);
});
