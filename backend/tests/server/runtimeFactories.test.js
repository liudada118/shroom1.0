const assert = require('assert');
const {
  bindLegacySerialRuntime,
} = require('../../extensions/built-in-sensors/runtimeBindingsFactory');
const {
  createSerialRuntime,
} = require('../../kernel/serial/serialRuntimeFactory');
const {
  createWebSocketRuntime,
} = require('../../kernel/platform/websocket/websocketRuntimeFactory');

const parserManager = { channels: { SIT: 'sit' } };
const serialRuntime = createSerialRuntime({
  frameDelimiter: Buffer.from([1]),
  smallBed12BDelimiter: Buffer.from([2]),
  parserManagerFactory: ({ frameDelimiter, smallBed12BDelimiter }) => {
    assert.deepStrictEqual([...frameDelimiter], [1]);
    assert.deepStrictEqual([...smallBed12BDelimiter], [2]);
    return parserManager;
  },
  serialManagerFactory: ({ parserManager: injectedParserManager }) => {
    assert.strictEqual(injectedParserManager, parserManager);
    return { roles: { SIT: 'sit' } };
  },
});

assert.strictEqual(serialRuntime.serialParserManager, parserManager);
serialRuntime.setSerialPortState('serialport', { demo: true });
assert.deepStrictEqual(serialRuntime.getSerialPortState('serialport'), { demo: true });
serialRuntime.serialPortStateAccessor('serialport').set({ demo: false });
assert.deepStrictEqual(serialRuntime.serialPortStateAccessor('serialport').get(), { demo: false });

const websocketRuntime = createWebSocketRuntime({
  getSensorType: () => 'demo',
  channelBusFactory: () => ({ publish: () => ({ timestamp: 1 }) }),
  realtimeTelemetryGatewayFactory: () => ({
    publishRealtimeFrame: (channel, payload) => ({
      channel,
      payload,
      legacySent: 2,
    }),
  }),
  webSocketServersFactory: () => ({ sit: {}, back: {}, head: {} }),
  webSocketSubscriptionManagerFactory: () => ({ publish: () => 0 }),
});

assert.strictEqual(websocketRuntime.publishRealtimeFrame('sit', { data: [1] }), 2);
assert.deepStrictEqual(Object.keys(websocketRuntime.wsServers), ['sit', 'back', 'head']);

const legacyBinding = bindLegacySerialRuntime({
  baseContext: { publish: () => {} },
  collectionStateAccessor: () => ({ get: () => null, set: () => {} }),
  getManagedSerialPort: () => null,
  mutableBindings: {
    file: { get: () => 'demo', set: () => {} },
  },
  runtimeStateAccessor: () => ({ get: () => null, set: () => {} }),
  serialRoles: { SIT: 'sit' },
  zeroStateAccessor: () => ({ get: () => null, set: () => {} }),
  serialParserManager: {
    channels: {
      BACK: 'back',
      BIG_BED_SIT: 'bigBedSit',
      HEAD: 'head',
      SIT: 'sit',
      SMALL_BED_12B: 'smallBed12B',
    },
    onData: () => {},
  },
});

assert.ok(legacyBinding.legacySerialRuntimeContext);
assert.ok(legacyBinding.legacySerialRuntimeBinding);

console.log('runtimeFactories.test.js passed');
