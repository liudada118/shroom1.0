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

console.log('framePipelineFactory.test.js passed');
