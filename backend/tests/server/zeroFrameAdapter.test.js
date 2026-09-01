const assert = require('assert');

const {
  createZeroChannelIdentityResolver,
  sensorIdFromChannelId,
} = require('../../kernel/platform/runtime/zeroChannelIdentityResolver');
const {
  createZeroFrameAdapter,
  getZeroBaselineForStorage,
} = require('../../kernel/platform/runtime/zeroFrameAdapter');
const {
  createZeroStateStore,
} = require('../../kernel/platform/runtime/zeroStateStore');

let sensorType = 'seat-a';
const channelsBySensorType = {
  'seat-a': [{
    channelId: 'display-a:seat-pad',
    displaySystemId: 'display-a',
    sensorId: 'seat-pad',
    sensorType: 'seat-a',
    serialRole: 'sit',
    outputChannel: 'sit',
  }],
  'seat-b': [{
    channelId: 'display-b:seat-pad',
    displaySystemId: 'display-b',
    sensorId: 'seat-pad',
    sensorType: 'seat-b',
    serialRole: 'sit',
    outputChannel: 'sit',
  }],
  'invalid-manifest': [
    {
      channelId: 'display-bad:seat:extra',
      displaySystemId: 'display-bad',
      sensorId: 'seat:extra',
      sensorType: 'invalid-manifest',
      serialRole: 'bad-multi',
      outputChannel: 'bad-multi',
    },
    {
      channelId: 'display-bad:seat',
      displaySystemId: 'another-display',
      sensorId: 'seat',
      sensorType: 'invalid-manifest',
      serialRole: 'bad-conflict',
      outputChannel: 'bad-conflict',
    },
  ],
};
const identityResolver = createZeroChannelIdentityResolver({
  getActiveSensorType: () => sensorType,
  listSerialChannels: (type) => channelsBySensorType[type] || [],
});
assert.strictEqual(sensorIdFromChannelId('display-a:seat-pad', 'sit'), 'seat-pad');
assert.strictEqual(
  sensorIdFromChannelId('display-a:seat:extra', 'arm left'),
  'arm-left',
  'an ambiguous canonical id may only use the explicitly sanitized legacy fallback',
);
const zeroStateStore = createZeroStateStore();
const adapter = createZeroFrameAdapter({
  zeroStateStore,
  resolveChannelIdentity: identityResolver.resolveChannelIdentity,
});

const firstFrame = adapter.process('sit', {
  sitData: [10, 20],
  realArr: [4, 8],
  rawPressureData: [4, 8],
  newArr147: [3, 6],
});
assert.strictEqual(firstFrame.channelId, 'display-a:seat-pad');
assert.deepStrictEqual(firstFrame.sitData, [10, 20]);
assert.deepStrictEqual(zeroStateStore.capture('display-a:seat-pad').affectedChannelIds, [
  'display-a:seat-pad',
]);

const processedRawFrame = adapter.process('sit', {
  sitData: [13, 18],
  realArr: [9, 7],
  rawPressureData: [13, 18],
});
assert.deepStrictEqual(
  processedRawFrame.rawPressureData,
  [3, 0],
  'a legacy rawPressureData copy of processed data must use the processed baseline',
);
assert.strictEqual(processedRawFrame.zeroStorageStage, 'processed');
assert.deepStrictEqual(
  getZeroBaselineForStorage(zeroStateStore, 'display-a:seat-pad', processedRawFrame),
  [10, 20],
);

const zeroedFrame = adapter.process('sit', {
  sitData: [13, 18],
  realArr: [9, 7],
  rawPressureData: [9, 7],
  newArr147: [8, 4],
});
assert.deepStrictEqual(zeroedFrame.sitData, [3, 0]);
assert.deepStrictEqual(zeroedFrame.rawPressureData, [5, 0]);
assert.strictEqual(zeroedFrame.zeroStorageStage, 'decoded');
assert.deepStrictEqual(
  getZeroBaselineForStorage(zeroStateStore, 'display-a:seat-pad', zeroedFrame),
  [4, 8],
);
assert.deepStrictEqual(zeroedFrame.newArr147, [5, 0]);
assert.deepStrictEqual(zeroedFrame.realArr, [9, 7]);
assert.deepStrictEqual(
  zeroStateStore.getSources('display-a:seat-pad').processed,
  [13, 18],
  'latest source must stay pre-zero so a later capture does not accumulate subtraction',
);

sensorType = 'seat-b';
const isolatedFrame = adapter.process('sit', { sitData: [13, 18] });
assert.strictEqual(isolatedFrame.channelId, 'display-b:seat-pad');
assert.deepStrictEqual(isolatedFrame.sitData, [13, 18]);

const unknownManifestFrame = { mysteryData: [1, 2] };
assert.strictEqual(identityResolver.resolveChannelIdentity('mystery'), null);
assert.strictEqual(
  adapter.process('mystery', unknownManifestFrame),
  unknownManifestFrame,
  'an undeclared manifest channel must not be rewritten as a legacy zero identity',
);

sensorType = 'invalid-manifest';
assert.strictEqual(identityResolver.getActiveDisplaySystemId(), '');
assert.deepStrictEqual(identityResolver.listActiveChannelIds(), []);
for (const channel of ['bad-multi', 'bad-conflict']) {
  const invalidFrame = { [`${channel}Data`]: [1, 2] };
  assert.strictEqual(identityResolver.resolveChannelIdentity(channel), null);
  assert.strictEqual(
    adapter.process(channel, invalidFrame),
    invalidFrame,
    'invalid manifest identity must fail closed before it reaches zeroStateStore',
  );
}
assert.strictEqual(zeroStateStore.snapshot('display-bad:seat'), null);

sensorType = 'legacy custom';
const fallbackFrame = adapter.process('arm left', { armLeftData: [1, 2] });
assert.strictEqual(fallbackFrame.channelId, 'legacy-custom:arm-left');
assert.strictEqual(fallbackFrame.displaySystemId, 'legacy-custom');

const manifestFrame = {
  channelId: 'display-a:seat-pad',
  displaySystemId: 'display-a',
  runtimeSource: 'display-system',
  outputChannel: 'sit',
  sitData: [100, 200],
};
assert.strictEqual(adapter.process('sit', manifestFrame), manifestFrame);

sensorType = 'seat-b';
const unmarkedLegacyFrame = adapter.process('sit', {
  channelId: 'untrusted:alias',
  sitData: [11, 22],
});
assert.strictEqual(unmarkedLegacyFrame.channelId, 'display-b:seat-pad');
assert.strictEqual(unmarkedLegacyFrame.runtimeSource, 'legacy');

// 内部算法帧和对外 matrixOrigin 可以是两个不同 processed 表示。显式 source
// 必须独立捕获/扣零，且不能覆盖不同源的对外 payload。
sensorType = 'internal-stage';
adapter.prepare('sit', { sitData: [100, 200] }, {
  sourceStages: { processed: [10, 20] },
});
zeroStateStore.capture('internal-stage:sit');
const isolatedProcessedStage = adapter.prepare('sit', { sitData: [130, 240] }, {
  sourceStages: { processed: [13, 25] },
});
assert.deepStrictEqual(isolatedProcessedStage.frame.sitData, [130, 240]);
assert.deepStrictEqual(isolatedProcessedStage.zeroedStages.processed, [3, 5]);

sensorType = 'mixed-fields';
adapter.process('sit', {
  data: [10, 20],
  sitData: [100, 200],
  pressureData: [300, 400],
});
zeroStateStore.capture('mixed-fields:sit');
const mixedFields = adapter.process('sit', {
  data: [12, 25],
  sitData: [102, 205],
  pressureData: [302, 405],
});
assert.deepStrictEqual(mixedFields.data, [2, 5]);
assert.deepStrictEqual(mixedFields.sitData, [102, 205]);
assert.deepStrictEqual(mixedFields.pressureData, [302, 405]);

sensorType = 'empty-preferred-field';
const emptyPreferredField = adapter.process('sit', {
  data: [],
  sitData: [10, 20],
});
assert.deepStrictEqual(
  zeroStateStore.getSources('empty-preferred-field:sit').processed,
  [10, 20],
  'an empty preferred alias must not hide a later non-empty legacy frame',
);
assert.deepStrictEqual(
  zeroStateStore.capture('empty-preferred-field:sit').affectedChannelIds,
  ['empty-preferred-field:sit'],
);
const zeroedAfterEmptyAlias = adapter.process('sit', {
  data: [],
  sitData: [13, 18],
});
assert.deepStrictEqual(zeroedAfterEmptyAlias.data, []);
assert.deepStrictEqual(zeroedAfterEmptyAlias.sitData, [3, 0]);

console.log('zeroFrameAdapter.test.js passed');
