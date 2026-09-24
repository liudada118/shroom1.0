const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createChannelBus } = require('@shroom/backend/telemetry/channelBus.js');
const { realtimePackage } = require('../../agent-runtime/algorithm-lab/realtimeCatalog');
const { createAlgorithmMarketService } = require('../../extension-host/runtime/algorithmMarketService');
const { createManifestAlgorithmBindings } = require('../../extension-host/workspace/manifestAlgorithmBindings');

/** 用可重复的 1024→529 映射和已保存分类器构造当前用户系统。 */
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-manifest-binding-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = 'def predict(f):\n    return 0';
  const item = realtimePackage({ id: 'gesture', systemId: 'seatpad2', name: '动作识别', language: 'restricted-python-v1',
    source, labels: ['抚摸', '拍打'], windowFrames: 16, report: { inputContract: { stage: 'data', pointCount: 529, sampleIntervalMs: 20 },
      sourceDigest: createHash('sha256').update(JSON.stringify(source)).digest('hex') } }, true);
  const manifest = { id: 'seatpad2', sensors: [{ id: 'sit', type: 'seatpad2-sit', matrix: { rows: 23, cols: 23 },
    protocol: { decoding: { valueCount: 1024 } }, files: { lineOrder: 'sit/line-order.json' } }] };
  const definitions = { sensors: { sit: { lineOrder: { order: Array.from({ length: 529 }, (_, index) => index + 1) } } } };
  let system = { id: 'seatpad2', editable: true };
  const options = { root, getSystem: () => system, getEditor: () => ({ manifest, definitions }), listPackages: () => [item] };
  return { root, item, manifest, definitions, options, reload: () => { system = { ...system }; } };
}

test('current Manifest keeps a 529-point user classifier binding across restart and rejects changed input mapping', (t) => {
  const f = fixture(t);
  const bindings = createManifestAlgorithmBindings(f.options);
  const before = JSON.stringify(f.manifest);
  const original = bindings.read('seatpad2');
  const configuration = { algorithms: [{ packageId: f.item.id, sensorId: 'sit', enabled: true }],
    charts: [{ id: 'gesture', name: '动作识别', packageId: f.item.id, metricId: 'classIndex', color: '#20B486', decimals: 0 }] };
  const saved = bindings.update('seatpad2', { expectedRevision: original.revision, configuration });
  assert.deepEqual(saved.configuration, configuration);
  assert.equal(JSON.stringify(f.manifest), before);
  assert.deepEqual(createManifestAlgorithmBindings(f.options).read('seatpad2').configuration, configuration);
  assert.throws(() => bindings.update('seatpad2', { expectedRevision: original.revision, configuration }), { code: 'DISPLAY_SYSTEM_REVISION_CONFLICT' });
  f.definitions.sensors.sit.lineOrder.order[0] = 100;
  f.reload();
  assert.throws(() => bindings.read('seatpad2'), { code: 'DISPLAY_SYSTEM_INPUT_CHANGED' });
  assert.equal(bindings.getRuntimeConfiguration('seatpad2'), null);
});

test('a bound Manifest classifier consumes canonical 529-point frames and publishes its real class metric', async (t) => {
  const f = fixture(t);
  const bindings = createManifestAlgorithmBindings(f.options);
  const initial = bindings.read('seatpad2');
  bindings.update('seatpad2', { expectedRevision: initial.revision, configuration: {
    algorithms: [{ packageId: f.item.id, sensorId: 'sit', enabled: true }], charts: [],
  } });
  const bus = createChannelBus();
  let time = 1000;
  const market = createAlgorithmMarketService({ channelBus: bus, listUserPackages: () => [f.item],
    getContext: () => ({ sensorType: 'seatpad2', allowed: true, playback: false, systemConfiguration: bindings.getRuntimeConfiguration('seatpad2') }),
    now: () => time, schedule: () => null, unschedule() {} });
  t.after(() => market.dispose());
  for (let index = 0; index < 18; index++) {
    time = 1000 + index * 20;
    bus.publish('seatpad2:sit', { type: 'sensor.frame', sensorType: 'seatpad2-sit', displaySystemId: 'seatpad2', sensorId: 'sit',
      channelId: 'seatpad2:sit', source: 'realtime', timestamp: time, sequence: index,
      payload: { matrix: { rows: 23, cols: 23, total: 529 }, value: Array(529).fill(index), stages: { processed: Array(529).fill(index) } } });
    await new Promise((resolve) => setImmediate(resolve));
  }
  for (let index = 0; index < 100 && !market.snapshot().instances[0]?.history.length; index++) await new Promise((resolve) => setTimeout(resolve, 10));
  const snapshot = market.snapshot();
  assert.equal(snapshot.configuration.algorithms[0].sensorId, 'sit');
  assert.equal(snapshot.instances[0].managed, true);
  assert.equal(snapshot.instances[0].history[0].metrics.classIndex, 0);
});
