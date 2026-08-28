const assert = require('assert');
const { EventEmitter } = require('events');

const {
  createSensorStatusPayload,
  createWebSocketHandlerAttacher,
} = require('../../kernel/platform/websocket/webSocketHandlerFactory');

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
const clientSubscriptions = new Map();
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
  wsSubscriptions: {
    getSubscriptions: (client) => clientSubscriptions.get(client) || [],
    registerClient: (client, options) => {
      clientSubscriptions.set(client, [...options.channels]);
      registeredClients.push({ client, options });
    },
  },
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
client.send = () => {};
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

client.emit('message', Buffer.from('{"getSensorTypes":true}'));
assert.deepStrictEqual(commandCalls[0].message, { getSensorTypes: true });
assert.strictEqual(commandCalls[0].context.client, client);
assert.strictEqual(commandCalls[0].context.scope, 'main');

clientSubscriptions.set(client, ['back']);
client.emit('message', Buffer.from('{"local":false}'));
assert.deepStrictEqual(commandCalls[1].message, { local: false });
assert.strictEqual(commandCalls[1].context.client, client);
assert.strictEqual(commandCalls[1].context.scope, 'back');

console.log('webSocketHandlerFactory.test.js passed');
