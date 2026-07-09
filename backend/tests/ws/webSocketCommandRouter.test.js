const assert = require('assert');
const {
  createWebSocketCommandRouter,
} = require('../../ws/webSocketCommandRouter');

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
