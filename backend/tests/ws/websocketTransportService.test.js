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

/** 假的 WebSocket 连接，只实现心跳要用的那几样：`ping` / `terminate` / 事件收发。 */
class FakeSocket extends EventEmitter {
  /**
   * 初始化连接态：`readyState = 1`（OPEN）加两个计数/标记位。
   *
   * `readyState` 必须是 OPEN，心跳层会跳过非 OPEN 的连接、一次都不 ping。
   */
  constructor() {
    super();
    this.readyState = 1;
    this.pingCount = 0;
    this.terminated = false;
  }

  /** 只累加 `pingCount`，用来断言心跳发了几次。 */
  ping() {
    this.pingCount += 1;
  }

  /** 只置 `terminated` 标记，不真断连 —— 断言「超时被踢」时读它。 */
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
