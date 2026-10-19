const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createAlgorithmLab } = require('../../agent-runtime/algorithm-lab/service');
const { createRealtimeAlgorithmCatalog } = require('../../agent-runtime/algorithm-lab/realtimeCatalog');
const { CPU_RUNTIME, predictCpuModel } = require('../../agent-runtime/algorithm-lab/cpuModel');

/** 创建有相同总压力但相反空间分布的独立采集及固定训练器。 */
function fixture({ validation = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-auto-lab-'));
  const records = [], frames = new Map(), payloads = [], progress = [];
  let systemId = 'seat', frameReads = 0, trainingFailure = null;
  for (let index = 0; index < (validation ? 6 : 4); index++) {
    const right = index % 2;
    records.push({ id: `r${index}`, date: `session-${index}`, systemId, sensorId: 'sit', channel: 'sit', count: 32, maxId: 32,
      label: right ? '右倾' : '左倾', split: index < 4 ? 'development' : 'validation', startFrame: 0, frameLimit: 32 });
    frames.set(`r${index}`, Array.from({ length: 32 }, (_, position) => ({ id: position + 1, timestamp: position * 20,
      stage: 'stored-array', values: right ? [0, 10, 0, 10] : [10, 0, 10, 0] })));
  }
  /** 测试宿主协议与持久化；模型选择正确性由真实 Python 用例覆盖。 */
  const trainer = async (payload, { signal }) => {
    payloads.push(payload); if (trainingFailure) throw trainingFailure;
    signal?.throwIfAborted();
    const model = { schemaVersion: 1, runtime: CPU_RUNTIME, kind: 'tree', featureNames: payload.featureNames,
      classLabels: payload.labels, minConfidence: 0.55, trees: [{ nodes: [
        { feature: payload.featureNames.indexOf('copX'), threshold: 0.5, left: 1, right: 2 },
        { probabilities: [1, 0] }, { probabilities: [0, 1] },
      ] }] };
    const selected = payload.windows.filter((window) => window.split === (validation ? 'validation' : 'development'));
    const predictions = selected.map((window) => ({ recordId: window.recordId, startFrame: window.startFrame, timestamp: window.timestamp,
      expected: payload.labels[window.label], predicted: payload.labels[window.label], correct: true }));
    return { model, candidates: [{ kind: 'tree', macroF1: 1, accuracy: 1 }], report: { split: validation ? 'validation' : 'development',
      evaluation: validation ? 'independent-validation' : 'group-cross-validation', labels: payload.labels, windows: selected.length,
      correct: selected.length, unknown: 0, accuracy: 1, macroF1: 1, confusion: [[2, 0, 0], [0, 2, 0]], columns: [...payload.labels, '未知'],
      predictions, warnings: [], perClass: [] } };
  };
  const request = async (route, options) => {
    if (route.endsWith('/records')) return { systemId, records, offset: 0 };
    assert(route.endsWith('/frames')); frameReads++;
    const body = options.body;
    return { frames: frames.get(body.recordId).slice(body.offset, body.offset + body.limit) };
  };
  return { root, payloads, records, progress, matrix: { rows: 2, cols: 2, total: 4 }, lab: createAlgorithmLab({ root, request, trainCpu: trainer }),
    context: { taskId: 'training', algorithmSelection: { systemId, windowFrames: 16, catalogOffset: 0, records }, onStep: (event) => progress.push(event.message) },
    get frameReads() { return frameReads; }, switchSystem() { systemId = 'other'; }, failTraining(error) { trainingFailure = error; },
    cleanup() { fs.rmSync(root, { recursive: true, force: true }); } };
}

test('automatic training caches selected features and saves a JSON model only on apply', async () => {
  const f = fixture();
  try {
    const result = await f.lab.train({ name: '左右分类' }, f.context, { matrix: f.matrix });
    const reads = f.frameReads;
    assert(result.modelSummary.featureNames.includes('copX'));
    assert.equal(f.payloads[0].windows.length, 8);
    assert.equal(new Set(f.payloads[0].windows.map((window) => window.group)).size, 4);
    assert(!Object.hasOwn(result, 'model'));
    assert(!fs.existsSync(path.join(f.root, 'algorithm-lab', 'installed')));
    await f.lab.train({ name: '再比较' }, f.context, { matrix: f.matrix });
    assert.equal(f.frameReads, reads); assert(f.progress.some((message) => message.includes('复用本机缓存')));
    const proposal = f.lab.proposal({ draftId: result.draftId }, f.context);
    assert.deepEqual(proposal.after.report.inputContract.matrix, f.matrix);
    assert.equal(proposal.after.language, CPU_RUNTIME);
    const applied = f.lab.apply(proposal); assert.equal(applied.realtimeEnabled, false);
    const catalog = createRealtimeAlgorithmCatalog(f.root).list({ includeResolved: true });
    assert.equal(catalog[0].runtime, CPU_RUNTIME);
    assert.equal(predictCpuModel(catalog[0].resolvedPackage.classifier.model, { copX: 0, ...Object.fromEntries(result.modelSummary.featureNames.map((name) => [name, 0])) }), 0);
    const stored = JSON.parse(fs.readFileSync(path.join(f.root, 'algorithm-lab', 'drafts', `${result.draftId}.json`)));
    stored.model.trees[0].nodes[0].threshold = 0.9;
    fs.writeFileSync(path.join(f.root, 'algorithm-lab', 'drafts', `${result.draftId}.json`), JSON.stringify(stored));
    assert.throws(() => f.lab.apply(proposal), { code: 'ALGORITHM_DRAFT_STALE' });
  } finally { f.cleanup(); }
});

test('system or matrix change during training cannot leave a saved draft', async () => {
  const f = fixture();
  try {
    await assert.rejects(f.lab.train({ name: '空间分类' }, f.context, { matrix: f.matrix, validateInput: () => { throw Object.assign(new Error('changed'), { code: 'ALGORITHM_SYSTEM_CHANGED' }); } }), { code: 'ALGORITHM_SYSTEM_CHANGED' });
    assert(!fs.existsSync(path.join(f.root, 'algorithm-lab', 'drafts')));
    f.switchSystem();
    await assert.rejects(f.lab.train({ name: '旧系统' }, f.context, { matrix: f.matrix }), { code: 'ALGORITHM_SYSTEM_CHANGED' });
  } finally { f.cleanup(); }
});

test('independent validation remains consumed after failed training and is never silently reused', async () => {
  const f = fixture({ validation: true });
  try {
    f.failTraining(Object.assign(new Error('cancelled'), { code: 'AGENT_CANCELLED' }));
    await assert.rejects(f.lab.train({ name: '验证分类' }, f.context, { matrix: f.matrix }), { code: 'AGENT_CANCELLED' });
    await assert.rejects(f.lab.train({ name: '再次验证' }, f.context, { matrix: f.matrix }), { code: 'ALGORITHM_VALIDATION_USED' });
    assert.equal(f.payloads.length, 1);
    assert(!fs.existsSync(path.join(f.root, 'algorithm-lab', 'drafts')));
    assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(f.root, 'algorithm-lab', 'validation-ledger.json')))).length, 2);
  } finally { f.cleanup(); }
});
