const assert = require('assert');
const {
  bindDisplaySystemRuntimeChannels,
  createDisplaySystemFrameProcessor,
  createDisplaySystemRuntimeRegistry,
} = require('../../extension-host');
const {
  createZeroFrameAdapter,
} = require('../../kernel/platform/runtime/zeroFrameAdapter');

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
  /**
   * 假的 `readFileSync`：从上面的 `fixtureFiles` 表按路径取内容。
   *
   * 用法：作为 `fsLike` 注入给 `createDisplaySystemFrameProcessor`，
   * 线序表/点序表/算法文件就都是内存里的字符串。未登记的路径返回 `undefined`
   * 而不报错，让下游自己暴露缺兜底的地方。
   *
   * @param {string} filePath 文件路径（fixtureFiles 的键）。
   * @returns {string|undefined} 文件内容。
   */
  readFileSync(filePath) {
    return fixtureFiles[filePath];
  },
};

/**
 * 造一个够用的假「零点状态仓库」，只实现处理链路会调的三个方法。
 *
 * 用法：作为 `zeroStateStore` 注入。返回对象上的 `sources` / `identities` 两个 Map
 * 是刻意暴露的，断言可以直接检查「零点基线有没有被正确登记」。
 *
 * @returns {object} 假仓库，含 sources/identities 与 setBaseline/updateSources/apply。
 */
function createTestZeroStateStore() {
  const sources = new Map();
  const baselines = new Map();
  const identities = new Map();
  return {
    sources,
    identities,
    /**
     * 记下某通道某阶段的零点基线。键是 `channelId:stage`，因为零点按阶段分别记。
     *
     * `[...values]` 的拷贝是必须的 —— 入参是处理链路复用的缓冲区，存引用会让基线
     * 被下一帧改掉，现象是「零点标定过一会儿自己失效」。
     *
     * @param {string} channelId 通道 id。
     * @param {string} stage 阶段名。
     * @param {number[]} values 基线值。
     */
    setBaseline(channelId, stage, values) {
      baselines.set(`${channelId}:${stage}`, [...values]);
    },
    /**
     * 记下某通道各阶段的当前值和身份标识，供断言检查。数组逐个拷贝，理由同
     * `setBaseline`。
     *
     * @param {string} channelId 通道 id。
     * @param {Record<string, number[]>} stages 阶段名 → 值数组。
     * @param {object} identity 通道身份（型号、矩阵尺寸这类）。
     */
    updateSources(channelId, stages, identity) {
      sources.set(channelId, Object.fromEntries(
        Object.entries(stages).map(([stage, values]) => [stage, [...values]]),
      ));
      identities.set(channelId, { ...identity });
    },
    /**
     * 按基线扣减，即零点标定的核心行为。返回新数组，不原地改入参。
     *
     * 两条兜底照抄真实实现，也是本测试要覆盖的：没有基线 → 原样返回；
     * **长度不一致 → 也原样返回**（换了矩阵尺寸后拿旧基线扣会错位，比不扣更糟）。
     * `Math.max(0, ...)` 截负值 —— 没有负压力，放过去会让配色映射出界。
     *
     * @param {string} channelId 通道 id。
     * @param {string} stage 阶段名。
     * @param {number[]} values 待扣减的值。
     * @returns {number[]} 扣减后的新数组。
     */
    apply(channelId, stage, values) {
      const baseline = baselines.get(`${channelId}:${stage}`);
      if (!baseline || baseline.length !== values.length) return [...values];
      return values.map((value, index) => Math.max(0, value - baseline[index]));
    },
  };
}

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

const zeroStateStore = createTestZeroStateStore();
const zeroRuntimeBase = {
  serialRole: 'sit',
  outputChannel: 'sit',
  parserChannel: { role: 'sit', sensorType: 'pressure-matrix' },
  processing: {
    lineOrder: { source: null },
    pointOrder: { source: null },
    algorithm: { type: 'none', enabled: false },
  },
};
const firstDisplayProcessor = createDisplaySystemFrameProcessor({
  runtimeChannel: {
    ...zeroRuntimeBase,
    id: 'first-display:seat',
    displaySystemId: 'first-display',
    sensor: { id: 'seat', type: 'pressure-matrix' },
  },
  zeroStateStore,
});
const secondDisplayProcessor = createDisplaySystemFrameProcessor({
  runtimeChannel: {
    ...zeroRuntimeBase,
    id: 'second-display:seat',
    displaySystemId: 'second-display',
    sensor: { id: 'seat', type: 'pressure-matrix' },
  },
  zeroStateStore,
});
zeroStateStore.setBaseline('first-display:seat', 'processed', [10, 20]);
zeroStateStore.setBaseline('second-display:seat', 'processed', [80, 120]);

const firstZeroedFrame = firstDisplayProcessor.processFrame([15, 18]);
const secondZeroedFrame = secondDisplayProcessor.processFrame([90, 150]);
assert.deepStrictEqual(firstZeroedFrame.data, [5, 0]);
assert.deepStrictEqual(firstZeroedFrame.sitData, [5, 0]);
assert.deepStrictEqual(firstZeroedFrame.rawData, [15, 18]);
assert.deepStrictEqual(firstZeroedFrame.normalizedData, [15, 18]);
assert.deepStrictEqual(firstZeroedFrame.metrics, {
  totalPressure: 5,
  maxPressure: 5,
  averagePressure: 2.5,
  nonZeroCount: 1,
});
assert.deepStrictEqual(secondZeroedFrame.data, [10, 30]);
assert.deepStrictEqual(secondZeroedFrame.sitData, [10, 30]);
assert.deepStrictEqual(zeroStateStore.sources.get('first-display:seat').processed, [15, 18]);
assert.deepStrictEqual(zeroStateStore.sources.get('second-display:seat').processed, [90, 150]);
assert.strictEqual(zeroStateStore.identities.get('first-display:seat').sensorId, 'seat');

// builder 的 sensorDefinition.id 历史上等于 displaySystemId。零点 identity
// 必须从 canonical runtimeChannel.id 取后半段，不能被该旧字段带偏。
const builderIdentityProcessor = createDisplaySystemFrameProcessor({
  runtimeChannel: {
    ...zeroRuntimeBase,
    id: 'builder-display:sit',
    displaySystemId: 'builder-display',
    sensor: { id: 'builder-display', type: 'pressure-matrix' },
  },
  zeroStateStore,
});
builderIdentityProcessor.processFrame([3, 4]);
assert.strictEqual(zeroStateStore.identities.get('builder-display:sit').sensorId, 'sit');

const customChannelProcessor = createDisplaySystemFrameProcessor({
  runtimeChannel: {
    ...zeroRuntimeBase,
    id: 'custom-display:armrest-array',
    displaySystemId: 'custom-display',
    serialRole: 'armrest-parser',
    outputChannel: 'armrest',
    sensor: { id: 'armrest-array', type: 'custom-pressure' },
  },
  zeroStateStore,
});
zeroStateStore.setBaseline('custom-display:armrest-array', 'processed', [1]);
const mismatchedCustomFrame = customChannelProcessor.processFrame([7, 9]);
assert.deepStrictEqual(mismatchedCustomFrame.data, [7, 9]);
assert.deepStrictEqual(mismatchedCustomFrame.armrestData, [7, 9]);
assert.strictEqual(
  zeroStateStore.identities.get('custom-display:armrest-array').outputChannel,
  'armrest',
);
assert.strictEqual(
  zeroStateStore.identities.get('custom-display:armrest-array').sensorId,
  'armrest-array',
);

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

let droppedSourceUpdates = 0;
const droppedZeroStateStore = {
  /**
   * 只做计数的 `updateSources`，配合末尾 `assert(droppedSourceUpdates === 0)`
   * 守一条不变量：**校验失败被丢弃的清单帧，不能被兜底层重新当成旧协议帧处理**。
   *
   * 下面那帧帧头是 `0xab 0x55`（应为 `0xaa 0x55`）会被判 `dropped`，之后仍要过一遍
   * `createZeroFrameAdapter`；如果那层看不懂 `dropped`，串口噪声就会污染零点基线，
   * 画面慢慢偏且无法回溯。计数停在 0 才说明兜底层认这个标记。
   */
  updateSources() {
    droppedSourceUpdates += 1;
  },
  apply: (channelId, stage, values) => [...values],
};
const guardedProcessor = createDisplaySystemFrameProcessor({
  runtimeChannel: {
    ...zeroRuntimeBase,
    id: 'guarded-display:seat',
    displaySystemId: 'guarded-display',
    sensor: { id: 'seat', type: 'pressure-matrix' },
    protocol: {
      framing: { type: 'fixedLength', frameLength: 4 },
      decoding: { valueType: 'uint8', byteOffset: 2, valueCount: 2 },
      validation: { header: [0xaa, 0x55] },
    },
  },
  zeroStateStore: droppedZeroStateStore,
});
const droppedManifestFrame = guardedProcessor.processFrame([0xab, 0x55, 1, 2]);
assert.strictEqual(droppedManifestFrame.dropped, true);
assert.strictEqual(droppedManifestFrame.runtimeSource, 'display-system');

const droppedFrameAdapter = createZeroFrameAdapter({
  zeroStateStore: droppedZeroStateStore,
  resolveChannelIdentity: () => ({
    channelId: 'legacy-fallback:sit',
    displaySystemId: 'legacy-fallback',
    sensorId: 'sit',
    sensorType: 'legacy-fallback',
    outputChannel: 'sit',
  }),
});
droppedFrameAdapter.process('sit', droppedManifestFrame);
assert.strictEqual(
  droppedSourceUpdates,
  0,
  'a dropped manifest frame must not be reclassified as legacy or update zero sources',
);

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
    getStatus: (role) => ({
      portId: role,
      role,
      path: 'COM7',
      baudRate: 921600,
      parserChannel: 'sit',
      status: 'open',
      isOpen: true,
      openedAt: 1234,
    }),
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
assert.strictEqual(output.processedFrame.serialRole, 'sit');
assert.ok(Number.isFinite(output.processedFrame.timestamp));
assert.deepStrictEqual(output.processedFrame.serial, {
  role: 'sit',
  portId: 'sit',
  path: 'COM7',
  baudRate: 921600,
  parserChannel: 'sit',
  status: 'open',
  isOpen: true,
  openedAt: 1234,
});

let asyncSerialPath = 'COM7';
let finishAsyncFrame;
const asyncBindings = bindDisplaySystemRuntimeChannels({
  runtimeChannelRegistry: { list: () => [runtimeChannel] },
  serialManager: {
    getStatus: (role) => ({ role, portId: role, path: asyncSerialPath, isOpen: true }),
  },
  serialParserManager: { channels: { SIT: 'sit' } },
  frameOutputPipeline: { publishSit: (frame) => frame },
  createFrameProcessor: () => ({
    processFrame: (frame) => new Promise((resolve) => {
      finishAsyncFrame = () => resolve({ data: frame, outputChannel: 'sit' });
    }),
  }),
});
const asyncStartedAt = Date.now();
const pendingAsyncOutput = asyncBindings[0].handleFrame([9]);
asyncSerialPath = 'COM8';
finishAsyncFrame();
const asyncOutput = await pendingAsyncOutput;
assert.strictEqual(asyncOutput.processedFrame.serial.path, 'COM7');
assert.ok(asyncOutput.processedFrame.timestamp >= asyncStartedAt);
assert.ok(asyncOutput.processedFrame.timestamp <= Date.now());

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
