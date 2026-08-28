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
