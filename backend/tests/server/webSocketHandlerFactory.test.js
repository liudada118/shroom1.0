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
const closedClients = [];
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
  onClientClose: (client) => closedClients.push(client),
  controlCommandService: {
    executeWs: (message, context) => {
      commandCalls.push({ message, context });
      return message.resetZero != null
        ? {
          handled: true,
          results: [{
            name: 'calibration-zero',
            affected: 1,
            affectedChannelIds: ['display-a:seat'],
            skipped: [],
          }],
        }
        : { handled: true, results: [] };
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
const historyHandler = registeredHandlers.find((handler) => handler.name === 'history-compatibility');
assert.strictEqual(historyHandler.when({ resetZero: true }), false);

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

client.emit('message', Buffer.from(JSON.stringify({
  type: 'legacy.calibration.zero',
  requestId: 'legacy-zero-ack',
  resetZero: true,
})));
const zeroAck = client.sent.find((message) => message.requestId === 'legacy-zero-ack');
assert.strictEqual(zeroAck.ok, true);
assert.deepStrictEqual(zeroAck.data.results, [{
  name: 'calibration-zero',
  affected: 1,
  affectedChannelIds: ['display-a:seat'],
  skipped: [],
}]);

client.emit('close');
assert.deepStrictEqual(wsSubscriptions.getStatus(), { channels: {}, scopes: {} });
assert.deepStrictEqual(closedClients, [client]);
console.log('webSocketHandlerFactory.test.js passed');

/** Async device authorization must preserve its actual denial code in command.ack. */
(async () => {
  let handlers = [], resolveActivation;
  const asyncServer = new EventEmitter(), events = [];
  const context = { ...handlerContext, server: asyncServer, serverOpened: false,
    activateSubmittedLicenseKey: () => new Promise(resolve => { resolveActivation = resolve; }),
    publishSystemEvent: value => events.push(value),
    controlCommandService: {
      registerHandler: handler => handlers.push(handler),
      executeWs: (message, execution) => ({ handled: true, results: handlers.filter(handler => handler.when(message)).map(handler => ({ name: handler.name, ...handler.handle(message, execution) })) }),
    } };
  createWebSocketHandlerAttacher(context)();
  const socket = new EventEmitter(); socket.readyState = 1; socket.sent = []; socket.send = body => socket.sent.push(JSON.parse(body));
  asyncServer.emit('connection', socket, { connection: { remoteAddress: '127.0.0.1', remotePort: 45679 } });
  socket.emit('message', Buffer.from(JSON.stringify({ type: 'legacy.license.activate', requestId: 'device-denied', date: { date: 'synthetic' } })));
  assert.equal(socket.sent.some(value => value.requestId === 'device-denied'), false);
  resolveActivation({ ok: false, code: 'DEVICE_LIMIT_REACHED', message: '电脑数量已达上限。' });
  await new Promise(resolve => setImmediate(resolve));
  const ack = socket.sent.find(value => value.requestId === 'device-denied');
  assert.equal(ack.ok, false); assert.equal(ack.code, 'DEVICE_LIMIT_REACHED'); assert.equal(ack.message, '电脑数量已达上限。');
  assert.equal(events.at(-1).licenseErrorCode, 'DEVICE_LIMIT_REACHED');
  console.log('webSocketHandlerFactory async device authorization passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
