const assert = require('node:assert/strict');
const { test } = require('node:test');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createDeviceAuthorization } = require('../../kernel/platform/license/deviceAuthorization');
const { validateLicenseKey } = require('../../kernel/platform/license/licenseValidationService');
const { encStr, decryptStr } = require('../../kernel/platform/license/aes_ecb');
const { createLicenseAccessPolicy } = require('../../kernel/platform/license/licenseAccessPolicy');

/** Isolate authorization caches so the test cannot read or change a customer's real activation. */
function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-legacy-authorization-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('automatic old-key synchronization preserves the original key and caches an unlimited signed allowance', async t => {
  const root = temporaryRoot(t), pair = crypto.generateKeyPairSync('ed25519');
  const key = 'ab'.repeat(64), deviceId = 'c'.repeat(64), now = Date.now();
  let compatibleServer = false, offline = false;
  const lease = { schemaVersion: 1, keyHash: crypto.createHash('sha256').update(key).digest('hex'), deviceId,
    issuedAt: now, expiresAt: now + 60000, deviceLimit: 0 };
  const deviceLease = { lease, signature: crypto.sign(null, Buffer.from(JSON.stringify(lease)), pair.privateKey).toString('base64') };
  /** Model an older server and automatic compatibility without an administrator registering the key. */
  const fetchImpl = async (_url, request) => {
    assert.equal(JSON.parse(request.body).key, key, 'hex case and outer whitespace must not change the allowance identity');
    if (offline) throw new Error('synthetic offline');
    return new Response(JSON.stringify(compatibleServer
      ? { valid: true, status: 'LEGACY_VALID', time: now, expireTimestamp: now + 86400000, deviceLimit: 0, deviceLease }
      : { valid: false, status: 'LICENSE_NOT_REGISTERED', time: now, expireTimestamp: now + 86400000, deviceLimit: 0 }));
  };
  const service = createDeviceAuthorization({ root, deviceId, now: () => now, publicKey: pair.publicKey, fetchImpl });
  const denied = await service.authorize(`  ${key.toUpperCase()}\r\n`, { endDate: now + 86400000 });
  assert.equal(denied.ok, false); assert.equal(denied.code, 'LICENSE_NOT_REGISTERED');
  assert.match(denied.message, /自动同步.*无需更换密钥或到网站补录/);
  const cacheFile = path.join(root, 'license-devices', `${lease.keyHash}.json`);
  const oldDenial = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  oldDenial.message = '旧版本提示管理员去网站补录原密钥';
  fs.writeFileSync(cacheFile, JSON.stringify(oldDenial));
  offline = true;
  const offlineDenial = await service.authorize(key, { endDate: now + 86400000 });
  assert.equal(offlineDenial.ok, false);
  assert.equal(offlineDenial.message, denied.message, 'old cached denials must no longer direct users to website review');
  offline = false; compatibleServer = true;
  const active = await service.authorize(key, { endDate: now + 86400000 });
  assert.equal(active.ok, true); assert.equal(active.code, 'LEGACY_VALID'); assert.equal(active.deviceLimit, 0);
  offline = true;
  assert.equal((await service.authorize(key, { endDate: now + 86400000 })).ok, true);
  const restarted = createDeviceAuthorization({ root, deviceId, now: () => now, publicKey: pair.publicKey, fetchImpl });
  assert.equal((await restarted.authorize(key, { endDate: now + 86400000 })).ok, true);
  const copied = createDeviceAuthorization({ root, deviceId: 'd'.repeat(64), now: () => now, publicKey: pair.publicKey, fetchImpl });
  assert.equal((await copied.authorize(key, { endDate: now + 86400000 })).ok, false, 'unlimited licenses still require each computer to obtain its own signed cache');
});

test('a valid original AES key automatically authorizes multiple computers with unchanged scope and expiry', async t => {
  const pair = crypto.generateKeyPairSync('ed25519'), now = Date.now(), endDate = now + 86400000;
  const key = encStr(JSON.stringify({ file: 'all', date: endDate }));
  const validation = validateLicenseKey(key, { decryptStr });
  assert.equal(validation.ok, true); assert.equal(validation.state.licenseFile, 'all');
  const identities = [];
  /** Simulate the automatic server response, signing a distinct cache for every computer without a count limit. */
  const fetchImpl = async (_url, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.key, key); identities.push(body.deviceId);
    const lease = { schemaVersion: 1, keyHash: crypto.createHash('sha256').update(key).digest('hex'),
      deviceId: body.deviceId, issuedAt: now, expiresAt: endDate, deviceLimit: 0 };
    return new Response(JSON.stringify({ valid: true, status: 'LEGACY_VALID', time: now, expireTimestamp: endDate,
      deviceLimit: 0, deviceLease: { lease, signature: crypto.sign(null, Buffer.from(JSON.stringify(lease)), pair.privateKey).toString('base64') } }));
  };
  for (const deviceId of ['c'.repeat(64), 'd'.repeat(64)]) {
    const root = temporaryRoot(t), options = { root, deviceId, now: () => now, publicKey: pair.publicKey };
    const access = await createDeviceAuthorization({ ...options, fetchImpl }).authorize(key, validation.state);
    assert.equal(access.ok, true); assert.equal(access.deviceLimit, 0); assert.equal(access.licenseExpiresAt, endDate);
    const policy = createLicenseAccessPolicy({ clock: { now: () => now, synchronize() {} } });
    t.after(() => policy.dispose());
    assert.equal(policy.update(access).canAcquire, true); assert.equal(policy.requireAccess('export').canExport, true);
    const offline = await createDeviceAuthorization({ ...options, fetchImpl: async () => { throw new Error('synthetic offline'); } })
      .authorize(key, validation.state);
    assert.equal(offline.ok, true); assert.equal(offline.offline, true);
    assert.equal(offline.licenseExpiresAt, endDate); assert.equal(validation.state.licenseFile, 'all');
  }
  assert.deepEqual(identities, ['c'.repeat(64), 'd'.repeat(64)]);
});

test('unknown older server still cannot authorize an unregistered key without a signed allowance', async t => {
  const service = createDeviceAuthorization({ root: temporaryRoot(t), deviceId: 'c'.repeat(64), fetchImpl: async () => new Response(JSON.stringify({
    valid: true, status: 'UNKNOWN', time: Date.now(), expireTimestamp: Date.now() + 86400000, deviceLimit: 0,
  })) });
  const result = await service.authorize('ab'.repeat(64), { endDate: Date.now() + 86400000 });
  assert.equal(result.ok, false); assert.equal(result.code, 'LICENSE_NOT_REGISTERED');
});
