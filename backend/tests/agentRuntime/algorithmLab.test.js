const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const Database = require('better-sqlite3');
const { compile, predict } = require('../../agent-runtime/algorithm-lab/restrictedPython');
const { createAlgorithmRecordService } = require('../../kernel/storage/history/algorithmRecordService');
const { createHttpApp } = require('../../kernel/platform/http/httpAppFactory');
const { createAgentTools } = require('../../agent-runtime/tools');
const { createAgentRuntime } = require('../../agent-runtime/runtime');
const { compute } = require('../../agent-runtime/algorithm-lab/service');
const { prepareWindows, evaluate } = require('../../agent-runtime/algorithm-lab/evaluate');

const source = 'def predict(f):\n    change = f["maxRiseRate"]\n    if change > 100:\n        return 1\n    elif f["totalMean"] >= 0:\n        return 0\n    else:\n        return -1';

/** 构造真实只读 SQLite 查询与本机 HTTP 链路，数据为合成的两类压力采集。 */
async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-algorithm-lab-'));
  const db = new Database(':memory:');
  db.exec('CREATE TABLE matrix (id INTEGER PRIMARY KEY, data TEXT, timestamp INTEGER, date TEXT)');
  const insert = db.prepare('INSERT INTO matrix(data,timestamp,date) VALUES (?,?,?)');
  for (const date of ['a-stroke', 'b-tap', 'c-stroke-test', 'd-tap-test']) for (let index = 0; index < 64; index++) {
    insert.run(JSON.stringify([date.includes('tap') ? index % 4 * 100 : 5, 0, 0, 0]), 1000 + index * 20, date);
  }
  let systemId = 'hand-copy', allowed = true;
  const records = createAlgorithmRecordService({ getContext: () => ({ systemId, allowed }), getDatabases: () => ({ sit: db }) });
  const app = createHttpApp({ algorithmRecordService: records, agentDeviceConnectionService: { snapshot: () => ({ licensed: allowed, currentSystem: { id: systemId, name: '测试系统' } }) },
    controlCommandService: { executeHttp: async () => ({}) }, serialManager: { getStatus: () => [] }, getRealtimeChannels: () => [], listPorts: async () => [], getPort: (value) => value, logger: { error() {}, warn() {} } });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${server.address().port}`;
  const tools = createAgentTools({ root, httpBaseUrl: address });
  const catalog = await tools.listAlgorithmRecords();
  const chosen = catalog.records.sort((a, b) => a.date.localeCompare(b.date)).map((record) => ({ id: record.id, label: record.date.includes('tap') ? '拍打' : '抚摸', split: record.date.includes('test') ? 'validation' : 'development', startFrame: 0, frameLimit: 64 }));
  const selection = await tools.selectAlgorithmRecords({ systemId, records: chosen, windowFrames: 16 });
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, db, tools, records, selection, address, switchSystem: (id) => { systemId = id; }, deny: () => { allowed = false; } };
}

test('restricted Python calculates branches but cannot access host capabilities', () => {
  const program = compile(source);
  assert.equal(predict(program, { maxRiseRate: 200, totalMean: 4 }, 2), 1);
  assert.equal(predict(program, { maxRiseRate: 2, totalMean: 4 }, 2), 0);
  assert.equal(predict(program, { maxRiseRate: 2, totalMean: -1 }, 2), -1);
  for (const body of ['import os', 'return __import__("os")', 'return f.__class__', 'while True:', 'return open("file")', 'return eval("1")', 'return f["__proto__"]', 'return (lambda: 1)()']) {
    assert.throws(() => compile(`def predict(f):\n    ${body}`));
  }
  assert.throws(() => predict(compile('def predict(f):\n    return 1 / 0'), {}, 2), /非有限/);
  assert.throws(() => predict(compile('def predict(f):\n    return 2'), {}, 2), /类别下标/);
});

test('real SQLite selection, analysis, model tools, report proposal and installation form one workflow', async (t) => {
  const { root, db, tools, selection, address } = await fixture(t);
  const schemaBefore = db.prepare('SELECT sql FROM sqlite_master').all();
  const context = { algorithmSelection: selection, taskId: 'test-task' };
  const analysis = await tools.execute('analyze_algorithm_data', {}, context);
  assert.deepEqual(analysis.labels, ['抚摸', '拍打']);
  assert.equal(analysis.groups.length, 2);
  assert.equal(analysis.groups[0].features.maxRiseRate.max, 0);
  assert.deepEqual(db.prepare('SELECT sql FROM sqlite_master').all(), schemaBefore, 'analysis may not create indexes');
  const development = await tools.execute('test_algorithm', { name: '动作分类', source, validation: false }, context);
  assert.equal(development.accuracy, 1); assert.equal(development.windows, 8);
  const validation = await tools.execute('test_algorithm', { name: '动作分类', source, validation: true }, context);
  assert.equal(validation.accuracy, 1); assert.equal(validation.split, 'validation');
  let proposal;
  await tools.execute('prepare_algorithm_package', { draftId: validation.draftId }, { ...context, createProposal: (value) => { proposal = { ...value, id: 'proposal', status: 'pending' }; return proposal; } });
  assert.equal(proposal.after.report.accuracy, 1); assert.equal(proposal.after.source, source);
  const installed = await tools.apply(proposal);
  assert.equal(installed.offlineOnly, false);
  assert.equal(installed.realtimePackageId, `user-${validation.draftId}`);
  assert.equal(installed.realtimeEnabled, false);
  const workspace = await tools.execute('get_algorithm_workspace', {}, context);
  assert.equal(workspace.installed.length, 1); assert.equal(workspace.installed[0].source, source);
  assert.equal((await tools.execute('get_algorithm_workspace', {})).installed[0].realtimePackageId, installed.realtimePackageId, 'reading saved algorithms does not need a fresh dataset selection');
  const restarted = createAgentTools({ root, httpBaseUrl: address });
  // 重启后的持久验证台账仍然拒绝把同次采集重新当成独立验证。
  assert.ok(fs.existsSync(path.join(root, 'algorithm-lab', 'validation-ledger.json')));
  await assert.rejects(restarted.execute('test_algorithm', { name: '重启后重试', source, validation: true }, context), { code: 'ALGORITHM_VALIDATION_USED' });
  await assert.rejects(tools.execute('test_algorithm', { name: '重试', source, validation: true }, context), { code: 'ALGORITHM_VALIDATION_USED' });
});

test('offline analysis skips same-millisecond samples without renumbering source offsets or changing data', async () => {
  const base = Array.from({ length: 34 }, (_, index) => ({ values: [index, 2], timestamp: 1000 + index * 20, stage: 'stored-array' }));
  const frames = [...base.slice(0, 13), { ...base[12], values: [9000, 9000] }, ...base.slice(13)].map((frame, index) => ({ ...frame, id: 282 + index }));
  const record = { id: 'stroke', date: 'stroke-record', label: '抚摸', split: 'development', startFrame: 5, frames };
  const before = structuredClone(record), prepared = prepareWindows([record], 16);
  const expected = prepareWindows([{ ...record, frames: base }], 16);
  assert.deepEqual(prepared.windows.map((item) => item.features), expected.windows.map((item) => item.features));
  assert.deepEqual(prepared.windows.map((item) => item.startFrame), [5, 22]);
  const summary = { id: 'stroke', date: 'stroke-record', label: '抚摸', split: 'development', frameCount: 35, usableFrameCount: 34,
    skippedDuplicateTimestamps: 1, windows: 2, unusedTailFrames: 2 };
  assert.deepEqual(prepared.records, [summary]);
  assert.deepEqual((await compute({ records: [record], windowFrames: 16 })).records, [summary]);
  const report = evaluate(prepared, 'def predict(f):\n    return 0', ['抚摸'], 'development');
  assert.deepEqual(report.records, [summary]);
  assert.equal(report.inputContract.sampleIntervalMs, 20);
  assert.deepEqual(record, before);
});

test('real SQLite duplicate sampling counts survive analysis, test reports and installed packages', async (t) => {
  const { root, db, tools, selection } = await fixture(t);
  const selected = selection.records[0];
  const rows = db.prepare('SELECT id, timestamp FROM matrix WHERE date = ? ORDER BY id').all(selected.date);
  db.prepare('UPDATE matrix SET timestamp = ? WHERE id = ?').run(rows[12].timestamp, rows[13].id);
  const before = db.prepare('SELECT * FROM matrix ORDER BY id').all();
  const context = { algorithmSelection: selection, taskId: 'duplicate-record' };
  const analysis = await tools.execute('analyze_algorithm_data', {}, context);
  const summary = analysis.records.find((item) => item.id === selected.id);
  assert.equal(summary.frameCount, 64); assert.equal(summary.usableFrameCount, 63);
  assert.equal(summary.skippedDuplicateTimestamps, 1); assert.equal(summary.windows, 3); assert.equal(summary.unusedTailFrames, 15);
  const report = await tools.execute('test_algorithm', { name: '重复时间容错', source, validation: false }, context);
  const reportRecord = report.records.find((item) => item.id === selected.id);
  assert.equal(reportRecord.frameLimit, 64); assert.equal(reportRecord.startFrame, 0);
  assert.equal(reportRecord.skippedDuplicateTimestamps, 1); assert.equal(reportRecord.usableFrameCount, 63);
  assert.equal(reportRecord.unusedTailFrames, 15); assert.equal(report.windows, 7);
  let proposal;
  await tools.execute('prepare_algorithm_package', { draftId: report.draftId }, { ...context, createProposal: (value) => { proposal = { ...value, id: 'duplicate-proposal', status: 'pending' }; return proposal; } });
  await tools.apply(proposal);
  const saved = JSON.parse(fs.readFileSync(path.join(root, 'algorithm-lab', 'installed', `${report.draftId}.json`), 'utf8'));
  assert.deepEqual(saved.report.records, report.records);
  const workspace = await tools.execute('get_algorithm_workspace', {}, context);
  assert.match(workspace.recordSemantics, /maxId/); assert.match(workspace.recordSemantics, /数据库/);
  assert.match(workspace.recordSemantics, /不能.*缺口/);
  assert.deepEqual(db.prepare('SELECT * FROM matrix ORDER BY id').all(), before);
});

test('offline duplicate tolerance still reports the actual record and position for reverse time or long gaps', () => {
  const frames = Array.from({ length: 17 }, (_, index) => ({ id: 282 + index, values: [1, 2], timestamp: 1000 + index * 20, stage: 'data' }));
  frames[8] = { ...frames[8], timestamp: frames[7].timestamp };
  const record = { id: 'stroke', date: 'stroke-record', startFrame: 10, frames };
  for (const [timestamp, reason] of [[1100, /倒序/], [7000, /5 秒/]]) {
    const bad = { ...record, frames: frames.map((frame, index) => index === 9 ? { ...frame, timestamp } : frame) };
    assert.throws(() => prepareWindows([bad], 16), (error) => {
      assert.match(error.message, /stroke-record/); assert.match(error.message, /第 20 帧/);
      assert.match(error.message, /290.*291/); assert.match(error.message, reason); return true;
    });
  }
  assert.throws(() => prepareWindows([{ ...record, frames: frames.map((frame) => ({ ...frame, timestamp: 1000 })) }], 16), /不足一个完整窗口/);
  for (const patch of [{ values: [1] }, { stage: 'rawPressureData' }, { timestamp: NaN }]) {
    assert.throws(() => prepareWindows([{ ...record, frames: frames.map((frame, index) => index === 8 ? { ...frame, ...patch } : frame) }], 16));
  }
});

test('selection identity, allowed data range, changed records and remote web origins are enforced', async (t) => {
  const { tools, records, selection, db, address, switchSystem } = await fixture(t);
  const record = selection.records[0];
  assert.throws(() => records.read({ systemId: selection.systemId, recordId: '../private', maxId: record.maxId }), /记录目录/);
  await assert.rejects(tools.selectAlgorithmRecords({ ...selection, records: [record, record] }), /重复/);
  await assert.rejects(tools.selectAlgorithmRecords({ ...selection, records: selection.records.map((item) => ({ ...item, frameLimit: 900000 })) }), /帧范围/);
  for (const origin of ['https://example.com', 'null']) {
    const response = await fetch(`${address}/api/agent-algorithms/records`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 403);
  }
  db.prepare('INSERT INTO matrix(data,timestamp,date) VALUES (?,?,?)').run('[1,2,3,4]', 3000, record.date);
  await assert.rejects(tools.execute('analyze_algorithm_data', {}, { algorithmSelection: selection }), /记录已变化/);
  switchSystem('another');
  assert.throws(() => records.read({ systemId: selection.systemId, recordId: record.id, maxId: record.maxId }), /系统已切换/);
});

test('Agent runtime carries explicit dataset selection into tools and saves an algorithm only on apply', async (t) => {
  const { root, tools, selection } = await fixture(t);
  let turn = 0, draftId;
  const runtime = createAgentRuntime({ root, tools, modelRequest: async ({ input }) => {
    turn++;
    if (turn === 1) return { output: [{ type: 'function_call', call_id: 'test', name: 'test_algorithm', arguments: JSON.stringify({ name: '新分类', source, validation: false }) }] };
    if (turn === 2) {
      draftId = JSON.parse(input.at(-1).output).draftId;
      return { output: [{ type: 'function_call', call_id: 'prepare', name: 'prepare_algorithm_package', arguments: JSON.stringify({ draftId }) }] };
    }
    return { output: [{ type: 'message', content: [{ type: 'output_text', text: '已生成离线算法提案。' }] }] };
  } });
  runtime.configure({ model: 'fixture', apiKey: 'synthetic' });
  await runtime.setAlgorithmSelection(selection);
  runtime.startTask({ text: '编写分类算法' }); await runtime.whenIdle();
  const task = runtime.getState().conversation.tasks[0];
  assert.equal(task.status, 'awaiting_action');
  assert.equal(fs.existsSync(path.join(root, 'algorithm-lab', 'installed')), false);
  runtime.applyProposal({ taskId: task.id, proposalId: task.proposals[0].id }); await runtime.whenIdle();
  assert.equal(runtime.getState().conversation.tasks[0].proposals[0].status, 'applied');
  assert.ok(fs.existsSync(path.join(root, 'algorithm-lab', 'installed', `${draftId}.json`)));
  await runtime.dispose();
});

test('cancellation terminates the numeric worker without accepting a result', async () => {
  const controller = new AbortController();
  const pending = compute({ records: [], windowFrames: 16 }, controller.signal);
  controller.abort();
  await assert.rejects(pending, { code: 'AGENT_CANCELLED' });
});

test('inconsistent stages, point counts and timestamps cannot silently produce valid statistics', () => {
  const frames = Array.from({ length: 16 }, (_, index) => ({ values: [1, 2], timestamp: index * 20, stage: 'data' }));
  for (const patch of [{ timestamp: 0 }, { values: [1] }, { stage: 'rawPressureData' }]) {
    assert.throws(() => prepareWindows([{ frames: frames.map((frame, index) => index === 8 ? { ...frame, ...patch } : frame) }], 16));
  }
  assert.throws(() => compile('def predict(f):\n    return 0 < f["peak"] < 10'), /and/);
});
