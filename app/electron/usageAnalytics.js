const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { subscribeBusinessEvents } = require('../../backend/common/businessEvents');
const { compactStackLocations } = require('./diagnosticStack');
const { V2_EVENTS, V2_PROPERTIES, normalizeV2Property, validateV2Event } = require('./usageContractV2');
const { setUsageEvidenceAdapter } = require('../../backend/common/usageEvidence');

const MAX_EVENTS = 2000, MAX_BYTES = 8 * 1024 * 1024, MAX_AGE_MS = 30 * 86400000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const QUALITY_COUNTERS = ['droppedCount', 'invalidCount', 'expiredCount', 'capacityDroppedCount', 'storageFailureCount', 'suppressedCount', 'repeatedCount'];

/** Keep final evidence and diagnostics ahead of high-volume exposure or residence observations. */
function eventPriority(event) {
  if (['collection_finished', 'collection_outcome_reconciled'].includes(event.eventName) || event.properties.severity === 'fatal') return 3;
  if (['error_reported', 'collection_started', 'feature_attempted', 'export_result'].includes(event.eventName)) return 2;
  return 1;
}

/** Restore only bounded cumulative counters; a quality ID identifies one durable scope ledger. */
function readQuality(input = {}) {
  return { qualityId: UUID.test(input.qualityId || '') ? input.qualityId : randomUUID(),
    ...Object.fromEntries(QUALITY_COUNTERS.map(name => [name, Number.isSafeInteger(input[name]) && input[name] >= 0 && input[name] <= 1e12 ? input[name] : 0])) };
}

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
  const schemaVersion = input?.schemaVersion ?? 1;
  if (![1, 2].includes(schemaVersion) || !input || !(EVENT_NAMES.has(input.eventName) || schemaVersion === 2 && V2_EVENTS.has(input.eventName))
    || !input.properties || typeof input.properties !== 'object' || Array.isArray(input.properties)
    || Object.keys(input.properties).some(name => !PROPERTY_NAMES.has(name) && !(schemaVersion === 2 && V2_PROPERTIES.has(name)))) throw new Error('USAGE_EVENT_INVALID');
  const properties = {};
  for (const [name, value] of Object.entries(input.properties)) {
    if (schemaVersion === 2 && V2_PROPERTIES.has(name)) properties[name] = normalizeV2Property(name, value);
    else if (['message', 'stack'].includes(name)) {
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
  if (schemaVersion === 2) validateV2Event(input.eventName, properties);
  if (properties.systemType && properties.systemOrigin !== 'builtin') properties.systemType = `${properties.systemOrigin || 'custom'}.${createHash('sha256').update(`${identity.installationId}:${identity.scope}:${properties.systemType}`).digest('hex').slice(0, 16)}`;
  const { scope, epoch, runtimeVersions: rawVersions, ...publicIdentity } = identity;
  const runtimeVersions = normalizeRuntimeVersions(rawVersions);
  const event = { schemaVersion, eventId: randomUUID(), ...publicIdentity, ...(Object.keys(runtimeVersions).length ? { runtimeVersions } : {}), occurredAt: new Date().toISOString(), eventName: input.eventName, properties };
  if (Buffer.byteLength(JSON.stringify(event)) > 4096) throw new Error('USAGE_EVENT_TOO_LARGE');
  return event;
}

/** Revalidate persisted queues instead of trusting arbitrary JSON copied into the application directory. */
function restoreEvent(event, installationId, secrets) {
  const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const fields = new Set(['schemaVersion', 'eventId', 'installationId', 'sessionId', 'appVersion', 'environment', 'runtimeVersions', 'occurredAt', 'eventName', 'properties']);
  const occurred = Date.parse(event?.occurredAt);
  if (!event || Object.keys(event).some(name => !fields.has(name)) || ![1, 2].includes(event.schemaVersion)
    || event.installationId !== installationId || !uuid.test(event.eventId) || !uuid.test(event.sessionId)
    || !/^\d+\.\d+\.\d+$/.test(event.appVersion) || !['production', 'development', 'test'].includes(event.environment)
    || typeof event.occurredAt !== 'string' || event.occurredAt.length > 40
    || event.properties?.supersedesEventId === event.eventId
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
  if (!UUID.test(settings.installationId || '')) settings.installationId = randomUUID();
  settings.enabled = settings.enabled === true;
  if (!Number.isSafeInteger(settings.epoch) || settings.epoch < 0) settings.epoch = 0;
  try { fs.writeFileSync(settingsFile, JSON.stringify(settings), { mode: 0o600 }); } catch { storageError = true; }
  const sessionId = randomUUID(), sessionStart = performance.now();
  let scope = '', queue = [], chain = Promise.resolve(), sending = false, stopped = false, failureCount = 0, nextRetryAt = 0,
    lastSuccessAt = null, lastError = storageError ? '使用统计目录不可写，业务功能不受影响。' : null, blocked = false, dropped = 0, active = null, writeFailed = storageError;
  let lastErrorCode = storageError ? 'USAGE_STORAGE_UNAVAILABLE' : null, httpStatus = null;
  let quality = readQuality(), capabilityCheckedAt = 0, receiverV2 = false, recording = false, publishing = false, trimming = false;
  const repeatedErrors = new Map();
  const outboxes = new Map(), reportedOutboxErrors = new Set();
  const pendingWrites = new Map();
  const latestSnapshots = new Map(), durableSnapshots = new WeakSet();
  let writing = false, settingsChain = Promise.resolve(), consentRevision = 0;

  /** Count known loss without recursively generating diagnostics from the sender itself. */
  function countQuality(name, count = 1) {
    quality[name] = Math.min(1e12, quality[name] + count);
    if (['invalidCount', 'expiredCount', 'capacityDroppedCount', 'suppressedCount'].includes(name)) {
      quality.droppedCount = Math.min(1e12, quality.droppedCount + count); dropped = quality.droppedCount;
    }
  }

  /** Select a queue from the current credential digest; never send an old customer's queue with a new key. */
  function selectScope() {
    let key;
    try { key = String(getLicenseKey() || '').trim(); } catch { return ''; }
    const next = key ? createHash('sha256').update(key).digest('hex') : '';
    if (next === scope) return key;
    if (latestSnapshots.size >= 16 && next && !latestSnapshots.has(next)) {
      lastError = '统计存储仍有未保存的授权范围，暂缓记录新范围；业务功能不受影响。'; lastErrorCode = 'USAGE_STORAGE_UNAVAILABLE'; return '';
    }
    if (durableSnapshots.has(latestSnapshots.get(scope))) latestSnapshots.delete(scope);
    active?.abort(); scope = next; queue = []; quality = readQuality(); dropped = 0; repeatedErrors.clear(); blocked = false; lastSuccessAt = null; lastError = null; lastErrorCode = null; httpStatus = null; nextRetryAt = 0;
    if (scope) {
      try {
        let saved = latestSnapshots.get(scope);
        if (!saved) {
          const file = path.join(directory, `${scope}.json`), stat = fs.statSync(file);
          if (stat.size > MAX_BYTES) throw new Error('USAGE_QUEUE_INVALID');
          saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        if (!Array.isArray(saved.events) || saved.events.length > MAX_EVENTS) throw new Error('USAGE_QUEUE_INVALID');
        quality = readQuality(saved.quality); dropped = quality.droppedCount;
        if ((saved.epoch ?? 0) !== settings.epoch) {
          countQuality('suppressedCount', saved.events.length); void persist(); return key;
        }
        const ids = new Set();
        for (const event of saved.events) {
          try {
            const valid = restoreEvent(event, settings.installationId, [...getSecrets(), key]);
            if (!ids.has(valid.eventId)) { queue.push(valid); ids.add(valid.eventId); }
          } catch { countQuality(Date.parse(event?.occurredAt) < Date.now() - MAX_AGE_MS ? 'expiredCount' : 'invalidCount'); }
        }
        if (Array.isArray(saved.repeats)) for (const item of saved.repeats.slice(0, 128)) {
          try {
            const template = restoreEvent(item.template, settings.installationId, [...getSecrets(), key]);
            if (!/^[a-f0-9]{64}$/.test(item.fingerprint) || !Number.isSafeInteger(item.count) || item.count < 0 || item.count > 1e12
              || !Number.isFinite(Date.parse(item.lastObservedAt)) || Date.parse(item.lastObservedAt) > Date.now() + 60000
              || Date.parse(item.lastObservedAt) < Date.parse(template.occurredAt)) throw new Error('USAGE_REPEAT_INVALID');
            repeatedErrors.set(item.fingerprint, { template, count: item.count, lastObservedAt: item.lastObservedAt });
          } catch { countQuality('invalidCount'); }
        }
      } catch (error) { if (error.code !== 'ENOENT') { countQuality('invalidCount'); lastError = '使用统计队列无法读取，请关闭后重新开启。'; } }
    }
    return key;
  }

  /** Serialize atomic asynchronous writes; failures keep the queue and cannot affect the business call. */
  function persist(targetScope = scope, savedSnapshot = null) {
    if (!targetScope) return chain;
    const nextSnapshot = savedSnapshot || { epoch: settings.epoch, events: queue.slice(), quality: { ...quality },
      repeats: [...repeatedErrors].map(([fingerprint, item]) => ({ fingerprint, ...item })) };
    pendingWrites.set(targetScope, nextSnapshot); latestSnapshots.set(targetScope, nextSnapshot);
    if (writing) return chain;
    writing = true;
    chain = chain.catch(() => {}).then(async () => {
      while (pendingWrites.size) {
        const [digest, snapshot] = pendingWrites.entries().next().value;
        pendingWrites.delete(digest);
        const file = path.join(directory, `${digest}.json`), temporary = `${file}.${randomUUID()}.tmp`;
        try {
          const handle = await fs.promises.open(temporary, 'w', 0o600);
          try { await handle.writeFile(JSON.stringify(snapshot)); await handle.sync(); } finally { await handle.close(); }
          await fs.promises.rename(temporary, file);
          durableSnapshots.add(snapshot);
          if (digest !== scope && latestSnapshots.get(digest) === snapshot) latestSnapshots.delete(digest);
          if (digest === scope) writeFailed = false;
        } catch {
          if (digest === scope) { writeFailed = true; countQuality('storageFailureCount'); lastError = '使用统计暂未保存，业务功能不受影响。'; lastErrorCode = 'USAGE_STORAGE_UNAVAILABLE'; publish(); }
          await fs.promises.unlink(temporary).catch(() => {});
        }
      }
    }).finally(() => { writing = false; if (pendingWrites.size) void persist(); });
    return chain;
  }

  /** Read trusted committed outboxes without copying their immutable bodies into a second disk queue. */
  function outboxRecords(targetScope = scope) {
    const records = [];
    for (const provider of outboxes.keys()) {
      try {
        const items = provider.list();
        if (!Array.isArray(items)) throw new Error('USAGE_OUTBOX_INVALID');
        for (const item of items) {
          if (item.state !== 'pending' || item.scope !== targetScope) continue;
          if ((item.epoch ?? 0) !== settings.epoch) {
            if (provider.settle(item.event.eventId, 'suppressed', 'consent_changed') && targetScope === scope) countQuality('suppressedCount');
            continue;
          }
          if (Date.parse(item.event?.occurredAt) < Date.now() - MAX_AGE_MS) {
            if (provider.settle(item.event.eventId, 'expired', 'retention') && targetScope === scope) countQuality('expiredCount');
            continue;
          }
          const event = restoreEvent(item.event, settings.installationId, getSecrets());
          const bodyBytes = Buffer.byteLength(JSON.stringify(event));
          records.push({ provider, event, scope: item.scope,
            physicalBytes: Number.isSafeInteger(item.physicalBytes) && item.physicalBytes >= bodyBytes ? item.physicalBytes : bodyBytes });
        }
      } catch {
        if (!reportedOutboxErrors.has(provider)) { reportedOutboxErrors.add(provider); countQuality('invalidCount'); }
        lastError = '部分统计证据无法读取，观测可能不完整。'; lastErrorCode = 'USAGE_OUTBOX_INVALID';
      }
    }
    return records;
  }

  /** Count all physical envelope copies and unique IDs against the shared per-customer budget. */
  function usageSize(events, records, candidate, repeats = [...repeatedErrors].map(([fingerprint, item]) => ({ fingerprint, ...item }))) {
    const queued = [...events, ...(candidate ? [candidate] : [])], all = [...queued, ...records.map(item => item.event)];
    const repeatsBytes = Buffer.byteLength(JSON.stringify(repeats));
    return { count: new Set(all.map(event => event.eventId)).size,
      bytes: queued.reduce((sum, event) => sum + Buffer.byteLength(JSON.stringify(event)), 0)
        + records.reduce((sum, item) => sum + item.physicalBytes, 0) + repeatsBytes + 4096 };
  }

  /** Admit critical evidence by evicting only lower-priority unsent queue entries. */
  function admit(event, targetScope = scope) {
    const records = outboxRecords(targetScope);
    let events = queue, repeats;
    if (targetScope !== scope) {
      try {
        let saved = latestSnapshots.get(targetScope);
        if (!saved) {
          const file = path.join(directory, `${targetScope}.json`);
          if (fs.statSync(file).size > MAX_BYTES) return false;
          saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        if ((saved.epoch ?? 0) !== settings.epoch) { events = []; repeats = []; }
        else { events = saved.events || []; repeats = saved.repeats || []; }
      } catch (error) { if (error.code !== 'ENOENT') return false; events = []; repeats = []; }
    }
    let size = usageSize(events, records, event, repeats);
    while (size.count > MAX_EVENTS || size.bytes > MAX_BYTES) {
      const victim = targetScope === scope ? events.findIndex(item => eventPriority(item) < eventPriority(event)) : -1;
      if (victim < 0) { if (targetScope === scope) countQuality('capacityDroppedCount'); return false; }
      events.splice(victim, 1); countQuality('capacityDroppedCount'); size = usageSize(events, records, event, repeats);
    }
    return true;
  }

  /** Apply the same capacity and retention policy when journals return after a restart. */
  function trimBudget(targetScope = scope) {
    if (trimming) return;
    trimming = true;
    try {
    let saved = null, scopedQueue = queue;
    if (targetScope !== scope) {
      try {
        saved = latestSnapshots.get(targetScope);
        if (!saved) {
          const file = path.join(directory, `${targetScope}.json`);
          if (fs.statSync(file).size > MAX_BYTES) throw new Error('USAGE_QUEUE_INVALID');
          saved = JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        saved = JSON.parse(JSON.stringify(saved));
        if (!Array.isArray(saved.events) || saved.events.length > MAX_EVENTS) throw new Error('USAGE_QUEUE_INVALID');
      } catch (error) {
        if (error.code !== 'ENOENT') return;
        saved = { epoch: settings.epoch, events: [], quality: readQuality(), repeats: [] };
      }
      saved.quality = readQuality(saved.quality); scopedQueue = saved.events;
    }
    /** Keep a loss attributed to its original owner, even while another key is selected. */
    const loss = (name, count = 1) => {
      if (!saved) countQuality(name, count);
      else {
        saved.quality[name] = Math.min(1e12, saved.quality[name] + count);
        if (name !== 'storageFailureCount') saved.quality.droppedCount = Math.min(1e12, saved.quality.droppedCount + count);
      }
    };
    let changed = false;
    const before = scopedQueue.length;
    scopedQueue = scopedQueue.filter(event => Date.parse(event.occurredAt) >= Date.now() - MAX_AGE_MS);
    if (scopedQueue.length !== before) { loss('expiredCount', before - scopedQueue.length); changed = true; }
    const records = outboxRecords(targetScope);
    let size = usageSize(scopedQueue, records, null, saved ? saved.repeats || [] : undefined);
    while (size.count > MAX_EVENTS || size.bytes > MAX_BYTES) {
      const choices = [...scopedQueue.map((event, index) => ({ event, index })), ...records.map((item, recordIndex) => ({ ...item, recordIndex }))]
        .sort((a, b) => eventPriority(a.event) - eventPriority(b.event) || Date.parse(a.event.occurredAt) - Date.parse(b.event.occurredAt));
      const victim = choices[0];
      if (!victim) break;
      if (victim.provider) {
        if (!victim.provider.settle(victim.event.eventId, 'dropped', 'capacity')) {
          loss('storageFailureCount'); lastErrorCode = 'USAGE_STORAGE_UNAVAILABLE';
          lastError = '统计证据淘汰状态无法保存，已保留原记录；观测可能不完整。'; break;
        }
        records.splice(victim.recordIndex, 1);
      } else scopedQueue.splice(victim.index, 1);
      loss('capacityDroppedCount'); changed = true; size = usageSize(scopedQueue, records, null, saved ? saved.repeats || [] : undefined);
    }
    if (!saved) queue = scopedQueue;
    else saved.events = scopedQueue;
    if (changed) void persist(targetScope, saved);
    } finally { trimming = false; }
  }

  /** Apply storage limits to original owners without selecting or uploading their credentials. */
  function trimAllOutboxes() {
    const scopes = new Set([scope]);
    for (const provider of outboxes.keys()) {
      try { for (const item of provider.list()) if (/^[a-f0-9]{64}$/.test(item.scope)) scopes.add(item.scope); }
      catch { /* The ordinary provider read reports corruption separately. */ }
    }
    for (const owner of scopes) if (owner) trimBudget(owner);
  }

  /** Combine pending sources by immutable ID; conflicting evidence is never silently replaced. */
  function pendingEvents() {
    const map = new Map();
    for (const event of [...queue, ...outboxRecords().map(item => item.event)]) {
      const previous = map.get(event.eventId);
      if (previous && JSON.stringify(previous) !== JSON.stringify(event)) {
        blocked = true; lastErrorCode = 'EVENT_CONTENT_CONFLICT'; lastError = '统计证据内容冲突，已暂停上传并保留原记录。';
      } else map.set(event.eventId, event);
    }
    return [...map.values()];
  }

  /** Expose bounded delivery health; receipt counts alone never imply full observation coverage. */
  function status() { return { enabled: settings.enabled, queued: pendingEvents().length, sending, lastSuccessAt, lastError, lastErrorCode, httpStatus, nextRetryAt, dropped,
    quality: { ...quality }, receiverV2, noticePending: settings.noticeVersion !== 1, noticeVersion: 1 }; }
  /** Snapshot trusted host versions without allowing diagnostics failure to block business events. */
  function runtimeVersions() { try { return normalizeRuntimeVersions(getRuntimeVersions()); } catch { return {}; } }
  /** Notify the settings panel without exposing credentials or customer content. */
  function publish() {
    if (publishing) return;
    publishing = true;
    try { onStatus(status()); } catch { /* An unavailable UI is harmless. */ } finally { publishing = false; }
  }

  /** Freeze only trusted identity at operation start; the raw license is never part of evidence. */
  function captureContext() {
    if (stopped || !settings.enabled || !selectScope()) return null;
    return { installationId: settings.installationId, sessionId, appVersion, environment, runtimeVersions: runtimeVersions(), scope, epoch: settings.epoch };
  }

  /** Prepare an immutable terminal envelope before its owner atomically commits final evidence. */
  function prepareEvidence(input, context) {
    if (stopped || !settings.enabled || !context || context.epoch !== settings.epoch
      || context.installationId !== settings.installationId || !/^[a-f0-9]{64}$/.test(context.scope || '')) return { state: 'suppressed', reason: 'statistics_unavailable' };
    try {
      const event = normalizeEvent(input, context, getSecrets());
      if (input.occurredAt !== undefined) {
        const at = Date.parse(input.occurredAt);
        if (typeof input.occurredAt !== 'string' || !Number.isFinite(at) || at > Date.now() + 60000) throw new Error('USAGE_EVIDENCE_TIME_INVALID');
        if (at < Date.now() - MAX_AGE_MS) return { state: 'dropped', reason: 'retention' };
        event.occurredAt = new Date(at).toISOString();
      }
      if (!admit(event, context.scope)) { void persist(); return { state: 'dropped', reason: 'capacity' }; }
      return { state: 'pending', scope: context.scope, epoch: context.epoch, event };
    } catch { countQuality('invalidCount'); void persist(); return { state: 'suppressed', reason: 'invalid_evidence' }; }
  }

  /** Record nonterminal metadata with the same frozen identity as its final evidence. */
  function recordEvidence(input, context) {
    const item = prepareEvidence(input, context);
    if (item.state !== 'pending' || item.scope !== scope) return false;
    queue.push(item.event); void persist(); publish(); return true;
  }

  /** Attach a host-owned journal; renderers cannot submit arbitrary event identities through IPC. */
  function registerOutbox(provider) {
    if (!provider || typeof provider.list !== 'function' || typeof provider.settle !== 'function') throw new Error('USAGE_OUTBOX_INVALID');
    if (outboxes.has(provider)) return () => {};
    const unsubscribe = provider.subscribe?.(() => { if (!settings.enabled) suppressOutboxes(); else trimAllOutboxes(); void persist(); publish(); }) || (() => {});
    outboxes.set(provider, unsubscribe);
    if (!settings.enabled) suppressOutboxes();
    else trimAllOutboxes();
    publish();
    return () => { outboxes.get(provider)?.(); outboxes.delete(provider); };
  }

  /** Persist suppression before discarding pending evidence so re-enabling cannot resurrect it. */
  function suppressOutboxes() {
    for (const provider of outboxes.keys()) {
      try {
        for (const item of provider.list()) if (item.state === 'pending') {
          if (!provider.settle(item.event.eventId, 'suppressed', 'statistics_disabled')) throw new Error('USAGE_OUTBOX_WRITE_FAILED');
          if (item.scope === scope) countQuality('suppressedCount');
        }
      } catch { lastError = '上报已关闭，部分证据清理未完成；不会上传，请检查目录权限。'; lastErrorCode = 'USAGE_STORAGE_UNAVAILABLE'; }
    }
  }

  /** Queue one validated event, retaining a finite recent history while offline. */
  function record(input) {
    if (stopped || !settings.enabled || recording) return false;
    const key = selectScope();
    if (!key) return false;
    recording = true;
    try {
      const event = normalizeEvent(input, { installationId: settings.installationId, sessionId, appVersion, environment, scope, runtimeVersions: runtimeVersions() }, [...getSecrets(), key]);
      if (event.eventName === 'error_reported') {
        const fingerprint = createHash('sha256').update(JSON.stringify([event.properties, event.sessionId, event.appVersion, event.runtimeVersions])).digest('hex');
        const previous = repeatedErrors.get(fingerprint);
        if (previous) {
          previous.count = Math.min(1e12, previous.count + (event.properties.count ?? 1)); previous.lastObservedAt = event.occurredAt;
          countQuality('repeatedCount', event.properties.count ?? 1); void persist(); return true;
        }
        if (repeatedErrors.size >= 128) {
          summarizeErrors();
          const oldest = repeatedErrors.keys().next().value; repeatedErrors.delete(oldest);
        }
        repeatedErrors.set(fingerprint, { count: 0, template: event, lastObservedAt: event.occurredAt });
      }
      if (!admit(event)) { void persist(); publish(); return false; }
      queue.push(event);
      void persist(); publish();
      if (queue.length >= 50) void flush();
      return true;
    } catch { countQuality('invalidCount'); void persist(); return false; }
    finally { recording = false; }
  }

  /** Emit new immutable events for repeated errors; never change an ID after it has been sent. */
  function summarizeErrors() {
    const key = selectScope();
    if (!settings.enabled || !key) return;
    let changed = false;
    for (const entry of repeatedErrors.values()) {
      if (!entry.count) continue;
      const event = { ...entry.template, eventId: randomUUID(), occurredAt: entry.lastObservedAt,
        properties: { ...entry.template.properties, count: entry.count } };
      const observations = entry.count; entry.count = 0;
      if (Buffer.byteLength(JSON.stringify(event)) > 4096) countQuality('invalidCount', observations);
      else if (admit(event)) queue.push(event);
      changed = true;
    }
    if (changed) { void persist(); publish(); }
  }

  /** Emit cumulative, scope-local quality facts; a missing summary never means zero loss. */
  function summarizeQuality() {
    if (!settings.enabled || !selectScope()) return;
    const pending = pendingEvents(), oldest = pending.map(event => event.occurredAt).sort()[0];
    record({ schemaVersion: 2, eventName: 'usage_delivery_summary', properties: {
      ...quality, queuedCount: pending.length, ...(oldest ? { oldestQueuedAt: oldest } : {}),
    } });
  }

  /** Negotiate additive semantics before sending v2; an older receiver can still accept v1. */
  async function checkReceiver(signal) {
    if (Date.now() - capabilityCheckedAt < 600000) return receiverV2;
    capabilityCheckedAt = Date.now(); receiverV2 = false;
    try {
      const url = new URL(endpoint); url.pathname = '/api/usage/capabilities'; url.search = '';
      const response = await fetchImpl(url.toString(), { method: 'GET', signal, redirect: 'error' });
      if (response.ok) receiverV2 = (await readUsageResponse(response)).schemaVersions?.includes(2) === true;
    } catch { /* Keep v2 evidence pending while v1 remains independently uploadable. */ }
    return receiverV2;
  }

  /** Batch at most 50 events; remove only IDs explicitly acknowledged by the same customer scope. */
  async function flush(force = false) {
    if (stopped || !settings.enabled || sending || blocked || (!force && Date.now() < nextRetryAt)) return status();
    const key = selectScope();
    if (!/^[A-Za-z0-9+/=]{32,8192}$/.test(key)) { if (key) { lastError = '使用统计需要有效的软件密钥。'; lastErrorCode = 'USAGE_CREDENTIAL_INVALID'; httpStatus = null; } publish(); return status(); }
    trimBudget();
    const pending = pendingEvents();
    if (!pending.length || blocked) return status();
    sending = true; publish();
    const epoch = scope, consentEpoch = settings.epoch, controller = new AbortController(); active = controller;
    const timeout = setTimeout(() => controller.abort(), 12000); timeout.unref?.();
    let failure = null;
    try {
      await chain;
      let snapshot = latestSnapshots.get(epoch);
      if (snapshot && !durableSnapshots.has(snapshot)) await persist(epoch, snapshot);
      if (scope !== epoch || consentEpoch !== settings.epoch || stopped || !settings.enabled) return status();
      snapshot = latestSnapshots.get(epoch);
      if (writeFailed || snapshot && !durableSnapshots.has(snapshot)) {
        failure = { code: 'USAGE_STORAGE_UNAVAILABLE', message: '使用统计暂未保存，将在恢复后重试。' };
        throw new Error('USAGE_STORAGE_UNAVAILABLE');
      }
      if (pending.some(event => event.schemaVersion === 2)) await checkReceiver(controller.signal);
      if (scope !== epoch || consentEpoch !== settings.epoch || stopped || !settings.enabled) return status();
      const supported = pending.filter(event => event.schemaVersion === 1 || receiverV2);
      if (!supported.length) {
        lastError = '服务器尚未启用新版统计契约，新增证据保留在本地等待兼容。'; lastErrorCode = 'USAGE_CONTRACT_UNAVAILABLE';
        return status();
      }
      const version = supported[0].schemaVersion, batch = supported.filter(event => event.schemaVersion === version).slice(0, 50);
      const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `License ${key}` },
        body: JSON.stringify({ schemaVersion: version, events: batch }), signal: controller.signal, redirect: 'error' });
      if (scope !== epoch || consentEpoch !== settings.epoch || stopped || !settings.enabled) return status();
      if (!response.ok) {
        const body = await readUsageResponse(response).catch(() => null);
        if (scope !== epoch || consentEpoch !== settings.epoch || stopped || !settings.enabled) return status();
        failure = usageHttpFailure(response.status, body); blocked = failure.blocked;
        throw new Error('USAGE_HTTP_REJECTED');
      }
      failure = { code: 'USAGE_RESPONSE_INVALID', message: '上传确认无效，将自动重试；待上传记录仍保留。', httpStatus: response.status };
      const ack = await readUsageResponse(response), ids = new Set(batch.map(event => event.eventId));
      if (scope !== epoch || consentEpoch !== settings.epoch || stopped || !settings.enabled) return status();
      if (ack.accepted !== true || !Array.isArray(ack.eventIds) || ack.eventIds.length !== ids.size || ack.eventIds.some(id => !ids.has(id)) || new Set(ack.eventIds).size !== ids.size) throw new Error('USAGE_RESPONSE_INVALID');
      for (const item of outboxRecords()) if (ids.has(item.event.eventId) && !item.provider.settle(item.event.eventId, 'acked', 'server_receipt')) {
        failure = { code: 'USAGE_STORAGE_UNAVAILABLE', message: '服务器已接收，确认记录尚未保存；将用原事件安全重试。' };
        countQuality('storageFailureCount'); throw new Error('USAGE_ACK_WRITE_FAILED');
      }
      const acknowledgedQueue = queue.filter(event => ids.has(event.eventId));
      queue = queue.filter(event => !ids.has(event.eventId));
      await persist();
      if (scope !== epoch || consentEpoch !== settings.epoch || stopped || !settings.enabled) return status();
      if (writeFailed) {
        queue.unshift(...acknowledgedQueue); void persist();
        failure = { code: 'USAGE_STORAGE_UNAVAILABLE', message: '服务器已接收，本地确认尚未保存；将用原事件安全重试。' };
        throw new Error('USAGE_ACK_WRITE_FAILED');
      }
      lastSuccessAt = new Date().toISOString(); lastError = null; lastErrorCode = null; httpStatus = null; failureCount = 0; nextRetryAt = 0;
    } catch {
      if (scope === epoch && consentEpoch === settings.epoch && settings.enabled && !stopped) {
        failureCount++; nextRetryAt = blocked ? 0 : Date.now() + Math.min(300000, 1000 * 2 ** Math.min(failureCount, 18));
        lastError = failure?.message || '使用统计上传失败，将自动重试；待上传记录仍保留。';
        lastErrorCode = failure?.code || 'USAGE_UPLOAD_FAILED'; httpStatus = failure?.httpStatus || null;
      }
    } finally { clearTimeout(timeout); sending = false; active = null; publish(); }
    return status();
  }

  /** Atomically save settings so interrupted writes never turn an opt-out into a missing configuration. */
  async function writeSettings(nextSettings) {
    const temporary = `${settingsFile}.${randomUUID()}.tmp`;
    try {
      const handle = await fs.promises.open(temporary, 'w', 0o600);
      try { await handle.writeFile(JSON.stringify(nextSettings)); await handle.sync(); } finally { await handle.close(); }
      await fs.promises.rename(temporary, settingsFile);
    } finally { await fs.promises.unlink(temporary).catch(() => {}); }
  }

  /** Serialize settings operations, keeping the latest immediate opt-out effective during older writes. */
  function updateSettings(operation) {
    const result = settingsChain.catch(() => {}).then(operation);
    settingsChain = result;
    return result;
  }

  /** Save a visible collection choice; disabling deletes pending usage events, not chats or sensor data. */
  async function setEnabled(enabled) {
    if (typeof enabled !== 'boolean') throw new Error('USAGE_SETTINGS_INVALID');
    const revision = ++consentRevision; active?.abort();
    // Disable in memory first: an in-flight response or finalizer cannot race the persisted opt-out.
    if (!enabled) settings = { ...settings, enabled: false, epoch: settings.epoch + 1 };
    return updateSettings(async () => {
    await writeSettings({ ...settings, enabled: enabled && revision === consentRevision });
    if (revision === consentRevision) settings = { ...settings, enabled };
    if (!enabled) {
      countQuality('suppressedCount', queue.length);
      await chain; queue = []; repeatedErrors.clear(); latestSnapshots.clear(); blocked = false; lastError = null; lastErrorCode = null; httpStatus = null;
      suppressOutboxes();
      try {
        await fs.promises.unlink(installationFile).catch(() => {});
        for (const name of await fs.promises.readdir(directory)) if (/^[a-f0-9]{64}\.json$/.test(name)) await fs.promises.unlink(path.join(directory, name));
      } catch { lastError = '上报已关闭，部分待传文件暂未清除；请检查目录权限后再次关闭。'; }
      await persist();
    } else if (revision === consentRevision) { selectScope(); record({ eventName: 'app_session_started', properties: {} }); }
    publish(); return status();
    });
  }

  /** Remember that this version of the upload explanation has been displayed, independently of opt-out. */
  async function acknowledgeNotice() {
    return updateSettings(async () => {
      await writeSettings({ ...settings, noticeVersion: 1 });
      settings = { ...settings, noticeVersion: 1 }; publish(); return status();
    });
  }

  const unsubscribe = subscribeBusinessEvents(record);
  const timer = setInterval(() => { summarizeErrors(); summarizeQuality(); void flush(); }, 30000); timer.unref?.();
  selectScope(); record({ eventName: 'app_session_started', properties: {} });
  const detachEvidence = setUsageEvidenceAdapter({ captureContext, prepareEvidence, recordEvidence, registerOutbox });
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
    if (stopped) { await chain; return; }
    summarizeErrors();
    record({ eventName: 'usage_session_summary', properties: { action: 'session', durationMs: Math.min(86400000, performance.now() - sessionStart) } });
    stopped = true; active?.abort(); clearInterval(timer); unsubscribe(); detachEvidence();
    for (const unsubscribeOutbox of outboxes.values()) unsubscribeOutbox();
    outboxes.clear(); await chain;
  }
  return { record, flush, status, setEnabled, acknowledgeNotice, markInstallRequested, registerOutbox,
    captureContext, prepareEvidence, recordEvidence, summarizeQuality, whenPersisted: () => chain,
    retry: async () => { blocked = false; nextRetryAt = 0; capabilityCheckedAt = 0; await persist(); return flush(true); }, dispose };
}

module.exports = { createUsageAnalytics, normalizeEvent, restoreEvent, scrub, EVENT_NAMES, normalizeRuntimeVersions };
