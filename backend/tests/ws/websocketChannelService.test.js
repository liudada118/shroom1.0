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
const manifestMetadata = buildRealtimeChannelMetadata({
  sensorType: 'wearable-demo',
  managedChannels: [
    {
      portId: 'left-input',
      role: 'left-input',
      path: 'COM3',
      baudRate: 921600,
      parserChannel: 'wearable-demo:left-input',
      isOpen: true,
      status: 'open',
      openedAt: 123,
    },
  ],
  manifestChannels: [
    {
      channelId: 'wearable-demo:left-input',
      displaySystemId: 'wearable-demo',
      sensorId: 'left-input',
      serialRole: 'left-input',
      outputChannel: 'armLeft',
      label: '左臂',
      sensorType: 'arm-pressure',
      baudRate: 921600,
    },
    {
      channelId: 'wearable-demo:right-input',
      displaySystemId: 'wearable-demo',
      sensorId: 'right-input',
      serialRole: 'right-input',
      outputChannel: 'armRight',
      label: '右臂',
      sensorType: 'arm-pressure',
      baudRate: 115200,
    },
  ],
});
assert.strictEqual(manifestMetadata.length, 2);
assert.deepStrictEqual(manifestMetadata[0].serial, {
  role: 'left-input',
  portId: 'left-input',
  path: 'COM3',
  baudRate: 921600,
  parserChannel: 'wearable-demo:left-input',
  isOpen: true,
  status: 'open',
  openedAt: 123,
  updatedAt: null,
  lastError: null,
});
assert.strictEqual(manifestMetadata[0].sensorLabel, '左臂');
assert.strictEqual(manifestMetadata[0].sensorType, 'arm-pressure');
assert.strictEqual(manifestMetadata[0].serialPortPath, 'COM3');
assert.strictEqual(manifestMetadata[1].sensorLabel, '右臂');
assert.strictEqual(manifestMetadata[1].serialPortPath, null);
assert.strictEqual(manifestMetadata[1].baudRate, 115200);
assert.strictEqual(manifestMetadata[1].isOpen, false);
assert.strictEqual(manifestMetadata[1].status, 'unregistered');

const reconnectedMetadata = buildRealtimeChannelMetadata({
  sensorType: 'wearable-demo',
  manifestChannels: [{
    channelId: 'wearable-demo:left-input',
    displaySystemId: 'wearable-demo',
    sensorId: 'left-input',
    serialRole: 'left-input',
    outputChannel: 'armLeft',
    label: '左臂',
  }],
  managedChannels: [{
    portId: 'left-input',
    role: 'left-input',
    path: 'COM8',
    isOpen: true,
    status: 'open',
  }],
})[0];
assert.strictEqual(reconnectedMetadata.serialPortPath, 'COM8');
assert.strictEqual(reconnectedMetadata.serial.path, 'COM8');
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
