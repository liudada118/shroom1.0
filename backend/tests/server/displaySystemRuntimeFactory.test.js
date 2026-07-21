const assert = require('assert');
const {
  createDisplaySystemRuntimeController,
} = require('../../server/displaySystemRuntimeFactory');

const stopped = [];
const started = [];
let dispatcherId = 0;

const controller = createDisplaySystemRuntimeController({
  runtimeChannelRegistry: { list: () => [] },
  bindRuntimeChannels: ({ runtimeChannelRegistry }) => {
    assert.ok(runtimeChannelRegistry);
    return [{
      id: `binding-${dispatcherId + 1}`,
      displaySystemId: 'demo',
      serialRole: 'sit',
      parserChannel: 'sit',
      outputChannel: 'sit',
      status: 'bound',
      error: null,
    }];
  },
  createRuntimeDispatcher: ({ bindings, getSensorType }) => {
    dispatcherId += 1;
    const id = dispatcherId;
    assert.strictEqual(bindings.length, 1);
    assert.strictEqual(getSensorType(), 'demoSensor');
    return {
      start: () => started.push(id),
      stop: () => stopped.push(id),
      getStatus: () => ({
        started: !stopped.includes(id),
        bindingCount: bindings.length,
        activeHandlerCount: started.includes(id) && !stopped.includes(id) ? 1 : 0,
        skippedBindingCount: 0,
        handlers: [],
        skippedBindings: [],
      }),
    };
  },
});

controller.bind({ getSensorType: () => 'demoSensor' });
controller.bind({ getSensorType: () => 'demoSensor' });

assert.deepStrictEqual(started, [1, 2]);
assert.deepStrictEqual(stopped, [1]);
assert.strictEqual(controller.getRuntimeBindings()[0].id, 'binding-2');
assert.strictEqual(controller.getStatus().runtimeBindings.count, 1);
assert.strictEqual(controller.getStatus().runtimeBindings.bindings[0].error, null);
assert.strictEqual(controller.getStatus().runtimeDispatcher.activeHandlerCount, 1);

controller.stop();
assert.deepStrictEqual(stopped, [1, 2]);

console.log('displaySystemRuntimeFactory.test.js passed');
