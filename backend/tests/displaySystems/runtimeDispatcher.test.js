const assert = require('assert');
const {
  createDisplaySystemRuntimeDispatcher,
  normalizeIncomingFrame,
} = require('../../displaySystems');

const listeners = new Map();
let attachCount = 0;
const serialParserManager = {
  onData(channel, handler) {
    attachCount += 1;
    listeners.set(channel, handler);
  },
  offData(channel, handler) {
    if (listeners.get(channel) === handler) listeners.delete(channel);
  },
};

const handledFrames = [];
const dispatcher = createDisplaySystemRuntimeDispatcher({
  serialParserManager,
  bindings: [{
    id: 'demo:sit',
    parserChannel: 'sit',
    status: 'bound',
    runtimeMode: 'parallel',
    handleFrame: (frame) => handledFrames.push(frame),
  }, {
    id: 'blocked:back',
    parserChannel: 'back',
    status: 'bound',
    handleFrame: () => {
      throw new Error('blocked binding must not receive frames');
    },
  }],
});

assert.deepStrictEqual(normalizeIncomingFrame(Buffer.from([1, 2, 3])), [1, 2, 3]);

const started = dispatcher.start();
assert.strictEqual(started.started, true);
assert.strictEqual(started.activeHandlerCount, 1);
assert.strictEqual(started.skippedBindingCount, 1);
assert.strictEqual(attachCount, 1);

const startedAgain = dispatcher.start();
assert.strictEqual(startedAgain.activeHandlerCount, 1);
assert.strictEqual(attachCount, 1);

listeners.get('sit')(Buffer.from([4, 5, 6]));
assert.deepStrictEqual(handledFrames, [[4, 5, 6]]);

const stopped = dispatcher.stop();
assert.strictEqual(stopped.started, false);
assert.strictEqual(stopped.activeHandlerCount, 0);
assert.strictEqual(listeners.has('sit'), false);

console.log('runtimeDispatcher.test.js passed');
