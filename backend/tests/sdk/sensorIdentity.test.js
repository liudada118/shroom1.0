const assert = require('assert');

const identity = require('@shroom/backend/identity');
const backendSdk = require('@shroom/backend');
const backendPackage = require('@shroom/backend/package.json');
const {
  buildSensorFrameEnvelope,
  SENSOR_FRAME_SCHEMA_VERSION,
  SENSOR_FRAME_TYPE,
} = require('../../kernel/realtime/sensorFrameEnvelope');
const {
  createCollectionFrameStorageService,
} = require('@shroom/backend/collection/collectionFrameStorageService.js');

// helper 是可发布的 CommonJS 入口，子路径与根出口共用同一实现。
assert.strictEqual(typeof identity.resolveSensorIdentity, 'function');
assert.strictEqual(backendSdk.resolveSensorIdentity, identity.resolveSensorIdentity);
assert.strictEqual(backendPackage.exports['./identity'], './identity/index.js');
assert.ok(backendPackage.files.includes('identity'));

assert.strictEqual(identity.buildSensorChannelId('seat', 'left'), 'seat:left');
assert.strictEqual(identity.buildSensorChannelId('seat:debug', 'left'), null);
assert.strictEqual(identity.buildSensorChannelId(' seat', 'left'), null);
assert.deepStrictEqual(identity.parseSensorChannelId('seat:left'), {
  channelId: 'seat:left',
  displaySystemId: 'seat',
  sensorId: 'left',
});
assert.strictEqual(identity.parseSensorChannelId('seat:left:raw'), null);
assert.strictEqual(identity.parseSensorChannelId(' seat:left'), null);
assert.strictEqual(identity.parseSensorChannelId(':left'), null);
assert.strictEqual(identity.parseSensorChannelId('seat:'), null);

assert.deepStrictEqual(identity.resolveSensorIdentity({
  channelId: 'seat:left',
  displaySystemId: 'seat',
  sensorId: 'left',
}), {
  channelId: 'seat:left',
  displaySystemId: 'seat',
  sensorId: 'left',
});
assert.strictEqual(identity.resolveSensorIdentity({
  channelId: 'seat:left',
  displaySystemId: 'other',
  sensorId: 'left',
}), null);
assert.strictEqual(identity.resolveSensorIdentity({
  channelId: 'seat:left',
  displaySystemId: 'seat',
}), null, 'canonical 严格模式不允许缺 sensorId');
assert.deepStrictEqual(identity.resolveSensorIdentity({
  channelId: 'seat:left',
  displaySystemId: 'seat',
}, { allowDerived: true }), {
  channelId: 'seat:left',
  displaySystemId: 'seat',
  sensorId: 'left',
});
assert.deepStrictEqual(identity.resolveSensorIdentity({
  displaySystemId: 'seat',
  sensorId: 'left',
}, { allowDerived: true }), {
  channelId: 'seat:left',
  displaySystemId: 'seat',
  sensorId: 'left',
});

const canonicalFrame = {
  type: SENSOR_FRAME_TYPE,
  schemaVersion: SENSOR_FRAME_SCHEMA_VERSION,
  channelId: 'seat:left',
  displaySystemId: 'seat',
  sensorId: 'left',
  outputChannel: 'armLeft',
  payload: { value: [1, 2] },
};
assert.strictEqual(
  buildSensorFrameEnvelope({ channel: 'armLeft', payload: canonicalFrame }).channelId,
  'seat:left',
);

[
  { ...canonicalFrame, displaySystemId: 'other' },
  { ...canonicalFrame, sensorId: 'right' },
  { ...canonicalFrame, channelId: 'seat:left:raw' },
  { ...canonicalFrame, sensorId: undefined },
  { ...canonicalFrame, outputChannel: '   ' },
  { ...canonicalFrame, outputChannel: ' armLeft ' },
  { ...canonicalFrame, displaySystemId: ' seat' },
].forEach((payload) => {
  assert.strictEqual(
    buildSensorFrameEnvelope({ channel: 'armLeft', payload }),
    null,
    'canonical 身份冲突、冒号歧义或缺失都必须丢帧',
  );
});

assert.strictEqual(buildSensorFrameEnvelope({
  channel: 'armLeft',
  payload: {
    ...canonicalFrame,
    schemaVersion: SENSOR_FRAME_SCHEMA_VERSION + 1,
    data: [9, 9],
    armLeftData: [9, 9],
  },
}), null, '未知 sensor.frame 版本不能降级成 legacy 后重发为 v1');

const derivedFromChannel = buildSensorFrameEnvelope({
  channel: 'armLeft',
  payload: {
    channelId: 'seat:left',
    displaySystemId: 'seat',
    data: [3, 4],
  },
});
assert.deepStrictEqual({
  channelId: derivedFromChannel.channelId,
  displaySystemId: derivedFromChannel.displaySystemId,
  sensorId: derivedFromChannel.sensorId,
}, {
  channelId: 'seat:left',
  displaySystemId: 'seat',
  sensorId: 'left',
});

const derivedFromParts = buildSensorFrameEnvelope({
  channel: 'armLeft',
  payload: {
    displaySystemId: 'seat',
    sensorId: 'left',
    data: [5, 6],
  },
});
assert.strictEqual(derivedFromParts.channelId, 'seat:left');
assert.strictEqual(buildSensorFrameEnvelope({
  channel: 'armLeft',
  payload: {
    channelId: 'seat:left',
    displaySystemId: 'other',
    data: [7, 8],
  },
}), null, 'legacy 同时提供的身份字段冲突时也不能猜');
assert.strictEqual(buildSensorFrameEnvelope({
  channel: 'armLeft',
  payload: {
    channelId: 'seat:left:raw',
    data: [7, 8],
  },
}), null, 'legacy channelId 多冒号同样必须拒绝');

const enqueued = [];
const storage = createCollectionFrameStorageService({
  getSensorType: () => 'seat',
  getDbRef: () => 'primary-db',
  isCollecting: () => true,
  shouldStoreCollectionFrame: () => true,
  hasEnoughCollectionDiskSpace: () => true,
  enqueueCollectionFrame: (db, data, channel) => enqueued.push({ db, data, channel }),
  isZeroFrameStorageType: () => false,
  isSmallBedMatrixType: () => false,
});
const displayFrame = {
  runtimeSource: 'display-system',
  channelId: 'seat:left',
  displaySystemId: 'seat',
  sensorId: 'left',
  outputChannel: 'armLeft',
  data: [10, 11],
};
assert.strictEqual(storage.storeFrame(displayFrame), true);
assert.strictEqual(enqueued.length, 1);
assert.deepStrictEqual({
  channelId: enqueued[0].channel.channelId,
  displaySystemId: enqueued[0].channel.displaySystemId,
  sensorId: enqueued[0].channel.sensorId,
}, {
  channelId: 'seat:left',
  displaySystemId: 'seat',
  sensorId: 'left',
});

[
  { ...displayFrame, displaySystemId: 'other', sitData: [99] },
  { ...displayFrame, sensorId: 'right', sitData: [99] },
  { ...displayFrame, channelId: 'seat:left:raw', sitData: [99] },
  { ...displayFrame, sensorId: undefined, sitData: [99] },
].forEach((frame) => {
  assert.strictEqual(storage.getDisplaySystemFrameIdentity(frame), null);
  assert.strictEqual(
    storage.storeFrame(frame),
    false,
    '坏的 display-system 身份必须在 enqueue 前失败，不能落回 legacy 入库',
  );
});
assert.strictEqual(enqueued.length, 1, '所有坏身份帧都不得进入入库队列');

console.log('sensorIdentity.test.js passed');
