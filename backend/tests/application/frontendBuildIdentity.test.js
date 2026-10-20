const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createFrontendCache } = require('../../../app/update/frontendCache');

/** Create an isolated installer fixture without reading customer caches or starting Electron. */
function fixture(t, metadata) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-build-identity-'));
  const shipped = path.join(root, 'shipped');
  fs.mkdirSync(shipped);
  fs.writeFileSync(path.join(shipped, 'index.html'), '<div>fixture</div>');
  if (metadata !== undefined) fs.writeFileSync(path.join(shipped, 'frontend-build.json'),
    typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
  let requests = 0;
  /** Count requests while returning an untrusted release that must still be rejected. */
  function create(isPackaged = true) {
    const cache = createFrontendCache({ root, appVersion: '1.1.37', isPackaged,
      fetchImpl: async () => { requests++; return new Response('{}'); } });
    t.after(() => cache.dispose());
    return cache;
  }
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 }));
  return { root, shipped, create, requests: () => requests };
}

test('development checks are neutral and cannot alter production cache pointers', async t => {
  const f = fixture(t);
  const directory = path.join(f.root, 'frontend-cache');
  fs.mkdirSync(directory);
  const pointer = path.join(directory, 'state.json');
  const before = JSON.stringify({ installer: '1.1.37:10', lastCheck: {
    result: 'installer-update-required', errorCode: 'FRONTEND_PACKAGED_BUILD_MISSING' },
  pending: { manifest: { releaseId: 42 } } });
  fs.writeFileSync(pointer, before);
  const cache = f.create(false);
  assert.equal(cache.selectRoot(f.shipped), f.shipped);
  const result = await cache.check();
  assert.equal(result.source, 'development');
  assert.equal(result.updateSupported, false);
  assert.equal(result.lastCheckResult, 'development');
  assert.equal(result.lastErrorCode, null);
  assert.equal(result.pendingReleaseId, null);
  assert.equal(result.bootPending, null);
  assert.match(result.lastMessage, /开发版/);
  assert.equal(f.requests(), 0);
  assert.equal(fs.readFileSync(pointer, 'utf8'), before);
});

for (const [name, metadata, errorCode] of [
  ['missing', undefined, 'FRONTEND_PACKAGED_BUILD_MISSING'],
  ['malformed JSON', '{bad', 'FRONTEND_PACKAGED_BUILD_INVALID'],
  ['invalid build identity', { schemaVersion: 1, buildId: 0, appVersion: '1.1.37' }, 'FRONTEND_PACKAGED_BUILD_INVALID'],
  ['version mismatch', { schemaVersion: 1, buildId: 10, appVersion: '1.1.36' }, 'FRONTEND_PACKAGED_BUILD_VERSION_MISMATCH'],
]) {
  test(`installer with ${name} cannot install remote code without a trusted baseline`, async t => {
    const f = fixture(t, metadata), cache = f.create();
    assert.equal(cache.selectRoot(f.shipped), f.shipped);
    const result = await cache.check();
    assert.equal(result.lastErrorCode, errorCode);
    assert.equal(result.lastCheckResult, 'installer-update-required');
    assert.equal(result.activeBuildId, null);
    assert.equal(f.requests(), 0);
    assert.doesNotMatch(result.lastMessage, /已是最新/);
  });
}

test('a valid installer starts release verification and still rejects unsigned responses', async t => {
  const f = fixture(t, { schemaVersion: 1, buildId: 10, appVersion: '1.1.37' });
  const cache = f.create();
  cache.selectRoot(f.shipped);
  const result = await cache.check();
  assert.equal(result.packagedBuildId, 10);
  assert.equal(f.requests(), 1);
  assert.equal(result.lastErrorCode, 'FRONTEND_RELEASE_INVALID');
  assert.equal(result.source, 'packaged');
});

test('an unwritable cache is diagnosed independently from valid packaged metadata', async t => {
  const f = fixture(t, { schemaVersion: 1, buildId: 10, appVersion: '1.1.37' });
  fs.writeFileSync(path.join(f.root, 'frontend-cache'), 'fixture blocking the directory');
  const cache = f.create();
  assert.equal(cache.selectRoot(f.shipped), f.shipped);
  const result = await cache.check();
  assert.equal(result.lastErrorCode, 'FRONTEND_CACHE_STORAGE_UNAVAILABLE');
  assert.equal(result.lastCheckResult, 'unavailable');
  assert.equal(f.requests(), 0);
});
