const assert = require('assert');
const { createServerSmallBedRuntime } = require('../../extensions/built-in-sensors/smallBedRuntimeFactory');

const state = {
  pressureFrame: null,
  zeroSourceFrame: null,
  displayData: null,
  sent: null,
};

const runtime = createServerSmallBedRuntime({
  smallBed12B: {
    buildRealtimeFrameFromBuffer: () => ({
      orderedFrame: [1, 2],
      pressureData: [3, 4],
      realtimeFrame: { sitData: [3, 4] },
    }),
  },
  smallBed12BType: 'smallBed12B',
  runtimeContext: {
    getSensorType: () => 'smallBed12B',
    getNowDate: () => 1,
  },
  getLineOrder: () => [],
  getZeroFrame: () => [],
  subtractZero: (value) => value,
  calibration: {},
  getDisplayOptions: () => ({}),
  getHz: () => 100,
  transposeSquareMatrix: (frame) => frame,
  getEndDate: () => 2,
  setCurrentPressureFrame: (frame) => { state.pressureFrame = frame; },
  setZeroSourceFrame: (frame) => { state.zeroSourceFrame = frame; },
  setCurrentDisplayData: (frame) => { state.displayData = frame; },
  sendSitFrame: (jsonData) => { state.sent = JSON.parse(jsonData); },
});

assert.strictEqual(runtime.handleFrame(Buffer.alloc(1)), true);
assert.deepStrictEqual(state.pressureFrame, [3, 4]);
assert.deepStrictEqual(state.zeroSourceFrame, [1, 2]);
assert.deepStrictEqual(state.displayData, [3, 4]);
assert.deepStrictEqual(state.sent, { sitData: [3, 4] });

console.log('smallBedRuntimeFactory.test.js passed');
