const assert = require('assert');
const {
  createServerFramePipeline,
} = require('../../kernel/realtime/framePipelineFactory');

const runtimeContext = {
  getSensorType: () => 'jqbed',
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
  buildZeroAwareStorageData: () => null,
  buildSmallBed12BCollectionStorageData: () => null,
  getFrameMatrixData: () => [],
  isZeroFrameStorageType: () => false,
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
  outputChannel: 'sit',
  sitData: [10, 20],
  normalizedData: [5, 10],
  algorithmMetrics: { supportRate: 50 },
  metrics: { totalPressure: 30, algorithm: { supportRate: 50 } },
};
const storedDisplayFrame = JSON.parse(
  pipeline.collectionFrameStorage.buildSitCollectionData(displayFrame),
);
assert.deepStrictEqual(storedDisplayFrame, displayFrame);

assert.strictEqual(
  pipeline.collectionFrameStorage.buildSitCollectionData({ sitData: [7, 8] }),
  JSON.stringify([7, 8]),
);

console.log('framePipelineFactory.test.js passed');
