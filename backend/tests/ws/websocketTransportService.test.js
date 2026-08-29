const assert = require('assert');
const { EventEmitter } = require('events');
const {
  attachHeartbeat,
  parseJsonMessage,
} = require('../../kernel/platform/websocket/websocketTransportService');

const warnings = [];
const logger = {
  warn: (...args) => warnings.push(args),
};

assert.deepStrictEqual(parseJsonMessage('{"type":"ping"}', { logger }), { type: 'ping' });
assert.deepStrictEqual(
  parseJsonMessage(Buffer.from('{"channel":"sit"}'), { logger }),
  { channel: 'sit' },
);
assert.strictEqual(parseJsonMessage('[]', { logger, clientName: 'array-client' }), null);
assert.strictEqual(parseJsonMessage('invalid', { logger, clientName: 'invalid-client' }), null);
assert.strictEqual(warnings.length, 2);

class FakeSocket extends EventEmitter {
  constructor() {
    super();
    this.readyState = 1;
    this.pingCount = 0;
    this.terminated = false;
  }

  ping() {
    this.pingCount += 1;
  }

  terminate() {
    this.terminated = true;
  }
}

const socket = new FakeSocket();
const heartbeatTimer = attachHeartbeat(socket, {
  clientName: 'test-client',
  intervalMs: 10000,
  logger,
});
assert.strictEqual(socket.isAlive, true);
socket.isAlive = false;
socket.emit('pong');
assert.strictEqual(socket.isAlive, true);
socket.emit('close');
assert.strictEqual(socket.isAlive, false);
clearInterval(heartbeatTimer);

console.log('websocketTransportService.test.js passed');
