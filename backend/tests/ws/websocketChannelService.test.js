const assert = require('assert');
const {
  LEGACY_DEFAULT_WEBSOCKET_CHANNEL,
  SHARED_WEBSOCKET_PORT,
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
  'wearable-demo:sit',
  { channelId: 'wearable-demo:armLeft', outputChannel: 'armLeft' },
  { serialRole: 'armRight' },
  { channelId: 'wearable-demo:armLeft' },
]), ['wearable-demo:sit', 'wearable-demo:armLeft', 'armRight']);
assert.deepStrictEqual(buildRealtimeChannelMetadata({
  sensorType: 'wearable-demo',
  managedChannels: [
    { portId: 'left-input', role: 'left-input' },
    { portId: 'right-input', role: 'right-input' },
  ],
  manifestChannels: [
    {
      channelId: 'wearable-demo:left-input',
      displaySystemId: 'wearable-demo',
      sensorId: 'left-input',
      serialRole: 'left-input',
      outputChannel: 'armLeft',
      label: '左臂',
    },
    {
      channelId: 'wearable-demo:right-input',
      displaySystemId: 'wearable-demo',
      sensorId: 'right-input',
      serialRole: 'right-input',
      outputChannel: 'armRight',
      label: '右臂',
    },
  ],
}), [
  {
    channelId: 'wearable-demo:left-input',
    name: '左臂',
    port: 19999,
    displaySystemId: 'wearable-demo',
    sensorId: 'left-input',
    serialRole: 'left-input',
    outputChannel: 'armLeft',
    sensorType: 'wearable-demo',
    transport: 'websocket',
    messageType: 'sensor.frame',
    schemaVersion: 1,
    legacy: false,
  },
  {
    channelId: 'wearable-demo:right-input',
    name: '右臂',
    port: 19999,
    displaySystemId: 'wearable-demo',
    sensorId: 'right-input',
    serialRole: 'right-input',
    outputChannel: 'armRight',
    sensorType: 'wearable-demo',
    transport: 'websocket',
    messageType: 'sensor.frame',
    schemaVersion: 1,
    legacy: false,
  },
]);
const legacyMetadata = buildRealtimeChannelMetadata({
  sensorType: 'legacy-demo',
  managedChannels: [{ portId: 'back', role: 'back' }],
})[0];
assert.strictEqual(legacyMetadata.channelId, 'legacy-demo:back');
assert.strictEqual(legacyMetadata.outputChannel, 'back');
assert.strictEqual(legacyMetadata.legacy, true);
assert.strictEqual(toPayload('raw'), 'raw');
assert.strictEqual(toPayload({ type: 'status' }), '{"type":"status"}');

const sharedServer = {
  clients: new Set([
    {},
    {},
  ]),
};
/**
 * 取 WebSocket server 的 getter。传 getter 而不是直接传 server，是因为真实调用点在
 * server 还没建好时就要拿到这个函数 —— 通道统计每次都现取。
 *
 * @returns {{clients: Set<object>}} 固定的假 server，带两个空客户端。
 */
const getServer = () => sharedServer;

assert.deepStrictEqual(
  getChannelClientCounts(getServer, [
    'wearable-demo:left-input',
    'wearable-demo:right-input',
  ]),
  { 'wearable-demo:left-input': 2, 'wearable-demo:right-input': 2 },
);

console.log('websocketChannelService.test.js passed');
