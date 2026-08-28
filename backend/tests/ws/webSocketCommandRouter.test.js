const assert = require('assert');
const {
  createWebSocketCommandRouter,
} = require('../../kernel/platform/websocket/webSocketCommandRouter');

const warnings = [];
const router = createWebSocketCommandRouter({
  logger: {
    warn: (...args) => warnings.push(args),
  },
});

router.register({
  name: 'ignore',
  when: (message) => message.type === 'ignore',
  handle: () => ({ ignored: true }),
});
router.register({
  name: 'first',
  when: (message) => message.type === 'run',
  handle: () => ({ ok: true }),
});
router.register({
  name: 'stopper',
  when: (message) => message.type === 'run',
  handle: () => ({ stop: true, stopped: true }),
});
router.register({
  name: 'afterStop',
  when: (message) => message.type === 'run',
  handle: () => ({ shouldNotRun: true }),
});

const handled = router.handle({ type: 'run' }, { scope: 'test' });
assert.strictEqual(handled.handled, true);
assert.strictEqual(handled.stop, true);
assert.deepStrictEqual(handled.results.map((result) => result.name), ['first', 'stopper']);
assert.strictEqual(handled.results[0].ok, true);
assert.strictEqual(handled.results[1].stopped, true);

const missed = router.handle({ type: 'missing' }, { scope: 'test' });
assert.strictEqual(missed.handled, false);
assert.strictEqual(missed.stop, false);
assert.deepStrictEqual(missed.results, []);

const protocolRouter = createWebSocketCommandRouter();
let protocolContext;
protocolRouter.register({
  name: 'serial-open',
  when: (message) => message.sitPort != null,
  handle: (message, context) => {
    protocolContext = context;
    return { path: message.sitPort };
  },
});
const protocolResult = protocolRouter.handle({
  type: 'serial.open',
  payload: { role: 'sit', path: 'COM7' },
  requestId: 'req-router-1',
});
assert.strictEqual(protocolResult.handled, true);
assert.strictEqual(protocolResult.ok, true);
assert.strictEqual(protocolResult.results[0].path, 'COM7');
assert.strictEqual(protocolContext.legacyProtocol, false);
assert.strictEqual(protocolContext.commandEnvelope.requestId, 'req-router-1');
assert.throws(() => protocolRouter.handle({
  type: 'serial.open',
  payload: { role: 'sit' },
  requestId: 'req-router-2',
}), /missing required payload field/);

const errorRouter = createWebSocketCommandRouter({
  logger: {
    warn: (...args) => warnings.push(args),
  },
});
errorRouter.register({
  name: 'throws',
  handle: () => {
    throw new Error('boom');
  },
});

const failed = errorRouter.handle({ type: 'any' });
assert.strictEqual(failed.handled, true);
assert.strictEqual(failed.results[0].name, 'throws');
assert.strictEqual(failed.results[0].error, 'boom');
assert.strictEqual(warnings.length, 1);

console.log('webSocketCommandRouter.test.js passed');
