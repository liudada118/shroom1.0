const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createChannelBus } = require('@shroom/backend/telemetry/channelBus.js');
const { createRealtimeClassifier } = require('../../agent-runtime/algorithm-lab/realtimeRunner');
const { realtimePackage, createRealtimeAlgorithmCatalog } = require('../../agent-runtime/algorithm-lab/realtimeCatalog');
const { prepareWindows, evaluate } = require('../../agent-runtime/algorithm-lab/evaluate');
const { createAlgorithmMarketService } = require('../../extension-host/runtime/algorithmMarketService');
const { createAppRuntime } = require('../../extension-host/appRuntimeFactory');

const source = 'def predict(f):\n    if f["maxRiseRate"] > 100:\n        return 1\n    return 0';

/** 构造真正经过离线评价的固定算法版本和输入窗口。 */
function example(pointCount = 4) {
  const frames = Array.from({ length: 32 }, (_, index) => ({ values: [index < 16 ? 2 : index % 4 * 100, ...Array(pointCount - 1).fill(0)], timestamp: 1000 + index * 20, stage: 'data' }));
  const records = [{ id: 'a', frames: frames.slice(0, 16), label: '抚摸', split: 'development', startFrame: 0 }, { id: 'b', frames: frames.slice(16), label: '拍打', split: 'development', startFrame: 0 }];
  const report = evaluate(prepareWindows(records, 16), source, ['抚摸', '拍打'], 'development');
  report.sourceDigest = require('node:crypto').createHash('sha256').update(JSON.stringify(source)).digest('hex');
  return { frames, report, draft: { id: 'test-classifier', systemId: 'copy-hand', name: '拍打抚摸识别', source, language: 'restricted-python-v1', labels: ['抚摸', '拍打'], windowFrames: 16, report } };
}

/** 以受控临时目录保存版本，不触碰实际应用算法库。 */
function directory(t, draft) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-realtime-classifier-'));
  const installed = path.join(root, 'algorithm-lab', 'installed'); fs.mkdirSync(installed, { recursive: true });
  const file = path.join(installed, `${draft.id}.json`); fs.writeFileSync(file, JSON.stringify(draft));
  t.after(() => { assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'shroom-realtime-classifier-')); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, file };
}

/** 等待真实异步分类输出；失败时携带最终状态而非无限轮询。 */
async function until(read, condition) {
  for (let index = 0; index < 300; index++) { const result = read(); if (condition(result)) return result; await new Promise((resolve) => setTimeout(resolve, 10)); }
  assert.fail(JSON.stringify(read()));
}

test('saved numeric algorithms expose a bounded catalog and invalid or legacy versions cannot masquerade as realtime packages', (t) => {
  const { draft } = example(); const { root, file } = directory(t, draft);
  const catalog = createRealtimeAlgorithmCatalog(root);
  const item = catalog.list()[0]; assert.equal(item.id, 'user-test-classifier');
  assert.deepEqual(item.metricDefinitions[0].values, { '-1': '未知', 0: '抚摸', 1: '拍打' });
  assert.equal(JSON.stringify(item).includes('def predict'), false);
  assert.equal(catalog.list({ includeResolved: true })[0].resolvedPackage.classifier.inputStage, 'processed');
  for (const bad of [{ ...draft, report: { ...draft.report, inputContract: undefined } }, { ...draft, source: 'import os' }, { ...draft, windowFrames: 999 }, { ...draft, report: { ...draft.report, inputContract: { pointCount: 65536, stage: 'data', sampleIntervalMs: 20 } }, windowFrames: 256 }]) {
    fs.writeFileSync(file, JSON.stringify(bad)); assert.equal(catalog.list().length, 0);
  }
});

test('actual worker gives the same labels as offline windows, without mutating frames', async (t) => {
  const { draft, frames, report } = example();
  const runner = createRealtimeClassifier(realtimePackage(draft, true).resolvedPackage); t.after(() => runner.dispose());
  const before = JSON.stringify(frames), results = [];
  for (const frame of frames) { const result = await runner(frame.values, { timestamp: frame.timestamp }); if (!result.pending) results.push(draft.labels[result.metrics.classIndex]); }
  assert.deepEqual(results, report.predictions.map((item) => item.predicted));
  assert.equal(JSON.stringify(frames), before);
});

test('same-millisecond frames do not enter classifier windows or cancel in-flight results', async (t) => {
  const { draft, frames, report } = example();
  const runner = createRealtimeClassifier(realtimePackage(draft, true).resolvedPackage); t.after(() => runner.dispose());
  const before = JSON.stringify(frames), results = [];
  for (const [index, frame] of frames.entries()) {
    const duplicate = { values: [9000, 9000, 9000, 9000], timestamp: frame.timestamp };
    const [result, skipped] = await Promise.all([runner(frame.values, frame), runner(duplicate.values, duplicate)]);
    assert.deepEqual(skipped, { pending: true, buffered: (index + 1) % 16 });
    if (!result.pending) results.push(draft.labels[result.metrics.classIndex]);
  }
  assert.deepEqual(results, report.predictions.map((item) => item.predicted));
  assert.equal(JSON.stringify(frames), before);
});

test('duplicate tolerance preserves long-gap and invalid-input failures', async (t) => {
  const { draft } = example(); const options = realtimePackage(draft, true).resolvedPackage;
  for (const input of [
    { timestamp: 6001, values: [1, 0, 0, 0] },
    { timestamp: 1000, values: [1, 0] },
    { timestamp: 1000, values: [NaN, 0, 0, 0] },
    { timestamp: NaN, values: [1, 0, 0, 0] },
  ]) {
    const runner = createRealtimeClassifier(options); t.after(() => runner.dispose());
    await runner([1, 0, 0, 0], { timestamp: 1000 });
    await assert.rejects(runner(input.values, input), /不连续/);
    await assert.rejects(runner([1, 0, 0, 0], { timestamp: 1020 }), /不连续/);
  }
});

test('runtime rejects broken timing, incompatible cadence and unbounded queues', async (t) => {
  const { draft } = example(); const options = realtimePackage(draft, true).resolvedPackage;
  const gap = createRealtimeClassifier(options); t.after(() => gap.dispose());
  await gap([1, 0, 0, 0], { timestamp: 1000 });
  await assert.rejects(gap([1, 0, 0, 0], { timestamp: 999 }), /不连续/);
  const cadence = createRealtimeClassifier(options); t.after(() => cadence.dispose());
  for (let index = 0; index < 15; index++) await cadence([1, 0, 0, 0], { timestamp: 1000 + index * 100 });
  await assert.rejects(cadence([1, 0, 0, 0], { timestamp: 2500 }), /采样频率/);
  const queued = createRealtimeClassifier(options); t.after(() => queued.dispose());
  const outcomes = [];
  for (let index = 0; index < 32; index++) outcomes.push(queued([1, 0, 0, 0], { timestamp: 1000 + index * 20 }).catch((error) => error));
  const result = await Promise.all(outcomes); assert.ok(result.some((entry) => entry instanceof Error && /跟不上/.test(entry.message)));
});

test('live market discovers saved packages, uses processed values and clears instances on mode or system changes', async (t) => {
  const { draft, frames } = example(); const { root, file } = directory(t, draft); const catalog = createRealtimeAlgorithmCatalog(root);
  const bus = createChannelBus(); let current = { sensorType: 'copy-hand', allowed: true, playback: false }, time = 1000;
  const service = createAlgorithmMarketService({ channelBus: bus, getContext: () => current, listUserPackages: () => catalog.list({ includeResolved: true }), now: () => time, schedule: () => null, unschedule() {} });
  t.after(() => service.dispose());
  /** 发布合成 canonical 帧，normalized 故意与已测 processed 不同。 */
  function publish(frame) {
    time = frame.timestamp;
    bus.publish('copy-hand:sit', { type: 'sensor.frame', sensorType: 'copy-hand', displaySystemId: 'copy-hand', sensorId: 'sit', channelId: 'copy-hand:sit', source: 'realtime', timestamp: frame.timestamp, sequence: frame.timestamp,
      payload: { matrix: { rows: 2, cols: 2, total: 4 }, value: frame.values, stages: { processed: frame.values, normalized: [9000, 9000, 9000, 9000] } } });
  }
  const request = { sensorType: 'copy-hand', packageId: 'user-test-classifier', channelId: 'copy-hand:sit', enabled: true };
  publish({ ...frames[0], timestamp: 980 }); await service.toggle(request);
  for (const frame of frames.slice(0, 16)) { publish(frame); await new Promise((resolve) => setImmediate(resolve)); }
  const state = await until(() => service.snapshot(), (state) => state.instances[0]?.status === 'running');
  assert.equal(state.instances[0].history[0].metrics.classIndex, 0);
  assert.equal(JSON.stringify(state).includes('def predict'), false);
  current = { ...current, playback: true }; assert.equal(service.snapshot().instances.length, 0);
  current = { ...current, playback: false }; publish({ ...frames[0], timestamp: 2000 }); await service.toggle(request);
  current = { ...current, sensorType: 'other' }; assert.equal(service.snapshot().instances.length, 0); assert.equal(service.snapshot().packages.length, 0);
  current = { ...current, sensorType: 'copy-hand' }; publish({ ...frames[0], timestamp: 2100 }); await service.toggle(request);
  fs.unlinkSync(file); assert.equal(service.snapshot().instances.length, 0); assert.equal(service.snapshot().packages.length, 0);
});

test('live market skips equal timestamps but keeps reverse-time and reception-gap protection', async (t) => {
  const { draft, frames, report } = example(); const { root } = directory(t, draft);
  const catalog = createRealtimeAlgorithmCatalog(root), bus = createChannelBus(); let time = 980, sequence = 0;
  const service = createAlgorithmMarketService({ channelBus: bus, getContext: () => ({ sensorType: 'copy-hand', allowed: true, playback: false }),
    listUserPackages: () => catalog.list({ includeResolved: true }), now: () => time, schedule: () => null, unschedule() {} });
  t.after(() => service.dispose());
  /** 模拟批量发布：序号递增，接收时钟与帧时间可独立推进。 */
  function publish(frame, receivedAt = frame.timestamp) {
    time = receivedAt;
    bus.publish('copy-hand:sit', { type: 'sensor.frame', sensorType: 'copy-hand', displaySystemId: 'copy-hand', sensorId: 'sit', channelId: 'copy-hand:sit', source: 'realtime',
      timestamp: frame.timestamp, sequence: ++sequence, payload: { matrix: { rows: 2, cols: 2, total: 4 }, value: frame.values, stages: { processed: frame.values } } });
  }
  const request = { sensorType: 'copy-hand', packageId: 'user-test-classifier', channelId: 'copy-hand:sit', enabled: true };
  publish({ ...frames[0], timestamp: 980 }); await service.toggle(request);
  const before = JSON.stringify(frames);
  for (let window = 0; window < 2; window++) {
    for (const frame of frames.slice(window * 16, (window + 1) * 16)) {
      publish(frame); publish({ ...frame, values: [9000, 9000, 9000, 9000] });
      assert.notEqual(service.snapshot().instances[0].status, 'error');
      await new Promise((resolve) => setImmediate(resolve));
    }
    await until(() => service.snapshot(), (state) => state.instances[0]?.history.length === window + 1);
  }
  const state = service.snapshot().instances[0];
  assert.equal(state.status, 'running'); assert.equal(state.error, ''); assert.equal(state.dropped, frames.length);
  assert.deepEqual(state.history.map((point) => draft.labels[point.metrics.classIndex]), report.predictions.map((item) => item.predicted));
  assert.equal(JSON.stringify(frames), before);
  publish({ ...frames.at(-1), timestamp: frames.at(-1).timestamp - 1 });
  assert.match(service.snapshot().instances[0].error, /倒序/);
  publish({ ...frames.at(-1), timestamp: 2000 });
  assert.equal(service.snapshot().instances[0].status, 'error');

  await service.toggle({ ...request, enabled: false }); await service.toggle(request);
  publish({ ...frames[0], timestamp: 2020 });
  publish({ ...frames[0], timestamp: 2020 }, 4021);
  publish({ ...frames[0], timestamp: 2040 }, 4022);
  assert.match(service.snapshot().instances[0].error, /数据中断/);
});

test('native configuration and restart retain user bindings only in their tested system', (t) => {
  const { draft } = example(1024); const { root } = directory(t, draft);
  const options = { runtimeResourceRoot: path.join(root, 'resources'), runtimeWritableRoot: path.join(root, 'workspace'), agentRoot: root };
  const runtime = createAppRuntime(options), id = 'copy-hand', packageId = 'user-test-classifier';
  runtime.displaySystems.save({ builtinTemplate: { id, name: '独立手部', sourceType: 'hand' } });
  const editor = runtime.builtinTemplates.editor(id);
  assert.ok(runtime.displaySystems.getBuilderCatalog().algorithmPackages.some((item) => item.id === packageId));
  const configuration = { ...editor.configuration, algorithms: [{ packageId, sensorId: 'sit', enabled: true }], charts: [{ id: 'gesture', name: '动作识别', packageId, metricId: 'classIndex', color: '#20B486', decimals: 0 }] };
  runtime.builtinTemplates.update(id, { name: editor.builtinTemplate.name, configuration, expectedRevision: editor.revision });
  assert.deepEqual(createAppRuntime(options).builtinTemplates.editor(id).configuration, configuration);
  assert.throws(() => runtime.displaySystems.save({ builtinTemplate: { id: 'other-hand', name: '另一副本', sourceType: 'hand', configuration } }), /只能绑定/);
});
