const assert = require('assert');
const {
  attachRuntimeChannelPlan,
  buildDisplaySystemRuntimeDefinition,
} = require('../../displaySystems');

const runtimeDefinition = buildDisplaySystemRuntimeDefinition({
  id: 'demo',
  name: 'Demo',
  version: '1.0.0',
  sensor: {
    type: 'seat',
    matrix: { rows: 2, cols: 3 },
    ports: ['sit', 'back'],
  },
  files: {
    lineOrder: 'line-order.json',
    pointOrder: 'point-order.json',
  },
  resolvedFiles: {
    lineOrder: 'C:/demo/line-order.json',
    pointOrder: 'C:/demo/point-order.json',
  },
  algorithm: {
    type: 'js',
    entry: 'algorithm.js',
    input: { frame: 'raw' },
    output: { frame: 'processed' },
  },
  protocol: {
    baudRate: 921600,
    framing: { type: 'fixedLength', frameLength: 6 },
    decoding: { valueType: 'uint8', byteOffset: 0, valueCount: 6 },
  },
  display: {
    views: [{ id: 'heatmap', type: 'heatmap', source: 'data' }],
    defaultView: 'heatmap',
  },
});

const planned = attachRuntimeChannelPlan(runtimeDefinition);

assert.strictEqual(planned.runtimeChannelCount, 2);
assert.strictEqual(planned.runtimeChannels[0].serialRole, 'sit');
assert.strictEqual(planned.runtimeChannels[0].parserChannel.role, 'sit');
assert.strictEqual(planned.runtimeChannels[0].parserChannel.protocol.baudRate, 921600);
assert.strictEqual(planned.runtimeChannels[0].protocol.framing.frameLength, 6);
assert.strictEqual(planned.runtimeChannels[0].processing.lineOrder.source, 'C:/demo/line-order.json');
assert.strictEqual(planned.runtimeChannels[0].processing.pointOrder.source, 'C:/demo/point-order.json');
assert.strictEqual(planned.runtimeChannels[0].processing.algorithm.enabled, true);
assert.strictEqual(planned.runtimeChannels[0].display.defaultView, 'heatmap');
assert.strictEqual(planned.runtimeChannels[1].serialRole, 'back');

console.log('runtimeChannelPlanner.test.js passed');
