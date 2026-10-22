const test = require('node:test');
const assert = require('node:assert/strict');
const { createPetCareRuntimeService } = require('../../kernel/algorithm-channel/petCareRuntimeService');
const { buildJqbedGetDataArgs, createJqbedAlgorithmProtocol } = require('../../kernel/algorithm-channel/jqbedAlgorithmProtocol');

/** 生成包含有效零值、保留字段和告警的原生结果。 */
function result(overrides = {}) {
  return { rate: 15, heart_rate: 70, stateInBbed: 1, sosflag: 0, merged_alarm: 0,
    reserved_bytes: [122, 37, 0, 5, 2, 1, 777, -1], ...overrides };
}

/** 生成包含未知字段和完整矩阵的只读原生输出。 */
function completeOutputs(rate = -1) {
  return { rate, matrix_origin: new Array(1024).fill(1.25), reserved_bytes: new Array(10).fill(-1),
    future_key: { nested: [0, null, 1] } };
}

/** 用真实运行时和订阅协议驱动一次定时任务，不打开端口或 Python。 */
function createHarness({ output = result(), file = 'jqbed', local = false, licensed = true, subscribed = false } = {}) {
  let tick;
  const sent = [], calls = [], statuses = [], errors = [], logs = [];
  const state = { file, local, licensed, port: { isOpen: true }, collectionId: null };
  const context = () => ({ activeFile: state.file, licenseValid: state.licensed, realtime: !state.local });
  const protocol = createJqbedAlgorithmProtocol({ store: {}, getAlgorithmStatus: () => ({}),
    broadcastJson: () => assert.fail('raw outputs must never use the public broadcast'),
    sendJson: (client, payload) => { if (payload.jqbedAlgorithmLog) logs.push({ client, payload: structuredClone(payload) }); } });
  const primaryClient = { readyState: 1 };
  /** 发出当前连接的真实订阅请求。 */
  const subscribe = (enabled = true, client = primaryClient) => protocol.handle({ subscribeJqbedAlgorithmLog: enabled }, { ...context(), client });
  if (subscribed) subscribe();
  const service = createPetCareRuntimeService({
    buildJqbedGetDataArgs, jqbedAlgorithmProtocol: protocol, getJqbedLogContext: context,
    getExecutionContext: () => ({ systemId: state.file, collectionId: state.collectionId, local: state.local }),
    getPointArr: () => new Array(1024).fill(1), getFile: () => state.file, getPort: () => state.port,
    setJqbedAlgorithmStatus: value => statuses.push(value),
    logger: { warn: (...values) => errors.push(values) },
    publishSystemEvent: value => sent.push(JSON.parse(value)),
    callPy: async (method, args) => { calls.push({ method, args }); return typeof output === 'function' ? output() : output; },
  });
  const originalInterval = global.setInterval;
  global.setInterval = (callback, interval) => { assert.equal(interval, 125); tick = callback; return null; };
  try { service.startVitalSignsTimer(); } finally { global.setInterval = originalInterval; }
  return { tick, state, sent, calls, statuses, errors, logs, protocol, primaryClient, subscribe, service };
}

/** 暂存算法响应，用于模拟请求期间切换系统和订阅。 */
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

/** 等待配置探测微任务结束，确认本次 Python 调用已真正发出。 */
async function waitForCall(harness) {
  for (let index = 0; index < 8 && !harness.calls.length; index++) await Promise.resolve();
  assert.equal(harness.calls.length, 1);
}

test('combines native diagnostics and physiological results without changing the stable-state timer', async () => {
  const harness = createHarness();
  await harness.tick(); await harness.tick();
  assert.deepEqual(harness.sent[0].jqbedAlgorithmDiagnostics, {
    sensorType: 'jqbed', reserved_bytes: result().reserved_bytes, merged_alarm: 0, sosflag: 0,
  });
  assert.equal(harness.sent[0].rate.rate, 15);
  assert.equal(harness.sent[0].rate.onBedTime, 2);
  assert.equal(harness.sent[1].rate.onBedTime, 4);
  assert.deepEqual(harness.errors, []);
});

for (const reserved of [[0, 0, 0, 0, 0, 0], [-1, -1, -1, -1, -1, -1, 19, 20], undefined, null, { 4: 2 }]) {
  test(`publishes exact returned settings independently of the rate filter: ${JSON.stringify(reserved)}`, async () => {
    const harness = createHarness({ output: result({ rate: -1, reserved_bytes: reserved }) });
    await harness.tick();
    assert.deepEqual(harness.sent, [{ jqbedAlgorithmDiagnostics: {
      sensorType: 'jqbed', reserved_bytes: Array.isArray(reserved) ? reserved : [], merged_alarm: 0, sosflag: 0,
    } }]);
  });
}

for (const [merged_alarm, sosflag] of [[10, 1], [0, 0], [-1, -1]]) {
  test(`returns alarm values ${merged_alarm}/${sosflag} even without physiological output or a log subscriber`, async () => {
    const harness = createHarness({ output: result({ rate: -1, merged_alarm, sosflag }) });
    await harness.tick();
    assert.equal(harness.sent[0].jqbedAlgorithmDiagnostics.merged_alarm, merged_alarm);
    assert.equal(harness.sent[0].jqbedAlgorithmDiagnostics.sosflag, sosflag);
    assert.equal(harness.sent[0].rate, undefined);
    assert.equal(Object.hasOwn(harness.calls[0].args, 'includeRawOutputs'), false);
    assert.deepEqual(harness.logs, []);
  });
}

test('missing native alarm fields never borrow saved configuration or invented defaults', async () => {
  const harness = createHarness({ output: { rate: -1 } });
  await harness.tick();
  assert.deepEqual(harness.sent, [{ jqbedAlgorithmDiagnostics: { sensorType: 'jqbed', reserved_bytes: [] } }]);
});

for (const options of [{ file: 'smallBed' }, { local: true }, { licensed: false }]) {
  test(`omits jqbed-only diagnostics outside licensed realtime jqbed: ${JSON.stringify(options)}`, async () => {
    const harness = createHarness({ ...options, output: result({ rate: -1 }) });
    await harness.tick();
    assert.deepEqual(harness.sent, []);
  });
}

test('smallBed keeps the existing shared physiological result and unrelated systems do not invoke it', async () => {
  const smallBed = createHarness({ file: 'smallBed' }); await smallBed.tick();
  assert.equal(smallBed.sent[0].rate.rate, 15);
  assert.equal(smallBed.sent[0].jqbedAlgorithmDiagnostics, undefined);
  const pet = createHarness({ file: 'petCare' }); await pet.tick();
  assert.deepEqual(pet.calls, []);
});

test('requests complete outputs only for subscribers and strips them from the public result', async () => {
  const outputs = completeOutputs(15);
  const source = result({ raw_outputs: outputs });
  const harness = createHarness({ subscribed: true, output: source });
  await harness.tick();
  assert.equal(harness.calls[0].args.includeRawOutputs, true);
  assert.deepEqual(harness.logs[0].payload.jqbedAlgorithmLog.outputs, outputs);
  assert.equal(harness.logs[0].client, harness.primaryClient);
  assert.equal(harness.sent[0].rate.raw_outputs, undefined);
  assert.equal(JSON.stringify(harness.sent).includes('future_key'), false);
  assert.equal(source.raw_outputs, outputs, 'response stripping must not mutate the RPC object');
  harness.subscribe(false); await harness.tick();
  assert.equal(Object.hasOwn(harness.calls[1].args, 'includeRawOutputs'), false);
  assert.equal(harness.logs.length, 1);
});

test('unsolicited raw outputs never leak into public rate events', async () => {
  const harness = createHarness({ output: result({ raw_outputs: completeOutputs(15) }) });
  await harness.tick();
  assert.equal(Object.hasOwn(harness.calls[0].args, 'includeRawOutputs'), false);
  assert.equal(JSON.stringify(harness.sent).includes('future_key'), false);
  assert.deepEqual(harness.logs, []);
});

test('complete initialization logs are available while the legacy rate filter remains active', async () => {
  const outputs = completeOutputs();
  const harness = createHarness({ subscribed: true, output: result({ rate: -1, raw_outputs: outputs }) });
  await harness.tick(); await harness.tick();
  assert.deepEqual(harness.logs[0].payload.jqbedAlgorithmLog.outputs, outputs);
  assert.equal(harness.logs[1].payload.jqbedAlgorithmLog.sequence, 2);
  assert.equal(harness.sent[0].rate, undefined);
});

test('older Python runtimes without raw_outputs still produce normal rate results', async () => {
  const harness = createHarness({ subscribed: true }); await harness.tick();
  assert.equal(harness.calls[0].args.includeRawOutputs, true);
  assert.deepEqual(harness.logs, []);
  assert.equal(harness.sent[0].rate.rate, 15);
});

for (const [name, update] of [
  ['system change', h => { h.state.file = 'smallBed'; }],
  ['playback', h => { h.state.local = true; }],
  ['port closure', h => { h.state.port.isOpen = false; }],
  ['port removal', h => { h.state.port = null; }],
  ['port replacement', h => { h.state.port = { isOpen: true }; }],
  ['license expiration', h => { h.state.licensed = false; }],
  ['collection boundary', h => { h.state.collectionId = 'next'; }],
  ['unsubscribe', h => { h.subscribe(false); }],
  ['client close', h => { h.primaryClient.readyState = 3; h.protocol.removeClient(h.primaryClient); }],
  ['subscription renewal', h => { h.subscribe(false); h.subscribe(true); }],
]) {
  test(`discards a complete in-flight log after ${name}`, async () => {
    const pending = deferred();
    const harness = createHarness({ subscribed: true, output: () => pending.promise });
    const ticking = harness.tick(); await waitForCall(harness);
    update(harness); pending.resolve(result({ raw_outputs: completeOutputs(15) })); await ticking;
    assert.deepEqual(harness.logs, []);
    assert.equal(JSON.stringify(harness.sent).includes('future_key'), false);
  });
}

test('a request begun in playback cannot publish diagnostics after returning to realtime', async () => {
  const pending = deferred();
  const harness = createHarness({ local: true, output: () => pending.promise });
  const ticking = harness.tick(); await waitForCall(harness);
  harness.state.local = false; pending.resolve(result()); await ticking;
  assert.deepEqual(harness.sent, []);
});

test('only request-time subscribers receive a pending result', async () => {
  const pending = deferred();
  const harness = createHarness({ subscribed: true, output: () => pending.promise });
  const ticking = harness.tick(); await waitForCall(harness);
  harness.subscribe(true, { readyState: 1 });
  pending.resolve(result({ raw_outputs: completeOutputs(15) })); await ticking;
  assert.equal(harness.logs.length, 1);
  assert.equal(harness.logs[0].client, harness.primaryClient);
});

test('Python failures send no fabricated diagnostics and retain retryable status handling', async () => {
  const harness = createHarness({ output: () => { throw new Error('native algorithm unavailable'); } });
  await harness.tick();
  assert.deepEqual(harness.sent, []);
  assert.equal(harness.statuses.at(-1).state, 'error');
  assert.equal(harness.errors.length, 1);
});
