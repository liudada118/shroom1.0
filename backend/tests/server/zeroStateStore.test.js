const assert = require('assert');
const {
  ZERO_STAGES,
  createZeroStateStore,
} = require('../../kernel/platform/runtime/zeroStateStore');

assert.deepStrictEqual(ZERO_STAGES, [
  'decoded',
  'normalized',
  'processed',
  'mapped',
]);

const store = createZeroStateStore();
const rawSource = [1, 2];
const processedSource = [2, 5];
const mappedSource = [8, 13];

store.updateSources('system-a:seat', {
  raw: rawSource,
  processed: processedSource,
  mapped: mappedSource,
}, {
  outputChannel: 'pressure',
  label: 'Seat pressure',
});
store.updateSources('system-b:seat', {
  processed: [100, 200],
});
store.updateSources('system-a:empty', {}, {
  outputChannel: 'empty-output',
});

rawSource[0] = 999;
processedSource[0] = 999;
mappedSource[0] = 999;

assert.deepStrictEqual(store.getSources('system-a:seat'), {
  decoded: [1, 2],
  normalized: [],
  processed: [2, 5],
  mapped: [8, 13],
});
assert.deepStrictEqual(store.snapshot('system-a:seat').identity, {
  channelId: 'system-a:seat',
  displaySystemId: 'system-a',
  sensorId: 'seat',
  outputChannel: 'pressure',
  label: 'Seat pressure',
});
assert.deepStrictEqual(store.snapshot('system-b:seat').identity, {
  channelId: 'system-b:seat',
  displaySystemId: 'system-b',
  sensorId: 'seat',
  outputChannel: 'seat',
});

const returnedSources = store.getSources('system-a:seat');
returnedSources.decoded[0] = 777;
assert.deepStrictEqual(store.getSources('system-a:seat').decoded, [1, 2]);

assert.deepStrictEqual(store.listChannelIds(), [
  'system-a:empty',
  'system-a:seat',
  'system-b:seat',
]);
assert.deepStrictEqual(store.listChannelIds({ displaySystemId: 'system-a' }), [
  'system-a:empty',
  'system-a:seat',
]);
assert.deepStrictEqual(store.listChannelIds({
  displaySystemId: 'system-a',
  withSourcesOnly: true,
}), ['system-a:seat']);

assert.deepStrictEqual(
  store.capture(['system-a:seat', 'system-a:missing', 'seat', 'system-a:seat']),
  {
    affectedChannelIds: ['system-a:seat'],
    skipped: [
      { channelId: 'system-a:missing', reason: 'unknown-channel' },
      { channelId: 'seat', reason: 'invalid-channel-id' },
    ],
  },
);
assert.deepStrictEqual(store.capture('system-a:empty'), {
  affectedChannelIds: [],
  skipped: [{ channelId: 'system-a:empty', reason: 'no-source-data' }],
});

assert.deepStrictEqual(store.getBaseline('system-a:seat', 'raw'), [1, 2]);
assert.deepStrictEqual(store.getBaseline('system-a:seat', 'processed'), [2, 5]);
assert.deepStrictEqual(store.getBaselines('system-b:seat'), {
  decoded: [],
  normalized: [],
  processed: [],
  mapped: [],
});
assert.deepStrictEqual(store.apply('system-a:seat', 'processed', [1, 9]), [0, 4]);
assert.deepStrictEqual(store.apply('system-a:seat', 'raw', [5, 9]), [4, 7]);
assert.deepStrictEqual(
  store.apply('system-a:seat', 'processed', [1, 9, 12]),
  [1, 9, 12],
);
assert.deepStrictEqual(
  store.apply('system-b:seat', 'processed', [150, 250]),
  [150, 250],
);

const applied = store.apply('system-a:seat', 'processed', [5, 7]);
applied[0] = 999;
assert.deepStrictEqual(store.getBaseline('system-a:seat', 'processed'), [2, 5]);

const baselines = store.getBaselines('system-a:seat');
baselines.mapped[0] = 999;
assert.deepStrictEqual(store.getBaseline('system-a:seat', 'mapped'), [8, 13]);

const allSnapshots = store.snapshot();
allSnapshots['system-a:seat'].sources.decoded[0] = 999;
allSnapshots['system-a:seat'].identity.outputChannel = 'changed';
assert.deepStrictEqual(store.getSources('system-a:seat').decoded, [1, 2]);
assert.strictEqual(store.snapshot('system-a:seat').identity.outputChannel, 'pressure');
assert.strictEqual(store.snapshot('system-c:unknown'), null);

store.updateSources('system-a:seat', { processed: [] });
assert.deepStrictEqual(store.capture('system-a:seat'), {
  affectedChannelIds: [],
  skipped: [{ channelId: 'system-a:seat', reason: 'no-source-data' }],
});
assert.deepStrictEqual(
  store.getBaseline('system-a:seat', 'processed'),
  [2, 5],
  'an empty source must not replace an existing baseline',
);
assert.deepStrictEqual(store.getSources('system-a:seat'), {
  decoded: [],
  normalized: [],
  processed: [],
  mapped: [],
});

store.updateSources('system-a:seat', { processed: [9, 10] });
assert.deepStrictEqual(store.capture('system-a:seat').affectedChannelIds, ['system-a:seat']);
assert.deepStrictEqual(store.getBaselines('system-a:seat'), {
  decoded: [],
  normalized: [],
  processed: [9, 10],
  mapped: [],
}, 'capture must replace all stages atomically instead of retaining stale mapped/raw baselines');

assert.deepStrictEqual(store.clear(['system-a:seat', 'system-c:unknown', ':invalid']), {
  affectedChannelIds: ['system-a:seat'],
  skipped: [
    { channelId: 'system-c:unknown', reason: 'unknown-channel' },
    { channelId: ':invalid', reason: 'invalid-channel-id' },
  ],
});
assert.deepStrictEqual(store.getBaselines('system-a:seat'), {
  decoded: [],
  normalized: [],
  processed: [],
  mapped: [],
});
assert.deepStrictEqual(store.apply('system-a:seat', 'processed', [4, 9]), [4, 9]);

assert.throws(
  () => store.updateSources('seat', { processed: [1] }),
  /complete channelId/,
);
assert.throws(
  () => store.updateSources(' system-a:seat', { processed: [1] }),
  /complete channelId/,
);
assert.throws(
  () => store.updateSources('system-a: seat', { processed: [1] }),
  /complete channelId/,
);
assert.throws(
  () => store.updateSources('system-a:seat:extra', { processed: [1] }),
  /complete channelId/,
);
assert.throws(
  () => store.updateSources('system-a:seat', { processed: [1] }, {
    displaySystemId: 'another-system',
    sensorId: 'seat',
  }),
  /identity must match channelId/,
);
assert.throws(
  () => store.updateSources('system-a:seat', { processed: [1] }, {
    displaySystemId: 'system-a',
    sensorId: 'seat:variant',
  }),
  /without colons/,
);
assert.throws(
  () => store.updateSources('system-a:seat', { processed: [1] }, {
    channelId: 'system-a:another-seat',
  }),
  /identity channelId must match channelId/,
);

const explicitIdentityStore = createZeroStateStore();
explicitIdentityStore.updateSources('display-explicit:sensor-explicit', {
  processed: [7],
}, {
  channelId: 'display-explicit:sensor-explicit',
  displaySystemId: 'display-explicit',
  sensorId: 'sensor-explicit',
  outputChannel: 'pressure',
});
assert.deepStrictEqual(
  explicitIdentityStore.snapshot('display-explicit:sensor-explicit').identity,
  {
    channelId: 'display-explicit:sensor-explicit',
    displaySystemId: 'display-explicit',
    sensorId: 'sensor-explicit',
    outputChannel: 'pressure',
  },
);
assert.throws(
  () => store.apply('system-a:seat', 'calibrated', [1]),
  /unsupported zero state stage/,
);

console.log('zeroStateStore.test.js passed');
