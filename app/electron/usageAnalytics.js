const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { subscribeBusinessEvents } = require('../../backend/common/businessEvents');
const { compactStackLocations } = require('./diagnosticStack');

const ENDPOINT = 'https://shroom.jq-industries.com/api/usage/events/batch';
const EVENT_NAMES = new Set(['app_session_started', 'feature_exposed', 'feature_attempted', 'system_entered', 'device_connection_result',
  'monitoring_usage_summary', 'collection_started', 'collection_finished', 'export_result', 'playback_started', 'algorithm_result',
  'analysis_tool_used', 'custom_system_saved', 'agent_task_result', 'usage_session_summary', 'error_reported']);
const PROPERTY_NAMES = new Set(['featureId', 'systemType', 'systemOrigin', 'operationId', 'result', 'durationMs', 'count', 'format',
  'errorCode', 'connectionType', 'mode', 'algorithmId', 'module', 'action', 'errorType', 'severity', 'message', 'stack']);
const IDENTIFIER = /^[A-Za-z0-9_.:-]{1,80}$/;
const FAILURE_CODES = {
  400: new Set(['INVALID_PAYLOAD', 'INVALID_EVENT', 'INVALID_JSON']),
  401: new Set(['INVALID_CREDENTIAL', 'INVALID_LICENSE', 'LICENSE_INVALID']),
  403: new Set(['LICENSE_UNAVAILABLE', 'LICENSE_CUSTOMER_REQUIRED', 'LICENSE_CUSTOMER_INACTIVE', 'PRODUCT_MISMATCH', 'LICENSE_EXPIRED', 'LICENSE_REVOKED']),
  409: new Set(['EVENT_CONTENT_CONFLICT']), 413: new Set(['BATCH_TOO_LARGE', 'PAYLOAD_TOO_LARGE']),
  415: new Set(['JSON_REQUIRED', 'ENCODING_UNSUPPORTED']), 429: new Set(['RATE_LIMITED']),
  503: new Set(['STORAGE_UNAVAILABLE', 'RECEIVE_TIMEOUT']),
};

/** Read at most 16 KiB of JSON and cancel oversized or unusable response bodies. */
async function readUsageResponse(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('USAGE_RESPONSE_INVALID');
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const item = await reader.read(); if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > 16384) throw new Error('USAGE_RESPONSE_TOO_LARGE');
      chunks.push(Buffer.from(item.value));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('USAGE_RESPONSE_INVALID');
    return body;
  } finally { await reader.cancel().catch(() => {}); }
}

/** Separate schema, authorization and service failures without exposing server-provided text. */
function usageHttpFailure(status, body) {
  status = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 0;
  const allowed = FAILURE_CODES[status], candidate = body?.error;
  const code = typeof candidate === 'string' && allowed?.has(candidate) ? candidate : status ? `USAGE_HTTP_${status}` : 'USAGE_HTTP_REJECTED';
  const blocked = status >= 400 && status < 500 && status !== 429;
  const message = {
    400: '使用统计格式与服务器接收规则不兼容，已暂停自动上传。请管理员检查客户端与服务端版本；待上传记录仍保留。',
    401: '使用统计上传未通过身份验证，已暂停自动上传。请管理员检查软件密钥登记与状态；待上传记录仍保留。',
    403: '当前授权不允许上传使用统计，已暂停自动上传。请管理员检查授权与客户关联；待上传记录仍保留。',
    409: '使用统计记录与服务器已有内容冲突，已暂停自动上传。请管理员核查记录；待上传记录仍保留。',
    413: '使用统计批次超出服务器接收上限，已暂停自动上传。请管理员检查接收限制；待上传记录仍保留。',
    429: '使用统计上传频率受限，稍后自动重试；待上传记录仍保留。',
  }[status] || (blocked ? '使用统计接口暂不接受当前请求，已暂停自动上传。请管理员检查接口配置；待上传记录仍保留。'
    : '使用统计服务暂不可用，将自动重试；待上传记录仍保留。');
  return { code, message, httpStatus: status || null, blocked };
}

/** Keep only bounded release identifiers; runtime diagnostics never contain paths or configurations. */
function normalizeRuntimeVersions(input) {
  const result = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return result;
  for (const name of ['frontendReleaseId', 'frontendBuildId', 'hostContract']) {
    if (Number.isSafeInteger(input[name]) && input[name] > 0) result[name] = input[name];
  }
  for (const name of ['systemPackageVersion', 'serverContractVersion']) {
    if (typeof input[name] === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(input[name])) result[name] = input[name];
  }
  return result;
}

/** Compare numeric release versions when confirming that an installer handoff actually took effect. */
function versionReached(actual, target) {
  if (!/^\d+\.\d+\.\d+$/.test(actual || '') || !/^\d+\.\d+\.\d+$/.test(target || '')) return false;
  const current = actual.split('.').map(Number), requested = target.split('.').map(Number);
  for (let index = 0; index < 3; index++) if (current[index] !== requested[index]) return current[index] > requested[index];
  return true;
}

/** Scrub credentials, customer contact details and local paths before queueing an error. */
function scrub(value, secrets = []) {
  let text = String(value || '');
  for (const secret of secrets.filter(item => typeof item === 'string' && item)) text = text.split(secret).join('[credential]');
  return text.replace(/\b(?:Bearer|License)\s+\S+/gi, '[credential]')
    .replace(/\b(?:api[_-]?key|token|password|secret|authorization|license[_-]?key)["']?\s*[=:]\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;"'}\]]+)/gi, '[credential]')
    .replace(/\b(?:sk-[\w-]{8,}|[a-f0-9]{32,})\b/gi, '[credential]')
    .replace(/https?:\/\/[^\s<>'"]+/gi, '[url]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email]')
    .replace(/\b[A-Za-z]:[\\/][^\r\n"<>|]*/g, '[path]')
    .replace(/(?:\/(?:Users|home|tmp|var|opt|usr|app|workspace|mnt|Volumes|Applications|Library|data|srv|root|etc)\/|\\\\)[^\s"<>]*/g, '[path]');
}

/** Accept the server's finite event vocabulary, never frames, chat content or arbitrary objects. */
function normalizeEvent(input, identity, secrets = []) {
  if (!input || !EVENT_NAMES.has(input.eventName) || !input.properties || typeof input.properties !== 'object'
    || Array.isArray(input.properties) || Object.keys(input.properties).some(name => !PROPERTY_NAMES.has(name))) throw new Error('USAGE_EVENT_INVALID');
  const properties = {};
  for (const [name, value] of Object.entries(input.properties)) {
    if (['message', 'stack'].includes(name)) {
      if (input.eventName !== 'error_reported' || typeof value !== 'string') throw new Error('USAGE_EVENT_INVALID');
      properties[name] = scrub(name === 'stack' ? compactStackLocations(value) : value, secrets).slice(0, name === 'message' ? 400 : 1800);
    } else if (['durationMs', 'count'].includes(name)) {
      if (!Number.isFinite(value) || value < 0 || value > (name === 'durationMs' ? 86400000 : 1e12) || (name === 'count' && !Number.isInteger(value))) throw new Error('USAGE_EVENT_INVALID');
      properties[name] = name === 'durationMs' ? Math.round(value) : value;
    } else {
      if (typeof value !== 'string' || !IDENTIFIER.test(value)) throw new Error('USAGE_EVENT_INVALID');
      properties[name] = value;
    }
  }
  const enums = { systemOrigin: ['builtin', 'copy', 'custom'], result: ['success', 'failure', 'cancelled', 'unknown'],
    format: ['csv'], connectionType: ['serial', 'halow', 'unknown'], mode: ['realtime', 'playback'], severity: ['warning', 'error', 'fatal'] };
  for (const [name, allowed] of Object.entries(enums)) if (properties[name] !== undefined && !allowed.includes(properties[name])) throw new Error('USAGE_EVENT_INVALID');
  if (properties.systemType && properties.systemOrigin !== 'builtin') properties.systemType = `${properties.systemOrigin || 'custom'}.${createHash('sha256').update(`${identity.installationId}:${identity.scope}:${properties.systemType}`).digest('hex').slice(0, 16)}`;
  const { scope, runtimeVersions: rawVersions, ...publicIdentity } = identity;
  const runtimeVersions = normalizeRuntimeVersions(rawVersions);
  const event = { schemaVersion: 1, eventId: randomUUID(), ...publicIdentity, ...(Object.keys(runtimeVersions).length ? { runtimeVersions } : {}), occurredAt: new Date().toISOString(), eventName: input.eventName, properties };
  if (Buffer.byteLength(JSON.stringify(event)) > 4096) throw new Error('USAGE_EVENT_TOO_LARGE');
  return event;
}

/** Revalidate persisted queues instead of trusting arbitrary JSON copied into the application directory. */
function restoreEvent(event, installationId, secrets) {
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const fields = new Set(['schemaVersion', 'eventId', 'installationId', 'sessionId', 'appVersion', 'environment', 'runtimeVersions', 'occurredAt', 'eventName', 'properties']);
  const occurred = Date.parse(event?.occurredAt);
  if (!event || Object.keys(event).some(name => !fields.has(name)) || event.schemaVersion !== 1
    || event.installationId !== installationId || !uuid.test(event.eventId) || !uuid.test(event.sessionId)
    || !/^\d+\.\d+\.\d+$/.test(event.appVersion) || !['production', 'development', 'test'].includes(event.environment)
    || !Number.isFinite(occurred) || occurred < Date.now() - 30 * 86400000 || occurred > Date.now() + 60000) throw new Error('USAGE_QUEUE_INVALID');
  const normalized = normalizeEvent(event, { installationId, sessionId: event.sessionId, appVersion: event.appVersion, environment: event.environment, runtimeVersions: event.runtimeVersions, scope: '' }, secrets);
  if (event.runtimeVersions !== undefined && JSON.stringify(normalized.runtimeVersions) !== JSON.stringify(event.runtimeVersions)) throw new Error('USAGE_QUEUE_INVALID');
  if (event.properties.systemType && event.properties.systemOrigin !== 'builtin') {
    if (!/^(custom|copy)\.[a-f0-9]{16}$/.test(event.properties.systemType)) throw new Error('USAGE_QUEUE_INVALID');
    normalized.properties.systemType = event.properties.systemType;
  }
  // An already transmitted ID must never be retried with changed content; unsafe old entries are discarded.
  if (JSON.stringify(normalized.properties) !== JSON.stringify(event.properties)) throw new Error('USAGE_QUEUE_INVALID');
  return { ...normalized, eventId: event.eventId, occurredAt: event.occurredAt };
}

/** Persist isolated customer queues and upload only confirmed events, without delaying sensor processing. */
function createUsageAnalytics({ root, appVersion, environment, getLicenseKey, getSecrets = () => [], fetchImpl = globalThis.fetch,
  endpoint = ENDPOINT, onStatus = () => {}, defaultEnabled = true, getRuntimeVersions = () => ({}) }) {
  const directory = path.join(root, 'usage-analytics'), settingsFile = path.join(directory, 'settings.json');
  const installationFile = path.join(directory, 'update-install.json');
  let storageError = false;
  try { fs.mkdirSync(directory, { recursive: true }); } catch { storageError = true; }
  let settings;
  try { settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8')); }
  catch (error) { settings = { enabled: error.code === 'ENOENT' && defaultEnabled, installationId: randomUUID() }; }
  if (!/^[a-f0-9-]{36}$/i.test(settings.installationId || '')) settings.installationId = randomUUID();
  settings.enabled = settings.enabled === true;
  try { fs.writeFileSync(settingsFile, JSON.stringify(settings), { mode: 0o600 }); } catch { storageError = true; }
  const sessionId = randomUUID(), sessionStart = performance.now();
  let scope = '', queue = [], chain = Promise.resolve(), sending = false, stopped = false, failureCount = 0, nextRetryAt = 0,
    lastSuccessAt = null, lastError = storageError ? '使用统计目录不可写，业务功能不受影响。' : null, blocked = false, dropped = 0, active = null, writeFailed = storageError;
  let lastErrorCode = storageError ? 'USAGE_STORAGE_UNAVAILABLE' : null, httpStatus = null;
  const repeatedErrors = new Map();
  const pendingWrites = new Map();
  let writing = false;

  /** Select a queue from the current credential digest; never send an old customer's queue with a new key. */
  function selectScope() {
    let key;
    try { key = String(getLicenseKey() || '').trim(); } catch { return ''; }
    const next = key ? createHash('sha256').update(key).digest('hex') : '';
    if (next === scope) return key;
    active?.abort(); scope = next; queue = []; repeatedErrors.clear(); blocked = false; lastError = null; lastErrorCode = null; httpStatus = null; nextRetryAt = 0;
    if (scope) {
      try {
        const file = path.join(directory, `${scope}.json`), stat = fs.statSync(file);
        if (stat.size > 8 * 1024 * 1024) throw new Error('USAGE_QUEUE_INVALID');
        const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!Array.isArray(saved.events) || saved.events.length > 2000) throw new Error('USAGE_QUEUE_INVALID');
        const ids = new Set();
        for (const event of saved.events) {
          try {
            const valid = restoreEvent(event, settings.installationId, [...getSecrets(), key]);
            if (!ids.has(valid.eventId)) { queue.push(valid); ids.add(valid.eventId); }
          } catch { dropped++; }
        }
      } catch (error) { if (error.code !== 'ENOENT') lastError = '使用统计队列无法读取，请关闭后重新开启。'; }
    }
    return key;
  }

  /** Serialize atomic asynchronous writes; failures keep the queue and cannot affect the business call. */
  function persist() {
    if (!scope) return chain;
    pendingWrites.set(scope, queue.slice());
    if (writing) return chain;
    writing = true;
    chain = chain.catch(() => {}).then(async () => {
      while (pendingWrites.size) {
        const [digest, events] = pendingWrites.entries().next().value;
        pendingWrites.delete(digest);
        const file = path.join(directory, `${digest}.json`), temporary = `${file}.${randomUUID()}.tmp`;
        try {
          await fs.promises.writeFile(temporary, JSON.stringify({ events }), { mode: 0o600 }); await fs.promises.rename(temporary, file);
          if (digest === scope) writeFailed = false;
        } catch {
          if (digest === scope) { writeFailed = true; lastError = '使用统计暂未保存，业务功能不受影响。'; publish(); }
          await fs.promises.unlink(temporary).catch(() => {});
        }
      }
    }).finally(() => { writing = false; if (pendingWrites.size) void persist(); });
    return chain;
  }

  /** Expose only the switch, delivery state and counts. */
  function status() { return { enabled: settings.enabled, queued: queue.length, sending, lastSuccessAt, lastError, lastErrorCode, httpStatus, nextRetryAt, dropped,
    noticePending: settings.noticeVersion !== 1, noticeVersion: 1 }; }
  /** Snapshot trusted host versions without allowing diagnostics failure to block business events. */
  function runtimeVersions() { try { return normalizeRuntimeVersions(getRuntimeVersions()); } catch { return {}; } }
  /** Notify the settings panel without exposing credentials or customer content. */
  function publish() { try { onStatus(status()); } catch { /* An unavailable UI is harmless. */ } }

  /** Queue one validated event, retaining a finite recent history while offline. */
  function record(input) {
    if (stopped || !settings.enabled) return false;
    const key = selectScope();
    if (!key) return false;
    try {
      const event = normalizeEvent(input, { installationId: settings.installationId, sessionId, appVersion, environment, scope, runtimeVersions: runtimeVersions() }, [...getSecrets(), key]);
      if (event.eventName === 'error_reported') {
        const fingerprint = createHash('sha256').update(JSON.stringify(event.properties)).digest('hex');
        const previous = repeatedErrors.get(fingerprint);
        if (previous) { previous.count = Math.min(1e12, previous.count + 1); return true; }
        if (repeatedErrors.size >= 128) {
          const oldest = repeatedErrors.keys().next().value; dropped += repeatedErrors.get(oldest).count; repeatedErrors.delete(oldest);
        }
        repeatedErrors.set(fingerprint, { count: 0, properties: event.properties });
      }
      queue.push(event);
      if (queue.length > 2000) { queue.shift(); dropped++; }
      void persist(); publish();
      if (queue.length >= 50) void flush();
      return true;
    } catch { return false; }
  }

  /** Emit new immutable events for repeated errors; never change an ID after it has been sent. */
  function summarizeErrors() {
    const key = selectScope();
    if (!settings.enabled || !key) return;
    let changed = false;
    for (const entry of repeatedErrors.values()) {
      if (!entry.count) continue;
      const event = normalizeEvent({ eventName: 'error_reported', properties: { ...entry.properties, count: entry.count } },
        { installationId: settings.installationId, sessionId, appVersion, environment, scope, runtimeVersions: runtimeVersions() }, [...getSecrets(), key]);
      entry.count = 0; queue.push(event); changed = true;
      if (queue.length > 2000) { queue.shift(); dropped++; }
    }
    if (changed) { void persist(); publish(); }
  }

  /** Batch at most 50 events; remove only IDs explicitly acknowledged by the same customer scope. */
  async function flush(force = false) {
    if (stopped || !settings.enabled || sending || blocked || (!force && Date.now() < nextRetryAt)) return status();
    const key = selectScope();
    if (!/^[A-Za-z0-9+/=]{32,8192}$/.test(key)) { if (key) { lastError = '使用统计需要有效的软件密钥。'; lastErrorCode = 'USAGE_CREDENTIAL_INVALID'; httpStatus = null; } publish(); return status(); }
    if (!queue.length) return status();
    sending = true; publish();
    const epoch = scope, batch = queue.slice(0, 50), controller = new AbortController(); active = controller;
    const timeout = setTimeout(() => controller.abort(), 12000); timeout.unref?.();
    let failure = null;
    try {
      await chain;
      if (writeFailed) {
        failure = { code: 'USAGE_STORAGE_UNAVAILABLE', message: '使用统计暂未保存，将在恢复后重试。' };
        throw new Error('USAGE_STORAGE_UNAVAILABLE');
      }
      const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `License ${key}` },
        body: JSON.stringify({ schemaVersion: 1, events: batch }), signal: controller.signal, redirect: 'error' });
      if (scope !== epoch || stopped || !settings.enabled) return status();
      if (!response.ok) {
        const body = await readUsageResponse(response).catch(() => null);
        if (scope !== epoch || stopped || !settings.enabled) return status();
        failure = usageHttpFailure(response.status, body); blocked = failure.blocked;
        throw new Error('USAGE_HTTP_REJECTED');
      }
      failure = { code: 'USAGE_RESPONSE_INVALID', message: '上传确认无效，将自动重试；待上传记录仍保留。', httpStatus: response.status };
      const ack = await readUsageResponse(response), ids = new Set(batch.map(event => event.eventId));
      if (scope !== epoch || stopped || !settings.enabled) return status();
      if (ack.accepted !== true || !Array.isArray(ack.eventIds) || ack.eventIds.length !== ids.size || ack.eventIds.some(id => !ids.has(id)) || new Set(ack.eventIds).size !== ids.size) throw new Error('USAGE_RESPONSE_INVALID');
      queue = queue.filter(event => !ids.has(event.eventId));
      await persist(); lastSuccessAt = new Date().toISOString(); lastError = null; lastErrorCode = null; httpStatus = null; failureCount = 0; nextRetryAt = 0;
    } catch {
      if (scope === epoch && settings.enabled && !stopped) {
        failureCount++; nextRetryAt = blocked ? 0 : Date.now() + Math.min(300000, 1000 * 2 ** Math.min(failureCount, 18));
        lastError = failure?.message || '使用统计上传失败，将自动重试；待上传记录仍保留。';
        lastErrorCode = failure?.code || 'USAGE_UPLOAD_FAILED'; httpStatus = failure?.httpStatus || null;
      }
    } finally { clearTimeout(timeout); sending = false; active = null; publish(); }
    return status();
  }

  /** Save a visible collection choice; disabling deletes pending usage events, not chats or sensor data. */
  async function setEnabled(enabled) {
    if (typeof enabled !== 'boolean') throw new Error('USAGE_SETTINGS_INVALID');
    const nextSettings = { ...settings, enabled }; active?.abort();
    await fs.promises.writeFile(settingsFile, JSON.stringify(nextSettings), { mode: 0o600 });
    settings = nextSettings;
    if (!enabled) {
      await chain; queue = []; repeatedErrors.clear(); blocked = false; lastError = null; lastErrorCode = null; httpStatus = null;
      try {
        await fs.promises.unlink(installationFile).catch(() => {});
        for (const name of await fs.promises.readdir(directory)) if (/^[a-f0-9]{64}\.json$/.test(name)) await fs.promises.unlink(path.join(directory, name));
      } catch { lastError = '上报已关闭，部分待传文件暂未清除；请检查目录权限后再次关闭。'; }
    } else { selectScope(); record({ eventName: 'app_session_started', properties: {} }); }
    publish(); return status();
  }

  /** Remember that this version of the upload explanation has been displayed, independently of opt-out. */
  async function acknowledgeNotice() {
    const nextSettings = { ...settings, noticeVersion: 1 };
    await fs.promises.writeFile(settingsFile, JSON.stringify(nextSettings), { mode: 0o600 });
    settings = nextSettings; publish(); return status();
  }

  const unsubscribe = subscribeBusinessEvents(record);
  const timer = setInterval(() => { summarizeErrors(); void flush(); }, 30000); timer.unref?.();
  selectScope(); record({ eventName: 'app_session_started', properties: {} });
  try {
    const installation = JSON.parse(fs.readFileSync(installationFile, 'utf8'));
    if (installation.scope === scope && /^\d+\.\d+\.\d+$/.test(installation.targetVersion || '') && Number.isFinite(installation.requestedAt)
      && Date.now() >= installation.requestedAt && Date.now() - installation.requestedAt < 30 * 86400000) record({ eventName: 'usage_session_summary', properties: {
      featureId: 'software_update', action: versionReached(appVersion, installation.targetVersion) ? 'installation_verified' : 'installation_not_confirmed',
      result: versionReached(appVersion, installation.targetVersion) ? 'success' : 'unknown' } });
    fs.unlinkSync(installationFile);
  } catch { /* First launch or unreadable diagnostics cannot prevent startup. */ }

  /** Save only a requested version; next launch confirms the installed version, never the installer process. */
  function markInstallRequested(targetVersion) {
    if (!settings.enabled || !/^\d+\.\d+\.\d+$/.test(targetVersion || '')) return;
    const temporary = `${installationFile}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify({ targetVersion, requestedAt: Date.now(), scope: selectScope() && scope }), { mode: 0o600 });
      fs.renameSync(temporary, installationFile);
    } catch { /* Installation proceeds even if diagnostic storage is unavailable. */ }
    finally { try { fs.rmSync(temporary, { force: true }); } catch { /* Retry cleanup does not block the installer. */ } }
  }
  /** Finish a bounded session summary; shutdown never waits for the network. */
  async function dispose() {
    summarizeErrors();
    record({ eventName: 'usage_session_summary', properties: { action: 'session', durationMs: Math.min(86400000, performance.now() - sessionStart) } });
    stopped = true; active?.abort(); clearInterval(timer); unsubscribe(); await chain;
  }
  return { record, flush, status, setEnabled, acknowledgeNotice, markInstallRequested, retry: () => { blocked = false; nextRetryAt = 0; return flush(true); }, dispose };
}

module.exports = { createUsageAnalytics, normalizeEvent, restoreEvent, scrub, EVENT_NAMES, normalizeRuntimeVersions };
