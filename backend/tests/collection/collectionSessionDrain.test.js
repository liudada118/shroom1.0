const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createCollectionSessionService } = require('../../kernel/storage/history/collectionSessionService');
const { createCollectionInsertQueueService } = require('@shroom/backend/collection/collectionInsertQueueService.js');
const { createServerFramePipeline } = require('../../kernel/realtime/framePipelineFactory');
const { bindDisplaySystemRuntimeChannels } = require('../../extension-host/runtime/displaySystemRuntimeBinder');

/** Journal evidence stays in an isolated temporary directory. */
function journal(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-collection-drain-'));
  const service = createCollectionSessionService({ root, ...options });
  t.after(() => { service.dispose(); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, service };
}

test('admitted asynchronous work drains after stop; repeated stop and settlement are idempotent', async (t) => {
  const { service } = journal(t);
  service.begin({ recordKey: 'old', systemId: 'fixture', inputCoverage: 'fenced' });
  const db = {}, token = service.beginFrame({ channelId: 'fixture:pad', originalDb: db, timestamp: 123 });
  let flushes = 0;
  service.finish('LICENSE_EXPIRED', () => flushes++);
  let finished = false;
  const completion = service.whenFinished().then((summary) => { finished = true; return summary; });
  await Promise.resolve(); assert.equal(finished, false);
  assert.equal(service.current().phase, 'finalizing');
  assert.equal(service.beginFrame(), null);
  assert.throws(() => service.begin({ recordKey: 'new' }), /收尾/);
  assert.equal(service.frameContext(token).originalDb, db);
  const context = service.queued({ frameToken: token, timestamp: 123 });
  assert.equal(service.queued({ frameToken: token }), null);
  service.finish('USER_STOPPED', () => flushes++);
  service.endFrame(token, { stored: true });
  assert.equal(service.current().phase, 'finalizing');
  service.settled(context, true); service.settled(context, false); service.endFrame(token, { error: new Error('late') });
  const result = service.current();
  assert.equal((await completion).id, result.id);
  assert.equal(flushes, 1); assert.equal(result.result, 'saved'); assert.equal(result.reason, 'LICENSE_EXPIRED');
  assert.equal(result.channels['fixture:pad'].committed, 1); assert.equal(result.channels['fixture:pad'].failed, 0);
  assert.equal(result.channels['fixture:pad'].inFlight, 0); assert.equal(result.completeness, 'not-hardware-verified');
  assert.equal(service.frameContext(token), null);
});

test('restart and untracked legacy input remain unknown; processing failures report partial', (t) => {
  const { root, service } = journal(t);
  const started = service.begin({ recordKey: 'unfinished', systemId: 'fixture', inputCoverage: 'fenced' });
  service.beginFrame({ channelId: 'pad' });
  service.dispose();
  const restored = createCollectionSessionService({ root });
  assert.equal(restored.list({})[0].id, started.id);
  assert.equal(restored.list({})[0].result, 'unknown');
  assert.equal(restored.list({})[0].reason, 'PROCESS_INTERRUPTED');
  restored.begin({ recordKey: 'legacy', systemId: 'native' }); restored.finish();
  assert.equal(restored.current().inputCoverage, 'untracked'); assert.equal(restored.current().result, 'unknown');
  restored.begin({ recordKey: 'failed', inputCoverage: 'fenced' });
  const token = restored.beginFrame({ channelId: 'pad' });
  restored.finish(); restored.endFrame(token, { error: new Error('algorithm failed') });
  assert.equal(restored.current().result, 'partial'); assert.equal(restored.current().channels.pad.processingFailed, 1);
  restored.dispose();
});

test('a processor that never resolves cannot deadlock later collections or write through an expired fence', async (t) => {
  const { service } = journal(t, { drainTimeoutMs: 5 });
  service.begin({ recordKey: 'timeout', inputCoverage: 'fenced' });
  const token = service.beginFrame({ channelId: 'pad' });
  service.finish(); await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(service.current().result, 'unknown'); assert.equal(service.current().evidenceError, 'COLLECTION_DRAIN_TIMEOUT');
  assert.equal(service.isFrameToken(token), false);
  service.begin({ recordKey: 'new', inputCoverage: 'fenced' });
  assert.equal(service.queued({ frameToken: token }), null);
});

test('transaction rollback and observer exceptions never invert committed SQL outcomes', (t) => {
  const db = new Database(':memory:'); t.after(() => db.close());
  db.exec('CREATE TABLE rows (value INTEGER UNIQUE)');
  const events = [];
  const writer = createCollectionInsertQueueService({ sql: 'INSERT INTO rows(value) VALUES (?)', batchSize: 2,
    onSettled: (context, ok) => { events.push([context.id, ok]); throw new Error('observer'); }, onError: () => { throw new Error('diagnostic observer'); } });
  writer.enqueue(db, [1], 'left', { id: 'first' }); writer.enqueue(db, [2], 'right', { id: 'second' });
  assert.equal(db.prepare('SELECT count(*) count FROM rows').get().count, 2);
  assert.deepEqual(writer.getStats(), { queued: 2, written: 2, failed: 0, pending: 0, exact: true });
  writer.enqueue(db, [3], 'left', { id: 'third' }); writer.enqueue(db, [1], 'right', { id: 'duplicate' });
  assert.equal(db.prepare('SELECT count(*) count FROM rows').get().count, 2);
  assert.deepEqual(events, [['first', true], ['second', true], ['third', false], ['duplicate', false]]);
  assert.deepEqual(writer.getStats(), { queued: 4, written: 2, failed: 2, pending: 0, exact: true });
});

test('legacy asynchronous callbacks count each row once even when a run throws or an observer fails', () => {
  const pending = [], events = [];
  const db = { run(_sql, params, callback) { if (params[0] === 2) throw new Error('run failed'); pending.push(callback); } };
  const writer = createCollectionInsertQueueService({ sql: 'synthetic', batchSize: 3,
    onSettled: (context, ok) => { events.push([context.id, ok]); throw new Error('observer'); } });
  writer.enqueue(db, [1], 'a', { id: 1 }); writer.enqueue(db, [2], 'b', { id: 2 }); writer.enqueue(db, [3], 'c', { id: 3 });
  assert.equal(writer.getStats().pending, 2);
  pending[0].call({ changes: 1 }, null); pending[0].call({}, new Error('duplicate callback')); pending[1].call({ changes: 1 }, null);
  assert.deepEqual(writer.getStats(), { queued: 3, written: 2, failed: 1, pending: 0, exact: false });
  assert.deepEqual(events, [[2, false], [1, true], [3, true]]);
});

test('audited synchronous legacy admission reports saved after its actual SQLite queue commits', async (t) => {
  const { service } = journal(t), db = new Database(':memory:'); t.after(() => db.close());
  db.exec('CREATE TABLE matrix(data TEXT, timestamp INTEGER, date TEXT)');
  service.begin({ recordKey: 'native-session', systemId: 'hand', inputCoverage: 'synchronous' });
  const writer = createCollectionInsertQueueService({ sql: 'INSERT INTO matrix VALUES (?,?,?)', batchSize: 20, onSettled: service.settled });
  const evidence = service.queued({ channelId: 'sit', timestamp: 1000 });
  writer.enqueue(db, ['[1,2]', 1000, 'native-session'], 'sit', evidence);
  const result = service.finish('USER_STOPPED', writer.flushAll);
  assert.equal(result.inputCoverage, 'synchronous'); assert.equal(result.result, 'saved');
  assert.equal(result.channels.sit.committed, 1); assert.equal((await service.whenFinished()).id, result.id);
  assert.deepEqual(db.prepare('SELECT * FROM matrix').get(), { data: '[1,2]', timestamp: 1000, date: 'native-session' });
});

test('Manifest async tail uses original database, record key and trace while a post-stop frame stays uncollected', async (t) => {
  const { service } = journal(t);
  const firstDb = new Database(':memory:'), nextDb = new Database(':memory:');
  t.after(() => { firstDb.close(); nextDb.close(); });
  for (const db of [firstDb, nextDb]) db.exec('CREATE TABLE matrix(data TEXT, timestamp INTEGER, date TEXT)');
  let db = firstDb, collecting = true, key = 'old-session', resolve, reject, captures = [];
  service.begin({ recordKey: key, systemId: 'fixture', configuration: { revisionHash: 'old' }, inputCoverage: 'fenced' });
  const writer = createCollectionInsertQueueService({ sql: 'INSERT INTO matrix VALUES (?,?,?)', batchSize: 200, onSettled: service.settled });
  const { frameOutputPipeline, collectionFrameStorage } = createServerFramePipeline({
    runtimeContext: { getSensorType: () => 'fixture', getDatabase: () => db }, collectionSessions: service, getCollectionTrace: service.trace,
    publishRealtimeChannel: (_channel, payload) => { assert(!payload.includes('collectionToken')); return 1; },
    isCollecting: () => collecting, shouldStoreCollectionFrame: () => true, hasEnoughCollectionDiskSpace: () => true,
    enqueueCollectionFrame: (targetDb, data, identity, token) => {
      const context = service.frameContext(token);
      writer.enqueue(targetDb, [data, identity.timestamp, context?.recordKey || key], identity.channelId,
        service.queued({ frameToken: token, channelId: identity.channelId, timestamp: identity.timestamp }));
    },
  });
  const channel = { id: 'fixture:pad', displaySystemId: 'fixture', sensor: { id: 'pad' }, serialRole: 'pad', outputChannel: 'sit', parserChannel: { role: 'sit' } };
  const [binding] = bindDisplaySystemRuntimeChannels({ runtimeChannelRegistry: { list: () => [channel] }, frameOutputPipeline,
    serialParserManager: { channels: { SIT: 'sit' } }, createFrameProcessor: () => ({ processFrame: (_frame, context) => {
      captures.push(context);
      return new Promise((success, failure) => { resolve = success; reject = failure; });
    } }) });
  const pending = binding.handleFrame([1, 2]);
  collecting = false; service.finish('LICENSE_EXPIRED', writer.flushAll);
  db = nextDb; key = 'new-session';
  assert(!Object.hasOwn(captures[0], 'collectionToken'));
  resolve({ runtimeSource: 'display-system', channelId: 'fixture:pad', displaySystemId: 'fixture', sensorId: 'pad', outputChannel: 'sit', data: [1, 2] });
  const result = await pending;
  assert.equal(result.output.stored, true); writer.flushAll();
  const saved = firstDb.prepare('SELECT * FROM matrix').get();
  assert.equal(saved.date, 'old-session'); assert.equal(JSON.parse(saved.data).collectionTrace.revisionHash, 'old');
  assert.equal(nextDb.prepare('SELECT count(*) count FROM matrix').get().count, 0);
  assert.equal(service.current().result, 'saved');
  const denied = collectionFrameStorage.beginCollectionFrame({ ...channel, channelId: channel.id, runtimeSource: 'display-system' });
  service.begin({ recordKey: key, systemId: 'fixture', inputCoverage: 'fenced' }); collecting = true;
  assert.equal(collectionFrameStorage.storeSit(result.processedFrame, { collectionToken: denied }), false);
  const failed = binding.handleFrame([3, 4]); collecting = false; service.finish(); reject(new Error('algorithm failed'));
  await assert.rejects(failed, /algorithm failed/);
  const failedSummary = service.current();
  assert.equal(failedSummary.channels['fixture:pad'].processingFailed, 1);
  if (failedSummary.result === 'unknown') assert.equal(failedSummary.evidenceError, 'COLLECTION_SUMMARY_WRITE_FAILED');
  else assert.equal(failedSummary.result, 'partial');
});
