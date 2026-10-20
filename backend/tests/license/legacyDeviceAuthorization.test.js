const assert = require('node:assert/strict');
const { test } = require('node:test');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createDeviceAuthorization } = require('../../kernel/platform/license/deviceAuthorization');

/** Isolate authorization caches so the test cannot read or change a customer's real activation. */
function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-legacy-authorization-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('reviewed old-key registration recovers without replacing the key and uses only a valid signed allowance', async t => {
  const root = temporaryRoot(t), pair = crypto.generateKeyPairSync('ed25519');
  const key = 'ab'.repeat(64), deviceId = 'c'.repeat(64), now = Date.now();
  let registered = false, offline = false;
  const lease = { schemaVersion: 1, keyHash: crypto.createHash('sha256').update(key).digest('hex'), deviceId,
    issuedAt: now, expiresAt: now + 60000, deviceLimit: 1 };
  const deviceLease = { lease, signature: crypto.sign(null, Buffer.from(JSON.stringify(lease)), pair.privateKey).toString('base64') };
  /** Model the old key before and after the administrator registers its original value. */
  const fetchImpl = async (_url, request) => {
    assert.equal(JSON.parse(request.body).key, key, 'hex case and outer whitespace must not change the allowance identity');
    if (offline) throw new Error('synthetic offline');
    return new Response(JSON.stringify(registered
      ? { valid: true, status: 'ACTIVATED', time: now, expireTimestamp: now + 86400000, deviceLimit: 1, deviceLease }
      : { valid: false, status: 'LICENSE_NOT_REGISTERED', time: now, expireTimestamp: now + 86400000, deviceLimit: 0 }));
  };
  const service = createDeviceAuthorization({ root, deviceId, now: () => now, publicKey: pair.publicKey, fetchImpl });
  const denied = await service.authorize(`  ${key.toUpperCase()}\r\n`, { endDate: now + 86400000 });
  assert.equal(denied.ok, false); assert.equal(denied.code, 'LICENSE_NOT_REGISTERED');
  assert.match(denied.message, /密钥验证.*补录原密钥/);
  offline = true;
  assert.equal((await service.authorize(key, { endDate: now + 86400000 })).ok, false);
  offline = false; registered = true;
  assert.equal((await service.authorize(key, { endDate: now + 86400000 })).ok, true);
  offline = true;
  assert.equal((await service.authorize(key, { endDate: now + 86400000 })).ok, true);
  const copied = createDeviceAuthorization({ root, deviceId: 'd'.repeat(64), now: () => now, publicKey: pair.publicKey, fetchImpl });
  assert.equal((await copied.authorize(key, { endDate: now + 86400000 })).ok, false, 'reviewed registration cannot make the allowance portable');
});

test('unknown older server still cannot authorize an unregistered key without a signed allowance', async t => {
  const service = createDeviceAuthorization({ root: temporaryRoot(t), deviceId: 'c'.repeat(64), fetchImpl: async () => new Response(JSON.stringify({
    valid: true, status: 'UNKNOWN', time: Date.now(), expireTimestamp: Date.now() + 86400000, deviceLimit: 0,
  })) });
  const result = await service.authorize('ab'.repeat(64), { endDate: Date.now() + 86400000 });
  assert.equal(result.ok, false); assert.equal(result.code, 'LICENSE_NOT_REGISTERED');
});
