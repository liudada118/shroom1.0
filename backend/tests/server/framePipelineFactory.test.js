const assert = require('assert');
const {
  createServerFramePipeline,
} = require('../../server/framePipelineFactory');

const runtimeContext = {
  getSensorType: () => 'jqbed',
  getDatabase: (channel) => `${channel || 'sit'}Db`,
};
const queued = [];

const pipeline = createServerFramePipeline({
  runtimeContext,
  publishRealtimeChannel: () => 1,
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
