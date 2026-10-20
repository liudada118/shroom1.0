const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_JQBED_ALGORITHM_VALUES,
} = require('../../kernel/algorithm-channel/jqbedAlgorithmConfig');
const {
  buildJqbedGetDataArgs,
} = require('../../kernel/algorithm-channel/jqbedAlgorithmProtocol');
const {
  createPetCareRuntimeService,
} = require('../../kernel/algorithm-channel/petCareRuntimeService');

/**
 * 劫持全局 `setInterval`，把注册的定时器收进 `timers` 而不真的计时。
 *
 * 用法：`const harness = createTimerHarness()`，之后手动调
 * `harness.timers[0].callback()` 驱动一次轮询，**用完必须 `harness.restore()`**，
 * 否则会影响同进程里后面的测试。
 *
 * 这样做是为了让测试不用真等 —— 服务的轮询周期是秒级的，靠真定时器要么很慢，
 * 要么得靠 sleep 凑时间，那种测试会间歇性失败。同时 `intervalMs` 也被记下来，
 * 周期本身可以断言。
 *
 * @returns {{restore: Function, timers: Array<{callback: Function, intervalMs: number}>}}
 */
function createTimerHarness() {
  const timers = [];
  const originalSetInterval = global.setInterval;
  global.setInterval = (callback, intervalMs) => {
    const timer = { callback, intervalMs };
    timers.push(timer);
    return timer;
  };
  return {
    restore: () => { global.setInterval = originalSetInterval; },
    timers,
  };
}

/**
 * 造一份最小的算法输出，形状照 Python 算法真实返回的字段名。
 *
 * 每次调用**返回新对象**，避免多个测试共用一份被改脏。
 *
 * @returns {{heart_rate: number, matrix_origin: number[], rate: number, stateInBbed: number}}
 */
function algorithmResult() {
  return {
    heart_rate: 70,
    matrix_origin: [],
    rate: 12,
    stateInBbed: 1,
  };
}

test('passes a snapshot only after the Python runtime proves the new jqbed ABI', async () => {
  const harness = createTimerHarness();
  const calls = [];
  const statuses = [];
  try {
    const service = createPetCareRuntimeService({
      buildJqbedGetDataArgs,
      getJqbedAlgorithmConfigSnapshot: () => ({
        version: 2,
        values: structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES),
        savedAt: null,
      }),
      callPy: async (name, args) => {
        calls.push({ args, name });
        if (name === 'health') {
          return {
            onbedFilterAvailable: true,
            onbedFilterSensitivitySchema: true,
          };
        }
        return algorithmResult();
      },
      getFile: () => 'jqbed',
      getPointArr: () => new Array(1024).fill(1),
      getPort: () => ({ isOpen: true }),
      probeJqbedAlgorithmConfig: () => calls.length === 0
        ? Promise.resolve({
          onbedFilterAvailable: true,
          onbedFilterSensitivitySchema: true,
        })
        : Promise.reject(new Error('health probe should only run once')),
      setJqbedAlgorithmStatus: (status) => statuses.push(status),
    });

    service.startVitalSignsTimer();
    assert.equal(harness.timers[0].intervalMs, 125);
    await harness.timers[0].callback();

    assert.equal(calls[0].name, 'getData');
    assert.deepEqual(calls[0].args.config, DEFAULT_JQBED_ALGORITHM_VALUES);
    assert.deepEqual(statuses.at(-1), { state: 'ready', error: null });
  } finally {
    harness.restore();
  }
});

test('falls back to the unchanged getData(data) path when the native ABI is unavailable', async () => {
  const harness = createTimerHarness();
  const getDataCalls = [];
  const statuses = [];
  try {
    const service = createPetCareRuntimeService({
      buildJqbedGetDataArgs,
      getJqbedAlgorithmConfigSnapshot: () => ({
        version: 2,
        values: structuredClone(DEFAULT_JQBED_ALGORITHM_VALUES),
        savedAt: null,
      }),
      callPy: async (name, args) => {
        if (name === 'getData') getDataCalls.push(args);
        return algorithmResult();
      },
      getFile: () => 'jqbed',
      getPointArr: () => new Array(1024).fill(1),
      getPort: () => ({ isOpen: true }),
      probeJqbedAlgorithmConfig: async () => ({
        onbedFilterAvailable: true,
        onbedFilterSensitivitySchema: false,
      }),
      setJqbedAlgorithmStatus: (status) => statuses.push(status),
    });

    service.startVitalSignsTimer();
    await harness.timers[0].callback();

    assert.deepEqual(Object.keys(getDataCalls[0]), ['data']);
    assert.equal(statuses[0].code, 'JQBED_CONFIG_ABI_UNAVAILABLE');
    assert.notEqual(statuses.at(-1).state, 'ready');
  } finally {
    harness.restore();
  }
});

test('jqbed replies cannot update cached matrices across collection start, stop or system reset', async () => {
  const harness = createTimerHarness();
  const matrices = [], events = [], statuses = [];
  const port = { isOpen: true };
  let context = { systemId: 'jqbed', collectionId: null, phase: 'idle' }, complete;
  const service = createPetCareRuntimeService({ getFile: () => 'jqbed', getPointArr: () => new Array(1024).fill(1), getPort: () => port,
    getExecutionContext: () => context, callPy: () => new Promise((resolve) => { complete = resolve; }),
    setJqbedMatrixOrigin: (value) => matrices.push(value), publishSystemEvent: (value) => events.push(value), setJqbedAlgorithmStatus: (value) => statuses.push(value) });
  try {
    service.startVitalSignsTimer();
    const tick = harness.timers[0].callback;
    const beforeCollection = tick(); await Promise.resolve();
    context = { systemId: 'jqbed', collectionId: 'capture-a', phase: 'collecting' };
    complete({ ...algorithmResult(), matrix_origin: [100] }); await beforeCollection;
    assert.equal(matrices.length, 0); assert.equal(events.length, 0);
    const beforeStop = tick(); await Promise.resolve();
    context = { ...context, phase: 'completed' };
    complete({ ...algorithmResult(), matrix_origin: [200] }); await beforeStop;
    assert.equal(matrices.length, 0);
    const beforeReset = tick(); await Promise.resolve(); service.resetAll();
    complete({ ...algorithmResult(), matrix_origin: [300] }); await beforeReset;
    assert.equal(matrices.length, 0);
    const current = tick(); await Promise.resolve(); complete({ ...algorithmResult(), matrix_origin: [400] }); await current;
    assert.deepEqual(matrices, [[400]]); assert.equal(events.length, 1);
    assert.equal(statuses.length, 0);
  } finally { service.dispose(); harness.restore(); }
});

test('pet reset and step retain their originating context and disposal discards pending replies', async () => {
  const harness = createTimerHarness();
  const port = { isOpen: true }, calls = [], events = [];
  let context = { systemId: 'petCare', collectionId: 'a', phase: 'collecting' }, completeReset, completeStep;
  const service = createPetCareRuntimeService({ getFile: () => 'petCare', getPointArr: () => [1, 2], getPort: () => port,
    getExecutionContext: () => context, publishSystemEvent: (value) => events.push(value), callPy: (name) => {
      calls.push(name);
      return new Promise((resolve) => { if (name.includes('reset')) completeReset = resolve; else completeStep = resolve; });
    } });
  try {
    service.startPetCareTimer('petCare'); const tick = harness.timers[0].callback;
    const first = tick(); context = { ...context, collectionId: 'b' }; completeReset({}); await first;
    assert.deepEqual(calls, ['reset_pet_care']);
    const second = tick(); completeReset({}); await Promise.resolve();
    assert.deepEqual(calls, ['reset_pet_care', 'reset_pet_care', 'pet_care_step']);
    service.dispose(); completeStep({ posture_state: 0, breath_rate: 0 }); await second;
    assert.equal(events.length, 0);
    await tick(); assert.equal(calls.length, 3);
  } finally { service.dispose(); harness.restore(); }
});

test('an old finally cannot overwrite a newer runtime generation', async () => {
  const harness = createTimerHarness();
  const port = { isOpen: true }, events = [], complete = [];
  const service = createPetCareRuntimeService({ getFile: () => 'petCareMini', getPointArr: () => [1], getPort: () => port,
    getExecutionContext: () => ({ systemId: 'petCareMini', collectionId: 'a', phase: 'collecting' }), publishSystemEvent: value => events.push(value),
    callPy: (name) => name.includes('reset') ? Promise.resolve({}) : new Promise(resolve => complete.push(resolve)) });
  try {
    service.startPetCareTimer('petCareMini'); const tick = harness.timers[0].callback;
    const old = tick(); await Promise.resolve(); service.resetAll();
    const current = tick(); await Promise.resolve();
    complete[0]({ posture_state: 0 }); await old;
    await tick(); assert.equal(complete.length, 2, 'old finally must not release the current call guard');
    complete[1]({ posture_state: 0 }); await current;
    assert.equal(events.length, 1);
  } finally { service.dispose(); harness.restore(); }
});

test('an obsolete ABI probe cannot publish status or prevent a fresh context from probing again', async () => {
  const harness = createTimerHarness();
  const port = { isOpen: true }, statuses = [];
  let context = { systemId: 'jqbed', collectionId: 'a', phase: 'collecting' }, probeCount = 0, complete;
  const calls = [];
  const service = createPetCareRuntimeService({ getFile: () => 'jqbed', getPointArr: () => new Array(1024).fill(1), getPort: () => port,
    getExecutionContext: () => context, getJqbedAlgorithmConfigSnapshot: () => ({ version: 1, values: {} }),
    setJqbedAlgorithmStatus: value => statuses.push(value), callPy: async name => { calls.push(name); return algorithmResult(); },
    probeJqbedAlgorithmConfig: () => ++probeCount === 1 ? new Promise(resolve => { complete = resolve; }) : Promise.resolve({ onbedFilterAvailable: true, onbedFilterSensitivitySchema: true }) });
  try {
    service.startVitalSignsTimer(); const tick = harness.timers[0].callback;
    const old = tick(); await Promise.resolve();
    context = { ...context, collectionId: 'b' }; complete({ onbedFilterAvailable: false }); await old;
    assert.equal(statuses.length, 0); assert.equal(calls.length, 0);
    await tick(); assert.equal(probeCount, 2); assert.deepEqual(calls, ['getData']);
    assert.equal(statuses.at(-1).state, 'ready');
  } finally { service.dispose(); harness.restore(); }
});
