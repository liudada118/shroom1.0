const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID, createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { createStartupDiagnostics, LIMITS } = require('../../../app/electron/startupDiagnostics');
const { createUsageAnalytics } = require('../../../app/electron/usageAnalytics');
const modulePath = path.resolve(__dirname, '../../../app/electron/startupDiagnostics.js');
const KEY_A = 'ab'.repeat(64), KEY_B = 'cd'.repeat(64);

/** Create an isolated consent/store fixture and delete only its verified temporary root. */
function fixture(t, enabled = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-startup-diagnostics-'));
  const directory = path.join(root, 'usage-analytics'), file = path.join(directory, 'startup-diagnostics.json');
  fs.mkdirSync(directory);
  const settings = { enabled, installationId: randomUUID() };
  fs.writeFileSync(path.join(directory, 'settings.json'), JSON.stringify(settings));
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, directory, file, settings, options: { root, appVersion: '1.1.43', environment: 'test', getLicenseKey: () => KEY_A } };
}

/** Read the actual persisted store rather than treating an in-memory return value as durability evidence. */
function stored(f) { return JSON.parse(fs.readFileSync(f.file, 'utf8')); }

test('early failures retain immutable IDs and original customer scope after restart', t => {
  const f = fixture(t), first = createStartupDiagnostics(f.options);
  const error = Object.assign(new Error('private message ' + KEY_A), { code: 'EADDRINUSE',
    stack: `Error: private message ${KEY_A}\n at privateLabel (C:\\Users\\private\\App\\index.js:14:2)` });
  const result = first.record(error, { phase: 'port_preflight' });
  assert.equal(result.saved, true);
  first.record(error, { phase: 'port_preflight' });
  assert.equal(first.list().length, 1);
  const original = first.list()[0];
  assert.equal(original.scope, createHash('sha256').update(KEY_A).digest('hex'));
  assert.equal(original.event.properties.errorCode, 'STARTUP_PORT_IN_USE');
  assert.equal(original.event.properties.stack, '    at index.js:14:2');
  assert.doesNotMatch(JSON.stringify(original), /private|Users|privateLabel|abababab/);
  first.markClean('startup_failed');
  const restarted = createStartupDiagnostics({ ...f.options, appVersion: '1.1.44', getLicenseKey: () => KEY_B });
  assert.deepEqual(restarted.list()[0], original);
  assert.equal(restarted.preview(), '', 'another customer cannot export old-customer evidence');
  assert.equal(restarted.settle(original.event.eventId, 'acked'), true);
  assert.equal(restarted.list().length, 0);
  assert.deepEqual(stored(f).records[0].event, original.event);
});

test('unknown ownership stays local and opt-out clears all evidence without enabling collection', t => {
  const f = fixture(t), service = createStartupDiagnostics({ ...f.options, getLicenseKey: () => '' });
  service.record(new Error('unassigned'));
  assert.equal(service.list().length, 0);
  assert.equal(JSON.parse(service.preview()).records[0].ownership, 'unassigned');
  service.markClean();
  const next = createStartupDiagnostics(f.options);
  assert.equal(next.list().length, 0, 'a newly entered key never adopts unassigned records');
  fs.writeFileSync(path.join(f.directory, 'settings.json'), JSON.stringify({ ...f.settings, enabled: false }));
  assert.equal(next.record(new Error('disabled')).saved, false);
  assert.equal(next.preview(), '');
  assert.equal(stored(f).records.length, 0);
  fs.writeFileSync(path.join(f.directory, 'settings.json'), '{broken');
  assert.equal(createStartupDiagnostics(f.options).status().enabled, false);
  fs.unlinkSync(path.join(f.directory, 'settings.json'));
  assert.equal(createStartupDiagnostics(f.options).record(new Error('missing')).saved, false);
  assert.equal(fs.existsSync(path.join(f.directory, 'settings.json')), false);
});

test('unconfirmed prior exit reports a new warning linked to the original attempt while intentional exits remain clean', t => {
  for (const close of ['normal', 'upgrade', 'startup_failed', null]) {
    const f = fixture(t), original = createStartupDiagnostics(f.options), marker = stored(f).marker;
    if (close) { original.markClean(close); original.markClean('normal'); }
    const restarted = createStartupDiagnostics({ ...f.options, appVersion: '1.1.44', getLicenseKey: () => KEY_B });
    const reports = restarted.list();
    assert.equal(reports.length, close ? 0 : 1);
    if (!close) {
      const event = reports[0].event;
      assert.equal(event.properties.errorCode, 'PREVIOUS_EXIT_UNCONFIRMED');
      assert.equal(event.properties.severity, 'warning');
      assert.equal(event.properties.operationId, marker.attemptId);
      assert.equal(event.appVersion, '1.1.44', 'the observation is made by the new host, without guessing the previous exit time');
      assert.notEqual(event.sessionId, marker.sessionId);
      assert.ok(Date.parse(event.occurredAt) >= Date.parse(marker.startedAt));
    }
    restarted.markClean();
  }
});

test('count, byte, event and retention bounds are independently enforced and losses remain visible', t => {
  const f = fixture(t), service = createStartupDiagnostics(f.options);
  for (let i = 0; i < 120; i++) service.record(new Error('failure'));
  assert.equal(stored(f).records.length, LIMITS.records);
  assert.equal(stored(f).removed.capacity, 20);
  assert.ok(fs.statSync(f.file).size <= LIMITS.bytes);
  for (const record of stored(f).records) assert.ok(Buffer.byteLength(JSON.stringify(record.event)) <= LIMITS.eventBytes);
  service.markClean();
  const future = createStartupDiagnostics({ ...f.options, now: () => Date.now() + LIMITS.ageMs + 1000 });
  assert.equal(future.list().length, 0);
  assert.equal(stored(f).removed.expired, 100);

  const small = fixture(t), limited = createStartupDiagnostics({ ...small.options, limits: { ...LIMITS, bytes: 3000 } });
  for (let i = 0; i < 15; i++) limited.record(new Error('failure'));
  assert.ok(stored(small).records.length < 15);
  assert.ok(stored(small).removed.capacity > 0);
  assert.ok(fs.statSync(small.file).size <= 3000);
  const tiny = fixture(t), tinyEvent = createStartupDiagnostics({ ...tiny.options, limits: { ...LIMITS, eventBytes: 50 } });
  assert.equal(tinyEvent.record(new Error('too large')).saved, false);
  assert.equal(tinyEvent.list().length, 0);
});

test('failed atomic acknowledgement retains pending content and suppression deletes the original body', t => {
  const f = fixture(t), service = createStartupDiagnostics(f.options);
  service.record(new Error('failure'));
  const original = service.list()[0], backup = `${f.file}.backup`;
  fs.renameSync(f.file, backup); fs.mkdirSync(f.file);
  assert.equal(service.settle(original.event.eventId, 'acked'), false);
  assert.deepEqual(service.list()[0], original);
  assert.equal(service.status().storageAvailable, false);
  fs.rmdirSync(f.file); fs.renameSync(backup, f.file);
  assert.equal(service.settle(original.event.eventId, 'suppressed'), true);
  assert.doesNotMatch(fs.readFileSync(f.file, 'utf8'), new RegExp(original.event.eventId));
});

test('safe export requires the current preview and never includes another customer or newly disabled data', t => {
  const f = fixture(t), service = createStartupDiagnostics(f.options);
  service.record(new Error('private text'));
  const preview = service.preview(), target = path.join(f.root, 'safe.json');
  assert.equal(service.exportTo(target, preview), true);
  assert.equal(fs.readFileSync(target, 'utf8'), preview);
  assert.ok(fs.statSync(target).size <= LIMITS.bytes);
  assert.doesNotMatch(preview, /private text|abababab|[A-Z]:\\/);
  fs.writeFileSync(path.join(f.directory, 'settings.json'), JSON.stringify({ ...f.settings, enabled: false }));
  assert.equal(service.exportTo(path.join(f.root, 'disabled.json'), preview), false);
  assert.equal(fs.existsSync(path.join(f.root, 'disabled.json')), false);
});

test('consent epoch prevents old evidence resurrection when cleanup fails and reporting is enabled again', t => {
  const f = fixture(t), service = createStartupDiagnostics(f.options);
  service.record(new Error('failure'));
  const old = fs.readFileSync(f.file, 'utf8'), backup = `${f.file}.backup`;
  fs.renameSync(f.file, backup); fs.mkdirSync(f.file);
  fs.writeFileSync(path.join(f.directory, 'settings.json'), JSON.stringify({ ...f.settings, enabled: false, epoch: 1 }));
  assert.deepEqual(service.list(), []);
  fs.writeFileSync(path.join(f.directory, 'settings.json'), JSON.stringify({ ...f.settings, enabled: true, epoch: 1 }));
  assert.deepEqual(service.list(), []);
  assert.equal(service.preview(), '');
  fs.rmdirSync(f.file); fs.renameSync(backup, f.file);
  assert.equal(fs.readFileSync(f.file, 'utf8'), old);
  const restarted = createStartupDiagnostics(f.options);
  assert.deepEqual(restarted.list(), []);
  assert.equal(stored(f).records.length, 0);
});

test('the real uploader acknowledges startup outbox IDs and disabling reporting removes pending evidence', async t => {
  const f = fixture(t), store = createStartupDiagnostics(f.options), requests = [];
  store.record(Object.assign(new Error('occupied'), { code: 'EADDRINUSE' }), { phase: 'port_preflight' });
  const original = store.list()[0].event;
  const usage = createUsageAnalytics({ ...f.options, fetchImpl: async (_url, request) => {
    if (request.method === 'GET') return new Response(JSON.stringify({ schemaVersions: [1, 2] }));
    const body = JSON.parse(request.body); requests.push(body.events);
    return new Response(JSON.stringify({ accepted: true, eventIds: body.events.map(event => event.eventId) }));
  } });
  try {
    usage.registerOutbox(store);
    await usage.flush(true);
    assert.deepEqual(requests.flat().find(event => event.eventId === original.eventId), original);
    assert.equal(stored(f).records.find(record => record.event.eventId === original.eventId).state, 'acked');
    store.record(new Error('another failure'));
    assert.equal(store.list().length, 1);
    await usage.setEnabled(false);
    assert.equal(store.list().length, 0);
    assert.equal(stored(f).records.length, 0);
    await usage.setEnabled(true);
    assert.equal(store.list().length, 0);
  } finally { await usage.dispose(); }
});

/** Run a bounded Electron child without windows, using only isolated userData and local evidence files. */
function runElectron(script, root, mode, asNode = false) {
  const executable = typeof require('electron') === 'string' ? require('electron') : process.execPath;
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  if (asNode) env.ELECTRON_RUN_AS_NODE = '1';
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [script, root, mode], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Isolated Electron diagnostic fixture timed out')); }, 20000);
    child.stdout.on('data', bytes => { output = (output + bytes).slice(-4000); });
    child.stderr.on('data', bytes => { output = (output + bytes).slice(-4000); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('exit', code => { clearTimeout(timer); resolve({ code, output }); });
  });
}

test('isolated Electron exits recover unknown state and Electron Node fatal callbacks persist before real termination', async t => {
  const f = fixture(t), script = path.join(f.root, 'electron-fixture.cjs');
  fs.writeFileSync(script, `const { app } = require('electron');
const { createStartupDiagnostics } = require(${JSON.stringify(modulePath)});
app.setPath('userData', process.argv[2]);
const store = createStartupDiagnostics({ app, appVersion: '1.1.43', environment: 'test', getLicenseKey: () => '${KEY_A}' });
app.on('will-quit', () => store.markClean('normal'));
app.whenReady().then(() => { if (process.argv[3] === 'unexpected') app.exit(23); else app.quit(); });
`);
  assert.equal((await runElectron(script, f.root, 'unexpected')).code, 23);
  assert.equal(stored(f).marker.state, 'open');
  assert.equal((await runElectron(script, f.root, 'normal')).code, 0);
  assert.equal(stored(f).records.length, 1);
  assert.equal(stored(f).records[0].event.properties.errorCode, 'PREVIOUS_EXIT_UNCONFIRMED');
  assert.equal(stored(f).marker.state, 'normal');
  const fatalScript = path.join(f.root, 'fatal-fixture.cjs');
  fs.writeFileSync(fatalScript, `const { createStartupDiagnostics } = require(${JSON.stringify(modulePath)});
const store = createStartupDiagnostics({ root: process.argv[2], appVersion: '1.1.43', environment: 'test', getLicenseKey: () => '${KEY_A}' });
process.on('uncaughtExceptionMonitor', error => store.record(error, { phase: 'main_process', uncaught: true }));
throw new Error('synthetic fatal');
`);
  const fatalResult = await runElectron(fatalScript, f.root, 'fatal', true);
  assert.notEqual(fatalResult.code, 0);
  const fatalRecord = stored(f).records.find(record => record.event.properties.errorCode === 'MAIN_UNCAUGHT_EXCEPTION');
  assert.ok(fatalRecord);
  assert.match(fatalRecord.event.properties.stack, /fatal-fixture.cjs:\d+:\d+/);
  assert.equal(stored(f).marker.state, 'fatal_observed');
});
