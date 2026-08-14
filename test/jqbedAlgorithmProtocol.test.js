const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_JQBED_ALGORITHM_VALUES,
  JqbedAlgorithmConfigValidationError,
} = require('../server/jqbedAlgorithmConfig');
const {
  buildJqbedGetDataArgs,
  createJqbedAlgorithmProtocol,
} = require('../server/jqbedAlgorithmProtocol');

function createSnapshot(values = DEFAULT_JQBED_ALGORITHM_VALUES, savedAt = null) {
  return { version: 1, values: structuredClone(values), savedAt };
}

function createProtocol({ save, reset } = {}) {
  const sent = [];
  const broadcasts = [];
  const snapshot = createSnapshot();
  const store = {
    getSnapshot: () => structuredClone(snapshot),
    save: save || ((values) => {
      snapshot.values = structuredClone(values);
      snapshot.savedAt = '2026-08-14T08:00:00.000Z';
      return structuredClone(snapshot);
    }),
    reset: reset || (() => {
      snapshot.values = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
      snapshot.savedAt = '2026-08-14T08:00:00.000Z';
      return structuredClone(snapshot);
    }),
  };
  const protocol = createJqbedAlgorithmProtocol({
    store,
    sendJson: (_client, payload) => sent.push(payload),
    broadcastJson: (payload) => broadcasts.push(payload),
    getAlgorithmStatus: () => ({ state: 'ready', error: null }),
  });
  return { protocol, sent, broadcasts, store };
}

const authorizedContext = { client: {}, licenseValid: true, activeFile: 'jqbed', realtime: true };

test('returns the backend snapshot for an authorized realtime jqbed request', () => {
  const { protocol, sent, broadcasts, store } = createProtocol();
  const handled = protocol.handle({ getJqbedAlgorithmConfig: true }, authorizedContext);
  assert.equal(handled, true);
  assert.deepEqual(sent[0].jqbedAlgorithmConfig, store.getSnapshot());
  assert.equal(sent[0].jqbedAlgorithmStatus.state, 'ready');
  assert.deepEqual(broadcasts, []);
});

test('rejects save outside licensed realtime jqbed without mutating the store', () => {
  for (const context of [
    { licenseValid: false, activeFile: 'jqbed', realtime: true },
    { licenseValid: true, activeFile: 'smallBed', realtime: true },
    { licenseValid: true, activeFile: 'jqbed', realtime: false },
  ]) {
    let saveCalls = 0;
    const { protocol, sent, broadcasts } = createProtocol({
      save: () => { saveCalls += 1; },
    });
    assert.equal(protocol.handle({ setJqbedAlgorithmConfig: DEFAULT_JQBED_ALGORITHM_VALUES }, { client: {}, ...context }), true);
    assert.deepEqual(sent.at(-1).jqbedAlgorithmConfigResult, {
      ok: false,
      action: 'save',
      errors: {},
      message: 'jqbed realtime configuration is unavailable',
    });
    assert.equal(saveCalls, 0);
    assert.deepEqual(broadcasts, []);
  }
});

test('broadcasts authoritative snapshots after successful save and reset', () => {
  const { protocol, sent, broadcasts } = createProtocol();
  const savedValues = structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES);
  savedValues.threshold_factor = 2.5;
  assert.equal(protocol.handle({ setJqbedAlgorithmConfig: savedValues }, authorizedContext), true);
  assert.deepEqual(broadcasts[0].jqbedAlgorithmConfig.values, savedValues);
  assert.deepEqual(sent[0].jqbedAlgorithmConfigResult, { ok: true, action: 'save', errors: {}, message: null });

  assert.equal(protocol.handle({ resetJqbedAlgorithmConfig: true }, authorizedContext), true);
  assert.deepEqual(broadcasts[1].jqbedAlgorithmConfig.values, DEFAULT_JQBED_ALGORITHM_VALUES);
  assert.deepEqual(sent[1].jqbedAlgorithmConfigResult, { ok: true, action: 'reset', errors: {}, message: null });
});

test('echoes the opaque requestId on successful and rejected mutation results', () => {
  const success = createProtocol();
  success.protocol.handle({
    setJqbedAlgorithmConfig: DEFAULT_JQBED_ALGORITHM_VALUES,
    requestId: 'save-request-7',
  }, authorizedContext);
  assert.equal(success.sent[0].jqbedAlgorithmConfigResult.requestId, 'save-request-7');

  const rejected = createProtocol();
  rejected.protocol.handle({
    resetJqbedAlgorithmConfig: true,
    requestId: 'reset-request-9',
  }, { ...authorizedContext, realtime: false });
  assert.equal(rejected.sent[0].jqbedAlgorithmConfigResult.requestId, 'reset-request-9');
});

test('returns validation field codes only to the requesting client', () => {
  const { protocol, sent, broadcasts } = createProtocol({
    save: () => { throw new JqbedAlgorithmConfigValidationError({ threshold_factor: 'nonnegative' }); },
  });
  protocol.handle({ setJqbedAlgorithmConfig: DEFAULT_JQBED_ALGORITHM_VALUES }, authorizedContext);
  assert.deepEqual(sent[0].jqbedAlgorithmConfigResult, {
    ok: false,
    action: 'save',
    errors: { threshold_factor: 'nonnegative' },
    message: 'Invalid jqbed algorithm configuration',
  });
  assert.deepEqual(broadcasts, []);
});

test('does not broadcast when persistence fails', () => {
  const { protocol, sent, broadcasts } = createProtocol({
    save: () => { throw new Error('disk full'); },
  });
  protocol.handle({ setJqbedAlgorithmConfig: DEFAULT_JQBED_ALGORITHM_VALUES }, authorizedContext);
  assert.deepEqual(sent[0].jqbedAlgorithmConfigResult, {
    ok: false,
    action: 'save',
    errors: {},
    message: 'Unable to save jqbed algorithm configuration',
  });
  assert.deepEqual(broadcasts, []);
});

test('ignores unrelated websocket messages', () => {
  const { protocol, sent, broadcasts } = createProtocol();
  assert.equal(protocol.handle({ play: true }, authorizedContext), false);
  assert.deepEqual(sent, []);
  assert.deepEqual(broadcasts, []);
});

test('includes configuration in Python arguments only for jqbed', () => {
  const data = [1, 2, 3];
  const config = createSnapshot();
  assert.deepEqual(buildJqbedGetDataArgs(data, 'jqbed', config), { data, config: config.values });
  assert.deepEqual(buildJqbedGetDataArgs(data, 'smallBed', config), { data });
});

test('mounts the jqbed protocol dispatcher only on the primary 19999 websocket', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const legacyConnection = source.indexOf('server1.on("connection", function connection(ws, req) {');
  const primaryConnection = source.indexOf('server.on("connection", function connection(ws, req) {');
  const dispatcher = 'jqbedAlgorithmProtocol.handle(getMessage, {';
  assert.ok(legacyConnection >= 0);
  assert.ok(primaryConnection > legacyConnection);
  assert.doesNotMatch(source.slice(legacyConnection, primaryConnection), new RegExp(dispatcher.replace(/[().{}]/g, '\\$&')));
  assert.match(source.slice(primaryConnection), new RegExp(dispatcher.replace(/[().{}]/g, '\\$&')));
  assert.equal(source.split(dispatcher).length - 1, 1);
});

test('uses one pre-await activeFile snapshot throughout each jqbed timer call', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const timerStart = source.indexOf('jqbedTimer = setInterval(async () => {');
  const timerEnd = source.indexOf('function startPetCareTimer', timerStart);
  const timer = source.slice(timerStart, timerEnd);
  assert.ok(timerStart >= 0 && timerEnd > timerStart);
  assert.ok(timer.indexOf('const activeFile = file;') < timer.indexOf('await callPy('));
  assert.match(timer, /buildJqbedGetDataArgs\(\s*newArr,\s*activeFile,/);
  assert.match(timer, /normalizeVitalSignsHeartRate\(rawData, activeFile\)/);
  assert.equal((timer.match(/if \(activeFile === 'jqbed'\)/g) || []).length, 2);
});
