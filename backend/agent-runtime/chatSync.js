const path = require('path');
const { createHash, randomUUID } = require('crypto');
const { isDeepStrictEqual } = require('util');
const { readJson, writeJsonAtomic } = require('./storage');
const { agentError } = require('./errors');

const MAX_EVENT_BYTES = 8 * 1024 * 1024;
const MAX_QUEUE_BYTES = 64 * 1024 * 1024;
const IDENTIFIER = /^[A-Za-z0-9_.:-]{1,160}$/;

/** 接口必须使用 HTTPS；HTTP 仅开放给本机联调，地址不能携带凭据。 */
function normalizeSyncEndpoint(value) {
  if (typeof value !== 'string' || value.length > 2048) throw agentError('AGENT_SYNC_SETTINGS_INVALID', '聊天上传接口地址格式无效。');
  const text = value.trim();
  if (!text) return '';
  let url;
  try { url = new URL(text); } catch { throw agentError('AGENT_SYNC_SETTINGS_INVALID', '请输入完整的聊天上传接口 URL。'); }
  if (url.username || url.password || text.includes('?') || text.includes('#') || !['https:', 'http:'].includes(url.protocol)
    || (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw agentError('AGENT_SYNC_SETTINGS_INVALID', '接口须使用 HTTPS（本机测试可使用 HTTP），且不能包含账号、查询参数或片段。');
  }
  return url.href;
}

/** 只接受真实时间戳，避免把其他运行数据装入时间字段。 */
function timestamp(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined; }

/** 消息正文隐藏已知凭据、Bearer 密钥、内嵌图片和绝对文件路径。 */
function redactText(value, secrets) {
  let text = typeof value === 'string' ? value : '';
  for (const secret of secrets.filter((item) => typeof item === 'string' && item).sort((a, b) => b.length - a.length)) text = text.split(secret).join('[已隐藏凭据]');
  return text.replace(/Bearer\s+\S+/gi, 'Bearer [已隐藏凭据]')
    .replace(/sk-[\w-]{8,}/g, '[已隐藏凭据]')
    .replace(/data:[^\s,;]+(?:;[^,\s]*)?;base64,[A-Za-z0-9+/=\r\n]+/gi, '[已省略内嵌数据]')
    .replace(/\b[A-Za-z]:[\\/][^\s"'<>|`，。；）)\]]*/g, '[本地路径]')
    .replace(/\\\\[^\s"'<>|`，。；）)\]]+/g, '[本地路径]')
    .replace(/(?<![:/\w])\/[A-Za-z0-9_.~-][^\s"'<>`，。；）)\]]*/g, '[本地路径]');
}

/** 只复制消息正文、任务状态及已引用附件的名称；工具和采集载荷不进入队列。 */
function conversationSnapshot(state, secrets) {
  const source = state?.conversation;
  if (!source || !IDENTIFIER.test(source.id || '') || !Array.isArray(source.messages) || !Array.isArray(source.tasks)) return null;
  const attachmentIds = new Set();
  const messages = source.messages.filter((item) => item && IDENTIFIER.test(item.id || '') && ['user', 'assistant'].includes(item.role)).map((item) => {
    const selected = Array.isArray(item.attachmentIds) ? [...new Set(item.attachmentIds.filter((id) => typeof id === 'string' && IDENTIFIER.test(id)))] : [];
    for (const id of selected) attachmentIds.add(id);
    return { id: item.id, ...(IDENTIFIER.test(item.taskId || '') ? { taskId: item.taskId } : {}), role: item.role,
      text: redactText(item.text, secrets), ...(timestamp(item.createdAt) ? { createdAt: timestamp(item.createdAt) } : {}),
      ...(selected.length ? { attachmentIds: selected } : {}) };
  });
  if (!messages.length) return null;
  const tasks = source.tasks.filter((item) => item && IDENTIFIER.test(item.id || '') && typeof item.status === 'string' && /^[a-z_]{1,40}$/.test(item.status)).map((item) => ({
    id: item.id, status: item.status, ...(timestamp(item.createdAt) ? { createdAt: timestamp(item.createdAt) } : {}),
    ...(timestamp(item.finishedAt) ? { finishedAt: timestamp(item.finishedAt) } : {}),
    ...(typeof item.error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(item.error.code) ? { errorCode: item.error.code } : {}),
  }));
  const attachments = (Array.isArray(state.attachments) ? state.attachments : []).filter((item) => item && attachmentIds.has(item.id)).map((item) => ({
    id: item.id, name: redactText(path.win32.basename(path.posix.basename(typeof item.name === 'string' ? item.name : '附件')), secrets).slice(0, 255),
    ...(['image', 'text', 'csv', 'json', 'xlsx', 'file'].includes(item.kind) ? { kind: item.kind } : {}),
    ...(Number.isSafeInteger(item.size) && item.size >= 0 ? { size: item.size } : {}),
  }));
  return { id: source.id, ...(timestamp(source.createdAt) ? { createdAt: timestamp(source.createdAt) } : {}), messages, tasks, attachments };
}

/** 重启只允许读取本模块产生的白名单快照，损坏队列不能引入额外上传字段。 */
function validStoredEvent(event) {
  const fields = ['schemaVersion', 'eventType', 'eventId', 'installationId', 'conversationId', 'revision', 'occurredAt', 'appVersion', 'conversation'];
  if (Object.keys(event).some((key) => !fields.includes(key)) || !timestamp(event.occurredAt)
    || (event.appVersion !== undefined && (typeof event.appVersion !== 'string' || event.appVersion.length > 80))) return false;
  const source = event.conversation;
  if (!source || !Array.isArray(source.tasks) || !Array.isArray(source.attachments)) return false;
  const normalized = conversationSnapshot({ conversation: { ...source, tasks: source.tasks.map((task) => ({ ...task, ...(task.errorCode ? { error: { code: task.errorCode } } : {}) })) }, attachments: source.attachments }, []);
  return isDeepStrictEqual(normalized, source);
}

/** 有界读取上传确认，不展示服务器原始响应或错误内容。 */
async function readAcknowledgement(response) {
  const length = Number(response.headers?.get('content-length'));
  if (Number.isFinite(length) && length > 16384) throw agentError('AGENT_SYNC_ACK_INVALID', '服务器确认内容过大，上传记录仍保留。');
  const reader = response.body?.getReader?.();
  if (!reader) throw agentError('AGENT_SYNC_ACK_INVALID', '服务器未返回有效的上传确认。');
  const chunks = []; let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16384) throw agentError('AGENT_SYNC_ACK_INVALID', '服务器确认内容过大，上传记录仍保留。');
      chunks.push(Buffer.from(value));
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw agentError('AGENT_SYNC_ACK_INVALID', '服务器上传确认格式无效，上传记录仍保留。'); }
  } finally { await reader.cancel().catch(() => {}); }
}

/** 创建独立的持久上传队列；所有同步失败只影响上传状态，不中断本地聊天。 */
function createChatSync({ root, getConfig, getSecrets = () => [], onStatus = () => {}, fetchImpl = globalThis.fetch, appVersion,
  now = Date.now, requestTimeoutMs = 15000, retryBaseMs = 1000, retryMaxMs = 300000,
  maximumEventBytes = MAX_EVENT_BYTES, maximumQueueBytes = MAX_QUEUE_BYTES } = {}) {
  const directory = path.join(root, 'chat-sync');
  let installationId = null, config = { enabled: false, endpoint: '', token: '' }, outbox = null, file = null;
  let latestState = null, localError = null, controller = null, timer = null, generation = 0, disposed = false, initialized = false;
  const deferredSnapshots = new Map();
  // Keep different software licenses in separate queues without writing the key itself.
  const scope = () => config.authScheme === 'License'
    ? `${config.endpoint}\nlicense:${createHash('sha256').update(config.token).digest('hex')}` : config.endpoint;
  /** Re-read the current license from the main process at each dispatch boundary. */
  function readConfig() {
    const input = getConfig();
    return { enabled: input?.enabled === true, endpoint: normalizeSyncEndpoint(input?.endpoint || ''),
      token: typeof input?.token === 'string' ? input.token : '', authScheme: input?.authScheme === 'License' ? 'License' : 'Bearer' };
  }
  /** Detect credential changes before a queued event can be sent with stale authorization. */
  function configChanged() {
    const next = readConfig();
    return ['enabled', 'endpoint', 'token', 'authScheme'].some((key) => next[key] !== config[key]);
  }

  /** 构造仅含固定描述的公开错误，绝不回显网络地址或服务端响应。 */
  function safeError(code, message) { return { code, message }; }

  /** 输出界面可读的上传状态，不暴露令牌和消息正文。 */
  function getStatus() {
    const pendingCount = Object.values(outbox?.records || {}).filter((entry) => entry.event).length;
    const deferred = [...deferredSnapshots.values()].filter((item) => item.endpoint === scope());
    const state = !config.enabled ? 'disabled' : localError || deferred.length ? 'error' : outbox?.blocked ? 'blocked'
      : controller ? 'syncing' : outbox?.nextRetryAt ? 'retrying' : 'idle';
    return { state, pendingCount, unsyncedCount: deferred.length, installationId, lastSuccessAt: outbox?.lastSuccessAt || null,
      lastError: localError || deferred[0]?.error || outbox?.blocked || outbox?.lastError || null, nextRetryAt: outbox?.nextRetryAt || null };
  }

  /** UI 订阅者抛错也不能影响队列和聊天。 */
  function publish() { try { onStatus(getStatus()); } catch { /* 上传状态订阅不能阻断聊天。 */ } }

  /** 在整体容量检查后原子保存；失败不替换内存中的上一份队列。 */
  function persist(next) {
    if (Buffer.byteLength(JSON.stringify(next)) > maximumQueueBytes) throw agentError('AGENT_SYNC_QUEUE_FULL', '聊天上传队列已满，已有记录保留；请恢复上传后重试。');
    writeJsonAtomic(file, next); outbox = next;
  }

  /** 存储故障使用稳定提示，避免把本地路径带给 UI 或其他日志。 */
  function reportLocal(error) {
    localError = ['AGENT_SYNC_QUEUE_FULL', 'AGENT_SYNC_EVENT_LIMIT', 'AGENT_SYNC_SETTINGS_INVALID'].includes(error?.code)
      ? safeError(error.code, error.message) : safeError('AGENT_SYNC_STORAGE_FAILED', '聊天上传队列无法读写，原记录保留；本地聊天可继续，请检查磁盘后重试。');
    publish();
  }

  /** 创建或读取随机安装标识，不采集设备序列号、账号或 MAC。 */
  function loadInstallation() {
    const identityFile = path.join(directory, 'installation.json');
    const saved = readJson(identityFile, null, 4096);
    if (saved && (saved.schemaVersion !== 1 || typeof saved.installationId !== 'string' || !/^[a-f0-9-]{36}$/.test(saved.installationId))) throw new Error('invalid identity');
    if (saved) installationId = saved.installationId;
    else {
      const next = { schemaVersion: 1, installationId: randomUUID() };
      writeJsonAtomic(identityFile, next); installationId = next.installationId;
    }
  }

  /** 每个服务器地址有独立队列，切换后不会把旧服务器的待上传内容转交新地址。 */
  function loadOutbox() {
    const endpointHash = createHash('sha256').update(scope()).digest('hex');
    file = path.join(directory, 'outboxes', `${endpointHash}.json`);
    const initial = { schemaVersion: 1, endpoint: config.endpoint, records: {}, lastSuccessAt: null, failureCount: 0, nextRetryAt: null, blocked: null, lastError: null };
    const saved = readJson(file, initial, maximumQueueBytes);
    if (saved?.schemaVersion !== 1 || saved.endpoint !== config.endpoint || !saved.records || typeof saved.records !== 'object' || Array.isArray(saved.records)) throw new Error('invalid queue');
    for (const [id, entry] of Object.entries(saved.records)) {
      if (!IDENTIFIER.test(id) || !Number.isSafeInteger(entry?.revision) || entry.revision < 1 || typeof entry.digest !== 'string') throw new Error('invalid revision');
      if (entry.event && (entry.event.schemaVersion !== 1 || entry.event.eventType !== 'agent.conversation.upsert' || entry.event.installationId !== installationId
        || entry.event.conversationId !== id || entry.event.revision !== entry.revision || !IDENTIFIER.test(entry.event.eventId || '') || entry.event.conversation?.id !== id
        || !validStoredEvent(entry.event) || Buffer.byteLength(JSON.stringify(entry.event)) > maximumEventBytes
        || createHash('sha256').update(JSON.stringify(entry.event.conversation)).digest('hex') !== entry.digest)) throw new Error('invalid event');
    }
    outbox = saved;
  }

  /** 清理定时器并中断在飞请求；旧请求回调不能更新新配置的队列。 */
  function cancelWork() {
    generation += 1;
    if (timer) clearTimeout(timer);
    timer = null;
    controller?.abort(); controller = null;
  }

  /** 按持久退避时间启动一次上传，普通状态变化不能绕过退避或鉴权阻断。 */
  function schedule() {
    if (disposed || !config.enabled || !outbox || outbox.blocked || localError || controller || timer) return;
    if (!Object.values(outbox.records).some((entry) => entry.event)) return;
    const delay = Math.max(0, (Date.parse(outbox.nextRetryAt || '') || 0) - now());
    timer = setTimeout(() => { timer = null; void sendNext(); }, delay);
    timer.unref?.();
  }

  /** 同一会话保留最新快照，每次正文或任务状态变化增加 revision。 */
  function enqueueConversation(conversation) {
    const digest = createHash('sha256').update(JSON.stringify(conversation)).digest('hex');
    const previous = outbox.records[conversation.id];
    if (previous?.digest === digest) return;
    const revision = (previous?.revision || 0) + 1;
    const event = { schemaVersion: 1, eventType: 'agent.conversation.upsert', eventId: randomUUID(), installationId,
      conversationId: conversation.id, revision, occurredAt: new Date(now()).toISOString(),
      ...(typeof appVersion === 'string' ? { appVersion: appVersion.slice(0, 80) } : {}), conversation };
    if (Buffer.byteLength(JSON.stringify(event)) > maximumEventBytes) throw agentError('AGENT_SYNC_EVENT_LIMIT', '本次聊天快照超过上传大小限制，本地记录保留；请新建会话。');
    persist({ ...outbox, records: { ...outbox.records, [conversation.id]: { revision, digest, event } } });
  }

  /** 容量失败保留有界内存快照；未落盘的记录持续报错，重启后需重新打开原会话。 */
  function deferSnapshot(conversation, error) {
    const key = `${scope()}\n${conversation.id}`;
    const bytes = Buffer.byteLength(JSON.stringify(conversation));
    const used = [...deferredSnapshots.entries()].reduce((total, [entryKey, item]) => total + (entryKey === key ? 0 : item.bytes), 0);
    const retained = error.code === 'AGENT_SYNC_QUEUE_FULL' && bytes + used <= maximumQueueBytes;
    deferredSnapshots.set(key, { endpoint: scope(), conversation: retained ? conversation : null, bytes: retained ? bytes : 0,
      error: safeError(error.code, retained ? error.message : `${error.message} 如已切换会话，请在恢复后重新打开原会话。`) });
  }

  /** 本次状态落盘失败只影响上传；不同会话的容量失败不会互相覆盖。 */
  function enqueueLatest() {
    if (!latestState || !config.enabled || !outbox) return;
    const conversation = conversationSnapshot(latestState, [...getSecrets(), config.token]);
    if (!conversation) return;
    try {
      enqueueConversation(conversation);
      deferredSnapshots.delete(`${scope()}\n${conversation.id}`);
      localError = null;
    } catch (error) {
      if (['AGENT_SYNC_QUEUE_FULL', 'AGENT_SYNC_EVENT_LIMIT'].includes(error?.code)) deferSnapshot(conversation, error);
      else throw error;
    }
  }

  /** 已有队列排空后重试被容量拒绝的快照，仍未落盘的会话保持错误可见。 */
  function flushDeferred() {
    for (const [key, item] of deferredSnapshots) {
      if (item.endpoint !== scope() || !item.conversation) continue;
      try { enqueueConversation(item.conversation); deferredSnapshots.delete(key); }
      catch (error) {
        if (!['AGENT_SYNC_QUEUE_FULL', 'AGENT_SYNC_EVENT_LIMIT'].includes(error?.code)) throw error;
      }
    }
  }

  /** 网络失败持久退避，客户端配置类错误保留队列直到用户重试。 */
  function recordFailure(error, blocked) {
    const failureCount = (outbox.failureCount || 0) + 1;
    const delay = Math.min(retryMaxMs, retryBaseMs * 2 ** Math.min(failureCount - 1, 20));
    persist({ ...outbox, failureCount, blocked: blocked ? error : null, lastError: error,
      nextRetryAt: blocked ? null : new Date(now() + delay).toISOString() });
  }

  /** 发送一个快照，只有匹配 eventId 的显式确认才能清队列。 */
  async function sendNext() {
    if (disposed || !config.enabled || !outbox || outbox.blocked || controller) return;
    const event = Object.values(outbox.records).find((entry) => entry.event)?.event;
    if (!event) return;
    const epoch = generation, active = new AbortController();
    controller = active; publish();
    const timeout = setTimeout(() => active.abort(), requestTimeoutMs);
    timeout.unref?.();
    try {
      if (configChanged()) { reconfigure(); return; }
      const response = await fetchImpl(config.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `${config.authScheme} ${config.token}`, 'Idempotency-Key': event.eventId },
        body: JSON.stringify(event), redirect: 'error', signal: active.signal });
      if (epoch !== generation || disposed) return;
      if (![200, 201, 202].includes(response.status)) {
        await response.body?.cancel?.().catch(() => {});
        if (epoch !== generation || disposed) return;
        const blocked = response.status >= 400 && response.status < 500 && response.status !== 429;
        const error = safeError('AGENT_SYNC_HTTP_ERROR', `聊天上传失败（HTTP ${response.status}），${blocked ? '请检查软件密钥状态或上传凭证后重试' : '将自动重试'}。`);
        recordFailure(error, blocked);
      } else {
        const acknowledgement = await readAcknowledgement(response);
        if (epoch !== generation || disposed) return;
        if (acknowledgement?.accepted !== true || acknowledgement.eventId !== event.eventId) throw agentError('AGENT_SYNC_ACK_INVALID', '服务器未确认当前上传记录，队列已保留并将重试。');
        const latest = outbox.records[event.conversationId];
        const records = { ...outbox.records };
        if (latest?.event?.eventId === event.eventId) records[event.conversationId] = { ...latest, event: null };
        persist({ ...outbox, records, lastSuccessAt: new Date(now()).toISOString(), failureCount: 0, nextRetryAt: null, blocked: null, lastError: null });
        flushDeferred();
      }
    } catch (error) {
      if (epoch !== generation || disposed) return;
      try {
        if (/^(?:EACCES|EPERM|ENOSPC|EROFS|EIO|ENOENT|EMFILE|ENFILE|AGENT_SYNC_QUEUE_FULL)$/.test(error?.code || '')) reportLocal(error);
        else recordFailure(error?.code === 'AGENT_SYNC_ACK_INVALID' ? safeError(error.code, error.message)
          : safeError('AGENT_SYNC_NETWORK_ERROR', '聊天上传网络异常或超时，记录已保留并将自动重试。'), false);
      }
      catch (storageError) { reportLocal(storageError); }
    } finally {
      clearTimeout(timeout);
      if (epoch === generation && !disposed) { controller = null; publish(); schedule(); }
    }
  }

  /** 观察非流式运行状态；白名单提取和落盘异常不会向调用者传播。 */
  function observe(state) {
    if (disposed) return getStatus();
    try {
      if (configChanged()) reconfigure();
      latestState = state;
      enqueueLatest(); schedule();
    } catch (error) { reportLocal(error); }
    publish(); return getStatus();
  }

  /** 配置变化后取消旧请求并恢复对应地址的队列。 */
  function reconfigure() {
    if (disposed) return getStatus();
    cancelWork(); outbox = null; file = null; localError = null;
    try {
      const next = readConfig();
      if (config.enabled && (config.authScheme === 'License' || next.authScheme === 'License')
        && (config.token !== next.token || config.authScheme !== next.authScheme)) latestState = null;
      config = next;
      if (config.enabled) {
        if (!config.endpoint || !config.token || config.token.length > 8192 || /[\x00-\x20\x7f]/.test(config.token)) throw agentError('AGENT_SYNC_SETTINGS_INVALID', config.authScheme === 'License' ? '未读取到软件密钥，请先激活软件，再重试聊天同步。' : '启用聊天上传前，请填写服务器接口和上传令牌。');
        loadInstallation(); loadOutbox();
        if (initialized && (outbox.blocked || outbox.nextRetryAt)) persist({ ...outbox, blocked: null, lastError: null, nextRetryAt: null, failureCount: 0 });
        enqueueLatest(); flushDeferred(); schedule();
      }
    } catch (error) { reportLocal(error); }
    initialized = true;
    publish(); return getStatus();
  }

  /** 用户重试会重新读取存储并解除鉴权阻断；原 eventId 保持不变。 */
  function retry() {
    reconfigure();
    if (!disposed && config.enabled && outbox) {
      try { persist({ ...outbox, blocked: null, lastError: null, nextRetryAt: null, failureCount: 0 }); schedule(); }
      catch (error) { reportLocal(error); }
    }
    publish(); return getStatus();
  }

  /** 停止网络活动，保留磁盘队列供下次启动继续上传。 */
  function dispose() { disposed = true; cancelWork(); }

  reconfigure();
  return { observe, reconfigure, retry, getStatus, dispose };
}

module.exports = { createChatSync, normalizeSyncEndpoint };
