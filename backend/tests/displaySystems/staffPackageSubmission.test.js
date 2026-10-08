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
  assert.equal(service.clear().configured, false);
  await assert.rejects(service.submit('seatpad2'), { code: 'SYSTEM_SUBMISSION_TOKEN_REQUIRED' });
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
