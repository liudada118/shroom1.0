const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash, generateKeyPairSync, sign } = require('node:crypto');
const { createManagedSystemSync, verifyCatalog } = require('../../extension-host/workspace/managedSystemSync');

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

test('a signed customer catalog is bound to the current key and expires', () => {
  const f = fixture();
  assert.equal(verifyCatalog(f.envelope, f.key, Date.now(), f.keys.publicKey).systems[0].systemId, 'seatpad');
  assert.throws(() => verifyCatalog(f.envelope, 'other', Date.now(), f.keys.publicKey), { code: 'SYSTEM_CATALOG_INVALID' });
  assert.throws(() => verifyCatalog(f.envelope, f.key, Date.now() + 3600001, f.keys.publicKey), { code: 'SYSTEM_CATALOG_INVALID' });
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
