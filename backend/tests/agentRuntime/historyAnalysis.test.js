const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const Database = require('better-sqlite3');
const { createHistoryAnalysis, selectHistoryRecords } = require('../../agent-runtime/history-analysis/service');
const { createAgentTools } = require('../../agent-runtime/tools');
const { createAgentRuntime } = require('../../agent-runtime/runtime');
const { createAlgorithmRecordService } = require('../../kernel/storage/history/algorithmRecordService');
const { createHttpApp } = require('../../kernel/platform/http/httpAppFactory');

/** 用有限内存分页模拟不同阶段，检查选区不会变成任意取数接口。 */
function memorySource() {
  const records = [{ id: 'a', date: '无标签记录', count: 4, maxId: 4 }, { id: 'b', date: '另一记录', count: 4, maxId: 8 }];
  const frames = records.map((record, number) => Array.from({ length: 4 }, (_, index) => ({
    id: number * 4 + index + 1, timestamp: 1000 + index * 20, values: [index + number, 0, 2, 4], stage: 'normalizedData', matrix: { rows: 2, cols: 2 }, trace: { status: 'known', configVersion: 'stored-v1' },
  })));
  const catalog = { systemId: 'system', offset: 0, records };
  const calls = [];
  /** 固定目录和帧路由，记录所有读取边界供断言。 */
  const request = async (route, { body } = {}) => {
    if (route.endsWith('/records')) return catalog;
    assert(route.endsWith('/frames'));
    calls.push(body);
    const index = records.findIndex((record) => record.id === body.recordId);
    let rows = frames[index];
    if (body.startTimestamp !== undefined) rows = rows.filter((frame) => frame.timestamp >= body.startTimestamp && frame.timestamp <= body.endTimestamp);
    const page = rows.slice(body.offset, body.offset + body.limit);
    return { frames: page, nextOffset: body.offset + page.length, complete: body.offset + page.length >= rows.length };
  };
  /** 只选一个无标签采集的明确帧区间。 */
  const choose = (ids = ['a'], region) => selectHistoryRecords({ systemId: 'system', records: ids.map((id) => ({ id, range: { kind: 'frames', startFrame: 1, frameLimit: 2 } })), ...(region ? { region } : {}) }, catalog);
  return { catalog, frames, calls, request, choose };
}

test('single unlabelled record uses only confirmed frame and matrix area with traceable scalar report', async () => {
  const f = memorySource();
  const report = await createHistoryAnalysis({ request: f.request }).analyze(f.choose(['a'], { row: 0, column: 0, rows: 1, cols: 1 }));
  assert.equal(report.results[0].statistics.average, 1.5);
  assert.equal(report.results[0].statistics.frames, 2);
  assert.equal(report.results[0].source.firstFrameId, 2);
  assert.equal(report.results[0].source.maxId, 4);
  assert.equal(report.results[0].source.contentSha256.length, 64);
  assert.equal(report.evaluation.kind, 'descriptive');
  assert(report.results[0].trend.every((point) => !Object.hasOwn(point, 'values')));
  assert(f.calls.every((call) => call.offset >= 1 && call.offset + call.limit <= 3));
});

test('reject ranges outside user records and reject comparison of different shape or stored stage', async () => {
  const f = memorySource();
  assert.throws(() => selectHistoryRecords({ systemId: 'system', records: [{ id: 'a', range: { kind: 'frames', startFrame: 3, frameLimit: 2 } }] }, f.catalog), /区间/);
  assert.throws(() => selectHistoryRecords({ systemId: 'system', records: [{ id: 'not-selected', range: { kind: 'frames', startFrame: 0, frameLimit: 2 } }] }, f.catalog), /记录/);
  for (const frame of f.frames[1]) frame.stage = 'rawPressureData';
  const analyze = createHistoryAnalysis({ request: f.request }).analyze;
  await assert.rejects(analyze(f.choose(['a', 'b']), { compare: true }), { code: 'HISTORY_ANALYSIS_INCOMPATIBLE' });
  for (const frame of f.frames[1]) { frame.stage = 'normalizedData'; frame.matrix = { rows: 1, cols: 4 }; }
  await assert.rejects(analyze(f.choose(['a', 'b']), { compare: true }), { code: 'HISTORY_ANALYSIS_INCOMPATIBLE' });
  await assert.rejects(analyze(f.choose(['a'], { row: 2, column: 0, rows: 1, cols: 1 })), /区域/);
});

test('time range is forwarded and reports a user imposed cap instead of claiming the complete interval', async () => {
  const f = memorySource();
  const selection = selectHistoryRecords({ systemId: 'system', records: [{ id: 'a', range: { kind: 'time', startTimestamp: 1020, endTimestamp: 1060, frameLimit: 1 } }] }, f.catalog);
  const report = await createHistoryAnalysis({ request: f.request }).analyze(selection);
  assert.equal(report.results[0].source.firstFrameId, 2);
  assert.equal(report.results[0].source.rangeLimited, true);
  assert(report.warnings.some((warning) => warning.includes('上限')));
  assert.equal(f.calls[0].startTimestamp, 1020);
  f.catalog.records[0].maxId = 9;
  await assert.rejects(createHistoryAnalysis({ request: f.request }).analyze(selection), { code: 'HISTORY_SELECTION_STALE' });
});

test('real SQLite HTTP tools and resumed conversation persist analysis without labels or database mutation', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-history-analysis-'));
  const db = new Database(':memory:');
  db.exec('CREATE TABLE matrix (id INTEGER PRIMARY KEY, data TEXT, timestamp INTEGER, date TEXT)');
  const insert = db.prepare('INSERT INTO matrix(data,timestamp,date) VALUES (?,?,?)');
  for (let index = 0; index < 6; index += 1) insert.run(JSON.stringify({ data: [index, 0, 2, 4], matrix: { rows: 2, cols: 2 } }), 1000 + index * 20, '无标签');
  const service = createAlgorithmRecordService({ getContext: () => ({ systemId: 'fixture', allowed: true, historyAllowed: true }), getDatabases: () => ({ sit: db }) });
  const app = createHttpApp({ algorithmRecordService: service,
    agentDeviceConnectionService: { snapshot: () => ({ currentSystem: { id: 'fixture', name: '合成系统', kind: 'manifest' } }) },
    controlCommandService: { executeHttp: async () => ({}) }, serialManager: { getStatus: () => [] }, getRealtimeChannels: () => [], listPorts: async () => [], getPort: (value) => value, logger: { error() {}, warn() {} } });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); db.close(); fs.rmSync(root, { recursive: true, force: true }); });
  const tools = createAgentTools({ root, httpBaseUrl: `http://127.0.0.1:${server.address().port}` });
  let turn = 0;
  const runtime = createAgentRuntime({ root, tools, modelRequest: async ({ onText }) => {
    turn += 1;
    if (turn === 1) return { output: [{ type: 'function_call', name: 'request_history_data', arguments: '{}', call_id: 'select' }] };
    if (turn === 2) return { output: [{ type: 'function_call', name: 'analyze_history_data', arguments: '{}', call_id: 'analyze' }] };
    onText('所选区间平均值 1.88，结果为描述统计。'); return { output: [] };
  } });
  runtime.configure({ model: 'fixture', apiKey: 'synthetic' });
  const before = db.prepare('SELECT sql FROM sqlite_master').all();
  runtime.startTask({ text: '分析这条采集，不需要分类训练。' }); await runtime.whenIdle();
  const task = runtime.getState().conversation.tasks[0];
  assert.equal(task.algorithmDataRequest.kind, 'history');
  const catalog = await runtime.listHistoryRecords();
  await runtime.completeHistoryDataRequest({ taskId: task.id, requestId: task.algorithmDataRequest.id, selection: {
    systemId: 'fixture', records: [{ id: catalog.records[0].id, range: { kind: 'frames', startFrame: 1, frameLimit: 2 } }],
  } });
  await runtime.whenIdle();
  const state = runtime.getState();
  assert.equal(state.conversation.tasks[0].status, 'succeeded');
  assert.equal(state.conversation.algorithmSelection, undefined);
  assert.equal(state.conversation.historySelection.records.length, 1);
  assert.equal(state.conversation.tasks[0].analysisRuns[0].results[0].statistics.average, 1.875);
  assert.deepEqual(db.prepare('SELECT sql FROM sqlite_master').all(), before);
  await runtime.dispose();
  const reloaded = createAgentRuntime({ root, tools });
  assert.equal(reloaded.getState().conversation.tasks[0].analysisRuns[0].version, 'history-statistics-v1');
  await reloaded.dispose();
});

test('SQLite time filters retain channel and maxId fences and stored metadata without current-config guesses', async () => {
  const db = new Database(':memory:');
  try {
    db.exec('CREATE TABLE matrix (id INTEGER PRIMARY KEY, data TEXT, timestamp INTEGER, date TEXT)');
    const insert = db.prepare('INSERT INTO matrix(data,timestamp,date) VALUES (?,?,?)');
    for (let index = 0; index < 5; index += 1) {
      for (const channel of ['left', 'right']) insert.run(JSON.stringify({ runtimeSource: 'display-system', channelId: `fixture:${channel}`,
        displaySystemId: 'fixture', sensorId: channel, data: [channel === 'left' ? index : 999, 0, 0, 0], matrix: { rows: 2, cols: 2 },
        collectionTrace: { revision: 'stored-revision', zeroValues: [10, 20, 30, 40] } }), 1000 + index * 20, 'same-session');
    }
    const service = createAlgorithmRecordService({ getContext: () => ({ systemId: 'fixture', allowed: false, historyAllowed: true }), getDatabases: () => ({ sit: db }) });
    const catalog = service.list();
    const left = catalog.records.find((record) => record.sensorId === 'left');
    const source = async (route, { body }) => route.endsWith('/records') ? service.list(body) : service.read(body);
    const selection = selectHistoryRecords({ systemId: 'fixture', records: [{ id: left.id, range: { kind: 'time', startTimestamp: 1020, endTimestamp: 1060, frameLimit: 10 } }] }, catalog);
    const report = await createHistoryAnalysis({ request: source }).analyze(selection);
    assert.equal(report.results[0].statistics.frames, 3);
    assert.equal(report.results[0].statistics.maximum, 3);
    assert.deepEqual(report.results[0].source.matrix, { rows: 2, cols: 2 });
    assert.equal(report.results[0].source.trace[0].configurationVersions.revision, 'stored-revision');
    assert(!JSON.stringify(report).includes('zeroValues'));
    insert.run(JSON.stringify({ runtimeSource: 'display-system', channelId: 'fixture:left', displaySystemId: 'fixture', sensorId: 'left', data: [9999, 0, 0, 0] }), 1040, 'same-session');
    const fixed = service.read({ systemId: 'fixture', recordId: left.id, maxId: left.maxId, startTimestamp: 1020, endTimestamp: 1060, offset: 0, limit: 32 });
    assert.equal(fixed.frames.length, 3);
    assert(fixed.frames.every((frame) => frame.id <= left.maxId));
  } finally { db.close(); }
});
