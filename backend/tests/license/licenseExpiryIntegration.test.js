const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const { verifyOfflineLicense } = require('../../../crypto-lib.cjs');
const { validateLicenseKey } = require('../../kernel/platform/license/licenseValidationService');
const { createDeviceAuthorization } = require('../../kernel/platform/license/deviceAuthorization');
const { createLicenseAccessPolicy } = require('../../kernel/platform/license/licenseAccessPolicy');
const { createRuntimeControlService } = require('../../kernel/platform/commands/runtimeControlService');
const { createControlCommandRouter } = require('../../kernel/platform/commands/controlCommandRouter');
const { createControlCommandService } = require('../../kernel/platform/commands/controlCommandService');
const { registerSerialControlHandlers } = require('../../kernel/serial/serialControlService');
const { createHttpApp } = require('../../kernel/platform/http/httpAppFactory');
const { createAlgorithmRecordService } = require('../../kernel/storage/history/algorithmRecordService');
const { createHistoryAnalysis, selectHistoryRecords } = require('../../agent-runtime/history-analysis/service');

/** Allocate an isolated fixture directory and verify its boundary before recursive cleanup. */
function temporaryRoot(t) {
  const parent = path.resolve(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'shroom-license-integration-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), parent);
    assert(path.basename(root).startsWith('shroom-license-integration-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}

/** Sign a computer allowance with disposable Ed25519 fixture keys. */
function signedLease(privateKey, key, deviceId, issuedAt, expiresAt) {
  const lease = { schemaVersion: 1, keyHash: crypto.createHash('sha256').update(key).digest('hex'),
    deviceId, issuedAt, expiresAt, deviceLimit: 2 };
  return { lease, signature: crypto.sign(null, Buffer.from(JSON.stringify(lease)), privateKey).toString('base64') };
}

/** Return a finite JSON response without making an external authorization request. */
function response(value) {
  return { ok: true, text: async () => JSON.stringify(value) };
}

test('verified RSA expiry is accepted only for history mode and never bypasses signature verification', async (t) => {
  const root = temporaryRoot(t);
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  const payload = Buffer.from(JSON.stringify({ version: 2, sensorTypes: ['hand'], expireDate: 2000 })).toString('base64');
  const envelope = { payload, signature: crypto.sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64') };
  const key = Buffer.from(JSON.stringify(envelope)).toString('base64');
  const verify = (value) => verifyOfflineLicense(value, { publicKey: publicPem, nowMs: 3000 });
  assert.equal(validateLicenseKey(key, { verifyOfflineLicense: verify }).code, 'LICENSE_EXPIRED');
  const validated = validateLicenseKey(key, { verifyOfflineLicense: verify, allowExpired: true });
  assert.equal(validated.ok, true);
  assert.equal(validated.state.endDate, 2000);
  assert.deepEqual(validated.state.selectFlag, ['hand']);
  let networkCalls = 0;
  const authorization = createDeviceAuthorization({ root, now: () => 3000,
    fetchImpl: async () => { networkCalls += 1; throw new Error('fixture must remain offline'); } });
  const grant = await authorization.authorize(key, validated.state);
  assert.equal(networkCalls, 0);
  assert.equal(grant.ok, false);
  assert.equal(grant.historyAllowed, true);
  const policy = createLicenseAccessPolicy({ clock: { now: () => 3000, synchronize() {} } });
  t.after(() => policy.dispose());
  const access = policy.update(grant);
  assert.equal(access.state, 'expired');
  assert.equal(access.canReadHistory, true);
  assert.equal(access.canAnalyzeHistory, true);
  assert.equal(access.canAcquire, false);
  assert.equal(access.canExport, false);
  const tampered = Buffer.from(JSON.stringify({ ...envelope,
    payload: Buffer.from(JSON.stringify({ version: 2, sensorTypes: ['all'], expireDate: 9000 })).toString('base64') })).toString('base64');
  assert.equal(validateLicenseKey(tampered, { verifyOfflineLicense: verify, allowExpired: true }).code, 'LICENSE_OFFLINE_INVALID');
});

test('signed computer allowance distinguishes lease expiry from normal software expiry and survives read-only restart', async (t) => {
  const root = temporaryRoot(t);
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const key = 'ab'.repeat(64), deviceId = 'fixture-computer';
  let now = 1500, online = true, denied = false;
  const deviceLease = signedLease(privateKey, key, deviceId, 1000, 2000);
  /** Simulate authoritative active, expired, explicitly revoked and offline outcomes. */
  const fetchImpl = async () => {
    if (!online) throw new Error('synthetic offline');
    return response(denied
      ? { valid: false, time: now, expireTimestamp: 3000, deviceLimit: 2, status: 'REVOKED' }
      : now < 3000
        ? { valid: true, time: now, expireTimestamp: 3000, deviceLimit: 2, status: 'OK', deviceLease }
        : { valid: false, time: now, expireTimestamp: 3000, deviceLimit: 2, status: 'EXPIRED' });
  };
  /** Recreate the desktop authorization service to exercise durable cache validation. */
  const restart = () => createDeviceAuthorization({ root, publicKey, deviceId, now: () => now, fetchImpl });
  const localState = { endDate: 3000 };
  const policy = createLicenseAccessPolicy({ clock: { now: () => now, synchronize() {} } });
  t.after(() => policy.dispose());
  assert.equal(policy.update(await restart().authorize(key, localState)).state, 'active');
  online = false; now = 2500;
  const leaseExpired = await restart().authorize(key, localState);
  assert.equal(leaseExpired.code, 'DEVICE_LEASE_EXPIRED');
  assert.equal(leaseExpired.historyAllowed, false);
  assert.equal(policy.update(leaseExpired).canReadHistory, false);
  now = 3500; online = true;
  const softwareExpired = await restart().authorize(key, localState);
  assert.equal(softwareExpired.code, 'LICENSE_EXPIRED');
  assert.equal(softwareExpired.historyAllowed, true);
  assert.deepEqual(softwareExpired.deviceLease, deviceLease);
  online = false;
  const restarted = await restart().authorize(key, localState);
  assert.equal(restarted.offline, true);
  assert.equal(policy.update(restarted).state, 'expired');
  assert.equal(policy.requireAccess('history').canReadHistory, true);
  assert.equal(policy.requireAccess('analyze').canAnalyzeHistory, true);
  assert.throws(() => policy.requireAccess('acquire'), { code: 'LICENSE_EXPIRED' });
  assert.throws(() => policy.requireAccess('export'), { code: 'LICENSE_EXPIRED' });
  const file = path.join(root, 'license-devices', `${crypto.createHash('sha256').update(key).digest('hex')}.json`);
  const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
  cached.deviceLease.lease.deviceId = 'different-computer';
  fs.writeFileSync(file, JSON.stringify(cached));
  const tampered = await restart().authorize(key, localState);
  assert.equal(tampered.code, 'LICENSE_ONLINE_ACTIVATION_REQUIRED');
  assert.equal(policy.update(tampered).canReadHistory, false);
  online = true; denied = true;
  const revoked = await restart().authorize(key, localState);
  assert.equal(revoked.explicitDenial, true);
  assert.equal(policy.update(revoked).state, 'restricted');
  assert.equal(policy.read().canAnalyzeHistory, false);
});

test('an online expired response without previous verified lease cannot grant offline history on next startup', async (t) => {
  const root = temporaryRoot(t);
  const { publicKey } = crypto.generateKeyPairSync('ed25519');
  const options = { root, publicKey, deviceId: 'fixture-new-computer', now: () => 3500 };
  const key = 'cd'.repeat(64), localState = { endDate: 3000 };
  const verifiedOnline = await createDeviceAuthorization({ ...options,
    fetchImpl: async () => response({ valid: false, time: 3500, expireTimestamp: 3000, deviceLimit: 2, status: 'EXPIRED' }),
  }).authorize(key, localState);
  assert.equal(verifiedOnline.historyAllowed, true);
  const offline = createDeviceAuthorization({ ...options, fetchImpl: async () => { throw new Error('synthetic offline'); } });
  const unavailable = await offline.authorize(key, localState);
  assert.equal(unavailable.code, 'LICENSE_ONLINE_ACTIVATION_REQUIRED');
  assert.notEqual(unavailable.historyAllowed, true);
});

test('real HTTP history and selected-data analysis remain usable after expiry while start and CSV/PDF exports are rejected before writes', async (t) => {
  const root = temporaryRoot(t);
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec('CREATE TABLE matrix (id INTEGER PRIMARY KEY, data TEXT, timestamp INTEGER, date TEXT)');
  const insert = db.prepare('INSERT INTO matrix(data,timestamp,date) VALUES (?,?,?)');
  for (let index = 0; index < 6; index += 1) insert.run(JSON.stringify({ data: [index, 0, 2, 4],
    matrix: { rows: 2, cols: 2 } }), 1000 + index * 20, 'fixture-record');
  const before = db.prepare('SELECT * FROM matrix ORDER BY id').all();
  const imgPath = path.join(root, 'images'), pdfPath = path.join(root, 'pdf'), csvPath = path.join(root, 'csv');
  for (const directory of [imgPath, pdfPath, csvPath]) fs.mkdirSync(directory);
  let now = 1000, deadlineCallback, runtime = { flag: false, colHZ: 50, collectOptions: {}, detectedInterval: 20 };
  const events = [], stateChanges = [];
  let csvCalls = 0, serialOpens = 0, historyLoads = 0, controls;
  const policy = createLicenseAccessPolicy({ clock: { now: () => now, synchronize() {} },
    setTimer: (callback) => { deadlineCallback = callback; return { unref() {} }; }, clearTimer() {},
    onChange(access) {
      stateChanges.push(access.state);
      if (access.state === 'expired') {
        events.push('expiry-callback');
        controls.updateCollectionControl({ flag: false });
        events.push('expiry-stopped');
      }
    } });
  t.after(() => policy.dispose());
  /** Preserve actual runtime mutations so refused commands cannot silently start acquisition. */
  const setRuntime = (patch) => { runtime = { ...runtime, ...patch }; if (patch.flag !== undefined) events.push(`flag:${patch.flag}`); };
  controls = createRuntimeControlService({ getRuntime: () => runtime, setRuntime, requireAccess: policy.requireAccess,
    getCollectionSource: () => ({ connected: true, ready: true, playback: false }),
    resetCollectionStorageClock: () => events.push('reset-clock'),
    flushCollectionInsertQueues: () => events.push('flush-tail'), onCollectionStopping: () => events.push('close-admission'),
    startPlaybackTimer: () => events.push('playback-start'), stopPlaybackTimer: () => events.push('playback-stop'),
    csvDownloadService: { exportHistoryCsv() { csvCalls += 1; fs.writeFileSync(path.join(csvPath, 'unexpected.csv'), 'must not export'); } } });
  const router = createControlCommandRouter();
  registerSerialControlHandlers(router, { getRuntime: () => runtime, setRuntime, requireAccess: policy.requireAccess,
    loadSelectedHistory: () => { historyLoads += 1; return { length: 6 }; },
    openSitSerialPort: () => { serialOpens += 1; }, stopPlaybackTimer() {} });
  router.register({ name: 'fixture-collection', when: (message) => message.flag != null,
    handle: (message) => controls.updateCollectionControl(message) });
  router.register({ name: 'fixture-export', when: (message) => message.download != null,
    handle: (message) => controls.exportHistoryCsv(message) });
  router.register({ name: 'fixture-playback', when: (message) => message.play != null,
    handle: (message) => controls.updateHistoryPlayback(message) });
  const records = createAlgorithmRecordService({ getContext: () => ({ systemId: 'fixture',
    allowed: policy.read().canAcquire, historyAllowed: policy.read().canAnalyzeHistory }), getDatabases: () => ({ sit: db }) });
  const app = createHttpApp({ algorithmRecordService: records, requireAccess: policy.requireAccess, getLicenseAccess: policy.read,
    getCollectionStatus: () => ({ phase: runtime.flag ? 'collecting' : 'completed', result: runtime.flag ? 'pending' : 'saved', channels: {} }),
    controlCommandService: createControlCommandService({ commandRouter: router }), imgPath, pdfPath,
    serialManager: { getStatus: () => [] }, getRealtimeChannels: () => [], listPorts: async () => [], getPort: (value) => value,
    logger: { error() {}, warn() {}, info() {} } });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let requestId = 0;
  /** Exercise the real JSON parser, contract normalization, router and HTTP status boundary. */
  const command = (type, payload) => fetch(`${base}/api/commands`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload, requestId: `fixture-${++requestId}` }) });
  /** Read only local HTTP history endpoints used by the real selected-data analysis service. */
  const request = async (route, { body } = {}) => {
    const result = await fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const value = await result.json();
    assert.equal(result.status, 200, JSON.stringify(value));
    return value;
  };
  policy.update({ ok: true, expiresAt: 3000, licenseExpiresAt: 3000, historyAllowed: true });
  assert.equal((await command('collection.control', { active: true })).status, 200);
  assert.equal(runtime.flag, true);
  assert.equal(typeof deadlineCallback, 'function');
  events.length = 0; now = 3000; deadlineCallback();
  assert.deepEqual(events, ['expiry-callback', 'close-admission', 'flush-tail', 'flag:false', 'expiry-stopped']);
  assert.equal(runtime.flag, false);
  policy.check(); policy.check();
  assert.deepEqual(stateChanges, ['active', 'expired']);
  const stoppedEvents = [...events];
  const rejectedStart = await command('collection.control', { active: true });
  assert.equal(rejectedStart.status, 403);
  assert.equal((await rejectedStart.json()).data.code, 'LICENSE_EXPIRED');
  assert.deepEqual(events, stoppedEvents);
  assert.equal((await command('collection.control', { active: false })).status, 200);
  assert.equal((await command('serial.open', { role: 'sit', path: 'COM_FIXTURE' })).status, 403);
  assert.equal(serialOpens, 0);
  assert.equal((await command('history.load', { date: 'fixture-record' })).status, 200);
  assert.equal(historyLoads, 1);
  assert.equal((await command('playback.control', { play: true })).status, 200);
  assert.equal(runtime.playFlag, true);
  assert.equal((await fetch(`${base}/api/collection/status`)).status, 200);
  const catalog = await request('/api/agent-algorithms/records');
  const selection = selectHistoryRecords({ systemId: 'fixture', records: [{ id: catalog.records[0].id,
    range: { kind: 'frames', startFrame: 1, frameLimit: 2 } }] }, catalog);
  const report = await createHistoryAnalysis({ request }).analyze(selection);
  assert.equal(report.results[0].statistics.average, 1.875);
  assert.equal(report.results[0].statistics.frames, 2);
  assert.deepEqual(db.prepare('SELECT * FROM matrix ORDER BY id').all(), before);
  const csv = await command('export.csv', { date: 'fixture-record' });
  assert.equal(csv.status, 403);
  assert.equal((await csv.json()).data.code, 'LICENSE_EXPIRED');
  assert.equal(csvCalls, 0);
  const form = new FormData();
  form.set('file', new Blob([Buffer.from('synthetic fixture image')], { type: 'image/png' }), 'fixture.png');
  form.set('date', 'fixture-record');
  const pdf = await fetch(`${base}/uploadCanvas`, { method: 'POST', body: form });
  assert.equal(pdf.status, 403);
  assert.equal((await pdf.json()).code, 'LICENSE_EXPIRED');
  for (const directory of [imgPath, pdfPath, csvPath]) assert.deepEqual(fs.readdirSync(directory), []);
  policy.update({ ok: false, code: 'DEVICE_LEASE_EXPIRED', expiresAt: 2000, licenseExpiresAt: 9000, historyAllowed: false });
  assert.equal((await fetch(`${base}/api/collection/status`)).status, 403);
  assert.equal((await command('history.load', { date: 'fixture-record' })).status, 403);
  const deniedAnalysis = await fetch(`${base}/api/agent-algorithms/records`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(deniedAnalysis.status, 403);
  assert.equal((await command('collection.control', { active: false })).status, 200);
  assert.equal((await command('playback.control', { play: false })).status, 200);
  assert.equal((await command('collection.control', { active: true })).status, 403);
  assert.equal((await command('export.csv', { date: 'fixture-record' })).status, 403);
});
