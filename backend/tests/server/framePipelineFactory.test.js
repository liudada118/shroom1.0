const assert = require('assert');
const {
  createServerFramePipeline,
} = require('../../kernel/realtime/framePipelineFactory');

let activeSensorType = 'jqbed';
const runtimeContext = {
  getSensorType: () => activeSensorType,
  getDatabase: (channel) => `${channel || 'sit'}Db`,
};
const queued = [];
let collecting = true;

const pipeline = createServerFramePipeline({
  runtimeContext,
  publishRealtimeChannel: () => 1,
  isCollecting: () => collecting,
  shouldStoreCollectionFrame: () => true,
  hasEnoughCollectionDiskSpace: () => true,
  enqueueCollectionFrame: (db, data, channel) => queued.push({ db, data, channel }),
  buildZeroAwareStorageData: (_frame, dataKey, channel) => JSON.stringify({
    storage: 'zero-aware',
    dataKey,
    channel,
  }),
  buildSmallBed12BCollectionStorageData: () => JSON.stringify({ storage: 'small-bed-12b' }),
  getFrameMatrixData: () => [],
  isZeroFrameStorageType: (type) => type === 'hand0507',
  isSmallBedMatrixType: () => false,
  tempFullBedType: 'tempFullBed',
  smallBed12BType: 'smallBed12B',
  minzhenType: 'minzhen',
  applyMinzhenBackendGauss: (frame) => frame,
});

assert.ok(pipeline.collectionFrameStorage);
assert.ok(pipeline.frameOutputPipeline);
assert.strictEqual(pipeline.collectionFrameStorage.storeSit({ sitData: [1, 2] }), true);
assert.strictEqual(pipeline.collectionFrameStorage.storeBack({ backData: [3, 4] }), true);
assert.strictEqual(pipeline.collectionFrameStorage.storeHead({ backData: [5, 6] }), true);
assert.deepStrictEqual(queued.map((item) => [item.db, item.channel]), [
  ['sitDb', 'sit'],
  ['backDb', 'back'],
  ['headDb', 'head'],
]);

// 回归：采集开关关着时一帧都不许落库。
// 这条以前不成立 —— `canStore` 只看限频和磁盘，不看开关，而 `publishSit/Back/Head`
// 是实时下发路径、每帧都会调到，结果就是「没点开始采集，库却一直在变大」。
collecting = false;
const queuedBeforeIdle = queued.length;
assert.strictEqual(pipeline.collectionFrameStorage.storeSit({ sitData: [1, 2] }), false);
assert.strictEqual(pipeline.collectionFrameStorage.storeBack({ backData: [3, 4] }), false);
assert.strictEqual(pipeline.collectionFrameStorage.storeHead({ backData: [5, 6] }), false);
assert.strictEqual(queued.length, queuedBeforeIdle);
collecting = true;

const displayFrame = {
  displaySystemId: 'custom-seat',
  channelId: 'custom-seat:sit',
  sensorId: 'sit',
  runtimeSource: 'display-system',
  outputChannel: 'sit',
  sitData: [10, 20],
  normalizedData: [5, 10],
  algorithmMetrics: { supportRate: 50 },
  metrics: { totalPressure: 30, algorithm: { supportRate: 50 } },
};
const storedDisplayFrame = JSON.parse(
  pipeline.collectionFrameStorage.buildSitCollectionData(displayFrame),
);
assert.deepStrictEqual(storedDisplayFrame, {
  ...displayFrame,
  sensorId: 'sit',
  sensorLabel: 'sit',
  sensorType: null,
  schemaVersion: 1,
  serialRole: null,
  serialPortPath: null,
  baudRate: null,
  parserChannel: null,
  data: [10, 20],
  serial: null,
});

const auxFrame = {
  channelId: 'custom-seat:leftHand',
  displaySystemId: 'custom-seat',
  sensorId: 'leftHand',
  sensorLabel: '左手',
  sensorType: 'hand-pad',
  timestamp: 123456,
  runtimeSource: 'display-system',
  stored: true,
  outputChannel: 'armLeft',
  data: [31, 32],
  normalizedData: [21, 22],
  serialRole: 'leftHand',
  serial: {
    role: 'leftHand',
    path: 'COM7',
    baudRate: 921600,
    parserChannel: 'custom-seat:leftHand',
  },
};
const auxResult = pipeline.frameOutputPipeline.publishAux('armLeft', auxFrame);
assert.strictEqual(auxResult.stored, true);
assert.strictEqual(queued.at(-1).db, 'sitDb');
assert.deepStrictEqual(queued.at(-1).channel, {
  channelId: 'custom-seat:leftHand',
  displaySystemId: 'custom-seat',
  sensorId: 'leftHand',
  sensorLabel: '左手',
  sensorType: 'hand-pad',
  outputChannel: 'armLeft',
  schemaVersion: 1,
  serialRole: 'leftHand',
  serialPortPath: 'COM7',
  baudRate: 921600,
  parserChannel: 'custom-seat:leftHand',
  timestamp: 123456,
});

const queuedBeforeOptOut = queued.length;
assert.strictEqual(pipeline.collectionFrameStorage.storeFrame({
  ...auxFrame,
  stored: false,
}), false);
assert.strictEqual(queued.length, queuedBeforeOptOut);

// canonical identity 也会被补到 legacy 帧上；它不能因此误走 manifest 存储格式。
activeSensorType = 'hand0507';
assert.deepStrictEqual(JSON.parse(pipeline.collectionFrameStorage.buildSitCollectionData({
  displaySystemId: 'hand0507',
  channelId: 'hand0507:sit',
  runtimeSource: 'legacy',
  sitData: [7, 8],
})), {
  storage: 'zero-aware',
  dataKey: 'sitData',
  channel: 'sit',
});
activeSensorType = 'jqbed';

assert.strictEqual(
  pipeline.collectionFrameStorage.buildSitCollectionData({ sitData: [7, 8] }),
  JSON.stringify([7, 8]),
);

console.log('framePipelineFactory.test.js passed');
