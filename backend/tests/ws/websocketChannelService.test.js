const assert = require('assert');
const WebSocket = require('ws');
const {
  LEGACY_DEFAULT_WEBSOCKET_CHANNEL,
  SHARED_WEBSOCKET_PORT,
  broadcastToChannel,
  buildRealtimeChannelMetadata,
  getChannelClientCounts,
  normalizeChannel,
  normalizeChannelList,
  toPayload,
} = require('../../kernel/platform/websocket/websocketChannelService');

assert.strictEqual(SHARED_WEBSOCKET_PORT, 19999);
assert.strictEqual(LEGACY_DEFAULT_WEBSOCKET_CHANNEL, 'sit');
assert.strictEqual(normalizeChannel('back'), 'back');
assert.strictEqual(normalizeChannel(' armLeft '), 'armLeft');
assert.strictEqual(normalizeChannel(''), 'sit');
assert.deepStrictEqual(normalizeChannelList([
  'sit',
  { outputChannel: 'armLeft' },
  { serialRole: 'armRight' },
  { channelId: 'armLeft' },
]), ['sit', 'armLeft', 'armRight']);
assert.deepStrictEqual(buildRealtimeChannelMetadata({
  sensorType: 'wearable-demo',
  managedChannels: [
    { portId: 'left-input', role: 'left-input' },
    { portId: 'right-input', role: 'right-input' },
  ],
  manifestChannels: [
    { serialRole: 'left-input', outputChannel: 'armLeft', label: '左臂' },
    { serialRole: 'right-input', outputChannel: 'armRight', label: '右臂' },
  ],
}), [
  {
    channelId: 'armLeft',
    name: '左臂',
    port: 19999,
    serialRole: 'left-input',
    sensorType: 'wearable-demo',
    transport: 'websocket',
    legacy: false,
  },
  {
    channelId: 'armRight',
    name: '右臂',
    port: 19999,
    serialRole: 'right-input',
    sensorType: 'wearable-demo',
    transport: 'websocket',
    legacy: false,
  },
]);
assert.strictEqual(buildRealtimeChannelMetadata({
  sensorType: 'legacy-demo',
  managedChannels: [{ portId: 'back', role: 'back' }],
})[0].legacy, true);
assert.strictEqual(toPayload('raw'), 'raw');
assert.strictEqual(toPayload({ type: 'status' }), '{"type":"status"}');

const sent = [];
const sharedServer = {
  clients: new Set([
    { readyState: WebSocket.OPEN, send: (payload) => sent.push(payload) },
    { readyState: WebSocket.CLOSED, send: () => assert.fail('closed client must not receive data') },
  ]),
};
const getServer = () => sharedServer;

assert.strictEqual(broadcastToChannel(getServer, { data: [1] }, 'sit'), 1);
assert.deepStrictEqual(sent, ['{"data":[1]}']);
assert.deepStrictEqual(
  getChannelClientCounts(getServer, ['sit', 'armLeft', 'armRight']),
  { sit: 2, armLeft: 2, armRight: 2 },
);

console.log('websocketChannelService.test.js passed');
