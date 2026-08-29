const assert = require('assert');
const { EventEmitter } = require('events');

const {
  createSensorStatusPayload,
  createWebSocketHandlerAttacher,
} = require('../../kernel/platform/websocket/webSocketHandlerFactory');
const {
  createWebSocketSubscriptionManager,
} = require('../../kernel/platform/websocket/websocketSubscriptionService');

const payload = createSensorStatusPayload({
  file: 'custom-pressure-map',
  licenseFile: ['hand0205', 'jqbed'],
  selectFlag: ['hand0205', 'jqbed'],
}, {
  date: 123456,
  nowDate: 120000,
});

assert.deepStrictEqual(payload, {
  file: ['hand0205', 'jqbed'],
  currentSensorType: 'custom-pressure-map',
  selectFlag: ['hand0205', 'jqbed'],
  date: 123456,
  nowDate: 120000,
});

const singleTypePayload = createSensorStatusPayload({
  file: 'custom-pressure-map',
  licenseFile: null,
  selectFlag: undefined,
});

assert.strictEqual(singleTypePayload.file, null);
assert.strictEqual(singleTypePayload.currentSensorType, 'custom-pressure-map');

const server = new EventEmitter();
const registeredClients = [];
const commandCalls = [];
const heartbeatClients = [];
const publishedSystemEvents = [];
const registeredHandlers = [];
const wsSubscriptions = createWebSocketSubscriptionManager({
  logger: { warn: () => {} },
});
const registerSubscriptionClient = wsSubscriptions.registerClient;
wsSubscriptions.registerClient = (client, options) => {
  registeredClients.push({ client, options });
  return registerSubscriptionClient(client, options);
};
const handlerContext = {
  WILDCARD_CHANNEL: '*',
  attachHeartbeat: (client) => heartbeatClients.push(client),
  controlCommandService: {
    executeWs: (message, context) => {
      commandCalls.push({ message, context });
      return { handled: true, results: [] };
    },
    registerHandler: (handler) => registeredHandlers.push(handler),
  },
  getStoredLicenseKey: () => '',
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
  },
  parseJsonMessage: (message) => JSON.parse(String(message)),
  publishSystemEvent: (event) => publishedSystemEvents.push(event),
  server,
  serverOpened: false,
  serverShutdownRequested: true,
  wsSubscriptions,
};

const attachWebSocketHandlers = createWebSocketHandlerAttacher(handlerContext);
attachWebSocketHandlers();
attachWebSocketHandlers();
assert.strictEqual(server.listenerCount('connection'), 1);
assert.strictEqual(server.listenerCount('open'), 1);
assert.strictEqual(server.listenerCount('close'), 1);
assert.strictEqual(handlerContext.serverOpened, true);
assert.strictEqual(handlerContext.serverShutdownRequested, false);
assert.strictEqual(registeredHandlers.length, 4);

const client = new EventEmitter();
client.readyState = 1;
client.sent = [];
client.send = (message) => client.sent.push(JSON.parse(message));
server.emit('connection', client, {
  connection: {
    remoteAddress: '127.0.0.1',
    remotePort: 45678,
  },
});

assert.deepStrictEqual(registeredClients[0].options, {
  channels: ['*'],
  clientId: '127.0.0.145678',
  scope: 'main',
});
assert.deepStrictEqual(heartbeatClients, [client]);
assert.ok(publishedSystemEvents.length >= 2);
assert.strictEqual(client.listenerCount('message'), 2);

client.emit('message', Buffer.from('{"getSensorTypes":true}'));
assert.deepStrictEqual(commandCalls[0].message, { getSensorTypes: true });
assert.strictEqual(commandCalls[0].context.client, client);
assert.strictEqual(commandCalls[0].context.scope, 'main');

client.emit('message', Buffer.from('{"type":"subscribe","channels":["back"]}'));
assert.deepStrictEqual(wsSubscriptions.getSubscriptions(client), ['back']);
assert.deepStrictEqual(client.sent.filter((message) => message.type === 'subscribed'), [{
  type: 'subscribed',
  clientId: '127.0.0.145678',
  channels: ['back'],
}]);
assert.deepStrictEqual(commandCalls[1].message, { type: 'subscribe', channels: ['back'] });
assert.strictEqual(commandCalls[1].context.scope, 'back');

client.emit('message', Buffer.from('{"local":false}'));
assert.deepStrictEqual(commandCalls[2].message, { local: false });
assert.strictEqual(commandCalls[2].context.client, client);
assert.strictEqual(commandCalls[2].context.scope, 'back');

client.emit('close');
assert.deepStrictEqual(wsSubscriptions.getStatus(), { channels: {}, scopes: {} });

console.log('webSocketHandlerFactory.test.js passed');
