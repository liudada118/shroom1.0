const assert = require('assert');
const { EventEmitter } = require('events');
const WebSocket = require('ws');

const {
  WILDCARD_CHANNEL,
  createWebSocketSubscriptionManager,
} = require('../../kernel/platform/websocket/websocketSubscriptionService');

function createClient() {
  const client = new EventEmitter();
  client.readyState = WebSocket.OPEN;
  client.sent = [];
  client.send = (payload) => client.sent.push(JSON.parse(payload));
  return client;
}

const subscriptions = createWebSocketSubscriptionManager();
const wildcardClient = createClient();
const backClient = createClient();
const defaultReplacementClient = createClient();

subscriptions.registerClient(wildcardClient, {
  channels: [WILDCARD_CHANNEL],
  clientId: 'legacy-main',
  scope: 'main',
});
subscriptions.registerClient(backClient, {
  channels: ['back'],
  clientId: 'back-only',
  scope: 'main',
});
subscriptions.registerClient(defaultReplacementClient, {
  channels: [WILDCARD_CHANNEL],
  clientId: 'default-replacement',
  scope: 'main',
});

defaultReplacementClient.emit('message', JSON.stringify({
  type: 'subscribe',
  channels: ['armLeft'],
}));
assert.deepStrictEqual(subscriptions.getSubscriptions(defaultReplacementClient), ['armLeft']);

assert.strictEqual(subscriptions.publish('sit', { sitData: [1] }), 1);
assert.deepStrictEqual(wildcardClient.sent, [{ sitData: [1] }]);
assert.deepStrictEqual(backClient.sent, []);

assert.strictEqual(subscriptions.publish('armLeft', { armLeftData: [4] }), 2);
assert.deepStrictEqual(wildcardClient.sent.at(-1), { armLeftData: [4] });
assert.deepStrictEqual(defaultReplacementClient.sent.at(-1), { armLeftData: [4] });
subscriptions.unregisterClient(defaultReplacementClient);

subscriptions.subscribe(wildcardClient, ['back']);
assert.strictEqual(subscriptions.publish('back', { backData: [2] }), 2);
assert.deepStrictEqual(wildcardClient.sent.at(-1), { backData: [2] });
assert.deepStrictEqual(backClient.sent.at(-1), { backData: [2] });
assert.strictEqual(
  wildcardClient.sent.filter((message) => message.backData).length,
  1,
  'a client subscribed through both * and back must receive the frame once',
);

backClient.emit('message', JSON.stringify({
  type: 'subscribe',
  channels: ['head'],
  replace: true,
}));
assert.deepStrictEqual(subscriptions.getSubscriptions(backClient), ['head']);
assert.deepStrictEqual(backClient.sent.at(-1), {
  type: 'subscribed',
  clientId: 'back-only',
  channels: ['head'],
});

assert.strictEqual(subscriptions.publish('head', { headData: [3] }), 2);
assert.deepStrictEqual(wildcardClient.sent.at(-1), { headData: [3] });
assert.deepStrictEqual(backClient.sent.at(-1), { headData: [3] });

assert.deepStrictEqual(subscriptions.getStatus(), {
  channels: { '*': 1, back: 1, head: 1 },
  scopes: { main: 2 },
});

console.log('websocketSubscriptionService.test.js passed');
