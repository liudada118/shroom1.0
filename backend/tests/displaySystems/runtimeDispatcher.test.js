const assert = require('assert');
const {
  createDisplaySystemRuntimeDispatcher,
  normalizeIncomingFrame,
} = require('../../extension-host');

const listeners = new Map();
let attachCount = 0;
const serialParserManager = {
  /**
   * 假的「订阅某个解析通道」，记下 handler 并累加 `attachCount`。
   *
   * 计数是重点：分发器最容易出的错不是没订阅上，而是**订阅了两次** ——
   * 不报任何错，只让每帧被处理两遍（压力翻倍、算法跑两次）。
   *
   * @param {string} channel 解析通道名（sit/back/head 这类）。
   * @param {Function} handler 帧回调。
   */
  onData(channel, handler) {
    attachCount += 1;
    listeners.set(channel, handler);
  },
  /**
   * 假的「退订」，**先比对 handler 是不是同一个引用再删**，与真实语义一致。
   *
   * 这个细节是可测点：分发器重绑时先 off 旧的再 on 新的，off 不比引用就会把刚挂上的
   * 新 handler 一起摘掉 —— 现象是重载显示系统后画面彻底不动，且不报错。
   *
   * @param {string} channel 解析通道名。
   * @param {Function} handler 要退订的那个具体回调。
   */
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
