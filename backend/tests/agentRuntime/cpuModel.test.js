const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Worker } = require('node:worker_threads');
const path = require('node:path');
const { CPU_RUNTIME, validateCpuModel, predictCpuModel, modelDigest } = require('../../agent-runtime/algorithm-lab/cpuModel');
const { FEATURE_VERSION, windowFeaturesForVersion, validateMatrix } = require('../../agent-runtime/algorithm-lab/spatialFeatures');
const { windowFeatures, prepareWindows } = require('../../agent-runtime/algorithm-lab/evaluate');
const { realtimePackage } = require('../../agent-runtime/algorithm-lab/realtimeCatalog');
const { createRealtimeClassifier } = require('../../agent-runtime/algorithm-lab/realtimeRunner');

/** 构造不依赖 sklearn 安装的便携二分类模型。 */
function treeModel(feature = 'copX') {
  return { schemaVersion: 1, runtime: CPU_RUNTIME, kind: 'tree', featureNames: [feature], classLabels: ['左', '右'], minConfidence: .55,
    trees: [{ nodes: [{ feature: 0, threshold: .5, left: 1, right: 2 }, { probabilities: [1, 0] }, { probabilities: [0, 1] }] }] };
}

/** 构造稳定时间戳与映射后行优先压力帧。 */
function frames(values) { return Array.from({ length: 16 }, (_, index) => ({ timestamp: 1000 + index * 20, values: [...values], stage: 'data' })); }

/** 执行一次真实特征线程并在结束后释放句柄。 */
async function featureWorker(data) {
  const worker = new Worker(path.join(__dirname, '../../agent-runtime/algorithm-lab/worker.js'), { workerData: data });
  try { return await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); }); }
  finally { await worker.terminate(); }
}

test('portable linear models use frozen scaling and stable softmax with a host confidence floor', () => {
  const model = { schemaVersion: 1, runtime: CPU_RUNTIME, kind: 'linear', featureNames: ['totalMean'], classLabels: ['低', '高'], minConfidence: .55,
    weights: [[0], [2]], intercepts: [0, 0], scaler: { mean: [10], scale: [2] } };
  const checked = validateCpuModel(model);
  assert.equal(predictCpuModel(checked, { totalMean: 10 }), -1);
  assert.equal(predictCpuModel(checked, { totalMean: 14 }), 1);
  assert.equal(predictCpuModel(checked, { totalMean: 6 }), 0);
  model.weights[1][0] = -2;
  assert.equal(predictCpuModel(checked, { totalMean: 14 }), 1);
  assert.ok(Object.isFrozen(checked.weights[1]));
  assert.throws(() => predictCpuModel(checked, { totalMean: NaN }), { code: 'ALGORITHM_MODEL_INVALID' });
});

test('trees round inputs to float32 and forests average leaf probabilities before rejecting uncertain classifications', () => {
  const model = treeModel('totalMean'); model.trees[0].nodes[0].threshold = 1;
  assert.equal(predictCpuModel(model, { totalMean: 1 + 1e-8 }), 0);
  const forest = treeModel('totalMean'); forest.kind = 'forest';
  forest.trees = [{ nodes: [{ probabilities: [1, 0] }] }, { nodes: [{ probabilities: [0, 1] }] }];
  assert.equal(predictCpuModel(forest, { totalMean: 0 }), -1);
  forest.trees[1].nodes[0].probabilities = [.2, .8];
  assert.equal(predictCpuModel(forest, { totalMean: 0 }), 0);
});

test('portable models reject invalid values, graph cycles, shared children and resource limits', () => {
  const cases = [];
  let item = treeModel(); item.minConfidence = 0; cases.push(item);
  item = treeModel(); item.trees[0].nodes[0].threshold = NaN; cases.push(item);
  item = treeModel(); item.trees[0].nodes[0].left = 99; cases.push(item);
  item = treeModel(); item.trees[0].nodes[0].left = 0; cases.push(item);
  item = treeModel(); item.trees[0].nodes[0].right = 1; cases.push(item);
  item = treeModel(); item.trees[0].nodes.push({ probabilities: [1, 0] }); cases.push(item);
  item = treeModel(); item.trees[0].nodes[1].probabilities = [.2, .2]; cases.push(item);
  item = treeModel(); item.trees[0].nodes = Array.from({ length: 512 }, () => ({ probabilities: [1, 0] })); cases.push(item);
  item = treeModel(); item.kind = 'forest'; item.trees = Array.from({ length: 33 }, () => ({ nodes: [{ probabilities: [1, 0] }] })); cases.push(item);
  item = treeModel(); item.featureNames = Array.from({ length: 65 }, (_, index) => `f${index}`); cases.push(item);
  item = treeModel(); item.classLabels = Array.from({ length: 9 }, (_, index) => `类别${index}`); cases.push(item);
  item = treeModel(); item.padding = 'x'.repeat(2 * 1024 * 1024); cases.push(item);
  item = treeModel(); item.self = item; cases.push(item);
  for (const candidate of cases) assert.throws(() => validateCpuModel(candidate), { code: 'ALGORITHM_MODEL_INVALID' });
});

test('spatial features retain all old global values and only use an explicit matching display matrix', () => {
  const left = frames([10, 0, 10, 0]), matrix = { rows: 2, cols: 2, total: 4 };
  const global = windowFeatures(left), spatial = windowFeaturesForVersion(left, { featureVersion: FEATURE_VERSION, matrix });
  for (const [name, value] of Object.entries(global)) assert.equal(spatial[name], value);
  assert.equal(spatial.copX, 0); assert.equal(spatial.copY, .5);
  assert.equal(spatial.leftRatio, 1); assert.equal(spatial.rightRatio, 0);
  assert.equal(spatial.topRatio, .5); assert.equal(spatial.symmetry, 0);
  assert.equal(spatial.spreadX, 0); assert.equal(spatial.spreadY, .5);
  const balanced = windowFeaturesForVersion(frames([10, 10, 10, 10]), { featureVersion: FEATURE_VERSION, matrix });
  assert.equal(balanced.symmetry, 1); assert.equal(balanced.copX, .5);
  assert.deepEqual(windowFeaturesForVersion(left, { featureVersion: FEATURE_VERSION }), global);
  assert.throws(() => validateMatrix({ rows: 1, cols: 4, total: 5 }, 4), /矩阵/);
  assert.throws(() => windowFeaturesForVersion(left, { featureVersion: FEATURE_VERSION, matrix: { rows: 3, cols: 3, total: 9 } }), /矩阵/);
});

test('features worker and direct offline preparation share exact spatial values and summaries', async () => {
  const records = [{ id: 'left', label: '左', split: 'development', frames: frames([10, 0, 10, 0]) }];
  const options = { featureVersion: FEATURE_VERSION, matrix: { rows: 2, cols: 2, total: 4 } };
  const prepared = prepareWindows(records, 16, null, options);
  const result = await featureWorker({ operation: 'features', records, windowFrames: 16, ...options });
  assert.equal(result.ok, true);
  assert.deepEqual(result.result.windows, prepared.windows);
  assert.deepEqual(result.result.matrix, options.matrix);
  assert.equal(result.result.summaries.groups[0].features.copX.mean, 0);
  assert.equal(Object.hasOwn(prepareWindows(records, 16).windows[0].features, 'copX'), false);
});

test('CPU realtime catalog binds model digest, feature version, label order and matrix without compiling source', () => {
  const model = treeModel(), matrix = { rows: 2, cols: 2, total: 4 };
  const draft = { id: 'cpu-test', systemId: 'pad', name: '左右识别', language: CPU_RUNTIME, model, labels: model.classLabels, windowFrames: 16,
    featureVersion: FEATURE_VERSION, matrix, report: { modelDigest: modelDigest(model), split: 'development', inputContract: { pointCount: 4, stage: 'data', sampleIntervalMs: 20, featureVersion: FEATURE_VERSION, matrix } } };
  const saved = realtimePackage(draft, true);
  assert.equal(saved.runtime, CPU_RUNTIME); assert.deepEqual(saved.resolvedPackage.classifier.matrix, matrix);
  assert.deepEqual(saved.compatibility.recommendedMatrices, [{ rows: 2, cols: 2 }]);
  assert.equal(saved.resolvedPackage.classifier.runtime, CPU_RUNTIME);
  assert.equal(realtimePackage({ ...draft, model: { ...model, minConfidence: .55, featureNames: ['copY'] } }), null);
  assert.equal(realtimePackage({ ...draft, labels: ['右', '左'] }), null);
  assert.equal(realtimePackage({ ...draft, matrix: null }), null);
  assert.equal(realtimePackage({ ...draft, featureVersion: 'unknown' }), null);
  assert.equal(realtimePackage({ ...draft, matrix: { rows: 1, cols: 4, total: 4 } }), null);
  const noMatrixContract = JSON.parse(JSON.stringify(draft)); delete noMatrixContract.report.inputContract.matrix;
  assert.equal(realtimePackage(noMatrixContract), null);
});

test('CPU realtime prediction matches offline features and rejects missing or changed geometry even with equal point counts', async (t) => {
  const model = treeModel(), matrix = { rows: 2, cols: 2, total: 4 };
  const classifier = { runtime: CPU_RUNTIME, model, labels: model.classLabels, windowFrames: 16, pointCount: 4, sampleIntervalMs: 20, matrix, featureVersion: FEATURE_VERSION };
  const run = createRealtimeClassifier({ classifier }); t.after(() => run.dispose());
  const input = frames([0, 10, 0, 10]); let output;
  for (const frame of input) output = await run(frame.values, { timestamp: frame.timestamp, matrix });
  assert.equal(output.metrics.classIndex, predictCpuModel(model, windowFeaturesForVersion(input, { matrix, featureVersion: FEATURE_VERSION })));
  assert.equal(output.metrics.classIndex, 1);
  const changed = createRealtimeClassifier({ classifier }); t.after(() => changed.dispose());
  await assert.rejects(changed(input[0].values, { timestamp: 1000, matrix: { rows: 1, cols: 4, total: 4 } }), /矩阵/);
  const missing = createRealtimeClassifier({ classifier }); t.after(() => missing.dispose());
  await assert.rejects(missing(input[0].values, { timestamp: 1000 }), /矩阵/);
});
