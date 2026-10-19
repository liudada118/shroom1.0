const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  JQBED_ALGORITHM_CONFIG_VERSION,
  DEFAULT_JQBED_ALGORITHM_VALUES,
  JqbedAlgorithmConfigValidationError,
} = require('../server/jqbedAlgorithmConfig');
const {
  buildJqbedGetDataArgs,
  createJqbedAlgorithmProtocol,
} = require('../server/jqbedAlgorithmProtocol');

function createSnapshot(values = DEFAULT_JQBED_ALGORITHM_VALUES, savedAt = null) {
  return { version: JQBED_ALGORITHM_CONFIG_VERSION, values: structuredClone(values), savedAt };
}

function createProtocol({ save, reset, sendJson } = {}) {
  const sent = [];
  const deliveries = [];
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
    sendJson: sendJson || ((client, payload) => {
      sent.push(payload);
      deliveries.push({ client, payload });
    }),
    broadcastJson: (payload) => broadcasts.push(payload),
    getAlgorithmStatus: () => ({ state: 'ready', error: null }),
  });
  return { protocol, sent, broadcasts, store, deliveries };
}

const authorizedContext = { client: {}, licenseValid: true, activeFile: 'jqbed', realtime: true };

test('returns the backend snapshot for an authorized realtime jqbed request', () => {
  const { protocol, sent, broadcasts, store } = createProtocol();
  const handled = protocol.handle({
    getJqbedAlgorithmConfig: true,
    requestId: 'load-request-1',
  }, authorizedContext);
  assert.equal(handled, true);
  assert.deepEqual(sent[0].jqbedAlgorithmConfig, store.getSnapshot());
  assert.equal(sent[0].jqbedAlgorithmStatus.state, 'ready');
  assert.deepEqual(sent[0].jqbedAlgorithmConfigResult, {
    ok: true,
    action: 'load',
    errors: {},
    message: null,
    requestId: 'load-request-1',
  });
  assert.deepEqual(broadcasts, []);
});

test('explicitly rejects every unauthorized GET with its requestId', () => {
  for (const context of [
    { licenseValid: false, activeFile: 'jqbed', realtime: true },
    { licenseValid: true, activeFile: 'smallBed', realtime: true },
    { licenseValid: true, activeFile: 'jqbed', realtime: false },
  ]) {
    const { protocol, sent, broadcasts } = createProtocol();
    assert.equal(protocol.handle({
      getJqbedAlgorithmConfig: true,
      requestId: 'rejected-load',
    }, { client: {}, ...context }), true);
    assert.deepEqual(sent, [{
      jqbedAlgorithmConfigResult: {
        ok: false,
        action: 'load',
        errors: {},
        message: 'jqbedAlgorithmConfig.backend.unavailable',
        requestId: 'rejected-load',
      },
    }]);
    assert.deepEqual(broadcasts, []);
  }
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

const logClient = () => ({ readyState: 1 });
const logContext = (client, overrides = {}) => ({ ...authorizedContext, client, ...overrides });
const subscribe = (protocol, client, enabled = true, overrides = {}) => protocol.handle({
  subscribeJqbedAlgorithmLog: enabled,
  requestId: 'log-subscription-request',
}, logContext(client, overrides));

test('acknowledges algorithm log subscriptions independently of configuration results', () => {
  const { protocol, sent, broadcasts } = createProtocol();
  const client = logClient();
  assert.equal(protocol.hasLogSubscribers(), false);
  assert.equal(subscribe(protocol, client), true);
  assert.deepEqual(sent, [{
    jqbedAlgorithmLogSubscription: {
      ok: true, subscribed: true, requestId: 'log-subscription-request',
    },
  }]);
  assert.equal(protocol.hasLogSubscribers(), true);
  assert.deepEqual(broadcasts, []);
});

for (const [name, context] of [
  ['unlicensed', { licenseValid: false }],
  ['another system', { activeFile: 'smallBed' }],
  ['playback', { realtime: false }],
]) {
  test(`rejects log subscription in ${name} context`, () => {
    const { protocol, sent } = createProtocol();
    subscribe(protocol, logClient(), true, context);
    assert.equal(sent[0].jqbedAlgorithmLogSubscription.ok, false);
    assert.equal(sent[0].jqbedAlgorithmLogSubscription.subscribed, false);
    assert.equal(protocol.hasLogSubscribers(), false);
  });
}

test('allows unsubscribe after license, system, and realtime eligibility have changed', () => {
  const { protocol, sent } = createProtocol();
  const client = logClient();
  subscribe(protocol, client);
  const recipients = protocol.captureLogSubscribers();
  subscribe(protocol, client, false, { licenseValid: false, activeFile: 'petCare', realtime: false });
  assert.deepEqual(sent.at(-1), {
    jqbedAlgorithmLogSubscription: {
      ok: true, subscribed: false, requestId: 'log-subscription-request',
    },
  });
  assert.equal(protocol.hasLogSubscribers(), false);
  assert.equal(protocol.publishLog({ rate: -1 }, authorizedContext, recipients), 0);
});

test('rejects nonboolean subscription values without treating them as configuration mutations', () => {
  for (const value of ['true', 'false', 1, 0, null, {}, []]) {
    const { protocol, sent, broadcasts } = createProtocol();
    assert.equal(subscribe(protocol, logClient(), value), true);
    assert.equal(sent[0].jqbedAlgorithmLogSubscription.ok, false);
    assert.equal(protocol.hasLogSubscribers(), false);
    assert.deepEqual(broadcasts, []);
  }
});

test('sends complete named native output only to subscribed clients, including initialization frames', () => {
  const { protocol, sent, deliveries, broadcasts } = createProtocol();
  const first = logClient();
  const second = logClient();
  const stranger = logClient();
  subscribe(protocol, first);
  subscribe(protocol, second);
  const recipients = protocol.captureLogSubscribers();
  const outputs = {
    rate: -1,
    state_in_bed: -1,
    matrix_origin: new Array(1024).fill(1.25),
    matrix_filter: new Array(1024).fill(0),
    reserved_bytes: new Array(10).fill(-1),
    future_key: { nested: [1, null, 0] },
  };
  assert.equal(protocol.publishLog(outputs, authorizedContext, recipients), 2);
  const logs = sent.filter((payload) => payload.jqbedAlgorithmLog);
  assert.equal(logs.length, 2);
  assert.deepEqual(logs[0].jqbedAlgorithmLog.outputs, outputs);
  assert.equal(logs[0].jqbedAlgorithmLog.sensorType, 'jqbed');
  assert.equal(logs[0].jqbedAlgorithmLog.sequence, 1);
  assert.match(logs[0].jqbedAlgorithmLog.receivedAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  assert.equal(logs[1].jqbedAlgorithmLog.sequence, 1);
  assert.equal(deliveries.some(({ client }) => client === stranger), false);
  assert.deepEqual(broadcasts, []);
  protocol.publishLog({ rate: 15 }, authorizedContext, recipients);
  assert.equal(sent.at(-1).jqbedAlgorithmLog.sequence, 2);
});

test('does not publish diagnostics without an explicit request-time recipient snapshot', () => {
  const { protocol, sent } = createProtocol();
  subscribe(protocol, logClient());
  assert.equal(protocol.publishLog({ rate: -1 }, authorizedContext), 0);
  assert.equal(sent.filter((payload) => payload.jqbedAlgorithmLog).length, 0);
});

test('new or renewed subscriptions do not receive outputs requested by an earlier session', () => {
  const { protocol, sent } = createProtocol();
  const client = logClient();
  const laterClient = logClient();
  subscribe(protocol, client);
  const oldRecipients = protocol.captureLogSubscribers();
  subscribe(protocol, laterClient);
  subscribe(protocol, client, false);
  subscribe(protocol, client);
  assert.equal(protocol.publishLog({ rate: 15 }, authorizedContext, oldRecipients), 0);
  assert.equal(sent.filter((payload) => payload.jqbedAlgorithmLog).length, 0);
  assert.equal(protocol.publishLog({ rate: 16 }, authorizedContext, protocol.captureLogSubscribers()), 2);
});

test('removes disconnected subscribers explicitly and prunes closed sockets before requesting raw outputs', () => {
  const { protocol, sent } = createProtocol();
  const client = logClient();
  subscribe(protocol, client);
  const recipients = protocol.captureLogSubscribers();
  protocol.removeClient(client);
  assert.equal(protocol.hasLogSubscribers(), false);
  assert.equal(protocol.publishLog({ rate: 15 }, authorizedContext, recipients), 0);
  subscribe(protocol, client);
  client.readyState = 3;
  assert.equal(protocol.hasLogSubscribers(), false);
  assert.equal(sent.filter((payload) => payload.jqbedAlgorithmLog).length, 0);
});

test('checks current authorization, system, and playback context again before publication', () => {
  const { protocol, sent } = createProtocol();
  subscribe(protocol, logClient());
  const recipients = protocol.captureLogSubscribers();
  for (const context of [
    { ...authorizedContext, licenseValid: false },
    { ...authorizedContext, activeFile: 'smallBed' },
    { ...authorizedContext, realtime: false },
  ]) {
    assert.equal(protocol.publishLog({ rate: 15 }, context, recipients), 0);
  }
  for (const invalidOutputs of [undefined, null, 1, 'raw', []]) {
    assert.equal(protocol.publishLog(invalidOutputs, authorizedContext, recipients), 0);
  }
  assert.equal(sent.filter((payload) => payload.jqbedAlgorithmLog).length, 0);
});

test('failed socket writes remove only the affected log subscriber', () => {
  const broken = logClient();
  const healthy = logClient();
  const logs = [];
  const { protocol } = createProtocol({ sendJson: (client, payload) => {
    if (!payload.jqbedAlgorithmLog) return;
    if (client === broken) throw new Error('socket closed during send');
    logs.push(payload);
  } });
  subscribe(protocol, broken);
  subscribe(protocol, healthy);
  assert.equal(protocol.publishLog({ rate: -1 }, authorizedContext, protocol.captureLogSubscribers()), 1);
  assert.equal(logs.length, 1);
  assert.deepEqual(protocol.captureLogSubscribers().map(({ client }) => client), [healthy]);
});

test('primary websocket close removes its algorithm log subscriber', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const primaryConnection = source.indexOf('server.on("connection", function connection(ws, req) {');
  assert.match(source.slice(primaryConnection), /ws\.on\('close', \(\) => jqbedAlgorithmProtocol\.removeClient\(ws\)\)/);
});
