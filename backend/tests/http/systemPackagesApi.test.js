const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const { createHttpApp } = require('../../kernel/platform/http/httpAppFactory');

test('local system-package routes isolate staff credentials and broadcast successful sync', async () => {
  const events = [];
  let configured = false;
  const app = createHttpApp({
    exportDisplaySystemPackage: (id) => ({ systemId: id, kind: 'manifest' }),
    getStaffPackageSubmissionStatus: () => ({ configured }),
    saveStaffPackageSubmissionToken: (token) => { configured = token === 'valid'; return { configured }; },
    clearStaffPackageSubmissionToken: () => { configured = false; return { configured }; },
    submitDisplaySystemPackage: async (id) => ({ id: 4, systemId: id, status: 'pending' }),
    listStaffSystemReleases: async () => ({ releases: [{ systemId: 'seatpad2', version: 3 }] }),
    listCompanyRevisionDrafts: () => [{ draftId: 'revision_abc', targetSystemId: 'seatpad2', baseVersion: 3 }],
    createCompanyRevisionDraft: async () => ({ draftId: 'revision_abc', targetSystemId: 'seatpad2' }),
    inspectCompanyRevisionDraft: () => ({ draftId: 'revision_abc', hasChanges: true, packageSha256: 'a'.repeat(64) }),
    submitCompanyRevisionDraft: async (_id, sha256) => ({ id: sha256 ? 9 : 0 }),
    syncManagedSystems: async () => ({ installed: [{ systemId: 'seatpad2' }], available: [], errors: [] }),
    getManagedSystemStatus: () => ({ available: [], expiresAt: null }),
    publishDisplaySystemsUpdated: (event) => events.push(event), logger: { warn() {} },
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/system-packages`;
  try {
    assert.equal((await fetch(`${base}/export/seatpad2`, { headers: { origin: 'https://untrusted.example' } })).status, 403);
    assert.equal((await (await fetch(`${base}/export/seatpad2`)).json()).package.systemId, 'seatpad2');
    assert.equal((await fetch(`${base}/staff-credential`, { method: 'PUT', headers: { origin: 'https://untrusted.example', 'content-type': 'application/json' }, body: '{"token":"valid"}' })).status, 403);
    assert.equal((await (await fetch(`${base}/staff-credential`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"token":"valid"}' })).json()).configured, true);
    assert.deepEqual(await (await fetch(`${base}/staff-credential`)).json(), { configured: true });
    assert.deepEqual(await (await fetch(`${base}/submit/seatpad2`, { method: 'POST' })).json(), { id: 4, systemId: 'seatpad2', status: 'pending' });
    assert.equal((await (await fetch(`${base}/staff/releases`)).json()).releases[0].version, 3);
    assert.equal((await (await fetch(`${base}/revisions`)).json()).drafts[0].draftId, 'revision_abc');
    assert.equal((await (await fetch(`${base}/revisions`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ systemId: 'seatpad2', version: 3 }) })).json()).result.draftId, 'revision_abc');
    assert.equal((await (await fetch(`${base}/revisions/revision_abc`)).json()).result.hasChanges, true);
    assert.equal((await (await fetch(`${base}/revisions/revision_abc/submit`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedSha256: 'a'.repeat(64) }) })).json()).result.id, 9);
    assert.equal((await (await fetch(`${base}/sync`, { method: 'POST' })).json()).installed[0].systemId, 'seatpad2');
    assert.deepEqual(events, [{ reason: 'revision-draft', id: 'revision_abc' }, { reason: 'managed-sync' }]);
    assert.equal((await (await fetch(`${base}/staff-credential`, { method: 'DELETE' })).json()).configured, false);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});
