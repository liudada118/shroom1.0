const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { getDeviceId } = require('../../../app/electron/deviceIdentity');
const { createDeviceAuthorization, verifyDeviceLease } = require('../../kernel/platform/license/deviceAuthorization');
const { createFrontendCache, validateRelease, safeResourcePath } = require('../../../app/update/frontendCache');
const { createUsageAnalytics, normalizeEvent, restoreEvent, scrub } = require('../../../app/electron/usageAnalytics');

test('RSA-style license uploads preserve immutable IDs and installer success requires a later version', async t => {
  const root = temporary(t), key = Buffer.from(JSON.stringify({ payload: 'fixture', signature: 'fixture' })).toString('base64');
  const batches = [], options = { root, environment: 'test', getLicenseKey: () => key, fetchImpl: async (_url, request) => {
    assert.equal(request.headers.Authorization, `License ${key}`);
    const batch = JSON.parse(request.body); batches.push(batch);
    return new Response(JSON.stringify({ accepted: true, eventIds: batch.events.map(event => event.eventId) }));
  } };
  const before = createUsageAnalytics({ ...options, appVersion: '1.1.37' });
  before.markInstallRequested('1.1.38'); await before.flush(true); await before.dispose();
  const unchanged = createUsageAnalytics({ ...options, appVersion: '1.1.37' }); await unchanged.flush(true);
  assert(batches.flatMap(batch => batch.events).some(event => event.properties.action === 'installation_not_confirmed' && event.properties.result === 'unknown'));
  unchanged.markInstallRequested('1.1.38'); await unchanged.dispose();
  const upgraded = createUsageAnalytics({ ...options, appVersion: '1.1.38' }); await upgraded.flush(true); await upgraded.dispose();
  assert(batches.flatMap(batch => batch.events).some(event => event.properties.action === 'installation_verified' && event.properties.result === 'success'));
  assert(!JSON.stringify(batches).includes(key));
});

/** Allocate a temporary test root and remove only that exact directory after the test. */
function temporary(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-services-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }
/** Sign a fixture with an ephemeral test-only key. */
function signed(payload, privateKey, field) { return { [field]: payload, signature: crypto.sign(null, Buffer.from(JSON.stringify(payload)), privateKey).toString('base64') }; }

test('computer identity survives upgrades and local fallback restarts', t => {
  const root = temporary(t);
  assert.equal(getDeviceId(root, { readSystem: () => 'ComputerA' }), getDeviceId(root, { readSystem: () => 'computera' }));
  assert.notEqual(getDeviceId(root, { readSystem: () => 'ComputerA' }), getDeviceId(root, { readSystem: () => 'ComputerB' }));
  assert.equal(getDeviceId(root, { readSystem: () => null }), getDeviceId(root, { readSystem: () => null }));
});

test('usage reporting defaults on and preserves an explicit opt-out after restart', async t => {
  const root = temporary(t), options = { root, appVersion: '1.1.37', environment: 'test', getLicenseKey: () => 'ab'.repeat(64),
    fetchImpl: async () => { throw new Error('synthetic offline'); } };
  const first = createUsageAnalytics(options);
  assert.equal(first.status().enabled, true);
  assert.equal(first.status().queued, 1);
  await first.setEnabled(false); await first.dispose();
  const restarted = createUsageAnalytics(options);
  assert.equal(restarted.status().enabled, false);
  assert.equal(restarted.record({ eventName: 'collection_started', properties: {} }), false);
  assert.equal(restarted.status().queued, 0);
  await restarted.dispose();
  fs.writeFileSync(path.join(root, 'usage-analytics/settings.json'), '{broken');
  const corrupted = createUsageAnalytics(options);
  assert.equal(corrupted.status().enabled, false, 'unreadable preferences must not silently reverse an opt-out');
  await corrupted.dispose();
});

test('device allowance rejects copied caches, wrong keys, expiry and tampering', async t => {
  const root = temporary(t), { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const key = 'ab'.repeat(64), deviceId = 'c'.repeat(64), now = Date.now();
  const envelope = signed({ schemaVersion: 1, keyHash: crypto.createHash('sha256').update(key).digest('hex'), deviceId,
    issuedAt: now, expiresAt: now + 60000, deviceLimit: 1 }, privateKey, 'lease');
  assert.equal(verifyDeviceLease(envelope, key, deviceId, now, publicKey), true);
  assert.equal(verifyDeviceLease(envelope, key, 'd'.repeat(64), now, publicKey), false);
  assert.equal(verifyDeviceLease(envelope, 'cd'.repeat(64), deviceId, now, publicKey), false);
  assert.equal(verifyDeviceLease(envelope, key, deviceId, now + 60001, publicKey), false);
  let online = true;
  const service = createDeviceAuthorization({ root, deviceId, publicKey, now: () => now, fetchImpl: async () => {
    if (!online) throw new Error('offline');
    return new Response(JSON.stringify({ valid: true, time: now, expireTimestamp: now + 86400000, deviceLimit: 1, deviceLease: envelope }));
  } });
  assert.equal((await service.authorize(key, { endDate: now + 86400000 })).ok, true);
  online = false;
  assert.equal((await service.authorize(key, { endDate: now + 86400000 })).offline, true);
  const other = createDeviceAuthorization({ root, deviceId: 'd'.repeat(64), publicKey, now: () => now, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal((await other.authorize(key, { endDate: now + 86400000 })).ok, false);
});

test('a device denial remains denied offline', async t => {
  const root = temporary(t), key = 'ab'.repeat(64); let online = true;
  const service = createDeviceAuthorization({ root, deviceId: 'c'.repeat(64), fetchImpl: async () => {
    if (!online) throw new Error('offline');
    return new Response(JSON.stringify({ valid: false, time: Date.now(), status: 'DEVICE_LIMIT_REACHED', reason: 'limit', deviceLimit: 1 }));
  } });
  assert.equal((await service.authorize(key, { endDate: Date.now() + 86400000 })).ok, false);
  online = false;
  assert.equal((await service.authorize(key, { endDate: Date.now() + 86400000 })).ok, false);
});

test('unlimited online keys also require a signed cached allowance', async t => {
  const root = temporary(t), key = 'ab'.repeat(64), deviceId = 'c'.repeat(64), now = Date.now();
  const service = createDeviceAuthorization({ root, deviceId, now: () => now, fetchImpl: async () => new Response(JSON.stringify({ valid: true, time: now, expireTimestamp: now + 86400000, deviceLimit: 0 })) });
  assert.equal((await service.authorize(key, { endDate: now + 86400000 })).ok, false);
  const file = path.join(root, 'license-devices', `${crypto.createHash('sha256').update(key).digest('hex')}.json`);
  fs.writeFileSync(file, JSON.stringify({ ok: true, keyHash: crypto.createHash('sha256').update(key).digest('hex'), deviceId, deviceLimit: 0, expiresAt: now + 86400000 }));
  const offline = createDeviceAuthorization({ root, deviceId, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal((await offline.authorize(key, { endDate: now + 86400000 })).ok, false);
});

test('legacy unregistered keys and outdated servers explain missing allowances without bypassing validation', async t => {
  const root = temporary(t), key = 'ab'.repeat(64), deviceId = 'c'.repeat(64), now = Date.now();
  let online = true, status = 'UNKNOWN', signature;
  const service = createDeviceAuthorization({ root, deviceId, now: () => now, fetchImpl: async () => {
    if (!online) throw new Error('offline');
    return new Response(JSON.stringify({ valid: true, time: now, status, expireTimestamp: now + 86400000, deviceLimit: 0, deviceLease: signature }));
  } });
  const legacy = await service.authorize(key, { endDate: now + 86400000 });
  assert.equal(legacy.ok, false);
  assert.equal(legacy.code, 'LICENSE_NOT_REGISTERED');
  assert.match(legacy.message, /补录原密钥/);
  online = false;
  assert.equal((await service.authorize(key, { endDate: now + 86400000 })).ok, false);
  online = true; status = 'ACTIVATED';
  assert.equal((await service.authorize(key, { endDate: now + 86400000 })).code, 'LICENSE_SERVER_UPGRADE_REQUIRED');
  const pair = crypto.generateKeyPairSync('ed25519');
  signature = signed({ schemaVersion: 1, keyHash: crypto.createHash('sha256').update(key).digest('hex'), deviceId,
    issuedAt: now, expiresAt: now + 60000, deviceLimit: 0 }, pair.privateKey, 'lease');
  assert.equal((await service.authorize(key, { endDate: now + 86400000 })).code, 'DEVICE_LEASE_INVALID', 'a real signature mismatch remains rejected');
});

test('frontend updates are staged, complete, signed and recover after a failed boot', async t => {
  const root = temporary(t), shipped = path.join(root, 'shipped'); fs.mkdirSync(shipped);
  fs.writeFileSync(path.join(shipped, 'frontend-build.json'), JSON.stringify({ schemaVersion: 1, buildId: 1, appVersion: '1.1.37' }));
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const content = { 'index.html': '<div id="root"></div><script type="module" src="/main.js"></script>', 'main.js': 'window.ready=true;' };
  const manifest = { schemaVersion: 1, hostContract: 1, releaseId: 2, buildId: 2, minAppVersion: '1.1.37', files: Object.entries(content).map(([name, value]) => ({ path: name,
    size: Buffer.byteLength(value), sha256: crypto.createHash('sha256').update(value).digest('hex') })) };
  const envelope = signed(manifest, privateKey, 'manifest');
  const options = { root, publicKey, appVersion: '1.1.37', endpoint: 'http://localhost/api/frontend/latest', fetchImpl: async url =>
    new Response(url.endsWith('/latest') ? JSON.stringify(envelope) : content[url.endsWith('/main.js') ? 'main.js' : 'index.html']) };
  const first = createFrontendCache(options);
  assert.equal(first.selectRoot(shipped), shipped);
  await first.check();
  assert.equal(first.selectRoot(shipped), shipped, 'a running page must not change');
  const candidate = createFrontendCache(options);
  assert.notEqual(candidate.selectRoot(shipped), shipped);
  assert.equal(candidate.status().appVersion, '1.1.37');
  assert.equal(candidate.status().hostContract, 1);
  assert.equal(candidate.status().activeBuildId, 2);
  assert.equal(candidate.status().packagedBuildId, 1);
  assert.equal(candidate.status().source, 'cache');
  assert.equal(candidate.status().bootPending, true);
  assert.equal(candidate.rollback(shipped), true);
  assert.equal(candidate.selectRoot(shipped), shipped);
  assert.equal(candidate.status().source, 'packaged');
  assert.equal(candidate.status().activeBuildId, 1);
  assert.equal(candidate.status().lastRollbackReason, 'FRONTEND_BOOT_FAILED');
  assert.ok(candidate.status().lastRollbackAt);
  first.dispose(); candidate.dispose();
  assert.equal(safeResourcePath('../secret'), false);
  assert.equal(safeResourcePath('assets/CON.js'), false);
  assert.throws(() => validateRelease({ ...envelope, manifest: { ...manifest, minAppVersion: '2.0.0' } }, '1.1.37', publicKey));
  assert.throws(() => validateRelease({ ...envelope, signature: 'invalid' }, '1.1.37', publicKey));
});

/** Build signed releases with controllable network failures and real local resources. */
function frontendFixture(t) {
  const root = temporary(t), shipped = path.join(root, 'shipped'), { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(path.join(shipped, 'assets'), { recursive: true });
  const requests = [], notices = []; let release, content, offline = false;
  fs.writeFileSync(path.join(shipped, 'assets/vendor.js'), 'window.vendor=true;');
  fs.writeFileSync(path.join(shipped, 'index.html'), '<div>shipped</div>');
  /** Simulate a newly built installer, even when its displayed version number is unchanged. */
  function installer(buildId, appVersion = '1.1.37') {
    fs.writeFileSync(path.join(shipped, 'frontend-build.json'), JSON.stringify({ schemaVersion: 1, buildId, appVersion }));
  }
  installer(10);
  /** Publish an independent signed build; omitted IDs model the legacy server format. */
  function publish(id, buildId = id, extra = {}) {
    content = { 'index.html': `<div>release ${id}</div>`, 'assets/vendor.js': 'window.vendor=true;', 'assets/app.js': `window.release=${id};`, ...extra };
    const manifest = { schemaVersion: 1, hostContract: 1, releaseId: id, minAppVersion: '1.1.37',
      files: Object.entries(content).map(([name, value]) => ({ path: name, size: Buffer.byteLength(value), sha256: crypto.createHash('sha256').update(value).digest('hex') })) };
    if (buildId !== null) manifest.buildId = buildId;
    release = signed(manifest, privateKey, 'manifest');
    return release;
  }
  /** Allocate a cache process while keeping the same installer and user directory. */
  function create(appVersion = '1.1.37', fetchImpl) {
    const cache = createFrontendCache({ root, appVersion, publicKey, endpoint: 'http://localhost/api/frontend/latest',
      onStatus: notice => notices.push(notice), fetchImpl: fetchImpl || (async url => {
        requests.push(url);
        if (offline) throw new Error('offline');
        if (url.endsWith('/latest')) return new Response(JSON.stringify(release));
        const name = new URL(url).pathname.split('/').slice(5).join('/');
        return new Response(content[name], { status: Object.hasOwn(content, name) ? 200 : 404 });
      }) });
    t.after(() => cache.dispose());
    cache.selectRoot(shipped);
    return cache;
  }
  /** List only complete version directories for retention assertions. */
  function versions() { return fs.readdirSync(path.join(root, 'frontend-cache')).filter(name => /^\d+$/.test(name)).sort((a, b) => Number(a) - Number(b)); }
  return { root, shipped, requests, notices, installer, publish, create, versions, setOffline: value => { offline = value; } };
}

test('new installer webpages replace old caches and reject republished older or unstamped builds', async t => {
  const f = frontendFixture(t);
  f.publish(20); const old = f.create(); await old.check();
  const running = f.create(); running.ready(); assert.equal(running.status().activeReleaseId, 20);
  f.installer(30, '2.0.0');
  const upgraded = f.create('2.0.0'); assert.equal(upgraded.selectRoot(f.shipped), f.shipped);
  assert.deepEqual(f.versions(), []);
  f.publish(40, 20); const count = f.requests.length; await upgraded.check();
  assert.equal(upgraded.status().pendingReleaseId, null);
  assert.equal(f.requests.length - count, 1, 'an old build republished with a higher release ID must not download');
  f.publish(41, null); await upgraded.check(); assert.equal(upgraded.status().pendingReleaseId, null);
  f.publish(42); await upgraded.check(); assert.equal(upgraded.status().pendingReleaseId, 42);
});

test('same-version installer rebuilds retire old cached pages while newer caches remain usable offline', async t => {
  const f = frontendFixture(t); f.publish(20); await f.create().check(); f.create().ready();
  f.installer(15); f.setOffline(true);
  assert.equal(f.create().status().activeReleaseId, 20, 'a cache built after the installer remains newer');
  f.installer(30);
  assert.equal(f.create().selectRoot(f.shipped), f.shipped);
  assert.deepEqual(f.versions(), []);
});

test('legacy cache pointers and unavailable cache storage cannot hide the packaged page', async t => {
  const f = frontendFixture(t); f.publish(20); await f.create().check(); f.create().ready();
  const legacy = f.publish(20, null);
  fs.writeFileSync(path.join(f.root, 'frontend-cache/state.json'), JSON.stringify({ active: legacy }));
  assert.equal(f.create().selectRoot(f.shipped), f.shipped); assert.deepEqual(f.versions(), []);
  fs.rmSync(path.join(f.root, 'frontend-cache/state.json')); fs.mkdirSync(path.join(f.root, 'frontend-cache/state.json'));
  assert.equal(f.create().selectRoot(f.shipped), f.shipped, 'cache write failures must not prevent the installer webpage from starting');
});

test('unchanged and renamed resources reuse verified local bytes and only changed files are downloaded', async t => {
  const f = frontendFixture(t); f.publish(20); await f.create().check(); const active = f.create(); active.ready();
  f.requests.length = 0;
  f.publish(21, 21, { 'assets/renamed-vendor.js': 'window.vendor=true;' }); await active.check();
  const downloads = f.requests.filter(url => !url.endsWith('/latest'));
  assert.equal(downloads.length, 2); assert.ok(downloads.every(url => !url.includes('vendor')));
  const cached = path.join(f.root, 'frontend-cache');
  assert.equal(fs.readFileSync(path.join(cached, '21/assets/renamed-vendor.js'), 'utf8'), 'window.vendor=true;');
  assert.ok(f.notices.some(notice => notice.type === 'web-update-ready' && notice.reusedBytes === 2 * Buffer.byteLength('window.vendor=true;')));
  assert.equal(fs.statSync(path.join(cached, '20/assets/vendor.js')).ino, fs.statSync(path.join(cached, '21/assets/vendor.js')).ino, 'same-volume immutable files share disk blocks');
});

test('old release directories are bounded while active, previous and pending releases survive cleanup', async t => {
  const f = frontendFixture(t); let active = f.create();
  for (let id = 20; id <= 24; id++) {
    f.publish(id); await active.check(); active.dispose(); active = f.create(); active.ready();
    assert.ok(f.versions().length <= 2);
  }
  assert.deepEqual(f.versions(), ['23', '24']);
  f.publish(25); await active.check(); assert.deepEqual(f.versions(), ['23', '24', '25']);
  fs.mkdirSync(path.join(f.root, 'frontend-cache', '.download-00000000-0000-0000-0000-000000000000'));
  fs.mkdirSync(path.join(f.root, 'collection-data')); fs.writeFileSync(path.join(f.root, 'collection-data/record.db'), 'keep');
  const next = f.create(); next.ready(); assert.deepEqual(f.versions(), ['24', '25']);
  assert.equal(fs.existsSync(path.join(f.root, 'frontend-cache', '.download-00000000-0000-0000-0000-000000000000')), false);
  assert.equal(fs.readFileSync(path.join(f.root, 'collection-data/record.db'), 'utf8'), 'keep');
});

test('startup confirmation during a download preserves staging and the newer pending release', async t => {
  const f = frontendFixture(t); f.publish(20); await f.create().check();
  const envelope = f.publish(21); let started, finish;
  const entered = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { finish = resolve; });
  const booting = f.create(undefined, async url => {
    if (url.endsWith('/latest')) return new Response(JSON.stringify(envelope));
    if (url.endsWith('/index.html')) { started(); await gate; return new Response('<div>release 21</div>'); }
    return new Response('window.release=21;');
  });
  const checking = booting.check(); await entered;
  booting.ready(); finish(); await checking;
  assert.equal(booting.status().activeReleaseId, 20); assert.equal(booting.status().pendingReleaseId, 21);
  const next = f.create(); next.ready(); assert.equal(next.status().activeReleaseId, 21);
  assert.deepEqual(f.versions(), ['20', '21']);
});

test('failed candidate boots and corrupt active pages fall back to retained verified code', async t => {
  const f = frontendFixture(t); f.publish(20); await f.create().check(); let active = f.create(); active.ready();
  f.publish(21); await active.check(); active = f.create(); active.ready();
  f.publish(22); await active.check(); const failed = f.create(); assert.equal(failed.status().activeReleaseId, 22); failed.dispose();
  const recovered = f.create(); assert.equal(recovered.status().activeReleaseId, 21);
  await recovered.check(); assert.equal(recovered.status().pendingReleaseId, null, 'the same failed release is not staged again');
  assert.equal(recovered.status().lastErrorCode, 'FRONTEND_RELEASE_PREVIOUSLY_FAILED', 'a rejected latest release must not be reported as already current');
  fs.writeFileSync(path.join(f.root, 'frontend-cache/21/assets/app.js'), 'broken');
  const previous = f.create(); assert.equal(previous.status().activeReleaseId, 20);
  f.setOffline(true); await previous.check(); assert.equal(previous.status().activeReleaseId, 20);
});

test('tampered reusable files are fetched again and interrupted downloads leave no pending release', async t => {
  const f = frontendFixture(t); f.publish(20); await f.create().check(); const active = f.create(); active.ready();
  fs.writeFileSync(path.join(f.root, 'frontend-cache/20/assets/vendor.js'), 'bad');
  assert.equal(fs.readFileSync(path.join(f.shipped, 'assets/vendor.js'), 'utf8'), 'window.vendor=true;', 'writable cache files never share blocks with the installer fallback');
  fs.writeFileSync(path.join(f.shipped, 'assets/vendor.js'), 'bad');
  f.publish(21); f.requests.length = 0; await active.check();
  assert.ok(f.requests.some(url => url.endsWith('/assets/vendor.js')));
  assert.equal(fs.readFileSync(path.join(f.root, 'frontend-cache/21/assets/vendor.js'), 'utf8'), 'window.vendor=true;');
  f.publish(22);
  const interrupted = f.create(undefined, async url => {
    if (url.endsWith('/latest')) return new Response(JSON.stringify(f.publish(22)));
    throw new Error('synthetic interrupted connection');
  });
  interrupted.ready(); await interrupted.check(); assert.equal(interrupted.status().pendingReleaseId, null);
  assert.equal(fs.readdirSync(path.join(f.root, 'frontend-cache')).some(name => name.startsWith('.download-')), false);
});

test('unpublished webpage releases remain local and keep an actionable diagnosis across restarts', async t => {
  const f = frontendFixture(t), cache = f.create(undefined, async () => new Response(JSON.stringify({ error: 'FRONTEND_RELEASE_UNAVAILABLE' }), { status: 503 }));
  await cache.check();
  const status = cache.status();
  assert.equal(status.source, 'packaged'); assert.equal(status.pendingReleaseId, null);
  assert.equal(status.lastErrorCode, 'FRONTEND_RELEASE_UNAVAILABLE'); assert.equal(status.lastCheckResult, 'unavailable');
  assert.match(status.lastMessage, /管理员完成网页发布/); assert.ok(Number.isFinite(Date.parse(status.lastCheckedAt)));
  assert.equal(f.create().status().lastErrorCode, 'FRONTEND_RELEASE_UNAVAILABLE');
  assert.ok(f.notices.some(notice => notice.errorCode === 'FRONTEND_RELEASE_UNAVAILABLE'));
});

test('signed incompatible webpages request a full installer without downloading or accepting forged compatibility hints', async t => {
  const f = frontendFixture(t), keyPair = crypto.generateKeyPairSync('ed25519');
  const manifest = { ...f.publish(20).manifest, minAppVersion: '2.0.0' };
  const incompatible = signed(manifest, keyPair.privateKey, 'manifest');
  const root = path.join(f.root, 'isolated-host'); let downloads = 0;
  const cache = createFrontendCache({ root, appVersion: '1.1.37', publicKey: keyPair.publicKey,
    fetchImpl: async () => { downloads++; return new Response(JSON.stringify(incompatible)); } });
  t.after(() => cache.dispose()); cache.selectRoot(f.shipped); await cache.check();
  assert.equal(downloads, 1); assert.equal(cache.status().lastErrorCode, 'FRONTEND_HOST_UPDATE_REQUIRED');
  assert.equal(cache.status().pendingReleaseId, null); assert.match(cache.status().lastMessage, /更新完整安装包/);
  incompatible.signature = 'invalid'; await cache.check();
  assert.equal(cache.status().lastErrorCode, 'FRONTEND_RELEASE_INVALID', 'unsigned metadata cannot supply an installer-upgrade instruction');
});

test('missing packaged build stamps and HTML update responses explain why updates cannot be staged', async t => {
  const f = frontendFixture(t); fs.rmSync(path.join(f.shipped, 'frontend-build.json'));
  const unstamped = f.create(undefined, async () => assert.fail('an unstamped installer must not load remote code'));
  await unstamped.check(); assert.equal(unstamped.status().lastErrorCode, 'FRONTEND_PACKAGED_BUILD_MISSING');
  f.installer(10);
  const html = f.create(undefined, async () => new Response('<!doctype html><title>Fallback</title>'));
  await html.check(); assert.equal(html.status().lastErrorCode, 'FRONTEND_RESPONSE_INVALID');
  assert.equal(html.status().pendingReleaseId, null); assert.equal(html.selectRoot(f.shipped), f.shipped);
});

test('usage events omit credentials, raw frames, unknown fields and customer system names', () => {
  const identity = { installationId: crypto.randomUUID(), sessionId: crypto.randomUUID(), appVersion: '1.1.37', environment: 'test', scope: 'scope' };
  const event = normalizeEvent({ eventName: 'system_entered', properties: { systemType: 'customer-seat', systemOrigin: 'custom' } }, identity);
  assert.match(event.properties.systemType, /^custom\.[a-f0-9]{16}$/);
  assert.throws(() => normalizeEvent({ eventName: 'system_entered', properties: { rawData: [1, 2] } }, identity));
  assert.throws(() => normalizeEvent({ eventName: 'system_entered', properties: { message: 'chat' } }, identity));
  assert.equal(scrub('Bearer secret-key user@example.com C:\\private\\file.txt').includes('secret-key'), false);
  assert.equal(restoreEvent(event, identity.installationId, []).eventId, event.eventId);
  assert.throws(() => restoreEvent({ ...event, rawFrames: [1, 2] }, identity.installationId, []));
  assert.throws(() => restoreEvent({ ...event, properties: { rawData: [1, 2] } }, identity.installationId, []));
});

test('runtime version snapshots remain bounded and unchanged on a durable retry', async t => {
  const root = temporary(t), sent = [];
  const options = { root, appVersion: '1.1.37', environment: 'test', getLicenseKey: () => 'ab'.repeat(64),
    getRuntimeVersions: () => ({ frontendReleaseId: 7, frontendBuildId: 20, hostContract: 1, systemPackageVersion: '3', serverContractVersion: '1.3', secretPath: 'C:/private', rawFrames: [1, 2] }),
    fetchImpl: async (_url, input) => { sent.push(JSON.parse(input.body)); return new Response('{}', { status: 503 }); } };
  const first = createUsageAnalytics(options);
  await first.flush(true); await first.dispose();
  const second = createUsageAnalytics({ ...options, getRuntimeVersions: () => ({ frontendBuildId: 21 }) });
  await second.flush(true); await second.dispose();
  const original = sent[0].events[0], retried = sent[1].events.find(event => event.eventId === original.eventId);
  assert.deepEqual(original.runtimeVersions, { frontendReleaseId: 7, frontendBuildId: 20, hostContract: 1, systemPackageVersion: '3', serverContractVersion: '1.3' });
  assert.deepEqual(retried.runtimeVersions, original.runtimeVersions);
  assert.ok(!JSON.stringify(sent).includes('C:/private'));
});

test('acknowledging diagnostic scope preserves an explicit opt-out across restarts', async t => {
  const options = { root: temporary(t), appVersion: '1.1.37', environment: 'test', getLicenseKey: () => '', fetchImpl: () => { assert.fail('no upload expected'); } };
  const first = createUsageAnalytics(options);
  assert.equal(first.status().noticePending, true);
  await first.setEnabled(false); await first.acknowledgeNotice(); await first.dispose();
  const second = createUsageAnalytics(options);
  assert.equal(second.status().enabled, false);
  assert.equal(second.status().noticePending, false);
  await second.dispose();
});

test('desktop diagnostics combine real running versions and wake checks run without a renderer', async () => {
  const { runtimeVersionSnapshot, checkLicenseOnWake } = require('../../../app/electron/runtimeDiagnostics');
  const runtime = { getRuntimeStatus: () => ({ runtimeVersions: { systemPackageVersion: '4', serverContractVersion: '1', privatePath: 'C:/private' } }) };
  const frontend = { status: () => ({ activeReleaseId: 9, activeBuildId: 21, hostContract: 1, pendingReleaseId: 10 }) };
  assert.deepEqual(runtimeVersionSnapshot(runtime, frontend), { frontendReleaseId: 9, frontendBuildId: 21, hostContract: 1, systemPackageVersion: '4', serverContractVersion: '1' });
  assert.deepEqual(runtimeVersionSnapshot({ getRuntimeStatus: () => { throw new Error('booting'); } }, frontend), { frontendReleaseId: 9, frontendBuildId: 21, hostContract: 1 });
  let checked = false; const errors = [];
  const checking = checkLicenseOnWake({ checkLicenseAccess: () => { checked = true; } });
  assert.equal(checked, true, 'expiry is checked synchronously at resume, not after reconnect');
  await checking;
  await checkLicenseOnWake({ checkLicenseAccess: () => Promise.reject(new Error('fixture unavailable')) }, error => errors.push(error.message));
  assert.deepEqual(errors, ['fixture unavailable']);
});

test('repeated errors are aggregated without changing acknowledged event IDs', async t => {
  const root = temporary(t), uploads = [], key = 'ab'.repeat(64);
  const options = { root, appVersion: '1.1.37', environment: 'test', getLicenseKey: () => key, defaultEnabled: true,
    fetchImpl: async (_url, request) => {
      const body = JSON.parse(request.body); uploads.push(body.events);
      return new Response(JSON.stringify({ accepted: true, eventIds: body.events.map(event => event.eventId) }));
    } };
  const service = createUsageAnalytics(options), error = { eventName: 'error_reported', properties: { module: 'backend', message: 'synthetic failure' } };
  for (let i = 0; i < 100; i++) service.record(error);
  assert.equal(service.status().queued, 2);
  await service.flush(true); await service.dispose();
  const restarted = createUsageAnalytics(options); await restarted.flush(true);
  const reports = uploads.flat().filter(event => event.eventName === 'error_reported');
  assert.equal(reports.length, 2);
  assert.notEqual(reports[0].eventId, reports[1].eventId);
  assert.equal(reports[1].properties.count, 99);
  await restarted.setEnabled(false); await restarted.dispose();
});

test('usage queues retry the same event IDs and cannot cross a changed license', async t => {
  const root = temporary(t); let key = 'ab'.repeat(64), online = false; const uploads = [];
  const service = createUsageAnalytics({ root, appVersion: '1.1.37', environment: 'test', getLicenseKey: () => key, defaultEnabled: true,
    fetchImpl: async (_url, options) => {
      if (!online) throw new Error('offline');
      const body = JSON.parse(options.body); uploads.push({ key: options.headers.Authorization, body });
      return new Response(JSON.stringify({ accepted: true, eventIds: body.events.map(event => event.eventId) }));
    } });
  await service.flush(true);
  assert.ok(service.status().queued > 0);
  key = 'cd'.repeat(64); service.record({ eventName: 'export_result', properties: { format: 'csv', result: 'success' } });
  online = true; await service.flush(true);
  assert.equal(uploads[0].key, `License ${key}`);
  assert.deepEqual(uploads[0].body.events.map(event => event.eventName), ['export_result']);
  key = 'ab'.repeat(64); service.record({ eventName: 'collection_started', properties: {} }); await service.flush(true);
  assert.ok(uploads[1].body.events.some(event => event.eventName === 'app_session_started'));
  await service.setEnabled(false); assert.equal(service.status().queued, 0); await service.dispose();
});
