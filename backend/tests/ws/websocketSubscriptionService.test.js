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
  clientId: 'main',
  scope: 'main',
});
subscriptions.registerClient(backClient, {
  channels: ['demo:back'],
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
  channels: ['human-body:left-arm'],
}));
assert.deepStrictEqual(subscriptions.getSubscriptions(defaultReplacementClient), ['human-body:left-arm']);

const sitFrame = { type: 'sensor.frame', channelId: 'demo:sit', payload: { value: [1] } };
assert.strictEqual(subscriptions.publish('demo:sit', sitFrame), 1);
assert.deepStrictEqual(wildcardClient.sent, [sitFrame]);
assert.deepStrictEqual(backClient.sent, []);

const armFrame = {
  type: 'sensor.frame',
  channelId: 'human-body:left-arm',
  payload: { value: [4] },
};
assert.strictEqual(subscriptions.publish('human-body:left-arm', armFrame), 2);
assert.deepStrictEqual(wildcardClient.sent.at(-1), armFrame);
assert.deepStrictEqual(defaultReplacementClient.sent.at(-1), armFrame);
subscriptions.unregisterClient(defaultReplacementClient);

subscriptions.subscribe(wildcardClient, ['demo:back']);
const backFrame = { type: 'sensor.frame', channelId: 'demo:back', payload: { value: [2] } };
assert.strictEqual(subscriptions.publish('demo:back', backFrame), 2);
assert.deepStrictEqual(wildcardClient.sent.at(-1), backFrame);
assert.deepStrictEqual(backClient.sent.at(-1), backFrame);
assert.strictEqual(
  wildcardClient.sent.filter((message) => message.channelId === 'demo:back').length,
  1,
  'a client subscribed through both * and demo:back must receive the frame once',
);

backClient.emit('message', JSON.stringify({
  type: 'subscribe',
  channels: ['demo:head'],
  replace: true,
}));
assert.deepStrictEqual(subscriptions.getSubscriptions(backClient), ['demo:head']);
assert.deepStrictEqual(backClient.sent.at(-1), {
  type: 'subscribed',
  clientId: 'back-only',
  channels: ['demo:head'],
});

const headFrame = { type: 'sensor.frame', channelId: 'demo:head', payload: { value: [3] } };
assert.strictEqual(subscriptions.publish('demo:head', headFrame), 2);
assert.deepStrictEqual(wildcardClient.sent.at(-1), headFrame);
assert.deepStrictEqual(backClient.sent.at(-1), headFrame);

assert.deepStrictEqual(subscriptions.getStatus(), {
  channels: { '*': 1, 'demo:back': 1, 'demo:head': 1 },
  scopes: { main: 2 },
});

console.log('websocketSubscriptionService.test.js passed');
