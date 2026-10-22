const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash, generateKeyPairSync, sign } = require('node:crypto');
const { createManagedSystemSync, verifyCatalog, verifyServerDocument } = require('../../extension-host/workspace/managedSystemSync');

/** Sign a synthetic entitlement with a test-only key, never the production signing key. */
function fixture() {
  const keys = generateKeyPairSync('ed25519');
  const key = 'a'.repeat(64);
  const sha256 = 'b'.repeat(64);
  const packageSignature = sign(null, Buffer.from(sha256, 'hex'), keys.privateKey).toString('base64');
  const catalog = { issuedAt: Date.now(), expiresAt: Date.now() + 3600000,
    keyHash: createHash('sha256').update(key).digest('hex'),
    systems: [{ systemId: 'seatpad', name: '坐垫', version: 9, sha256, signature: packageSignature }] };
  const envelope = { catalog, signature: sign(null, Buffer.from(JSON.stringify(catalog)), keys.privateKey).toString('base64') };
  return { key, sha256, keys, envelope, packageSignature };
}

/** Make a signed per-version status with only fixture identities. */
function installedGrant(f, mode = 'stop-distribution') {
  const grant = { schemaVersion: 1, type: 'installed-system-status', issuedAt: Date.now(), expiresAt: Date.now() + 60000,
    keyHash: createHash('sha256').update(f.key).digest('hex'), systems: [{ id: 'seatpad', version: 9,
      sha256: f.sha256, status: 'revoked', withdrawal: { schemaVersion: 1, mode, effectiveAt: Date.now(), reason: '' } }] };
  return { grant, signature: sign(null, Buffer.from(JSON.stringify(grant)), f.keys.privateKey).toString('base64') };
}

test('installed withdrawal is signed, exact-version and key bound; distribution-only keeps local use', async t => {
  const f = fixture();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-withdrawal-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'managed-display-systems', 'seatpad');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'package-info.json'), JSON.stringify({ systemId: 'seatpad', version: 9, sha256: f.sha256 }));
  let envelope = installedGrant(f);
  const catalog = { ...f.envelope.catalog, systems: [] };
  const emptyCatalog = { catalog, signature: sign(null, Buffer.from(JSON.stringify(catalog)), f.keys.privateKey).toString('base64') };
  const sync = createManagedSystemSync({ root, getLicenseKey: () => f.key, publicKey: f.keys.publicKey, installPackage() { assert.fail('withdrawn releases cannot download'); },
    fetchImpl: async (url, options) => {
      if (String(url).includes('installed-status')) {
        assert.deepEqual(JSON.parse(options.body), { systems: [{ id: 'seatpad', version: 9 }] });
        return { ok: true, json: async () => envelope };
      }
      return { ok: true, json: async () => emptyCatalog };
    } });
  await sync.sync();
  assert.equal(sync.isAllowed('seatpad'), true);
  assert.equal(sync.status().available[0].version, 9);
  envelope = installedGrant(f, 'stop-new-acquisition');
  await sync.sync();
  assert.equal(sync.isAllowed('seatpad'), false);
  assert.equal(sync.status().available.length, 0);
  assert.throws(() => verifyServerDocument(envelope, 'grant', 'wrong-key', Date.now(), f.keys.publicKey));
  assert.throws(() => verifyServerDocument(envelope, 'grant', f.key, Date.now() + 60001, f.keys.publicKey));
  const tampered = structuredClone(envelope);
  tampered.grant.systems[0].withdrawal.mode = 'stop-distribution';
  assert.throws(() => verifyServerDocument(tampered, 'grant', f.key, Date.now(), f.keys.publicKey));
  fs.writeFileSync(path.join(directory, 'package-info.json'), JSON.stringify({ systemId: 'seatpad', version: 10, sha256: f.sha256 }));
  assert.equal(sync.isAllowed('seatpad'), false, 'a status for version 9 cannot grant version 10');
});

test('a signed customer catalog is bound to the current key and expires', () => {
  const f = fixture();
  assert.equal(verifyCatalog(f.envelope, f.key, Date.now(), f.keys.publicKey).systems[0].systemId, 'seatpad');
  assert.throws(() => verifyCatalog(f.envelope, 'other', Date.now(), f.keys.publicKey), { code: 'SYSTEM_CATALOG_INVALID' });
  assert.throws(() => verifyCatalog(f.envelope, f.key, Date.now() + 3600001, f.keys.publicKey), { code: 'SYSTEM_CATALOG_INVALID' });
});

test('package authorization denial clears previously cached rights before later status requests', async t => {
  const f = fixture(), root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-package-denial-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'managed-display-systems', 'seatpad');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'package-info.json'), JSON.stringify({ systemId: 'seatpad', version: 8, sha256: f.sha256 }));
  const old = installedGrant(f);
  old.grant.systems[0].version = 8;
  old.grant.systems[0].status = 'published';
  old.grant.systems[0].withdrawal = null;
  old.signature = sign(null, Buffer.from(JSON.stringify(old.grant)), f.keys.privateKey).toString('base64');
  fs.writeFileSync(path.join(root, 'managed-installed-status.json'), JSON.stringify(old));
  const sync = createManagedSystemSync({ root, getLicenseKey: () => f.key, publicKey: f.keys.publicKey, installPackage() {},
    fetchImpl: async url => String(url).includes('/catalog') ? { ok: true, json: async () => f.envelope }
      : { ok: false, status: String(url).includes('/packages/') ? 403 : 503 } });
  assert.equal(sync.isAllowed('seatpad'), true);
  await assert.rejects(sync.sync(), error => error.httpStatus === 403);
  assert.equal(sync.isAllowed('seatpad'), false);
});

test('partial refresh preserves a new stop decision; explicit denial and old protocol invalidate cached grants', async t => {
  const f = fixture(), root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-withdrawal-batches-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (let index = 0; index < 33; index++) {
    const id = `seatpad${String(index).padStart(2, '0')}`, directory = path.join(root, 'managed-display-systems', id);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'package-info.json'), JSON.stringify({ systemId: id, version: 9, sha256: f.sha256 }));
  }
  const catalog = { ...f.envelope.catalog, systems: [] };
  const catalogEnvelope = { catalog, signature: sign(null, Buffer.from(JSON.stringify(catalog)), f.keys.privateKey).toString('base64') };
  let mode = 'initial', calls = 0;
  const sync = createManagedSystemSync({ root, getLicenseKey: () => f.key, publicKey: f.keys.publicKey, installPackage() {},
    fetchImpl: async (url, options) => {
      const isStatus = String(url).includes('installed-status');
      if (mode === 'denied' && String(url).includes('/catalog')) return { ok: false, status: 403 };
      if (!isStatus) return { ok: true, json: async () => catalogEnvelope };
      calls++;
      if (mode === 'old') return { ok: false, status: 404 };
      if (mode === 'partial' && calls % 2 === 0) return { ok: false, status: 503 };
      const items = JSON.parse(options.body).systems;
      const grant = { ...installedGrant(f).grant, systems: items.map(item => ({ ...item, sha256: f.sha256,
        status: mode === 'partial' ? 'revoked' : 'published',
        withdrawal: mode === 'partial' ? { schemaVersion: 1, mode: 'stop-new-acquisition' } : null })) };
      return { ok: true, json: async () => ({ grant, signature: sign(null, Buffer.from(JSON.stringify(grant)), f.keys.privateKey).toString('base64') }) };
    } });
  await sync.sync();
  assert.equal(sync.isAllowed('seatpad00'), true);
  mode = 'partial'; calls = 0;
  await sync.sync();
  assert.equal(sync.isAllowed('seatpad00'), false, 'a later 503 cannot erase a verified stop decision');
  assert.equal(sync.isAllowed('seatpad32'), true, 'only still-valid prior signatures survive transient failure');
  mode = 'old';
  await sync.sync();
  assert.equal(sync.isAllowed('seatpad32'), false, '404 falls back to the current catalog, not stale installed grants');
  mode = 'initial';
  await sync.sync();
  mode = 'denied';
  await assert.rejects(sync.sync());
  assert.equal(sync.isAllowed('seatpad00'), false, 'explicit authorization denial clears every grant cache');
});

test('sync installs only a package matching the signed catalog and keeps a cached grant', async (t) => {
  const f = fixture();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-managed-sync-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const installed = [];
  const fetchImpl = async (url) => ({ ok: true, json: async () => String(url).includes('/catalog')
    ? f.envelope : { version: 9, signature: f.packageSignature, package: { systemId: 'seatpad', sha256: f.sha256 } } });
  const sync = createManagedSystemSync({ root, getLicenseKey: () => f.key, installPackage: (value, version) => installed.push({ value, version }),
    publicKey: f.keys.publicKey, fetchImpl });
  assert.equal(sync.isAllowed('seatpad'), false);
  const result = await sync.sync();
  assert.equal(result.errors.length, 0);
  assert.equal(installed[0].version, 9);
  assert.equal(sync.isAllowed('seatpad'), true);
  const wrongKey = createManagedSystemSync({ root, getLicenseKey: () => 'c'.repeat(64), installPackage() {}, publicKey: f.keys.publicKey, fetchImpl });
  assert.equal(wrongKey.isAllowed('seatpad'), false);
});

test('a customer rollback installs the signed older release over a newer local version', async (t) => {
  const f = fixture();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-managed-rollback-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const installedRoot = path.join(root, 'managed-display-systems', 'seatpad');
  fs.mkdirSync(installedRoot, { recursive: true });
  fs.writeFileSync(path.join(installedRoot, 'package-info.json'), JSON.stringify({
    systemId: 'seatpad', version: 12, sha256: 'c'.repeat(64),
  }));
  const versions = [];
  const sync = createManagedSystemSync({ root, getLicenseKey: () => f.key,
    installPackage: (_value, version) => versions.push(version), publicKey: f.keys.publicKey,
    fetchImpl: async (url) => ({ ok: true, json: async () => String(url).includes('/catalog')
      ? f.envelope : { version: 9, signature: f.packageSignature,
        package: { systemId: 'seatpad', sha256: f.sha256 } } }),
  });
  assert.deepEqual((await sync.sync()).errors, []);
  assert.deepEqual(versions, [9]);
});

test('sync explains an HTML site fallback instead of exposing a JSON parser error', async (t) => {
  const f = fixture();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-managed-html-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sync = createManagedSystemSync({ root, getLicenseKey: () => f.key, installPackage() {},
    publicKey: f.keys.publicKey, fetchImpl: async () => ({ ok: true, headers: { get: () => 'text/html' }, json: async () => {
      throw new SyntaxError("Unexpected token '<'");
    } }) });
  await assert.rejects(sync.sync(), { code: 'SYSTEM_SYNC_SERVICE_UNAVAILABLE' });
});

test('sync explains why an offline key cannot access the company catalog', async (t) => {
  const f = fixture();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-managed-offline-auth-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sync = createManagedSystemSync({ root, getLicenseKey: () => f.key, installPackage() {},
    publicKey: f.keys.publicKey, fetchImpl: async () => ({ ok: false, status: 403,
      headers: { get: () => 'application/json' }, json: async () => ({ error: 'LICENSE_CUSTOMER_REQUIRED' }) }) });
  await assert.rejects(sync.sync(), (error) => error.code === 'LICENSE_CUSTOMER_REQUIRED'
    && error.message.includes('未关联客户'));
});
