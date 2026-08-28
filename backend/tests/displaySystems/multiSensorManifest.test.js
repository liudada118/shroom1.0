const assert = require('assert');
const {
  attachRuntimeChannelPlan,
  buildDisplaySystemRuntimeDefinition,
  validateDisplaySystemConfig,
} = require('../../extension-host');
const {
  bindDisplaySystemRuntimeChannels,
  resolveOutputPublisher,
} = require('../../extension-host/runtime/displaySystemRuntimeBinder');

// ---------------------------------------------------------------------------
// sensors[] 归一化：v2 单 sensor 升格
// ---------------------------------------------------------------------------
const legacyShape = validateDisplaySystemConfig({
  id: 'legacy-demo',
  name: 'Legacy Demo',
  version: '1.0.0',
  schemaVersion: 2,
  sensor: { type: 'seat', matrix: { rows: 2, cols: 3 }, ports: ['sit', 'back'] },
  files: { lineOrder: 'line-order.json', pointOrder: 'point-order.json' },
  protocol: {
    baudRate: 921600,
    framing: { type: 'fixedLength', frameLength: 6 },
    decoding: { valueType: 'uint8', valueCount: 6 },
  },
}, { source: 'legacy' });

assert.strictEqual(legacyShape.ok, true, legacyShape.errors.join('; '));
assert.strictEqual(legacyShape.value.sensors.length, 2);
assert.strictEqual(legacyShape.value.sensors[0].id, 'sit');
assert.strictEqual(legacyShape.value.sensors[1].id, 'back');
// 升格后每一路都继承顶层矩阵/协议/文件，行为与旧的「共用一份」完全一致。
assert.deepStrictEqual(legacyShape.value.sensors[1].matrix, { rows: 2, cols: 3 });
assert.strictEqual(legacyShape.value.sensors[1].protocol.framing.frameLength, 6);
assert.strictEqual(legacyShape.value.sensors[1].files.lineOrder, 'line-order.json');
// sensor 仍是第一路的别名，既有调用方（registry.js / 文件校验）不受影响。
assert.deepStrictEqual(legacyShape.value.sensor.ports, ['sit', 'back']);

// ---------------------------------------------------------------------------
// sensors[] 各自独立的矩阵与协议
// ---------------------------------------------------------------------------
const multiSensorConfig = {
  id: 'multi-demo',
  name: 'Multi Demo',
  version: '1.0.0',
  schemaVersion: 2,
  sensors: [
    {
      id: 'seatPad',
      type: 'seat',
      outputChannel: 'sit',
      matrix: { rows: 2, cols: 3 },
      files: { lineOrder: 'seat-line-order.json', pointOrder: 'seat-point-order.json' },
      protocol: {
        baudRate: 921600,
        framing: { type: 'fixedLength', frameLength: 6 },
        decoding: { valueType: 'uint8', valueCount: 6 },
      },
    },
    {
      id: 'armLeft',
      type: 'arm',
      matrix: { rows: 1, cols: 4 },
      files: { lineOrder: 'arm-line-order.json', pointOrder: 'arm-point-order.json' },
      protocol: {
        baudRate: 115200,
        framing: { type: 'delimiter', delimiter: [170, 85] },
        decoding: { valueType: 'uint16le', byteOffset: 2, valueCount: 4 },
        validation: {
          header: [170, 85],
          checksum: { type: 'sum8', byteOffset: 10, range: { start: 2, end: 10 } },
        },
      },
    },
  ],
};

const multi = validateDisplaySystemConfig(multiSensorConfig, { source: 'multi' });
assert.strictEqual(multi.ok, true, multi.errors.join('; '));
assert.strictEqual(multi.value.sensors.length, 2);
// 两路互不干扰：不同矩阵、不同波特率、不同数据类型。
assert.deepStrictEqual(multi.value.sensors[0].matrix, { rows: 2, cols: 3 });
assert.deepStrictEqual(multi.value.sensors[1].matrix, { rows: 1, cols: 4 });
assert.strictEqual(multi.value.sensors[0].protocol.baudRate, 921600);
assert.strictEqual(multi.value.sensors[1].protocol.baudRate, 115200);
assert.strictEqual(multi.value.sensors[1].protocol.decoding.valueType, 'uint16le');
assert.strictEqual(multi.value.sensors[1].protocol.validation.checksum.type, 'sum8');
// outputChannel 缺省时等于 id。
assert.strictEqual(multi.value.sensors[0].outputChannel, 'sit');
assert.strictEqual(multi.value.sensors[1].outputChannel, 'armLeft');

// 重复 id 必须被拒绝：parser 通道键会撞车。
const duplicated = validateDisplaySystemConfig({
  ...multiSensorConfig,
  sensors: [multiSensorConfig.sensors[0], { ...multiSensorConfig.sensors[1], id: 'seatPad' }],
}, { source: 'dup' });
assert.strictEqual(duplicated.ok, false);
assert.ok(duplicated.errors.some((message) => message.includes('duplicate')), duplicated.errors.join('; '));

// ---------------------------------------------------------------------------
// 逐传感器构建 parser 通道
// ---------------------------------------------------------------------------
const runtimeDefinition = buildDisplaySystemRuntimeDefinition(multi.value);
assert.strictEqual(runtimeDefinition.parserChannels.length, 2);
assert.strictEqual(runtimeDefinition.parserChannels[0].id, 'multi-demo:seatPad');
assert.strictEqual(runtimeDefinition.parserChannels[1].id, 'multi-demo:armLeft');
// 关键回归：第二路拿到的是自己的协议和矩阵，不是第一路的副本。
assert.strictEqual(runtimeDefinition.parserChannels[1].protocol.baudRate, 115200);
assert.deepStrictEqual(runtimeDefinition.parserChannels[1].matrix, {
  rows: 1,
  cols: 4,
  width: 4,
  height: 1,
  total: 4,
});

const planned = attachRuntimeChannelPlan(runtimeDefinition);
assert.strictEqual(planned.runtimeChannelCount, 2);
assert.strictEqual(planned.runtimeChannels[1].serialRole, 'armLeft');
assert.strictEqual(planned.runtimeChannels[1].outputChannel, 'armLeft');
assert.strictEqual(planned.runtimeChannels[1].protocol.framing.type, 'delimiter');
assert.deepStrictEqual(planned.runtimeChannels[1].sensor.matrix, {
  rows: 1,
  cols: 4,
  width: 4,
  height: 1,
  total: 4,
});

// ---------------------------------------------------------------------------
// 输出路由：sit/back/head 保持原样，其余走 publishAux
// ---------------------------------------------------------------------------
const publishCalls = [];
const frameOutputPipeline = {
  publishSit: (frame) => { publishCalls.push(['sit', frame]); return 'sit'; },
  publishBack: (frame) => { publishCalls.push(['back', frame]); return 'back'; },
  publishHead: (frame) => { publishCalls.push(['head', frame]); return 'head'; },
  publishAux: (channel, frame) => { publishCalls.push([channel, frame]); return 'aux'; },
};

assert.strictEqual(resolveOutputPublisher(frameOutputPipeline, 'sit'), frameOutputPipeline.publishSit);
assert.strictEqual(resolveOutputPublisher(frameOutputPipeline, 'back'), frameOutputPipeline.publishBack);
assert.strictEqual(resolveOutputPublisher(frameOutputPipeline, 'head'), frameOutputPipeline.publishHead);
assert.strictEqual(typeof resolveOutputPublisher(frameOutputPipeline, 'armLeft'), 'function');
// 没有 publishAux 的老管线对未知通道仍返回 null，不会静默乱发。
assert.strictEqual(resolveOutputPublisher({ publishSit: () => {} }, 'armLeft'), null);

const registeredParsers = [];
const bindings = bindDisplaySystemRuntimeChannels({
  runtimeChannelRegistry: { list: () => planned.runtimeChannels },
  serialManager: { getStatus: () => null },
  serialParserManager: {
    registerChannel: (id) => { registeredParsers.push(id); return id; },
  },
  frameOutputPipeline,
  createFrameProcessor: ({ runtimeChannel }) => ({
    processFrame: () => ({ outputChannel: runtimeChannel.outputChannel, ok: true }),
  }),
});

// 两路都要 bound：这正是改动前第四路会静默失败的地方。
assert.strictEqual(bindings.length, 2);
assert.deepStrictEqual(bindings.map((binding) => binding.status), ['bound', 'bound']);
assert.deepStrictEqual(registeredParsers, ['multi-demo:seatPad', 'multi-demo:armLeft']);
assert.strictEqual(bindings[1].outputChannel, 'armLeft');

bindings[1].handleFrame(Buffer.from([1, 2, 3]));
assert.deepStrictEqual(publishCalls[0][0], 'armLeft');

console.log('multiSensorManifest.test.js passed');
