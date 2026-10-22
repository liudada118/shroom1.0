const path = require('node:path');
const { normalizeModelSettings } = require('../../backend/agent-runtime/provider');
const { readJson, writeJsonAtomic } = require('../../backend/agent-runtime/storage');
const builtinCatalog = require('../../shared/agent-model-catalog.json');

const DEFAULT_CATALOG_URL = 'https://shroom.jq-industries.com/api/agent/model-catalog';
const MAX_CATALOG_BYTES = 128 * 1024;
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** 校验公开目录的短文本，拒绝控制符和过长内容。 */
function catalogText(value, maximum, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > maximum || /[\x00-\x1f\x7f]/.test(value)
    || (!allowEmpty && !value.trim())) throw new Error('Invalid model catalog text');
  return value.trim();
}

/** 仅保留服务商、Responses连接地址和模型元数据，不接受密钥或可执行配置。 */
function normalizeAgentModelCatalog(input) {
  if (!input || input.schemaVersion !== 1 || !Array.isArray(input.providers)
    || !input.providers.length || input.providers.length > 32) throw new Error('Invalid model catalog');
  const ids = new Set();
  const providers = input.providers.map((provider) => {
    const id = catalogText(provider?.id, 40);
    if (!/^[a-z][a-z0-9_-]*$/.test(id) || ids.has(id)) throw new Error('Invalid provider ID');
    ids.add(id);
    const label = catalogText(provider.label, 100);
    const address = catalogText(provider.baseUrl, 1000, id === 'custom');
    const baseUrl = id === 'custom' ? '' : normalizeModelSettings({ baseUrl: address }).baseUrl;
    if ((id === 'custom' && address) || (id !== 'custom' && !baseUrl.startsWith('https://'))) throw new Error('Invalid provider URL');
    if (!Array.isArray(provider.models) || !provider.models.length || provider.models.length > 100) throw new Error('Invalid provider models');
    const modelIds = new Set();
    const models = provider.models.map((model) => {
      const modelId = catalogText(model?.id, 120);
      if (modelIds.has(modelId)) throw new Error('Duplicate model ID');
      modelIds.add(modelId);
      return { id: modelId, label: catalogText(model.label, 100) };
    });
    const defaultModel = catalogText(provider.defaultModel, 120);
    if (!modelIds.has(defaultModel)) throw new Error('Invalid default model');
    return { id, label, baseUrl, defaultModel, models,
      ...(provider.hint === undefined ? {} : { hint: catalogText(provider.hint, 500, true) }) };
  });
  if (!ids.has('custom')) throw new Error('Missing custom provider');
  return { schemaVersion: 1, version: catalogText(input.version, 100), providers };
}

/** 有界下载无凭据的公开JSON，HTTP错误或HTML回退不会覆盖已有目录。 */
async function fetchCatalog(fetchImpl, url, signal) {
  const response = await fetchImpl(url, {
    method: 'GET', headers: { accept: 'application/json' }, redirect: 'error', credentials: 'omit', signal,
  });
  if (!response.ok || !/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel().catch(() => {});
    throw new Error('Model catalog unavailable');
  }
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_CATALOG_BYTES) {
    await response.body?.cancel().catch(() => {});
    throw new Error('Model catalog too large');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty model catalog');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let received = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_CATALOG_BYTES) throw new Error('Model catalog too large');
      text += decoder.decode(value, { stream: true });
    }
    return normalizeAgentModelCatalog(JSON.parse(text + decoder.decode()));
  } finally { await reader.cancel().catch(() => {}); }
}

/** 为设置下拉框提供远端目录、最近有效缓存和随包默认值；不修改用户连接。 */
function createAgentModelCatalog({ root, fetchImpl = globalThis.fetch, url = DEFAULT_CATALOG_URL,
  now = Date.now, timeoutMs = 5000, refreshIntervalMs = REFRESH_INTERVAL_MS } = {}) {
  const endpoint = new URL(url);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname);
  if ((endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && local))
    || endpoint.username || endpoint.password || endpoint.hash || endpoint.search) throw new Error('Invalid model catalog endpoint');
  const file = path.join(root, 'model-catalog.json');
  let catalog = normalizeAgentModelCatalog(builtinCatalog);
  let source = 'default', updatedAt = null, warning = '', lastAttempt = null, pending = null, activeController = null, disposed = false;
  try {
    const cache = readJson(file, null, MAX_CATALOG_BYTES);
    if (cache?.endpoint === endpoint.href && Number.isFinite(cache.updatedAt) && cache.updatedAt > 0) {
      catalog = normalizeAgentModelCatalog(cache.catalog);
      source = 'cache'; updatedAt = Math.min(now(), cache.updatedAt);
    }
  } catch { /* 公开目录缓存损坏时使用随包目录，用户连接和密钥不受影响。 */ }

  /** 返回隔离的公开快照，调用方不能修改进程中的缓存。 */
  function getSnapshot() {
    return structuredClone({ ...catalog, source, updatedAt, ...(warning ? { warning } : {}) });
  }

  /** 打开设置时按间隔刷新；手动刷新及并发打开共用一个请求。 */
  function load({ refresh = false } = {}) {
    if (disposed) return Promise.resolve(getSnapshot());
    if (pending) return pending;
    const recent = Math.max(updatedAt || 0, lastAttempt || 0);
    if (!refresh && recent > 0 && now() - recent < refreshIntervalMs) return Promise.resolve(getSnapshot());
    lastAttempt = now();
    const controller = new AbortController();
    activeController = controller;
    let timer;
    const deadline = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Model catalog timeout')); }, timeoutMs);
    });
    pending = (async () => {
      try {
        const next = await Promise.race([fetchCatalog(fetchImpl, endpoint.href, controller.signal), deadline]);
        if (!disposed) {
          catalog = next; source = 'remote'; updatedAt = now(); warning = '';
          try { writeJsonAtomic(file, { endpoint: endpoint.href, updatedAt, catalog }); }
          catch { warning = '模型列表已更新，本机缓存暂时无法保存。'; }
        }
      } catch {
        if (!disposed) warning = source === 'default' ? '暂时无法更新模型列表，已使用内置选项。' : '暂时无法更新模型列表，已保留最近可用列表。';
      } finally { clearTimeout(timer); activeController = null; pending = null; }
      return getSnapshot();
    })();
    return pending;
  }

  /** 关闭应用时取消公开目录请求，不触碰用户模型设置。 */
  function dispose() { disposed = true; activeController?.abort(); }

  return { getSnapshot, load, dispose };
}

module.exports = { DEFAULT_CATALOG_URL, MAX_CATALOG_BYTES, normalizeAgentModelCatalog, createAgentModelCatalog };
