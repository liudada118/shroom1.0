const assert = require('assert');
const { createServerSensorProcessors } = require('../../extensions/built-in-sensors/sensorProcessorFactory');

/**
 * 恒等函数，用来顶掉所有线序/映射依赖，让处理链路的输出可预测。
 *
 * 注意这里**直接返回原数组**（不像别处返回拷贝）：本文件只关心「工厂给每个型号
 * 装了哪几步」，不关心数据本身，返回原引用能让断言直接比引用相等。
 *
 * @param {unknown} frame 一帧数据。
 * @returns {unknown} 原样返回。
 */
function identity(frame) {
  return frame;
}

/**
 * 造一份完整的依赖表，所有变换都用 `identity` 顶掉。
 *
 * 用法：`makeDeps({ carCol: myFn })` —— `overrides` 只覆盖关心的那几项，
 * 其余保持恒等。**必须把每个依赖都填上**：`createServerSensorProcessors` 是按型号
 * 挑函数的，缺一个就是运行时 TypeError，而不是某个型号不可用。
 *
 * @param {object} [overrides] 要覆盖的依赖项。
 * @returns {object} 完整依赖表。
 */
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
});
assert.strictEqual(JSON.parse(sitResult.jsonData).sitData.length, 1024);

const backResult = processors.backHead1024FrameProcessor.processBackFrame(frame, {
  file: 'carQX',
});
assert.strictEqual(JSON.parse(backResult.jsonData).backData.length, 1024);

console.log('sensorProcessorFactory.test.js passed');
