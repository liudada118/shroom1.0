const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStaffPackageSubmission } = require('../../extension-host/workspace/staffPackageSubmission');

test('staff token is encrypted locally and only authorizes pending submissions', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-staff-submit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const safeStorage = { isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`encrypted:${value}`),
    decryptString: (buffer) => buffer.toString().replace(/^encrypted:/, '') };
  const token = `sps_${'a'.repeat(43)}`;
  let request;
  const service = createStaffPackageSubmission({ root, safeStorage, exportPackage: (id) => ({ systemId: id }),
    fetchImpl: async (_url, options) => { request = options; return { ok: true, json: async () => ({ id: 17, status: 'pending' }) }; } });
  assert.throws(() => service.save('wrong'), { code: 'SYSTEM_SUBMISSION_TOKEN_INVALID' });
  assert.equal(service.save(token).configured, true);
  assert.equal(fs.readFileSync(path.join(root, 'system-package-staff-credential.json'), 'utf8').includes(token), false);
  const result = await service.submit('seatpad2');
  assert.equal(result.status, 'pending');
  assert.equal(request.headers.Authorization, `Bearer ${token}`);
  assert.equal(JSON.parse(request.body).package.systemId, 'seatpad2');
  await service.submit('seatpad2', 7);
  assert.equal(JSON.parse(request.body).baseVersion, 7);
  assert.equal(service.clear().configured, false);
  await assert.rejects(service.submit('seatpad2'), { code: 'SYSTEM_SUBMISSION_TOKEN_REQUIRED' });
});

test('an occupied published ID returns the version needed for an explicit update', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-staff-conflict-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const safeStorage = { isEncryptionAvailable: () => true, encryptString: (value) => Buffer.from(value),
    decryptString: (value) => value.toString() };
  const service = createStaffPackageSubmission({ root, safeStorage, exportPackage: (systemId) => ({ systemId }),
    fetchImpl: async () => ({ ok: false, status: 409, headers: { get: () => 'application/json' },
      json: async () => ({ error: 'SYSTEM_ID_ALREADY_PUBLISHED', currentVersion: 11 }) }) });
  service.save(`sps_${'a'.repeat(43)}`);
  await assert.rejects(service.submit('seatpad'), (error) => error.code === 'SYSTEM_ID_ALREADY_PUBLISHED'
    && error.currentVersion === 11 && error.httpStatus === 409);
});

test('submission explains an HTML site fallback without surfacing a JSON parser error', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-staff-html-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const safeStorage = { isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value), decryptString: (buffer) => buffer.toString() };
  const service = createStaffPackageSubmission({ root, safeStorage, exportPackage: (id) => ({ systemId: id }),
    fetchImpl: async () => ({ ok: true, headers: { get: () => 'text/html' }, json: async () => {
      throw new SyntaxError("Unexpected token '<'");
    } }) });
  service.save(`sps_${'a'.repeat(43)}`);
  await assert.rejects(service.submit('seatpad2'), { code: 'SYSTEM_SUBMISSION_SERVICE_UNAVAILABLE' });
});

test('staff release reads use the encrypted token and preserve the immutable version envelope', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-staff-releases-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const safeStorage = { isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value), decryptString: (buffer) => buffer.toString() };
  const requests = [];
  const service = createStaffPackageSubmission({ root, safeStorage, exportPackage: () => null,
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), options });
      const body = String(url).endsWith('/staff/releases')
        ? { releases: [{ systemId: 'seatpad2', version: 7, kind: 'manifest', name: '坐垫' }] }
        : { systemId: 'seatpad2', version: 7, sha256: 'a'.repeat(64), package: { systemId: 'seatpad2' }, signature: 'signed' };
      return { ok: true, headers: { get: () => 'application/json' }, json: async () => body };
    } });
  service.save(`sps_${'a'.repeat(43)}`);
  assert.equal((await service.listReleases()).releases[0].version, 7);
  assert.equal((await service.getRelease('seatpad2', 7)).systemId, 'seatpad2');
  assert.equal(requests[0].options.headers.Authorization, `Bearer sps_${'a'.repeat(43)}`);
  assert.match(requests[1].url, /\/staff\/releases\/seatpad2\/7$/);
  await assert.rejects(service.getRelease('../seatpad2', 7), { code: 'SYSTEM_RELEASE_INVALID' });
});
