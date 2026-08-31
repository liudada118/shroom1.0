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
