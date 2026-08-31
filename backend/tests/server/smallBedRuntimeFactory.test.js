const assert = require('assert');
const { createServerSmallBedRuntime } = require('../../extensions/built-in-sensors/smallBedRuntimeFactory');

const state = {
  pressureFrame: null,
  displayData: null,
  sent: null,
  sourceUpdate: null,
};

const runtime = createServerSmallBedRuntime({
  smallBed12B: {
    buildRealtimeFrameFromBuffer: (_buffer, options) => {
      const orderedFrame = [10, 20];
      const zeroedFrame = orderedFrame.map((value, index) => (
        options.subtractZero(value - options.zeroFrame[index])
      ));
      const pressureData = zeroedFrame.map((value) => value * 2);
      return {
        orderedFrame,
        pressureData,
        realtimeFrame: { sitData: pressureData },
      };
    },
  },
  smallBed12BType: 'smallBed12B',
  runtimeContext: {
    getSensorType: () => 'smallBed12B',
    getNowDate: () => 1,
  },
  getLineOrder: () => [],
  zeroStateStore: {
    getBaseline: (channelId, stage) => {
      assert.strictEqual(channelId, 'small-bed:mat');
      assert.strictEqual(stage, 'decoded');
      return [3, 7];
    },
    updateSources: (channelId, stages, identity) => {
      state.sourceUpdate = { channelId, stages, identity };
    },
  },
  resolveChannelIdentity: () => ({
    channelId: 'small-bed:mat',
    displaySystemId: 'small-bed',
    sensorId: 'mat',
    sensorType: 'smallBed12B',
    outputChannel: 'sit',
  }),
  calibration: {},
  getDisplayOptions: () => ({}),
  getHz: () => 100,
  transposeSquareMatrix: (frame) => frame,
  getEndDate: () => 2,
  setCurrentPressureFrame: (frame) => { state.pressureFrame = frame; },
  setCurrentDisplayData: (frame) => { state.displayData = frame; },
  sendSitFrame: (jsonData) => { state.sent = JSON.parse(jsonData); },
});

assert.strictEqual(runtime.handleFrame(Buffer.alloc(1)), true);
assert.deepStrictEqual(state.pressureFrame, [14, 26]);
assert.deepStrictEqual(state.displayData, [14, 26]);
assert.deepStrictEqual(state.sourceUpdate.stages, { decoded: [10, 20] });
assert.deepStrictEqual(state.sent, {
  sitData: [14, 26],
  channelId: 'small-bed:mat',
  displaySystemId: 'small-bed',
  sensorId: 'mat',
  sensorType: 'smallBed12B',
  outputChannel: 'sit',
  runtimeSource: 'legacy',
  zeroApplied: true,
  rawData: [10, 20],
});

console.log('smallBedRuntimeFactory.test.js passed');
