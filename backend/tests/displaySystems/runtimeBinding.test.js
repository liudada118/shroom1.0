const assert = require('assert');
const {
  bindDisplaySystemRuntimeChannels,
  createDisplaySystemFrameProcessor,
  createDisplaySystemRuntimeRegistry,
} = require('../../displaySystems');

(async () => {

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
  '/algorithm-metrics.json': JSON.stringify({
    metrics: [
      { id: 'supportRate', operation: 'activeRatio', threshold: 10, scale: 100 },
      { id: 'pressureSum', operation: 'sum', scale: 0.5 },
    ],
  }),
  '/algorithm.js': 'module.exports = (values, context) => values.map((value) => value * context.data.scale);',
  '/algorithm-object.js': 'module.exports = (values) => ({ data: values.map((value) => value * 3), metrics: { score: 88.5, state: "stable" } });',
  '/algorithm-raw.js': 'module.exports = (rawData, context) => ({ data: context.normalizedData, metrics: { firstRaw: rawData[0] } });',
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
assert.deepStrictEqual(processed.metrics, {
  totalPressure: 110,
  maxPressure: 70,
  averagePressure: 110 / 6,
  nonZeroCount: 2,
});

const protocolProcessor = createDisplaySystemFrameProcessor({
  runtimeChannel: {
    ...runtimeChannel,
    protocol: {
      baudRate: 115200,
      framing: { type: 'fixedLength', frameLength: 6 },
      decoding: { valueType: 'uint16le', byteOffset: 2, valueCount: 2 },
    },
    processing: {
      ...runtimeChannel.processing,
      lineOrder: { source: null },
      pointOrder: { source: null },
      algorithm: { type: 'none', enabled: false },
    },
  },
  fsLike,
});
const protocolFrame = protocolProcessor.processFrame([0xaa, 0x55, 0x01, 0x00, 0x02, 0x00]);
assert.deepStrictEqual(protocolFrame.rawData, [1, 2]);
assert.deepStrictEqual(protocolFrame.data, [1, 2]);

const jsAlgorithmProcessor = createDisplaySystemFrameProcessor({
  runtimeChannel: {
    ...runtimeChannel,
    processing: {
      lineOrder: { source: null },
      pointOrder: { source: null },
      algorithm: {
        type: 'js',
        entry: '/algorithm.js',
        dataFile: '/algorithm-data.json',
        timeoutMs: 100,
        enabled: true,
      },
    },
  },
  fsLike,
});
assert.deepStrictEqual(jsAlgorithmProcessor.processFrame([2, 3]).data, [4, 6]);

const metricAlgorithmProcessor = createDisplaySystemFrameProcessor({
  runtimeChannel: {
    ...runtimeChannel,
    processing: {
      lineOrder: { source: null },
      pointOrder: { source: null },
      algorithm: {
        type: 'json',
        dataFile: '/algorithm-metrics.json',
        enabled: true,
      },
    },
  },
  fsLike,
});
const metricFrame = metricAlgorithmProcessor.processFrame([0, 20, 30, 0]);
assert.deepStrictEqual(metricFrame.normalizedData, [0, 20, 30, 0]);
assert.deepStrictEqual(metricFrame.algorithmMetrics, { supportRate: 50, pressureSum: 25 });
assert.deepStrictEqual(metricFrame.metrics.algorithm, { supportRate: 50, pressureSum: 25 });

const objectAlgorithmProcessor = createDisplaySystemFrameProcessor({
  runtimeChannel: {
    ...runtimeChannel,
    processing: {
      lineOrder: { source: null },
      pointOrder: { source: null },
      algorithm: {
        type: 'js',
        entry: '/algorithm-object.js',
        enabled: true,
      },
    },
  },
  fsLike,
});
const objectAlgorithmFrame = objectAlgorithmProcessor.processFrame([2, 3]);
assert.deepStrictEqual(objectAlgorithmFrame.data, [6, 9]);
assert.deepStrictEqual(objectAlgorithmFrame.algorithmMetrics, { score: 88.5, state: 'stable' });

const rawInputAlgorithmProcessor = createDisplaySystemFrameProcessor({
  runtimeChannel: {
    ...runtimeChannel,
    processing: {
      ...runtimeChannel.processing,
      algorithm: {
        type: 'js',
        entry: '/algorithm-raw.js',
        enabled: true,
      },
    },
  },
  fsLike,
});
const rawInputFrame = rawInputAlgorithmProcessor.processFrame([10, 20, 30, 40]);
assert.deepStrictEqual(rawInputFrame.rawData, [10, 20, 30, 40]);
assert.deepStrictEqual(rawInputFrame.normalizedData, [40, 0, 0, 0, 20, 10]);
assert.deepStrictEqual(rawInputFrame.data, rawInputFrame.normalizedData);
assert.strictEqual(rawInputFrame.algorithmMetrics.firstRaw, 10);

const pythonAlgorithmProcessor = createDisplaySystemFrameProcessor({
  runtimeChannel: {
    ...runtimeChannel,
    processing: {
      lineOrder: { source: null },
      pointOrder: { source: null },
      algorithm: { type: 'python', entry: '/algorithm.py', enabled: true },
    },
  },
  fsLike,
  algorithmRunners: {
    python: async (rawData, context) => ({
      data: context.normalizedData.map((value) => value + 1),
      metrics: { firstRaw: rawData[0] },
    }),
  },
});
const pythonAlgorithmFrame = await pythonAlgorithmProcessor.processFrame([2, 3]);
assert.deepStrictEqual(pythonAlgorithmFrame.data, [3, 4]);
assert.deepStrictEqual(pythonAlgorithmFrame.algorithmMetrics, { firstRaw: 2 });

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

let registeredParser = null;
const configuredBindings = bindDisplaySystemRuntimeChannels({
  runtimeChannelRegistry: {
    list: () => [{
      ...runtimeChannel,
      parserChannel: {
        id: 'demo:sit',
        role: 'sit',
        protocol: {
          baudRate: 921600,
          framing: { type: 'fixedLength', frameLength: 6 },
          decoding: { valueType: 'uint8' },
        },
      },
    }],
  },
  serialManager: { getStatus: () => ({ status: 'registered' }) },
  serialParserManager: {
    registerChannel: (id, protocol) => {
      registeredParser = { id, protocol };
      return id;
    },
  },
  frameOutputPipeline: { publishSit: () => ({ sent: 1 }) },
  createFrameProcessor: () => ({ processFrame: (frame) => ({ data: frame }) }),
});
assert.strictEqual(configuredBindings[0].parserChannel, 'demo:sit');
assert.strictEqual(registeredParser.id, 'demo:sit');
assert.strictEqual(registeredParser.protocol.baudRate, 921600);

const isolatedBindings = bindDisplaySystemRuntimeChannels({
  runtimeChannelRegistry: {
    list: () => [
      runtimeChannel,
      { ...runtimeChannel, id: 'broken:sit', displaySystemId: 'broken' },
    ],
  },
  serialManager: { getStatus: () => ({ status: 'registered' }) },
  serialParserManager: { channels: { SIT: 'sit' } },
  frameOutputPipeline: { publishSit: () => ({ sent: 1 }) },
  createFrameProcessor: ({ runtimeChannel: currentChannel }) => {
    if (currentChannel.displaySystemId === 'broken') {
      throw new Error('invalid algorithm module');
    }
    return { processFrame: (frame) => ({ data: frame }) };
  },
});
assert.strictEqual(isolatedBindings[0].status, 'bound');
assert.strictEqual(isolatedBindings[1].status, 'error');
assert.strictEqual(isolatedBindings[1].error, 'invalid algorithm module');
assert.match(isolatedBindings[1].handleFrame().reason, /invalid algorithm module/);

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
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
