const assert = require('assert');

const {
  createRealtimeTelemetryGateway,
} = require('../../kernel/realtime/realtimeTelemetryGateway');

const busCalls = [];
const websocketCalls = [];
const gateway = createRealtimeTelemetryGateway({
  channelBus: {
    publish: (channelId, payload, metadata) => {
      busCalls.push({ channelId, payload, metadata });
      return { timestamp: payload.timestamp };
    },
  },
  wsSubscriptions: {
    publish: (channelId, payload) => {
      websocketCalls.push({ channelId, payload });
      return 2;
    },
  },
  getSensorType: () => 'wearable-demo',
});

const legacyResult = gateway.publishRealtimeFrame('sit', {
  sitData: [4, 5, 6],
  realArr: [7, 8, 9],
  rawPressureData: [3, 4, 5],
  newArr147: [10, 11],
  rotate: [1, 2, 3, 4],
}, { timestamp: 1234 });

assert.strictEqual(legacyResult.sent, 2);
assert.strictEqual(legacyResult.frame.type, 'sensor.frame');
assert.strictEqual(legacyResult.frame.schemaVersion, 1);
assert.strictEqual(legacyResult.frame.channelId, 'wearable-demo:sit');
assert.strictEqual(legacyResult.frame.displaySystemId, 'wearable-demo');
assert.strictEqual(legacyResult.frame.sensorId, 'sit');
assert.strictEqual(legacyResult.frame.outputChannel, 'sit');
assert.strictEqual(legacyResult.frame.sequence, 1);
assert.strictEqual(legacyResult.frame.timestamp, 1234);
assert.deepStrictEqual(legacyResult.frame.payload.value, [4, 5, 6]);
assert.deepStrictEqual(legacyResult.frame.payload.stages.decoded, [7, 8, 9]);
assert.deepStrictEqual(legacyResult.frame.payload.stages.calibrated, [3, 4, 5]);
assert.deepStrictEqual(legacyResult.frame.payload.stages.mapped, [10, 11]);
assert.deepStrictEqual(legacyResult.frame.payload.orientation, [1, 2, 3, 4]);
assert.ok(!Object.hasOwn(legacyResult.frame, 'sitData'));

const manifestPayload = {
  channelId: 'human-body:left-arm',
  displaySystemId: 'human-body',
  sensorId: 'left-arm',
  sensorLabel: '左手',
  sensorType: 'arm-pad',
  outputChannel: 'armLeft',
  serialRole: 'leftHand',
  serial: {
    role: 'leftHand',
    portId: 'leftHand',
    path: 'COM7',
    baudRate: 921600,
    parserChannel: 'human-body:left-arm',
    status: 'open',
    isOpen: true,
  },
  rawData: [1, 2],
  normalizedData: [2, 1],
  data: [4, 2],
  armLeftData: [4, 2],
  metrics: { totalPressure: 6 },
  algorithmMetrics: { supportRate: 0.5 },
  metadata: { matrix: { rows: 1, cols: 2 } },
};
const firstManifestResult = gateway.publishRealtimeFrame('armLeft', manifestPayload, {
  timestamp: 2000,
});
const secondManifestResult = gateway.publishRealtimeFrame('armLeft', manifestPayload, {
  timestamp: 2001,
});

assert.strictEqual(firstManifestResult.frame.channelId, 'human-body:left-arm');
assert.strictEqual(firstManifestResult.frame.sensorId, 'left-arm');
assert.strictEqual(firstManifestResult.frame.sensorLabel, '左手');
assert.deepStrictEqual(firstManifestResult.frame.serial, manifestPayload.serial);
assert.strictEqual(firstManifestResult.frame.sequence, 1);
assert.strictEqual(secondManifestResult.frame.sequence, 2);
assert.deepStrictEqual(firstManifestResult.frame.payload.stages.decoded, [1, 2]);
assert.deepStrictEqual(firstManifestResult.frame.payload.stages.normalized, [2, 1]);
assert.deepStrictEqual(firstManifestResult.frame.payload.value, [4, 2]);
assert.deepStrictEqual(firstManifestResult.frame.payload.matrix, { rows: 1, cols: 2, total: 2 });
assert.strictEqual(websocketCalls.length, 3, 'each physical frame must be sent once');
assert.deepStrictEqual(
  websocketCalls.map((call) => call.channelId),
  ['wearable-demo:sit', 'human-body:left-arm', 'human-body:left-arm'],
);
assert.strictEqual(busCalls.length, 3, 'ChannelBus must receive the same single canonical frame');

const sanitizedResult = gateway.publishRealtimeFrame('sit', {
  type: 'sensor.frame',
  schemaVersion: 1,
  channelId: 'wearable-demo:sit',
  displaySystemId: 'wearable-demo',
  sensorId: 'sit',
  sensorType: 'wearable-demo',
  outputChannel: 'sit',
  sitData: [999],
  payload: {
    value: [12],
    stages: { processed: [12] },
  },
}, { timestamp: 3000 });
assert.deepStrictEqual(sanitizedResult.frame.payload.value, [12]);
assert.ok(!Object.hasOwn(sanitizedResult.frame, 'sitData'));
assert.strictEqual(sanitizedResult.frame.sequence, 2);
assert.strictEqual(websocketCalls.length, 4, 'canonical input must still be emitted exactly once');

const mappedOnlyResult = gateway.publishRealtimeFrame('back', {
  newArr147: [6, 7],
}, { timestamp: 4000 });
assert.deepStrictEqual(mappedOnlyResult.frame.payload.value, [6, 7]);
assert.strictEqual(mappedOnlyResult.frame.payload.stages.processed, null);
assert.deepStrictEqual(mappedOnlyResult.frame.payload.stages.mapped, [6, 7]);

console.log('realtimeTelemetryGateway.test.js passed');
