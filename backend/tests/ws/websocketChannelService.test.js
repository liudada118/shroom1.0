const assert = require('assert');
const WebSocket = require('ws');
const {
  CHANNELS,
  broadcastToChannel,
  getChannelClientCounts,
  normalizeChannel,
  toPayload,
} = require('../../kernel/platform/websocket/websocketChannelService');

assert.deepStrictEqual(
  Object.fromEntries(Object.entries(CHANNELS).map(([key, value]) => [key, value.port])),
  { sit: 19999, back: 19998, head: 19997 },
);
assert.strictEqual(normalizeChannel('back'), 'back');
assert.strictEqual(normalizeChannel('unknown'), 'sit');
assert.strictEqual(toPayload('raw'), 'raw');
assert.strictEqual(toPayload({ type: 'status' }), '{"type":"status"}');

const sent = [];
const servers = {
  sit: {
    clients: new Set([
      { readyState: WebSocket.OPEN, send: (payload) => sent.push(payload) },
      { readyState: WebSocket.CLOSED, send: () => assert.fail('closed client must not receive data') },
    ]),
  },
  back: { clients: new Set() },
  head: { clients: new Set() },
};
const getServer = (channel) => servers[channel];

assert.strictEqual(broadcastToChannel(getServer, { data: [1] }, 'sit'), 1);
assert.deepStrictEqual(sent, ['{"data":[1]}']);
assert.deepStrictEqual(getChannelClientCounts(getServer), { sit: 2, back: 0, head: 0 });

console.log('websocketChannelService.test.js passed');
