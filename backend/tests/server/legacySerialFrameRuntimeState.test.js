const assert = require('assert');

const {
  createLegacySerialFrameRuntime,
} = require('../../extensions/built-in-sensors/legacySerialFrameRuntime');

const identity = (frame) => [...frame];
const context = {
  nowDate: 0,
  endDate: 1,
  file: 'demo',
  colHZ: 12,
  newArr: [],
  newData: [],
  port1: { isOpen: true },
  port2: { isOpen: true },
  pointArr: [],
  pointArr2: [],
  pointArr4: [],
  isCar: () => false,
  isSmallBedMatrixType: () => false,
  zeroLineMatrix: identity,
  gloves0123: identity,
  gloves0123Res: identity,
  publishSystemEvent: () => {},
  bytes4ToInt10: () => [],
  footL: identity,
  footR: identity,
  footVideo: identity,
  footVideo1: identity,
  handL: identity,
  handR: identity,
  handRVideo1470506: identity,
  handVideo1_0416_0506: identity,
  handVideoRealPoint_0506_3: identity,
  isHandGloveType: () => false,
  HAND_GLOVE_FULL_PACKET: 'full-packet',
  HAND_GLOVE_FULL_PACKET_LENGTH: 274,
  MINZHEN_TYPE: 'minzhen',
  parseMinzhenSensorFrame: () => null,
  handleHandGloveFullPacket: () => false,
  handleHandGloveDoublePacket: () => false,
  sit1024FrameProcessor: {
    processFrame: () => ({
      pointArr: [90, 80],
      newData: [],
      jsonData: JSON.stringify({ sitData: [90, 80] }),
    }),
  },
  backHead1024FrameProcessor: {
    processBackFrame: () => ({
      frame: [70, 60],
      jsonData: JSON.stringify({ backData: [70, 60] }),
    }),
    processHeadFrame: () => ({
      frame: [50, 40],
      jsonData: JSON.stringify({ headData: [50, 40] }),
    }),
  },
  colOrSendData: () => ({ frame: { pressureData: [], sitData: [9, 8] } }),
  colOrSendData1: () => ({ frame: { backData: [7, 6] } }),
  colOrSendData2: () => ({ frame: { headData: [5, 4] } }),
};

const runtime = createLegacySerialFrameRuntime(context);
runtime.handleSitSerialFrame(Buffer.alloc(1024));
runtime.handleBackSerialFrame(Buffer.alloc(1024));
runtime.handleHeadSerialFrame(Buffer.alloc(1024));

assert.deepStrictEqual(
  context.pointArr,
  [9, 8],
  'sit runtime state must use the prepared zeroed frame returned by the output pipeline',
);
assert.deepStrictEqual(context.pointArr2, [7, 6]);
assert.deepStrictEqual(context.pointArr4, [5, 4]);

// jqbed 可选择发布 Python 返回的 matrixOrigin；它和下一轮算法使用的
// pointArr 不是同一阶段，即使数组长度相同也不能写回覆盖算法输入。
context.sit1024FrameProcessor.processFrame = () => ({
  pointArr: [90, 80],
  newData: [],
  jsonData: JSON.stringify({ sitData: [30, 20] }),
});
let matrixOriginSource = null;
context.colOrSendData = (jsonData, options) => {
  matrixOriginSource = { payload: JSON.parse(jsonData), options };
  return {
    frame: { sitData: [3, 2] },
    zeroedStages: { processed: [9, 8] },
  };
};
runtime.handleSitSerialFrame(Buffer.alloc(1024));
assert.deepStrictEqual(context.pointArr, [9, 8]);
assert.deepStrictEqual(matrixOriginSource.payload.sitData, [30, 20]);
assert.deepStrictEqual(matrixOriginSource.options.zeroSources.processed, [90, 80]);

// 262 手套帧也必须进入统一输出管线，不能再从 publishSystemEvent 旁路。
context.file = 'demo';
context.colOrSendData = (jsonData) => {
  const source = JSON.parse(jsonData);
  return { frame: { sitData: source.sitData.map(() => 0) } };
};
runtime.handleSitSerialFrame(Buffer.alloc(262, 5));
assert.strictEqual(context.pointArr.length, 256);
assert.ok(context.pointArr.every((value) => value === 0));

// bigBed 统一做动态扣零，但仍只由 legacy runtime 每 10 个完整合帧入库一次。
const bigBedPublishes = [];
const bigBedInserts = [];
Object.assign(context, {
  file: 'bigBed',
  firstData: [],
  lastData: [],
  pointArr3: [],
  localFlag: false,
  flag: true,
  dataFalg: 0,
  db: 'sit-db',
  saveTime: 'capture',
  shouldStoreCollectionFrame: () => true,
  hasEnoughCollectionDiskSpace: () => true,
  enqueueCollectionInsert: (db, values, channel) => {
    bigBedInserts.push({ db, values, channel });
  },
  colOrSendData: (jsonData, options) => {
    const source = JSON.parse(jsonData);
    bigBedPublishes.push({ options, length: source.sitData.length });
    return {
      frame: {
        sitData: source.sitData.map((value) => Math.max(0, value - 1)),
      },
    };
  },
});
const firstChunk = Buffer.alloc(1025, 2);
firstChunk[1024] = 0;
const secondChunk = Buffer.alloc(1025, 4);
secondChunk[1024] = 1;
for (let index = 0; index < 10; index += 1) {
  runtime.handleBigBedSitSerialFrame(firstChunk);
  runtime.handleBigBedSitSerialFrame(secondChunk);
}
assert.strictEqual(bigBedPublishes.length, 10);
assert.strictEqual(bigBedPublishes[0].options.store, false);
assert.strictEqual(bigBedPublishes[0].options.publish, true);
assert.strictEqual(bigBedPublishes[0].options.zeroSources.processed.length, 2048);
assert.strictEqual(bigBedPublishes[0].length, 2048);
assert.strictEqual(bigBedInserts.length, 1);
assert.strictEqual(bigBedInserts[0].db, 'sit-db');
assert.strictEqual(bigBedInserts[0].channel, 'sit');
const storedBigBedFrame = JSON.parse(bigBedInserts[0].values[0]);
assert.strictEqual(storedBigBedFrame.length, 2048);
assert.strictEqual(storedBigBedFrame[0], 1);
assert.strictEqual(storedBigBedFrame[32], 3);

console.log('legacySerialFrameRuntimeState.test.js passed');
