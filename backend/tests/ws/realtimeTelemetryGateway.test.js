const assert = require('assert');

const {
  createRealtimeTelemetryGateway,
  prepareTelemetryPayload,
} = require('../../kernel/realtime/realtimeTelemetryGateway');

assert.deepStrictEqual(
  prepareTelemetryPayload('armLeft', { armLeftData: [1, 2], data: [9] }),
  { armLeftData: [1, 2], data: [9], pressureData: [1, 2] },
);

const busCalls = [];
const legacyCalls = [];
const exactCalls = [];
const gateway = createRealtimeTelemetryGateway({
  channelBus: {
    publish: (channelId, payload, metadata) => {
      busCalls.push({ channelId, payload, metadata });
      return { timestamp: 1234 };
    },
  },
  wsSubscriptions: {
    publish: (channel, payload) => {
      legacyCalls.push({ channel, payload });
      return 2;
    },
    publishExact: (channel, payload) => {
      exactCalls.push({ channel, payload });
      return 1;
    },
  },
  getSensorType: () => 'wearable-demo',
});

const sourcePayload = { armLeftData: [4, 5, 6], data: [4, 5, 6] };
const result = gateway.publishRealtimeFrame('armLeft', sourcePayload);

assert.deepStrictEqual(legacyCalls, [{ channel: 'armLeft', payload: sourcePayload }]);
assert.strictEqual(result.legacySent, 2);
assert.strictEqual(result.telemetrySent, 1);
assert.strictEqual(result.telemetryFrame.channelId, 'wearable-demo_armLeft.pressure');
assert.strictEqual(result.telemetryFrame.portId, 'armLeft');
assert.deepStrictEqual(result.telemetryFrame.value, [4, 5, 6]);
assert.strictEqual(busCalls[0].channelId, 'armLeft');
assert.strictEqual(busCalls[1].channelId, 'wearable-demo_armLeft.pressure');
assert.strictEqual(exactCalls[0].channel, 'wearable-demo_armLeft.pressure');

console.log('realtimeTelemetryGateway.test.js passed');
