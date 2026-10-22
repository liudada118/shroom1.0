const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAgentModelCatalog, normalizeAgentModelCatalog, DEFAULT_CATALOG_URL } = require('../../../app/electron/agentModelCatalog');
const { createAgentProcess } = require('../../../app/electron/agentProcess');
const builtin = require('../../../shared/agent-model-catalog.json');

/** 给每个目录案例提供隔离存储，避免使用真实用户设置或密钥。 */
function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-model-catalog-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

/** 生成一个通过Responses兼容接口提供新模型的目录夹具。 */
function remoteCatalog() {
  return { ...structuredClone(builtin), version: 'remote-v2', providers: [
    { id: 'example', label: '示例模型服务', baseUrl: 'https://model.example/v1', defaultModel: 'new-model',
      models: [{ id: 'new-model', label: '新模型' }] },
    ...structuredClone(builtin.providers),
  ] };
}

/** 模拟标准JSON响应，网络中不携带客户或API凭据。 */
function jsonResponse(input) { return new Response(JSON.stringify(input), { headers: { 'content-type': 'application/json; charset=utf-8' } }); }

test('remote providers and models are cached without secrets and survive offline restart', async (t) => {
  const root = temporaryRoot(t);
  const calls = [];
  const catalog = remoteCatalog(); catalog.apiKey = 'must-not-cache'; catalog.providers[0].apiKey = 'must-not-cache';
  const service = createAgentModelCatalog({ root, now: () => 1000, fetchImpl: async (url, options) => {
    calls.push({ url, options }); return jsonResponse(catalog);
  } });
  t.after(service.dispose);
  const result = await service.load();
  assert.equal(result.source, 'remote');
  assert.equal(result.providers[0].models[0].id, 'new-model');
  assert.equal(calls[0].url, DEFAULT_CATALOG_URL);
  assert.deepEqual(calls[0].options.headers, { accept: 'application/json' });
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.redirect, 'error');
  assert(!JSON.stringify(result).includes('must-not-cache'));
  assert(!fs.readFileSync(path.join(root, 'model-catalog.json'), 'utf8').includes('must-not-cache'));
  await service.load();
  assert.equal(calls.length, 1, 'cached opens do not repeatedly download the list');
  result.providers[0].baseUrl = 'https://changed.invalid';
  assert.equal(service.getSnapshot().providers[0].baseUrl, 'https://model.example/v1');
  const restored = createAgentModelCatalog({ root, now: () => 2000, fetchImpl: async () => { throw new Error('offline secret'); } });
  t.after(restored.dispose);
  assert.equal(restored.getSnapshot().source, 'cache');
  assert.equal((await restored.load({ refresh: true })).version, 'remote-v2');
  assert.match(restored.getSnapshot().warning, /保留最近可用列表/);
  assert(!restored.getSnapshot().warning.includes('secret'));
});

test('failed or malformed responses retain defaults or the last valid catalog', async (t) => {
  const root = temporaryRoot(t);
  let response = jsonResponse(remoteCatalog());
  const service = createAgentModelCatalog({ root, fetchImpl: async () => response }); t.after(service.dispose);
  await service.load();
  const saved = fs.readFileSync(path.join(root, 'model-catalog.json'), 'utf8');
  for (const invalid of [
    new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }),
    new Response('private failure', { status: 503 }),
    new Response('{broken', { headers: { 'content-type': 'application/json' } }),
    jsonResponse({ ...remoteCatalog(), schemaVersion: 2 }),
    new Response('x'.repeat(128 * 1024 + 1), { headers: { 'content-type': 'application/json' } }),
    new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': String(128 * 1024 + 1) } }),
  ]) {
    response = invalid;
    const snapshot = await service.load({ refresh: true });
    assert.equal(snapshot.version, 'remote-v2');
    assert(snapshot.warning);
    assert.equal(fs.readFileSync(path.join(root, 'model-catalog.json'), 'utf8'), saved);
  }
  const firstOffline = createAgentModelCatalog({ root: temporaryRoot(t), fetchImpl: async () => { throw new Error('offline'); } });
  t.after(firstOffline.dispose);
  const snapshot = await firstOffline.load();
  assert.equal(snapshot.source, 'default');
  assert.deepEqual(snapshot.providers, builtin.providers);
});

test('a timeout is bounded even when a transport ignores abort, and concurrent requests are coalesced', async (t) => {
  let calls = 0, signal;
  const service = createAgentModelCatalog({ root: temporaryRoot(t), timeoutMs: 15, fetchImpl: async (_url, options) => {
    calls += 1; signal = options.signal; return new Promise(() => {});
  } });
  t.after(service.dispose);
  const first = service.load();
  assert.equal(service.load({ refresh: true }), first);
  const result = await first;
  assert.equal(calls, 1);
  assert.equal(signal.aborted, true);
  assert.equal(result.source, 'default');
  assert(result.warning);
});

test('the directory validates endpoints, unique identities and default models', () => {
  for (const update of [
    value => { value.providers[0].baseUrl = 'http://api.example'; },
    value => { value.providers[0].baseUrl = 'https://user:secret@api.example'; },
    value => { value.providers[0].baseUrl = 'https://api.example?api_key=secret'; },
    value => { value.providers[0].baseUrl = 'https://api.example/#secret'; },
    value => { value.providers[0].defaultModel = 'missing'; },
    value => { value.providers.push(value.providers[0]); },
    value => { value.providers[0].models.push(value.providers[0].models[0]); },
    value => { value.providers[0].label = 'bad\nlabel'; },
    value => { value.providers = value.providers.filter(item => item.id !== 'custom'); },
    value => { value.providers.find(item => item.id === 'custom').baseUrl = 'https://injected.example'; },
  ]) {
    const value = remoteCatalog(); update(value);
    assert.throws(() => normalizeAgentModelCatalog(value));
  }
});

test('invalid caches are harmless and cache data cannot cross catalog endpoints', (t) => {
  const root = temporaryRoot(t);
  fs.writeFileSync(path.join(root, 'model-catalog.json'), '{broken');
  const corrupt = createAgentModelCatalog({ root }); t.after(corrupt.dispose);
  assert.equal(corrupt.getSnapshot().source, 'default');
  fs.writeFileSync(path.join(root, 'model-catalog.json'), JSON.stringify({ endpoint: 'https://other.example/catalog', updatedAt: Date.now(), catalog: remoteCatalog() }));
  const different = createAgentModelCatalog({ root }); t.after(different.dispose);
  assert.equal(different.getSnapshot().source, 'default');
});

test('catalog IPC works without starting a task worker and rejects arbitrary destinations or credentials', async (t) => {
  const root = temporaryRoot(t);
  const settingsBytes = JSON.stringify({ baseUrl: 'https://saved.example', model: 'saved-model' });
  fs.writeFileSync(path.join(root, 'settings.json'), settingsBytes);
  let requests = 0;
  const manager = createAgentProcess({ root, getWindow: () => null, getLicenseKey: () => 'never-send-software-key',
    electron: { safeStorage: {}, utilityProcess: { fork: () => { throw new Error('catalog must not start a worker'); } },
      net: { fetch: async (url, options) => {
        requests += 1;
        assert.equal(url, DEFAULT_CATALOG_URL);
        assert(!JSON.stringify(options).includes('never-send-software-key'));
        return jsonResponse(remoteCatalog());
      } } } });
  t.after(() => manager.dispose());
  const result = await manager.invoke('getModelCatalog');
  assert.equal(result.providers[0].id, 'example');
  assert.equal(requests, 1);
  assert.equal(fs.readFileSync(path.join(root, 'settings.json'), 'utf8'), settingsBytes);
  for (const payload of [{ refresh: 'yes' }, { url: 'https://other.invalid' }, { apiKey: 'secret' }]) {
    await assert.rejects(manager.invoke('getModelCatalog', payload), { code: 'AGENT_INPUT_INVALID' });
  }
  assert.equal(requests, 1);
});
