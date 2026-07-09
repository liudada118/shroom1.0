const assert = require('assert');
const {
  bindDisplaySystemRuntimeChannels,
  createDisplaySystemFrameProcessor,
  createDisplaySystemRuntimeRegistry,
} = require('../../displaySystems');

const runtimeChannel = {
  id: 'demo:sit',
  displaySystemId: 'demo',
  serialRole: 'sit',
  parserChannel: { role: 'sit' },
  processing: {
    lineOrder: { source: '/line-order.json', type: 'file' },
    pointOrder: { source: '/point-order.json', type: 'file' },
    algorithm: {
      type: 'json',
      dataFile: '/algorithm-data.json',
      enabled: true,
    },
  },
  display: {
    defaultView: 'heatmap',
    matrix: { rows: 2, cols: 3 },
  },
};

const fixtureFiles = {
  '/line-order.json': JSON.stringify({ order: [4, 2, 1] }),
  '/point-order.json': JSON.stringify({
    matrix: { rows: 2, cols: 3 },
    points: [[0, 0], [1, 1], [1, 2]],
  }),
  '/algorithm-data.json': JSON.stringify({
    scale: 2,
    max: 70,
    zeroBelow: 30,
  }),
};

const fsLike = {
  readFileSync(filePath) {
    return fixtureFiles[filePath];
  },
};

const processor = createDisplaySystemFrameProcessor({
  runtimeChannel,
  fsLike,
});
const processed = processor.processFrame([10, 20, 30, 40]);

assert.deepStrictEqual(processed.data, [70, 0, 0, 0, 40, 0]);
assert.deepStrictEqual(processed.sitData, [70, 0, 0, 0, 40, 0]);
assert.strictEqual(processed.displaySystemId, 'demo');
assert.strictEqual(processed.outputChannel, 'sit');

const runtimeRegistry = createDisplaySystemRuntimeRegistry();
runtimeRegistry.register(runtimeChannel);
const bindings = bindDisplaySystemRuntimeChannels({
  runtimeChannelRegistry: runtimeRegistry,
  serialManager: {
    getStatus: (role) => ({ role, status: 'registered' }),
  },
  serialParserManager: {
    channels: { SIT: 'sit' },
  },
  frameOutputPipeline: {
    publishSit: (frame) => ({ stored: false, sent: 1, frame }),
  },
  createFrameProcessor: () => ({
    processFrame: (frame) => ({ data: frame, outputChannel: 'sit' }),
  }),
});

assert.strictEqual(runtimeRegistry.snapshot().count, 1);
assert.strictEqual(bindings.length, 1);
assert.strictEqual(bindings[0].status, 'bound');
assert.strictEqual(bindings[0].parserChannel, 'sit');

const output = bindings[0].handleFrame([1, 2, 3]);
assert.strictEqual(output.published, true);
assert.strictEqual(output.output.sent, 1);
assert.deepStrictEqual(output.processedFrame.data, [1, 2, 3]);

runtimeRegistry.register({
  ...runtimeChannel,
  id: 'demo:shadow',
  runtimeMode: 'shadow',
});
const shadowBindings = bindDisplaySystemRuntimeChannels({
  runtimeChannelRegistry: runtimeRegistry,
  serialManager: {
    getStatus: (role) => ({ role, status: 'registered' }),
  },
  serialParserManager: {
    channels: { SIT: 'sit' },
  },
  frameOutputPipeline: {
    publishSit: () => {
      throw new Error('shadow mode must not publish');
    },
  },
  createFrameProcessor: () => ({
    processFrame: (frame) => ({ data: frame, outputChannel: 'sit' }),
  }),
});
const shadowOutput = shadowBindings.find((binding) => binding.id === 'demo:shadow').handleFrame([4, 5]);
assert.strictEqual(shadowOutput.published, false);
assert.strictEqual(shadowOutput.reason, 'runtime mode shadow does not publish output');
assert.deepStrictEqual(shadowOutput.processedFrame.data, [4, 5]);

console.log('runtimeBinding.test.js passed');
