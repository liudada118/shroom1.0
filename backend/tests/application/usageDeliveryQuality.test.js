const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createUsageAnalytics, normalizeEvent } = require('../../../app/electron/usageAnalytics');
const { createCollectionSessionService } = require('../../kernel/storage/history/collectionSessionService');
const KEY = 'ab'.repeat(64), OTHER_KEY = 'cd'.repeat(64);
const cleanup = new Map();

/** Keep all queue and crash evidence in an isolated temporary directory. */
function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-usage-quality-'));
  cleanup.set(root, []);
  t.after(async () => {
    for (const dispose of cleanup.get(root).reverse()) await dispose();
    cleanup.delete(root);
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  }); return root;
}

/** Use the real sender with controlled capability and immutable acknowledgement responses. */
function fixture(t, options = {}) {
  const root = options.root || temporary(t), requests = [];
  let key = KEY, supported = options.supported !== false, refuse = options.refuse === true;
  const service = createUsageAnalytics({ root, appVersion: '1.1.43', environment: 'test', getLicenseKey: () => key,
    ...options,
    fetchImpl: async (url, request) => {
      if (request.method === 'GET') return new Response(JSON.stringify({ schemaVersions: supported ? [1, 2] : [1] }));
      const batch = JSON.parse(request.body); requests.push({ batch, authorization: request.headers.Authorization });
      options.onPost?.(batch);
      return refuse ? new Response('{}', { status: 503 })
        : new Response(JSON.stringify({ accepted: true, eventIds: batch.events.map(event => event.eventId) }));
    } });
  cleanup.get(root).push(() => service.dispose());
  return { root, service, requests, setKey: value => { key = value; }, support: () => { supported = true; },
    accept: () => { refuse = false; }, saved: () => JSON.parse(fs.readFileSync(path.join(root, 'usage-analytics', `${createHash('sha256').update(key).digest('hex')}.json`), 'utf8')) };
}

/** Build a valid final-evidence payload without a user record name or pressure array. */
function outcome(patch = {}) {
  return { schemaVersion: 2, eventName: 'collection_finished', properties: { featureId: 'collection',
    collectionId: randomUUID(), outcome: 'saved', result: 'success', stopReason: 'USER_STOPPED',
    outcomeRevision: 0, committedRows: 2, failedRows: 0, frameCount: 2, ...patch } };
}

test('v2 is additive, strict and cannot turn a control acknowledgement into a saved result', () => {
  const identity = { installationId: randomUUID(), sessionId: randomUUID(), appVersion: '1.1.43', environment: 'test', scope: 'x' };
  assert.equal(normalizeEvent(outcome(), identity).schemaVersion, 2);
  assert.throws(() => normalizeEvent({ ...outcome(), schemaVersion: 1 }, identity));
  for (const patch of [{ result: 'unknown' }, { outcomeRevision: 1 }, { committedRows: -1 }, { frameCount: '2' }, { rawData: [1] }]) {
    assert.throws(() => normalizeEvent(outcome(patch), identity));
  }
  assert.throws(() => normalizeEvent({ schemaVersion: 2, eventName: 'usage_delivery_summary', properties: {} }, identity));
  const summary = { schemaVersion: 2, eventName: 'usage_delivery_summary', properties: { qualityId: randomUUID(), queuedCount: 0, droppedCount: 0, invalidCount: 0 } };
  for (const patch of [{ qualityId: '11111111-1111-1111-1111-111111111111' }, { oldestQueuedAt: '2026-10-29T00:00:00' }, { oldestQueuedAt: '2026-02-30T00:00:00.000Z' }]) {
    assert.throws(() => normalizeEvent({ ...summary, properties: { ...summary.properties, ...patch } }, identity));
  }
  assert(normalizeEvent({ ...summary, properties: { ...summary.properties, oldestQueuedAt: new Date().toISOString() } }, identity));
});

test('an old receiver keeps v2 evidence pending while v1 still uploads; capability upgrade sends unchanged IDs', async t => {
  const f = fixture(t, { supported: false }); f.service.summarizeQuality();
  await f.service.whenPersisted(); const held = f.saved().events.find(event => event.schemaVersion === 2);
  await f.service.flush(true); assert.equal(f.requests[0].batch.schemaVersion, 1);
  await f.service.flush(true); assert.equal(f.service.status().lastErrorCode, 'USAGE_CONTRACT_UNAVAILABLE');
  assert.equal(f.requests.length, 1); assert.equal(f.service.status().queued, 1);
  f.support(); await f.service.retry();
  assert.deepEqual(f.requests[1].batch.events, [held]); assert.equal(f.service.status().queued, 0);
});

test('critical errors survive an ordinary event flood and quality loss is durable after restart', async t => {
  const f = fixture(t, { refuse: true });
  f.service.record({ eventName: 'error_reported', properties: { module: 'startup', severity: 'fatal', errorCode: 'STARTUP_FAILED' } });
  for (let index = 0; index < 2100; index++) f.service.record({ eventName: 'feature_exposed', properties: { featureId: 'view', count: index } });
  await f.service.whenPersisted();
  assert(f.service.status().queued <= 2000); assert(f.service.status().quality.capacityDroppedCount > 0);
  const saved = f.saved(); assert(saved.events.some(event => event.properties.errorCode === 'STARTUP_FAILED'));
  assert(Buffer.byteLength(JSON.stringify(saved)) <= 8 * 1024 * 1024);
  await f.service.dispose();
  const restarted = fixture(t, { root: f.root, refuse: true });
  assert(restarted.service.status().quality.capacityDroppedCount >= saved.quality.capacityDroppedCount);
  assert.equal(restarted.service.status().quality.qualityId, saved.quality.qualityId);
});

test('pending duplicate observations survive abrupt exit and retain the original runtime version', async t => {
  const root = temporary(t), modulePath = path.resolve(__dirname, '../../../app/electron/usageAnalytics.js');
  const script = `const {createUsageAnalytics}=require(${JSON.stringify(modulePath)});
    const service=createUsageAnalytics({root:${JSON.stringify(root)},appVersion:'1.1.43',environment:'test',getLicenseKey:()=>${JSON.stringify(KEY)},getRuntimeVersions:()=>({frontendBuildId:42}),fetchImpl:async()=>{throw Error('offline')}});
    for(let n=0;n<10;n++) service.record({eventName:'error_reported',properties:{module:'fixture',errorCode:'FIXTURE_ERROR'}});
    service.whenPersisted().then(()=>process.exit(17));`;
  const child = spawnSync(process.execPath, ['-e', script], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8' });
  assert.equal(child.status, 17, child.stderr);
  const f = fixture(t, { root, appVersion: '1.1.44', getRuntimeVersions: () => ({ frontendBuildId: 99 }), refuse: true });
  await f.service.dispose(); const errors = f.saved().events.filter(event => event.eventName === 'error_reported');
  assert.equal(errors.reduce((sum, event) => sum + (event.properties.count ?? 1), 0), 10);
  assert(errors.every(event => event.appVersion === '1.1.43' && event.runtimeVersions.frontendBuildId === 42));
  assert.equal(new Set(errors.map(event => event.eventId)).size, 2);
});

test('same-session runtime changes separate repeated error partitions', async t => {
  let build = 42; const f = fixture(t, { getRuntimeVersions: () => ({ frontendBuildId: build }), refuse: true });
  for (let index = 0; index < 3; index++) f.service.record({ eventName: 'error_reported', properties: { module: 'view', errorCode: 'FAILED' } });
  build = 43;
  for (let index = 0; index < 2; index++) f.service.record({ eventName: 'error_reported', properties: { module: 'view', errorCode: 'FAILED' } });
  await f.service.dispose();
  const totals = {};
  for (const event of f.saved().events.filter(event => event.eventName === 'error_reported')) totals[event.runtimeVersions.frontendBuildId] = (totals[event.runtimeVersions.frontendBuildId] || 0) + (event.properties.count ?? 1);
  assert.deepEqual(totals, { 42: 3, 43: 2 });
});

test('the host sends an outbox envelope unchanged and retains it until the local receipt commits', async t => {
  const f = fixture(t); const item = f.service.prepareEvidence(outcome(), f.service.captureContext());
  assert.equal(item.state, 'pending');
  let acknowledge = false, state = 'pending';
  f.service.registerOutbox({ list: () => state === 'pending' ? [item] : [], settle: (_id, next) => { if (!acknowledge) return false; state = next; return true; } });
  await f.service.flush(true); await f.service.flush(true);
  assert.equal(state, 'pending'); assert.equal(f.service.status().lastErrorCode, 'USAGE_STORAGE_UNAVAILABLE');
  acknowledge = true; await f.service.retry();
  assert.equal(state, 'acked');
  const sent = f.requests.flatMap(request => request.batch.events).filter(event => event.eventId === item.event.eventId);
  assert.equal(sent.length, 2); assert.deepEqual(sent[0], sent[1]);
});

test('same event ID with a changed body pauses rather than replacing evidence', async t => {
  const f = fixture(t); const item = f.service.prepareEvidence(outcome(), f.service.captureContext());
  f.service.registerOutbox({ list: () => [item, { ...item, event: { ...item.event, properties: { ...item.event.properties, committedRows: 3 } } }], settle: () => true });
  await f.service.flush(true); assert.equal(f.requests.length, 0);
  assert.equal(f.service.status().lastErrorCode, 'EVENT_CONTENT_CONFLICT');
});

test('new evidence cannot reuse consent after opt-out and pending outboxes cannot resurrect on re-enable', async t => {
  const f = fixture(t), context = f.service.captureContext(), item = f.service.prepareEvidence(outcome(), context);
  let state = 'pending';
  f.service.registerOutbox({ list: () => state === 'pending' ? [item] : [], settle: (_id, next) => { state = next; return true; } });
  await f.service.setEnabled(false); assert.equal(state, 'suppressed'); assert.equal(f.service.status().queued, 0);
  await f.service.setEnabled(true);
  assert.equal(f.service.prepareEvidence(outcome(), context).state, 'suppressed');
  await f.service.flush(true); assert(!f.requests.flatMap(request => request.batch.events).some(event => event.eventId === item.event.eventId));
});

test('changing the key isolates original pending evidence and preserves its event time and identity', async t => {
  const f = fixture(t), context = f.service.captureContext();
  const occurredAt = new Date(Date.now() - 30000).toISOString();
  const item = f.service.prepareEvidence({ ...outcome(), occurredAt }, context);
  let state = 'pending';
  f.service.registerOutbox({ list: () => state === 'pending' ? [item] : [], settle: (_id, next) => { state = next; return true; } });
  f.setKey(OTHER_KEY); f.service.record({ eventName: 'feature_attempted', properties: { featureId: 'view' } });
  await f.service.flush(true); assert.equal(state, 'pending');
  assert(!f.requests.flatMap(request => request.batch.events).some(event => event.eventId === item.event.eventId));
  f.setKey(KEY); await f.service.retry(); await f.service.flush(true);
  const delivered = f.requests.find(request => request.batch.events.some(event => event.eventId === item.event.eventId));
  assert.equal(delivered.authorization, `License ${KEY}`);
  assert.deepEqual(delivered.batch.events.find(event => event.eventId === item.event.eventId), item.event);
  assert.equal(item.event.occurredAt, occurredAt);
});

test('real collection journals share the sender and report final storage evidence, not stop snapshots', async t => {
  const f = fixture(t); const journal = createCollectionSessionService({ root: f.root });
  cleanup.get(f.root).push(() => journal.dispose());
  const session = journal.begin({ recordKey: 'private experiment', systemId: 'hand', inputCoverage: 'fenced' });
  const frame = journal.beginFrame({ originalDb: {} }), row = journal.queued({ frameToken: frame });
  journal.finish('SERIAL_DISCONNECTED'); assert.equal(journal.current().phase, 'finalizing');
  await f.service.flush(true); await f.service.flush(true);
  assert(!f.requests.flatMap(request => request.batch.events).some(event => event.eventName === 'collection_finished'));
  journal.settled(row, true); journal.endFrame(frame, { stored: true });
  await f.service.flush(true); await f.service.flush(true);
  const events = f.requests.flatMap(request => request.batch.events), final = events.find(event => event.eventName === 'collection_finished');
  assert.equal(final.properties.collectionId, session.id); assert.equal(final.properties.committedRows, 1);
  assert.equal(final.properties.outcome, 'saved'); assert.equal(final.properties.stopReason, 'SERIAL_DISCONNECTED');
  assert(!JSON.stringify(final).includes('private experiment'));
  const saved = JSON.parse(fs.readFileSync(path.join(f.root, 'collection-sessions', `${session.id}.json`)));
  assert.equal(saved.usageOutbox[0].state, 'acked'); assert.equal(saved.usageOutbox[0].event, undefined);
});

test('recursive observers cannot make a reporting storm and rejected inputs increment visible quality', async t => {
  let service;
  const f = fixture(t, { onStatus: () => { service?.record({ eventName: 'error_reported', properties: { module: 'observer' } }); } });
  service = f.service;
  service.record({ eventName: 'feature_exposed', properties: { featureId: 'view' } });
  assert.equal(service.record({ eventName: 'error_reported', properties: { sensorFrames: [123] } }), false);
  assert.equal(service.status().quality.invalidCount, 1); assert(service.status().queued <= 3);
  await service.whenPersisted(); assert(!JSON.stringify(f.saved()).includes('sensorFrames'));
});

test('outbox evidence bytes share the queue budget and eviction is persisted before the body is reclaimed', async t => {
  const f = fixture(t), context = f.service.captureContext();
  const items = Array.from({ length: 3 }, () => ({ ...f.service.prepareEvidence(outcome(), context), physicalBytes: 3 * 1024 * 1024 }));
  const decisions = [];
  f.service.registerOutbox({ list: () => items.filter(item => item.state === 'pending'),
    settle: (id, state, reason) => { const item = items.find(item => item.event.eventId === id); item.state = state; decisions.push({ state, reason }); return true; } });
  assert(items.filter(item => item.state === 'pending').length <= 2);
  assert(decisions.some(item => item.state === 'dropped' && item.reason === 'capacity'));
  assert(f.service.status().quality.capacityDroppedCount >= 1);
});

test('a write failure is visible, blocks unsafe upload and can recover without changing event IDs', async t => {
  const root = temporary(t), directory = path.join(root, 'usage-analytics'); fs.mkdirSync(directory);
  const queuePath = path.join(directory, `${createHash('sha256').update(KEY).digest('hex')}.json`);
  fs.mkdirSync(queuePath);
  const f = fixture(t, { root }); await f.service.whenPersisted();
  assert(f.service.status().quality.storageFailureCount > 0);
  await f.service.flush(true); assert.equal(f.requests.length, 0);
  assert.equal(f.service.status().lastErrorCode, 'USAGE_STORAGE_UNAVAILABLE');
  fs.rmdirSync(queuePath);
  await f.service.retry();
  assert.equal(f.requests.length, 1); assert.equal(f.service.status().queued, 0);
});

test('rapid A to B to A changes preserve all not-yet-written scope snapshots', async t => {
  const f = fixture(t, { refuse: true });
  f.service.record({ eventName: 'feature_attempted', properties: { featureId: 'first_A' } });
  f.setKey(OTHER_KEY); f.service.record({ eventName: 'feature_attempted', properties: { featureId: 'only_B' } });
  f.setKey(KEY); f.service.record({ eventName: 'feature_attempted', properties: { featureId: 'second_A' } });
  await f.service.whenPersisted();
  const names = f.saved().events.map(event => event.properties.featureId);
  assert(names.includes('first_A')); assert(names.includes('second_A')); assert(!names.includes('only_B'));
  const other = JSON.parse(fs.readFileSync(path.join(f.root, 'usage-analytics', `${createHash('sha256').update(OTHER_KEY).digest('hex')}.json`)));
  assert.deepEqual(other.events.map(event => event.properties.featureId), ['only_B']);
});

test('an undeletable old customer queue cannot resurrect after opt-out and re-enable', async t => {
  const f = fixture(t), oldFile = path.join(f.root, 'usage-analytics', `${createHash('sha256').update(KEY).digest('hex')}.json`);
  f.service.record({ eventName: 'feature_attempted', properties: { featureId: 'must_stay_deleted' } });
  await f.service.whenPersisted(); const oldIds = f.saved().events.map(event => event.eventId);
  f.setKey(OTHER_KEY); f.service.record({ eventName: 'feature_attempted', properties: { featureId: 'new_owner' } });
  await f.service.whenPersisted();
  const unlink = fs.promises.unlink;
  fs.promises.unlink = async file => { if (file === oldFile) throw Object.assign(new Error('locked'), { code: 'EACCES' }); return unlink.call(fs.promises, file); };
  try { await f.service.setEnabled(false); } finally { fs.promises.unlink = unlink; }
  assert(fs.existsSync(oldFile));
  await f.service.setEnabled(true); f.setKey(KEY);
  f.service.record({ eventName: 'feature_attempted', properties: { featureId: 'after_new_consent' } });
  await f.service.flush(true);
  assert(!f.requests.flatMap(request => request.batch.events).some(event => oldIds.includes(event.eventId)));
  assert(f.service.status().quality.suppressedCount >= oldIds.length);
});

test('a failed queue ACK write remains visible and retries the unchanged accepted IDs', async t => {
  let failWrites = false, firstPost = true;
  const f = fixture(t, { onPost: () => { if (firstPost) { failWrites = true; firstPost = false; } } });
  await f.service.whenPersisted();
  const rename = fs.promises.rename;
  fs.promises.rename = async (...args) => { if (failWrites) throw Object.assign(new Error('locked'), { code: 'EACCES' }); return rename.apply(fs.promises, args); };
  try {
    const result = await f.service.flush(true); await f.service.whenPersisted();
    assert.equal(result.lastErrorCode, 'USAGE_STORAGE_UNAVAILABLE'); assert.equal(result.lastSuccessAt, null);
    assert.equal(f.service.status().queued, 1);
  } finally { fs.promises.rename = rename; failWrites = false; }
  await f.service.retry();
  assert.deepEqual(f.requests[0].batch, f.requests[1].batch); assert.equal(f.service.status().queued, 0);
});

test('a repeated error near the byte limit reports lost observations instead of uploading oversized summaries', async t => {
  const f = fixture(t, { refuse: true }), identity = f.service.captureContext();
  const input = { eventName: 'error_reported', properties: { module: 'fixture', stack: '', message: '' } };
  const available = 4095 - Buffer.byteLength(JSON.stringify(normalizeEvent(input, identity)));
  input.properties.stack = '中'.repeat(Math.floor(available / 3));
  input.properties.message = 'z'.repeat(available % 3);
  assert.equal(Buffer.byteLength(JSON.stringify(normalizeEvent(input, identity))), 4095);
  for (let index = 0; index < 3; index++) assert(f.service.record(input));
  await f.service.dispose();
  const saved = f.saved();
  assert(saved.events.every(event => Buffer.byteLength(JSON.stringify(event)) <= 4096));
  assert.equal(saved.quality.invalidCount, 2);
});

test('notice acknowledgement and concurrent settings writes cannot undo a newer opt-out', async t => {
  const f = fixture(t), settingsFile = path.join(f.root, 'usage-analytics/settings.json');
  await f.service.whenPersisted();
  const rename = fs.promises.rename;
  let release, entered;
  const held = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  let intercepted = false;
  fs.promises.rename = async (source, target) => {
    if (target === settingsFile && !intercepted) { intercepted = true; entered(); await held; }
    return rename.call(fs.promises, source, target);
  };
  try {
    const notice = f.service.acknowledgeNotice(); await started;
    const disabling = f.service.setEnabled(false);
    assert.equal(f.service.status().enabled, false);
    release(); await Promise.all([notice, disabling]);
    assert.equal(f.service.status().enabled, false);
    assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile)).epoch, 1);
    await Promise.all([f.service.setEnabled(true), f.service.setEnabled(false), f.service.acknowledgeNotice()]);
    const saved = JSON.parse(fs.readFileSync(settingsFile));
    assert.equal(saved.enabled, false); assert.equal(saved.epoch, 2); assert.equal(saved.noticeVersion, 1);
    assert.equal(f.service.status().queued, 0);
  } finally { release(); fs.promises.rename = rename; }
});

test('a successful write for B cannot authorize sending the still-unwritten queue for A', async t => {
  const f = fixture(t), fileA = path.join(f.root, 'usage-analytics', `${createHash('sha256').update(KEY).digest('hex')}.json`);
  await f.service.whenPersisted();
  const rename = fs.promises.rename;
  fs.promises.rename = async (source, target) => {
    if (target === fileA) throw Object.assign(new Error('locked'), { code: 'EACCES' });
    return rename.call(fs.promises, source, target);
  };
  try {
    f.service.record({ eventName: 'feature_attempted', properties: { featureId: 'unwritten_A' } }); await f.service.whenPersisted();
    f.setKey(OTHER_KEY); f.service.record({ eventName: 'feature_attempted', properties: { featureId: 'written_B' } }); await f.service.whenPersisted();
    f.setKey(KEY); await f.service.flush(true); await f.service.whenPersisted();
    assert.equal(f.requests.length, 0); assert.equal(f.service.status().lastErrorCode, 'USAGE_STORAGE_UNAVAILABLE');
  } finally { fs.promises.rename = rename; }
  await f.service.retry();
  assert(f.requests[0].batch.events.some(event => event.properties.featureId === 'unwritten_A'));
  assert(!f.requests[0].batch.events.some(event => event.properties.featureId === 'written_B'));
});

test('another customer duplicate cache cannot consume the original outbox budget', async t => {
  const f = fixture(t), item = { ...f.service.prepareEvidence(outcome(), f.service.captureContext()), physicalBytes: 8 * 1024 * 1024 - 12000 };
  await f.service.whenPersisted();
  f.setKey(OTHER_KEY);
  for (let index = 0; index < 10; index++) f.service.record({ eventName: 'error_reported', properties: { module: `module${index}`, stack: 'z'.repeat(1800) } });
  f.service.registerOutbox({ list: () => item.state === 'pending' ? [item] : [], settle: (_id, state) => { item.state = state; return true; } });
  assert.equal(item.state, 'pending');
  assert.equal(f.service.status().quality.capacityDroppedCount, 0);
});
