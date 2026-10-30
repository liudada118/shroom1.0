const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createCollectionSessionService } = require('../../kernel/storage/history/collectionSessionService');
const bridge = require('../../common/usageEvidence');
const { createUsageAnalytics } = require('../../../app/electron/usageAnalytics');

/** Provide a trusted isolated sender with stable identity and no disk queue or network. */
function sender() {
  const context = { installationId: randomUUID(), sessionId: randomUUID(), appVersion: 'fixture-v1', environment: 'test',
    runtimeVersions: { frontendBuildId: 'fixture-build' }, scope: 'fixture-owner-a', epoch: 0 };
  const starts = [], providers = new Set();
  const adapter = {
    captureContext: () => JSON.parse(JSON.stringify(context)),
    prepareEvidence: (input, original) => ({ state: 'pending', scope: original.scope,
      event: { ...input, eventId: randomUUID(), installationId: original.installationId, sessionId: original.sessionId,
        appVersion: original.appVersion, environment: original.environment, runtimeVersions: original.runtimeVersions } }),
    recordEvidence: (input, original) => { starts.push(adapter.prepareEvidence(input, original).event); return true; },
    registerOutbox: provider => { providers.add(provider); return () => providers.delete(provider); },
  };
  const evidence = { captureUsageEvidenceContext: adapter.captureContext,
    prepareUsageEvidence: (input, original) => original ? adapter.prepareEvidence(input, original) : { state: 'suppressed', reason: 'NO_CONTEXT' },
    recordUsageEvidence: (input, original) => original && adapter.recordEvidence(input, original),
    registerUsageOutbox: provider => { provider.onAdapterReady?.(); return adapter.registerOutbox(provider); } };
  return { context, adapter, evidence, starts, providers, provider: () => [...providers].at(-1) };
}

/** Keep every session, crash child and recovery record within one disposable test directory. */
function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-usage-outbox-')), host = sender(), services = [];
  const create = overrides => { const service = createCollectionSessionService({ root, evidence: host.evidence, ...options, ...overrides }); services.push(service); return service; };
  t.after(() => { for (const service of services) service.dispose(); fs.rmSync(root, { recursive: true, force: true }); });
  return { root, host, create, read: id => JSON.parse(fs.readFileSync(path.join(root, 'collection-sessions', `${id}.json`), 'utf8')) };
}

test('all stop reasons publish one terminal only after admitted SQL settles and keep identities private', async t => {
  const f = fixture(t), service = f.create();
  for (const reason of ['USER_STOPPED', 'SERIAL_DISCONNECTED', 'LICENSE_EXPIRED', 'APPLICATION_EXIT', 'SYSTEM_RELEASE_WITHDRAWN', 'DATA_STREAM_TIMEOUT']) {
    const started = service.begin({ recordKey: 'private-record-name', systemId: 'fixture', inputCoverage: 'synchronous', usageProperties: { systemType: 'fixture', systemOrigin: 'builtin' } });
    const row = service.queued();
    service.finish(reason); service.finish(reason);
    assert(!f.host.provider().list().some(item => item.event.properties.collectionId === started.id));
    service.settled(row, true); service.settled(row, true);
    const matching = f.host.provider().list().filter(item => item.event.properties.collectionId === started.id);
    assert.equal(matching.length, 1);
    assert.deepEqual(matching[0].event.properties, { featureId: 'collection', systemType: 'fixture', systemOrigin: 'builtin', collectionId: started.id,
      outcome: 'saved', result: 'success', stopReason: reason, outcomeRevision: 0, committedRows: 1, failedRows: 0, frameCount: 1,
      durationMs: service.current().stoppedAt - started.startedAt });
    assert.equal(f.host.starts.at(-1).properties.collectionId, started.id);
    assert(!JSON.stringify(matching).includes('private-record-name'));
    const publicState = JSON.stringify([service.current(), service.list({})]);
    for (const secret of ['usageContext', 'usageOutbox', f.host.context.installationId, f.host.context.scope]) assert(!publicState.includes(secret));
  }
});

test('failed evidence replacement exposes no terminal; recovery uses original context and unknown outcome', t => {
  let fail = false;
  const injected = { ...fs, renameSync(from, to) { if (fail) throw Object.assign(new Error('injected replacement failure'), { code: 'EIO' }); fs.renameSync(from, to); } };
  const f = fixture(t), service = f.create({ fsImpl: injected });
  const started = service.begin({ inputCoverage: 'synchronous' });
  const row = service.queued(); service.settled(row, true);
  fail = true; service.finish();
  assert.equal(service.current().result, 'unknown'); assert.equal(f.host.provider().list().length, 0);
  assert(!f.read(started.id).usageOutbox);
  service.dispose(); fail = false;
  f.host.context.scope = 'fixture-owner-b'; f.host.context.appVersion = 'fixture-v2';
  const restored = f.create();
  const pending = f.host.provider().list();
  assert.equal(restored.list({})[0].result, 'unknown');
  assert.equal(pending.length, 1); assert.equal(pending[0].scope, 'fixture-owner-a');
  assert.equal(pending[0].event.appVersion, 'fixture-v1'); assert.equal(pending[0].event.properties.stopReason, 'PROCESS_INTERRUPTED');
});

test('ack fsync failure retains the exact pending body; successful durable disposition survives restart', t => {
  let fail = false;
  const injected = { ...fs, fsyncSync(fd) { if (fail) throw Object.assign(new Error('injected fsync failure'), { code: 'EIO' }); fs.fsyncSync(fd); } };
  const f = fixture(t), service = f.create({ fsImpl: injected });
  const started = service.begin({ inputCoverage: 'synchronous' }); service.finish();
  const provider = f.host.provider(), pending = provider.list()[0], body = JSON.stringify(pending.event);
  fail = true; assert.equal(provider.settle(pending.event.eventId, 'acked'), false);
  assert.equal(JSON.stringify(provider.list()[0].event), body);
  assert.equal(f.read(started.id).usageOutbox[0].state, 'pending');
  fail = false; assert.equal(provider.settle(pending.event.eventId, 'acked'), true);
  assert.equal(provider.settle(pending.event.eventId, 'acked'), true);
  assert.equal(f.read(started.id).usageOutbox[0].event, undefined);
  service.dispose(); f.create(); assert.equal(f.host.provider().list().length, 0);
});

test('late original SQL callbacks reconcile timeout once without changing the initial envelope', async t => {
  const f = fixture(t), service = f.create({ drainTimeoutMs: 5 });
  const started = service.begin({ inputCoverage: 'synchronous' }), row = service.queued();
  service.finish('SERIAL_DISCONNECTED'); await service.whenFinished();
  const first = f.host.provider().list()[0].event, initialBody = JSON.stringify(first);
  assert.equal(first.properties.outcome, 'unknown');
  service.settled(row, true); service.settled(row, false);
  const events = f.host.provider().list().map(item => item.event);
  assert.equal(events.length, 2); assert.equal(JSON.stringify(events[0]), initialBody);
  assert.equal(events[1].eventName, 'collection_outcome_reconciled');
  assert.equal(events[1].properties.collectionId, started.id); assert.equal(events[1].properties.outcomeRevision, 1);
  assert.equal(events[1].properties.supersedesEventId, first.eventId); assert.equal(events[1].properties.outcome, 'saved');
  assert.equal(service.current().result, 'saved');
  service.dispose(); f.create(); assert.deepEqual(f.host.provider().list().map(item => item.event), events);
});

test('suppressed, dropped and expired publications never resurrect after recovery or later settlement', async t => {
  for (const state of ['suppressed', 'dropped', 'expired']) {
    const f = fixture(t), service = f.create({ drainTimeoutMs: 5 });
    service.begin({ inputCoverage: 'synchronous' }); const row = service.queued(); service.finish(); await service.whenFinished();
    const eventId = f.host.provider().list()[0].event.eventId;
    assert.equal(f.host.provider().settle(eventId, state, 'FIXTURE_DISPOSITION'), true);
    service.settled(row, true);
    assert.equal(f.host.provider().list().length, 0);
    service.dispose(); f.create(); assert.equal(f.host.provider().list().length, 0);
  }
});

test('a failed revision replacement leaves the previously committed unknown envelope authoritative', async t => {
  let fail = false;
  const injected = { ...fs, renameSync(from, to) {
    if (fail && JSON.parse(fs.readFileSync(from, 'utf8')).usageOutbox?.length > 1) throw Object.assign(new Error('revision interrupted'), { code: 'EIO' });
    fs.renameSync(from, to);
  } };
  const f = fixture(t), service = f.create({ fsImpl: injected, drainTimeoutMs: 5 });
  const started = service.begin({ inputCoverage: 'synchronous' }), row = service.queued();
  service.finish(); await service.whenFinished();
  const first = f.host.provider().list()[0].event;
  fail = true; service.settled(row, true);
  assert.equal(service.current().result, 'unknown');
  assert.deepEqual(f.host.provider().list().map(item => item.event), [first]);
  assert.equal(f.read(started.id).usageOutbox.length, 1);
  service.dispose(); fail = false; f.create();
  assert.deepEqual(f.host.provider().list().map(item => item.event), [first]);
});

test('acknowledging an older revision cannot commit a newer failed revision as a side effect', async t => {
  let fail = false;
  const injected = { ...fs, renameSync(from, to) {
    if (fail && JSON.parse(fs.readFileSync(from, 'utf8')).usageOutbox?.length > 1) throw Object.assign(new Error('revision interrupted'), { code: 'EIO' });
    fs.renameSync(from, to);
  } };
  const f = fixture(t), service = f.create({ fsImpl: injected, drainTimeoutMs: 5 });
  const started = service.begin({ inputCoverage: 'synchronous' }), row = service.queued();
  service.finish(); await service.whenFinished();
  const first = f.host.provider().list()[0].event;
  fail = true; service.settled(row, true);
  assert.equal(f.host.provider().settle(first.eventId, 'acked'), true);
  assert.equal(f.read(started.id).usageOutbox.length, 1, 'ACK only commits a disposition on the already committed revision');
  assert.equal(f.read(started.id).usageOutbox[0].state, 'acked');
  assert.equal(f.host.provider().list().length, 0);
  assert.equal(service.current().result, 'unknown', 'failed newer evidence remains unconfirmed');
  fail = false; service.dispose(); f.create();
  const revisions = f.read(started.id).usageOutbox;
  assert.equal(revisions.length, 2, 'an explicit later evidence retry keeps the genuine SQL progress');
  assert.equal(revisions[0].state, 'acked'); assert.equal(revisions[1].state, 'pending');
  assert.equal(f.host.provider().list()[0].event.properties.outcome, 'saved');
});

test('actual opt-out suppresses an uncommitted successor without publishing it during confirmation', async t => {
  let fail = false;
  const injected = { ...fs, renameSync(from, to) {
    if (fail && JSON.parse(fs.readFileSync(from, 'utf8')).usageOutbox?.length > 1) throw Object.assign(new Error('revision interrupted'), { code: 'EIO' });
    fs.renameSync(from, to);
  } };
  const f = fixture(t), options = { root: f.root, appVersion: '1.1.43', environment: 'test', getLicenseKey: () => 'ab'.repeat(64),
    fetchImpl: async () => { throw new Error('network is forbidden in this test'); } };
  const usage = createUsageAnalytics(options), service = f.create({ evidence: bridge, fsImpl: injected, drainTimeoutMs: 5 });
  try {
    const started = service.begin({ inputCoverage: 'synchronous' }), row = service.queued(); service.finish(); await service.whenFinished();
    fail = true; service.settled(row, true); await usage.setEnabled(false);
    assert.equal(f.read(started.id).usageOutbox.length, 1);
    assert.equal(f.read(started.id).usageOutbox[0].state, 'suppressed');
    fail = false; service.dispose();
    const revisions = f.read(started.id).usageOutbox;
    assert.equal(revisions.length, 2);
    assert(revisions.every(entry => entry.state === 'suppressed' && !entry.event));
    await usage.dispose();
    const reopened = createUsageAnalytics(options), restored = f.create({ evidence: bridge });
    try {
      await reopened.setEnabled(true);
      assert.equal(reopened.status().queued, 1, 'only the new enabled-session event survives reopening');
      assert.equal(restored.list({})[0].result, 'saved', 'opt-out does not discard the local SQL outcome');
    } finally { restored.dispose(); await reopened.dispose(); }
  } finally { fail = false; service.dispose(); await usage.dispose(); }
});

test('recovery keeps the newest 2000 ordinary summaries, discovers older pending events and rejects oversized files', t => {
  const errors = [], f = fixture(t), original = f.create({ now: () => 1 });
  const pending = original.begin({ recordKey: 'old-pending', inputCoverage: 'synchronous' }); original.finish(); original.dispose();
  const directory = path.join(f.root, 'collection-sessions');
  for (let index = 0; index < 2005; index++) {
    const id = randomUUID();
    fs.writeFileSync(path.join(directory, `${id}.json`), JSON.stringify({ schemaVersion: 1, id, recordKey: `ordinary-${index}`, systemId: 'fixture',
      startedAt: 100 + index, stoppedAt: 101 + index, completedAt: 101 + index, phase: 'completed', result: 'saved',
      reason: 'USER_STOPPED', inputCoverage: 'synchronous', channels: {}, configuration: { boundedFixture: 'x'.repeat(256) } }));
  }
  const oversized = path.join(directory, `${randomUUID()}.json`); fs.writeFileSync(oversized, Buffer.alloc(1024 * 1024 + 1, 32));
  let oversizedReads = 0; const descriptors = new Map();
  const injected = { ...fs,
    openSync(file, ...args) { const descriptor = fs.openSync(file, ...args); descriptors.set(descriptor, file); return descriptor; },
    readSync(descriptor, ...args) { if (descriptors.get(descriptor) === oversized) oversizedReads++; return fs.readSync(descriptor, ...args); },
    closeSync(descriptor) { descriptors.delete(descriptor); return fs.closeSync(descriptor); } };
  const restored = f.create({ fsImpl: injected, onError: error => errors.push(error.code) });
  for (let index = 0; index < 5; index++) assert.equal(restored.list({ recordKey: `ordinary-${index}` }).length, 0);
  assert.equal(restored.list({ recordKey: 'ordinary-5' }).length, 1);
  assert.equal(restored.list({ recordKey: 'ordinary-2004' }).length, 1);
  assert.equal(restored.list({ limit: 99999 }).length, 100, 'the existing public response limit stays unchanged');
  assert.equal(f.host.provider().list().length, 1);
  assert.equal(f.host.provider().list()[0].event.properties.collectionId, pending.id);
  assert.equal(f.host.provider().list()[0].epoch, 0);
  assert.equal(oversizedReads, 0); assert(errors.includes('COLLECTION_SUMMARY_TOO_LARGE')); assert(fs.existsSync(oversized));
});

test('adapter startup delay preserves original crash recovery; legacy evidence is never rebound', t => {
  const f = fixture(t), off = bridge.setUsageEvidenceAdapter(f.host.adapter);
  const service = f.create({ evidence: bridge }); const started = service.begin({ inputCoverage: 'synchronous' });
  service.dispose(); off();
  const restored = f.create({ evidence: bridge });
  assert.equal(f.read(started.id).phase, 'collecting', 'await the trusted host before sealing the contextual recovery');
  const offAgain = bridge.setUsageEvidenceAdapter(f.host.adapter); t.after(offAgain);
  assert.equal(restored.list({})[0].result, 'unknown'); assert.equal(f.host.provider().list().length, 1);
  const legacyId = randomUUID(), legacy = { ...f.read(started.id), schemaVersion: 1, id: legacyId, phase: 'collecting', result: 'pending' };
  fs.writeFileSync(path.join(f.root, 'collection-sessions', `${legacyId}.json`), JSON.stringify(legacy));
  const legacyRestored = f.create();
  assert.equal(legacyRestored.list({}).find(item => item.id === legacyId).result, 'unknown');
  assert(!f.host.provider().list().some(item => item.event.properties.collectionId === legacyId));
  assert.equal(f.read(legacyId).usageOutbox[0].state, 'suppressed');
});

test('an altered persisted envelope is quarantined instead of being silently overwritten or republished', t => {
  const f = fixture(t), service = f.create(); const started = service.begin({ inputCoverage: 'synchronous' }); service.finish(); service.dispose();
  const file = path.join(f.root, 'collection-sessions', `${started.id}.json`), saved = f.read(started.id);
  saved.usageOutbox[0].event.properties.committedRows = 999;
  fs.writeFileSync(file, JSON.stringify(saved)); f.create();
  assert.equal(f.host.provider().list().length, 0);
  assert.equal(f.read(started.id).usageOutbox[0].state, 'dropped');
  assert.equal(f.read(started.id).usageOutbox[0].reason, 'USAGE_RESTORE_CONFLICT');
});

test('the actual desktop adapter accepts frozen collection identities and counts the committed outbox', async t => {
  const f = fixture(t), key = 'ab'.repeat(64);
  let at = Date.now() - 1000;
  const usage = createUsageAnalytics({ root: f.root, appVersion: '1.1.43', environment: 'test', getLicenseKey: () => key,
    getRuntimeVersions: () => ({ frontendBuildId: 123, hostContract: 1 }), fetchImpl: async () => { throw new Error('network is forbidden in this test'); } });
  const service = f.create({ evidence: bridge, now: () => at });
  try {
    const started = service.begin({ inputCoverage: 'synchronous', usageProperties: { systemType: 'fixture-private', systemOrigin: 'custom' } });
    const row = service.queued(); service.settled(row, true); at += 100;
    service.finish(); await usage.whenPersisted();
    const revision = f.read(started.id).usageOutbox[0];
    assert.equal(revision.state, 'pending'); assert.equal(revision.event.schemaVersion, 2);
    assert.equal(revision.event.occurredAt, new Date(at).toISOString());
    assert.equal(revision.event.properties.collectionId, started.id);
    assert.match(revision.event.properties.systemType, /^custom\.[a-f0-9]{16}$/);
    assert(!JSON.stringify(revision).includes(key));
    assert.equal(usage.status().queued, 3, 'startup, the associated start and one committed terminal');
    assert.equal(usage.status().quality.invalidCount, 0);
  } finally { service.dispose(); await usage.dispose(); }
});

test('isolated process death before and after terminal replacement follows the atomic record boundary', t => {
  const f = fixture(t), modulePath = path.resolve(__dirname, '../../kernel/storage/history/collectionSessionService.js');
  const script = `const fs = require('node:fs'), { randomUUID } = require('node:crypto');
    const { createCollectionSessionService } = require(${JSON.stringify(modulePath)});
    const context = {installationId:randomUUID(),sessionId:randomUUID(),appVersion:'crash-v1',environment:'test',scope:'crash-owner',epoch:0};
    const evidence = { captureUsageEvidenceContext:()=>context, recordUsageEvidence:()=>true, registerUsageOutbox:()=>()=>{},
      prepareUsageEvidence:(input,original)=>({state:'pending',scope:original.scope,event:{...input,eventId:randomUUID(),installationId:original.installationId,sessionId:original.sessionId,appVersion:original.appVersion,environment:'test'}}) };
    const injected = {...fs, renameSync(from,to) {const terminal=JSON.parse(fs.readFileSync(from,'utf8')).usageOutbox;
      if(terminal && process.argv[2]==='before')process.exit(81); fs.renameSync(from,to); if(terminal)process.exit(82);}};
    const service=createCollectionSessionService({root:process.argv[1],evidence,fsImpl:injected});
    service.begin({inputCoverage:'synchronous'}); const row=service.queued(); service.settled(row,true); service.finish();`;
  for (const phase of ['before', 'after']) {
    const root = path.join(f.root, phase); fs.mkdirSync(root);
    const child = spawnSync(process.execPath, ['-e', script, root, phase], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8', timeout: 10000 });
    assert.equal(child.status, phase === 'before' ? 81 : 82, child.stderr);
    const directory = path.join(root, 'collection-sessions'), file = fs.readdirSync(directory).find(name => name.endsWith('.json'));
    const before = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    const host = sender(), restored = createCollectionSessionService({ root, evidence: host.evidence }); t.after(() => restored.dispose());
    const event = host.provider().list()[0].event;
    assert.equal(host.provider().list().length, 1); assert.equal(event.properties.outcomeRevision, 0);
    if (phase === 'before') { assert.equal(before.phase, 'finalizing'); assert.equal(event.properties.outcome, 'unknown'); }
    else assert.deepEqual(event, before.usageOutbox[0].event);
  }
});
