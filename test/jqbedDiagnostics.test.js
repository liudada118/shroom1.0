const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createJqbedAlgorithmProtocol } = require('../server/jqbedAlgorithmProtocol');

const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const timerStart = source.indexOf('jqbedTimer = setInterval(async () => {');
const timerEnd = source.indexOf('function startPetCareTimer', timerStart);
assert.ok(timerStart >= 0 && timerEnd > timerStart, 'real jqbed timer is available');
const timerSource = source.slice(timerStart, timerEnd);

function result(overrides = {}) {
  return {
    rate: 15,
    heart_rate: 70,
    stateInBbed: 1,
    sosflag: 0,
    merged_alarm: 0,
    reserved_bytes: [122, 37, 0, 5, 2, 1, 777, -1],
    ...overrides,
  };
}

function createHarness({ output = result(), file = 'jqbed', local = false, licensed = true, subscribed = false } = {}) {
  let tick;
  const sent = [];
  const calls = [];
  const statuses = [];
  const errors = [];
  const normalizations = [];
  const logs = [];
  const logAcknowledgements = [];
  const permission = { licensed };
  const snapshot = { values: { sensitivity_threshold: 0, isLowBed: 0 } };
  const sandbox = {
    jqbedTimer: null,
    pointArr: [1, 2, 3, 4],
    file,
    localFlag: local,
    port1: { isOpen: true },
    onbedArr: [],
    onBedTime: 0,
    jqbedMatrixOrigin: null,
    jqbedOppo: (values) => values.slice().reverse(),
    jqbedAlgorithmConfigStore: { getSnapshot: () => structuredClone(snapshot) },
    buildJqbedGetDataArgs: (data, activeFile, config) => (
      activeFile === 'jqbed' ? { data, config: config.values } : { data }
    ),
    callPy: async (method, args) => {
      calls.push({ method, args });
      return typeof output === 'function' ? output() : output;
    },
    normalizeVitalSignsHeartRate: (data, activeFile) => {
      normalizations.push(activeFile);
      return { ...data };
    },
    setJqbedAlgorithmStatus: (status) => statuses.push(status),
    licenseManager: { isLicenseValid: () => permission.licensed },
    server: {
      clients: [
        { readyState: 1, send: (message) => sent.push(JSON.parse(message)) },
        { readyState: 3, send: () => assert.fail('closed sockets must not receive data') },
      ],
    },
    WebSocket: { OPEN: 1 },
    console: { error: (...args) => errors.push(args) },
    setInterval: (callback, interval) => {
      assert.equal(interval, 125);
      tick = callback;
      return 1;
    },
  };
  const protocol = createJqbedAlgorithmProtocol({
    store: sandbox.jqbedAlgorithmConfigStore,
    getAlgorithmStatus: () => ({ state: 'ready' }),
    broadcastJson: () => assert.fail('algorithm logs must not use the broadcast channel'),
    sendJson: (client, payload) => {
      if (payload.jqbedAlgorithmLog) logs.push({ client, payload: structuredClone(payload) });
      else logAcknowledgements.push({ client, payload });
    },
  });
  sandbox.jqbedAlgorithmProtocol = protocol;
  const primaryClient = sandbox.server.clients[0];
  const subscribe = (enabled = true, client = primaryClient) => protocol.handle({
    subscribeJqbedAlgorithmLog: enabled,
  }, { client, licenseValid: permission.licensed, activeFile: sandbox.file, realtime: !sandbox.localFlag });
  if (subscribed) subscribe();
  vm.runInNewContext(timerSource, sandbox, { filename: 'server.js:jqbedTimer' });
  return { tick, sandbox, sent, calls, statuses, errors, normalizations, permission, snapshot,
    protocol, primaryClient, subscribe, logs, logAcknowledgements };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('combines sourced diagnostics and physiological results in one real timer websocket message', async () => {
  const output = result();
  const harness = createHarness({ output });
  await harness.tick();
  assert.equal(harness.sent.length, 1);
  assert.deepEqual(harness.sent[0].jqbedAlgorithmDiagnostics, {
    sensorType: 'jqbed',
    reserved_bytes: output.reserved_bytes,
    merged_alarm: output.merged_alarm,
    sosflag: output.sosflag,
  });
  assert.equal(harness.sent[0].rate.rate, 15);
  assert.equal(harness.sent[0].rate.sosflag, 0);
  assert.equal(harness.sent[0].rate.onBedTime, 2);
  assert.deepEqual(harness.normalizations, ['jqbed']);
  assert.deepEqual(harness.errors, []);
});

test('preserves zero sensitivity and high-bed zero without substituting configuration values', async () => {
  const reserved = [0, 0, 0, 0, 0, 0];
  const harness = createHarness({ output: result({ reserved_bytes: reserved }) });
  harness.snapshot.values = { sensitivity_threshold: 3, isLowBed: 1 };
  await harness.tick();
  assert.deepEqual(harness.sent[0].jqbedAlgorithmDiagnostics.reserved_bytes, reserved);
  assert.deepEqual(harness.snapshot.values, { sensitivity_threshold: 3, isLowBed: 1 });
});

test('preserves all native reserved positions and initialization sentinels when rate is unavailable', async () => {
  const reserved = [-1, -1, -1, -1, -1, -1, 19, 20];
  const harness = createHarness({ output: result({ rate: -1, reserved_bytes: reserved }) });
  await harness.tick();
  assert.deepEqual(harness.sent, [{
    jqbedAlgorithmDiagnostics: {
      sensorType: 'jqbed', reserved_bytes: reserved, merged_alarm: 0, sosflag: 0,
    },
  }]);
  assert.deepEqual(harness.normalizations, []);
  assert.deepEqual(harness.sandbox.onbedArr, []);
  assert.equal(harness.sandbox.onBedTime, 0);
});

for (const [name, reserved] of [['missing', undefined], ['null', null], ['object', { 4: 2, 5: 1 }]]) {
  test(`clears stale diagnostics using an empty array for ${name} legacy reserved output`, async () => {
    const harness = createHarness({ output: result({ rate: -1, reserved_bytes: reserved }) });
    await harness.tick();
    assert.deepEqual(harness.sent, [{
      jqbedAlgorithmDiagnostics: {
        sensorType: 'jqbed', reserved_bytes: [], merged_alarm: 0, sosflag: 0,
      },
    }]);
  });
}

for (const [merged_alarm, sosflag] of [[10, 1], [0, 0], [-1, -1]]) {
  test(`publishes raw alarm values ${merged_alarm}/${sosflag} when rate is unavailable without log subscribers`, async () => {
    const harness = createHarness({ output: result({ rate: -1, merged_alarm, sosflag }) });
    await harness.tick();
    assert.equal(harness.sent.length, 1);
    assert.equal(harness.sent[0].jqbedAlgorithmDiagnostics.merged_alarm, merged_alarm);
    assert.equal(harness.sent[0].jqbedAlgorithmDiagnostics.sosflag, sosflag);
    assert.equal(harness.sent[0].rate, undefined);
    assert.equal(Object.hasOwn(harness.calls[0].args, 'includeRawOutputs'), false);
    assert.deepEqual(harness.logs, []);
    assert.deepEqual(harness.normalizations, []);
    assert.equal(harness.sandbox.onBedTime, 0);
  });
}

test('does not invent alarm values when legacy output omits them', async () => {
  const harness = createHarness({ output: { rate: -1 } });
  await harness.tick();
  assert.deepEqual(harness.sent, [{
    jqbedAlgorithmDiagnostics: { sensorType: 'jqbed', reserved_bytes: [] },
  }]);
});

test('does not send standalone alarm diagnostics for smallBed', async () => {
  const harness = createHarness({ file: 'smallBed', output: result({ rate: -1, merged_alarm: 10, sosflag: 1 }) });
  await harness.tick();
  assert.deepEqual(harness.sent, []);
});

test('does not attach jqbed diagnostics to the shared smallBed algorithm timer result', async () => {
  const harness = createHarness({ file: 'smallBed' });
  await harness.tick();
  assert.equal(harness.calls.length, 1);
  assert.equal(harness.sent.length, 1);
  assert.equal(harness.sent[0].jqbedAlgorithmDiagnostics, undefined);
  assert.equal(harness.sent[0].rate.rate, 15);
  assert.deepEqual(harness.normalizations, ['smallBed']);
});

test('does not invoke the bed algorithm for an unrelated system', async () => {
  const harness = createHarness({ file: 'petCare' });
  await harness.tick();
  assert.deepEqual(harness.calls, []);
  assert.deepEqual(harness.sent, []);
});

for (const [name, update] of [
  ['a system switch', (harness) => { harness.sandbox.file = 'smallBed'; }],
  ['entering playback', (harness) => { harness.sandbox.localFlag = true; }],
  ['closing the serial port', (harness) => { harness.sandbox.port1.isOpen = false; }],
  ['removing the serial port', (harness) => { harness.sandbox.port1 = null; }],
  ['replacing the serial connection', (harness) => { harness.sandbox.port1 = { isOpen: true }; }],
  ['license expiration', (harness) => { harness.permission.licensed = false; }],
]) {
  test(`suppresses diagnostics after ${name} while the Python request is in flight`, async () => {
    const pending = deferred();
    const harness = createHarness({ output: () => pending.promise });
    const ticking = harness.tick();
    assert.equal(harness.calls.length, 1);
    update(harness);
    pending.resolve(result());
    await ticking;
    assert.equal(harness.sent.length, 1, 'existing physiological result behavior remains intact');
    assert.equal(harness.sent[0].jqbedAlgorithmDiagnostics, undefined);
    assert.equal(harness.sent[0].rate.rate, 15);
    assert.deepEqual(harness.errors, []);
  });
}

test('does not publish a request started in playback after returning to realtime', async () => {
  const pending = deferred();
  const harness = createHarness({ local: true, output: () => pending.promise });
  const ticking = harness.tick();
  harness.sandbox.localFlag = false;
  pending.resolve(result());
  await ticking;
  assert.equal(harness.sent[0].jqbedAlgorithmDiagnostics, undefined);
});

for (const options of [{ local: true }, { licensed: false }]) {
  test(`does not send standalone diagnostics outside licensed realtime: ${JSON.stringify(options)}`, async () => {
    const harness = createHarness({ ...options, output: result({ rate: -1 }) });
    await harness.tick();
    assert.deepEqual(harness.sent, []);
  });
}

test('preserves the existing rate filter and state transition timer behavior', async () => {
  const harness = createHarness();
  await harness.tick();
  await harness.tick();
  assert.equal(harness.sent[0].rate.onBedTime, 2);
  assert.equal(harness.sent[1].rate.onBedTime, 4);
  assert.equal(harness.sandbox.onbedArr.length, 2);
  assert.deepEqual(harness.sandbox.onbedArr.map(Number), [1, 1]);
});

test('does not fabricate diagnostics from configuration when the Python call fails', async () => {
  const harness = createHarness({ output: () => { throw new Error('native algorithm unavailable'); } });
  await harness.tick();
  assert.deepEqual(harness.sent, []);
  assert.equal(harness.statuses.at(-1).state, 'error');
  assert.equal(harness.errors.length, 1);
});

function completeOutputs(rate = -1) {
  return {
    rate,
    stroke_risk: 4,
    state_in_bed: 1,
    matrix_origin: new Array(1024).fill(1.25),
    matrix_filter: new Array(1024).fill(0),
    reserved_bytes: new Array(10).fill(-1),
    sos_signal_out: new Array(159).fill(0),
    future_key: { nested: [0, null, 1] },
  };
}

test('requests and publishes complete raw outputs only with a current log subscription', async () => {
  const outputs = completeOutputs(15);
  const harness = createHarness({ subscribed: true, output: result({ raw_outputs: outputs }) });
  await harness.tick();
  assert.equal(harness.calls[0].args.includeRawOutputs, true);
  assert.equal(harness.logs.length, 1);
  assert.deepEqual(harness.logs[0].payload.jqbedAlgorithmLog.outputs, outputs);
  assert.equal(harness.logs[0].client, harness.primaryClient);
  assert.equal(harness.sent.length, 1);
  assert.equal(harness.sent[0].rate.raw_outputs, undefined);
  assert.equal(harness.sent[0].jqbedAlgorithmDiagnostics.raw_outputs, undefined);
  assert.equal(JSON.stringify(harness.sent).includes('future_key'), false);
});

test('adds neither a raw-output RPC flag nor a log payload without subscribers', async () => {
  const harness = createHarness();
  await harness.tick();
  assert.equal(Object.hasOwn(harness.calls[0].args, 'includeRawOutputs'), false);
  assert.deepEqual(harness.logs, []);
  assert.equal(harness.sent[0].rate.raw_outputs, undefined);
});

test('strips unsolicited raw outputs from legacy broadcasts even without a subscription', async () => {
  const output = result({ raw_outputs: completeOutputs(15) });
  const harness = createHarness({ output });
  await harness.tick();
  assert.equal(Object.hasOwn(harness.calls[0].args, 'includeRawOutputs'), false);
  assert.deepEqual(harness.logs, []);
  assert.equal(harness.sent[0].rate.raw_outputs, undefined);
  assert.ok(output.raw_outputs, 'stripping must not mutate the original RPC response fixture');
  assert.equal(JSON.stringify(harness.sent).includes('future_key'), false);
});

test('publishes every initialization result as a complete log without bypassing the legacy rate filter', async () => {
  const outputs = completeOutputs();
  const harness = createHarness({ subscribed: true, output: result({ rate: -1, raw_outputs: outputs }) });
  await harness.tick();
  await harness.tick();
  assert.equal(harness.logs.length, 2);
  assert.deepEqual(harness.logs[0].payload.jqbedAlgorithmLog.outputs, outputs);
  assert.equal(harness.logs[1].payload.jqbedAlgorithmLog.sequence, 2);
  assert.equal(harness.sent[0].rate, undefined);
  assert.equal(harness.sandbox.onBedTime, 0);
});

test('does not fabricate raw logs when an older Python runtime omits raw_outputs', async () => {
  const harness = createHarness({ subscribed: true });
  await harness.tick();
  assert.equal(harness.calls[0].args.includeRawOutputs, true);
  assert.deepEqual(harness.logs, []);
  assert.equal(harness.sent[0].rate.rate, 15);
});

for (const [name, update] of [
  ['system change', (h) => { h.sandbox.file = 'smallBed'; }],
  ['playback', (h) => { h.sandbox.localFlag = true; }],
  ['port closure', (h) => { h.sandbox.port1.isOpen = false; }],
  ['port replacement', (h) => { h.sandbox.port1 = { isOpen: true }; }],
  ['license expiration', (h) => { h.permission.licensed = false; }],
  ['unsubscribe', (h) => { h.subscribe(false); }],
  ['client close', (h) => { h.primaryClient.readyState = 3; h.protocol.removeClient(h.primaryClient); }],
  ['subscription renewal', (h) => { h.subscribe(false); h.subscribe(true); }],
]) {
  test(`discards a complete in-flight log after ${name}`, async () => {
    const pending = deferred();
    const harness = createHarness({ subscribed: true, output: () => pending.promise });
    const ticking = harness.tick();
    assert.equal(harness.calls[0].args.includeRawOutputs, true);
    update(harness);
    pending.resolve(result({ raw_outputs: completeOutputs(15) }));
    await ticking;
    assert.deepEqual(harness.logs, []);
    assert.deepEqual(harness.errors, []);
    assert.equal(JSON.stringify(harness.sent).includes('future_key'), false);
  });
}

test('only request-time subscribers receive an in-flight result', async () => {
  const pending = deferred();
  const harness = createHarness({ subscribed: true, output: () => pending.promise });
  const ticking = harness.tick();
  const laterClient = { readyState: 1 };
  harness.subscribe(true, laterClient);
  pending.resolve(result({ raw_outputs: completeOutputs(15) }));
  await ticking;
  assert.equal(harness.logs.length, 1);
  assert.equal(harness.logs[0].client, harness.primaryClient);
});

test('stops requesting raw outputs immediately when the last subscriber leaves', async () => {
  const harness = createHarness({ subscribed: true, output: result({ raw_outputs: completeOutputs(15) }) });
  await harness.tick();
  harness.subscribe(false);
  await harness.tick();
  assert.equal(harness.calls[0].args.includeRawOutputs, true);
  assert.equal(Object.hasOwn(harness.calls[1].args, 'includeRawOutputs'), false);
  assert.equal(harness.logs.length, 1);
});
