const assert = require('assert');
const { createServerSensorProcessors } = require('../../server/sensorProcessorFactory');

function identity(frame) {
  return frame;
}

function makeDeps(overrides = {}) {
  return {
    HAND_SINGLE_POINT_TYPE: 'handSinglePoint',
    MINZHEN_TYPE: 'minzhen',
    WHOLE_CHAIR_TYPE: 'wholeChair',
    arrToRealLine: identity,
    car10Sit: identity,
    car10Back: identity,
    carCol: identity,
    carBackLine: identity,
    carSitLine: identity,
    carYLine: identity,
    endiSit1024: identity,
    gloves: identity,
    gloves1: identity,
    gloves2: identity,
    handBlue: identity,
    handSinglePoint: identity,
    isCar: () => false,
    isPetCareSystem: () => false,
    isSmallBedMatrixType: () => false,
    jqbed: identity,
    matColLine: identity,
    maskMinzhenMatrixValues: () => {},
    newHand: identity,
    normalizeWholeChairFrame: (channel, frame) => frame,
    numLessZeroToZero: (value) => Math.max(0, value),
    press6sit: identity,
    pressNew1220: ({ arr }) => arr,
    pressNew12203131: ({ arr }) => arr,
    rect: identity,
    short: identity,
    sit10Line: identity,
    sit100Line: identity,
    smallBed1: identity,
    smallM1: identity,
    tempFullBed: (frame) => ({
      sitData: frame,
      rawSitData: frame,
      matrixWidth: 32,
      matrixHeight: 32,
      matrixOrientation: 'row',
      realArr: frame,
      pressureThreshold: 0,
      temperatureRawData: [],
      temperatureData: [],
      temperatureAvg: 0,
      temperatureK: 0,
    }),
    wowSitLine: identity,
    wowBackLine: identity,
    wowhead: identity,
    xiyueReal1: identity,
    yanfeng10sit: identity,
    yanfeng10back: identity,
    ...overrides,
  };
}

const processors = createServerSensorProcessors(makeDeps());
assert.strictEqual(typeof processors.sit1024FrameProcessor.processFrame, 'function');
assert.strictEqual(typeof processors.backHead1024FrameProcessor.processBackFrame, 'function');
assert.strictEqual(typeof processors.backHead1024FrameProcessor.processHeadFrame, 'function');

const frame = Buffer.alloc(1024, 5);
const sitResult = processors.sit1024FrameProcessor.processFrame(frame, {
  colHZ: 100,
  file: 'jqbed',
  pointArr1zero: [],
});
assert.strictEqual(JSON.parse(sitResult.jsonData).sitData.length, 1024);

const backResult = processors.backHead1024FrameProcessor.processBackFrame(frame, {
  file: 'carQX',
  zeroFrame: [],
});
assert.strictEqual(JSON.parse(backResult.jsonData).backData.length, 1024);

console.log('sensorProcessorFactory.test.js passed');
