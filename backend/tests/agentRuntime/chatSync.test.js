const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createChatSync } = require('../../agent-runtime/chatSync');
const { createAgentSyncSettings, DEFAULT_CHAT_SYNC_ENDPOINT } = require('../../../app/electron/agentSyncSettings');

/** 为每个测试创建独立目录，并在结束时删除合成数据。 */
function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-chat-sync-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

/** 等待上传器异步行为，超时直接给出断言失败。 */
async function until(predicate) {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > deadline) assert.fail('upload did not reach expected state');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** 构造不含真实用户数据的运行状态。 */
function state(text = '识别这次抚摸', id = 'conversation-1') {
  return { conversation: { id, createdAt: '2026-09-22T00:00:00.000Z',
    messages: [{ id: 'message-1', taskId: 'task-1', role: 'user', text, createdAt: '2026-09-22T00:00:00.000Z', attachmentIds: ['attachment-1'] }],
    tasks: [{ id: 'task-1', status: 'running', createdAt: '2026-09-22T00:00:00.000Z', steps: [{ arguments: 'private-tool', result: 'private-result' }], proposals: [{ after: 'private-proposal' }] }] },
  attachments: [{ id: 'attachment-1', name: 'C:\\Users\\owner\\test.png', kind: 'image', size: 12, base64: 'private-image', textPreview: 'private-preview', text: 'private-file', path: 'C:\\private' }],
  algorithmWorkspace: { frames: 'private-frames' }, settings: { apiKey: 'private-key' } };
}

/** 用内存请求替身构造上传器，禁止触及真实服务器。 */
function fixture(t, options = {}) {
  const root = options.root || temporaryRoot(t);
  const requests = [];
  let config = { enabled: true, endpoint: 'https://test.invalid/chat', token: 'test-upload-token' };
  const sync = createChatSync({ root, getConfig: () => config, retryBaseMs: 15, retryMaxMs: 25, ...options,
    fetchImpl: options.fetchImpl || (async (url, init) => {
      const event = JSON.parse(init.body); requests.push({ url, init, event });
      return new Response(JSON.stringify({ accepted: true, eventId: event.eventId }));
    }) });
  t.after(() => sync.dispose());
  return { root, sync, requests, setConfig: (next) => { config = { ...config, ...next }; } };
}

/** 测试安全存储替身，不依赖操作系统用户凭据。 */
function encryption() {
  return { isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(value.split('').reverse().join('')),
    decryptString: (value) => value.toString().split('').reverse().join('') };
}

test('sync settings default disabled, encrypt credentials and clear token on endpoint changes', (t) => {
  const root = temporaryRoot(t), safeStorage = encryption();
  const settings = createAgentSyncSettings({ root, safeStorage });
  assert.deepEqual(settings.getPublic(), { enabled: false, endpoint: DEFAULT_CHAT_SYNC_ENDPOINT, hasToken: false, licenseAuthAvailable: true });
  settings.save({ enabled: true });
  assert.equal(settings.getPrivate().authScheme, 'License');
  settings.save({ enabled: true, endpoint: 'https://example.test/chat', token: 'synthetic-upload-secret' });
  assert.equal(settings.getPublic().hasToken, true);
  assert.equal('token' in settings.getPublic(), false);
  assert.equal(fs.readFileSync(path.join(root, 'sync-settings.json'), 'utf8').includes('synthetic-upload-secret'), false);
  assert.equal(createAgentSyncSettings({ root, safeStorage }).getPrivate().token, 'synthetic-upload-secret');
  assert.equal(createAgentSyncSettings({ root, safeStorage }).getPublic().endpoint, 'https://example.test/chat');
  assert.throws(() => settings.save({ endpoint: 'https://other.test/chat' }), { code: 'AGENT_SYNC_SETTINGS_INVALID' });
  settings.save({ enabled: false, endpoint: 'http://127.0.0.1:8080/chat' });
  assert.equal(settings.getPrivate().token, '');
  for (const endpoint of ['http://example.test/chat', 'https://user:pw@example.test/chat', 'https://example.test/chat?a=b', 'https://example.test/chat#x', 'file:///x']) {
    assert.throws(() => settings.save({ endpoint }), { code: 'AGENT_SYNC_SETTINGS_INVALID' });
  }
  for (const input of [{ enabled: 'yes' }, { token: 'bad\ntoken' }, { apiKey: 'wrong-secret' }, null]) {
    assert.throws(() => settings.save(input), { code: 'AGENT_SYNC_SETTINGS_INVALID' });
  }
});

test('the default service receives contract requests only after the customer supplies an upload token', async (t) => {
  const root = temporaryRoot(t), safeStorage = encryption(), requests = [];
  const settings = createAgentSyncSettings({ root, safeStorage });
  const sync = createChatSync({ root, getConfig: settings.getPrivate, fetchImpl: async (url, options) => {
    const event = JSON.parse(options.body);
    requests.push({ url, options, event });
    return new Response(JSON.stringify({ accepted: true, eventId: event.eventId }));
  } });
  t.after(() => sync.dispose());
  sync.observe(state());
  assert.equal(requests.length, 0);
  settings.save({ enabled: true, token: 'synthetic-service-token' });
  sync.reconfigure();
  await until(() => requests.length === 1 && sync.getStatus().pendingCount === 0);
  assert.equal(requests[0].url, 'https://shroom.jq-industries.com/api/agent/conversations');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer synthetic-service-token');
  assert.equal(requests[0].event.eventType, 'agent.conversation.upsert');
  assert.equal(requests[0].options.headers['Idempotency-Key'], requests[0].event.eventId);
  assert.equal(createAgentSyncSettings({ root, safeStorage }).getPublic().endpoint, DEFAULT_CHAT_SYNC_ENDPOINT);
});

test('empty legacy settings gain the default address without rebinding any saved credentials', (t) => {
  const root = temporaryRoot(t), file = path.join(root, 'sync-settings.json'), safeStorage = encryption();
  fs.writeFileSync(file, JSON.stringify({ enabled: false, endpoint: '' }));
  assert.equal(createAgentSyncSettings({ root, safeStorage }).getPublic().endpoint, DEFAULT_CHAT_SYNC_ENDPOINT);
  fs.writeFileSync(file, JSON.stringify({ enabled: false, endpoint: '', encryptedToken: safeStorage.encryptString('orphan-token').toString('base64') }));
  const settings = createAgentSyncSettings({ root, safeStorage });
  assert.equal(settings.getPublic().endpoint, '');
  settings.save({ enabled: true, endpoint: DEFAULT_CHAT_SYNC_ENDPOINT });
  assert.equal(settings.getPrivate().authScheme, 'License');
  assert.equal(settings.getPrivate().token, '');
});

test('official endpoint uses the current license without exposing or persisting it; custom endpoints never inherit it', async (t) => {
  const root = temporaryRoot(t), license = 'ab'.repeat(64), requests = [];
  const settings = createAgentSyncSettings({ root, safeStorage: encryption(), getLicenseKey: () => license });
  const sync = createChatSync({ root, getConfig: settings.getPrivate, fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ accepted: true, eventId: JSON.parse(options.body).eventId }));
  } });
  t.after(() => sync.dispose());
  sync.observe(state(`secret ${license}`));
  assert.equal(requests.length, 0);
  settings.save({ enabled: true }); sync.reconfigure();
  await until(() => requests.length === 1 && sync.getStatus().pendingCount === 0);
  assert.equal(requests[0].options.headers.Authorization, `License ${license}`);
  assert.equal(requests[0].options.redirect, 'error');
  assert.ok(!requests[0].options.body.includes(license));
  assert.ok(!JSON.stringify(settings.getPublic()).includes(license));
  assert.ok(!fs.readFileSync(path.join(root, 'sync-settings.json'), 'utf8').includes(license));
  assert.throws(() => settings.save({ endpoint: 'https://another.invalid/chat' }), { code: 'AGENT_SYNC_SETTINGS_INVALID' });
  settings.save({ enabled: false, endpoint: 'https://another.invalid/chat' });
  assert.equal(settings.getPrivate().token, '');
  assert.equal(settings.getPrivate().authScheme, 'Bearer');
});

test('missing license blocks uploads without preventing saving consent or local chats', (t) => {
  const root = temporaryRoot(t);
  const settings = createAgentSyncSettings({ root, safeStorage: encryption() });
  settings.save({ enabled: true });
  const sync = createChatSync({ root, getConfig: settings.getPrivate, fetchImpl: () => { assert.fail('must not upload'); } });
  t.after(() => sync.dispose());
  assert.doesNotThrow(() => sync.observe(state()));
  assert.equal(sync.getStatus().lastError.code, 'AGENT_SYNC_SETTINGS_INVALID');
  assert.equal(createAgentSyncSettings({ root, safeStorage: encryption() }).getPublic().enabled, true);
});

test('license changes cannot resend another license queue and restoring a license keeps eventId', async (t) => {
  const root = temporaryRoot(t), requests = [];
  let license = 'ab'.repeat(64);
  const settings = createAgentSyncSettings({ root, safeStorage: encryption(), getLicenseKey: () => license });
  settings.save({ enabled: true });
  const sync = createChatSync({ root, getConfig: settings.getPrivate, fetchImpl: async (_url, options) => {
    requests.push({ auth: options.headers.Authorization, event: JSON.parse(options.body) });
    return new Response('{}', { status: 401 });
  } });
  t.after(() => sync.dispose());
  sync.observe(state('first license', 'first'));
  await until(() => sync.getStatus().state === 'blocked');
  license = 'cd'.repeat(64); sync.retry();
  assert.equal(sync.getStatus().pendingCount, 0);
  sync.observe(state('second license', 'second'));
  await until(() => requests.length === 2 && sync.getStatus().state === 'blocked');
  assert.equal(requests[1].event.conversationId, 'second');
  assert.equal(requests[1].auth, `License ${license}`);
  license = 'ab'.repeat(64); sync.retry();
  await until(() => requests.length === 3 && sync.getStatus().state === 'blocked');
  assert.equal(requests[2].event.eventId, requests[0].event.eventId);
});

test('a license removed before scheduled transmission is not used from a stale in-memory config', async (t) => {
  let license = 'ab'.repeat(64);
  const root = temporaryRoot(t);
  const settings = createAgentSyncSettings({ root, safeStorage: encryption(), getLicenseKey: () => license });
  settings.save({ enabled: true });
  const sync = createChatSync({ root, getConfig: settings.getPrivate, fetchImpl: () => { assert.fail('stale key sent'); } });
  t.after(() => sync.dispose());
  sync.observe(state()); license = '';
  await until(() => sync.getStatus().state === 'error');
  assert.equal(sync.getStatus().lastError.code, 'AGENT_SYNC_SETTINGS_INVALID');
});

test('unreadable sync settings and unavailable secure storage leave local chat usable', (t) => {
  const root = temporaryRoot(t), file = path.join(root, 'sync-settings.json');
  fs.writeFileSync(file, 'broken-json');
  const broken = createAgentSyncSettings({ root, safeStorage: encryption() });
  assert.equal(broken.getPublic().enabled, false);
  assert.ok(broken.getPublic().warning);
  assert.equal(fs.readFileSync(file, 'utf8'), 'broken-json');
  broken.save({ endpoint: 'https://test.invalid/chat', token: 'safe-secret', enabled: true });
  const unsupported = createAgentSyncSettings({ root, safeStorage: { isEncryptionAvailable: () => false } });
  assert.equal(unsupported.getPublic().enabled, false);
  assert.equal(unsupported.getPublic().hasToken, false);
  assert.throws(() => unsupported.save({ token: 'new-secret' }), { code: 'AGENT_ENCRYPTION_UNAVAILABLE' });
});

test('default disabled observer never creates an upload or stores chat in outbox', async (t) => {
  let calls = 0;
  const f = fixture(t, { getConfig: () => ({ enabled: false, endpoint: '', token: '' }), fetchImpl: async () => { calls++; } });
  f.sync.observe(state());
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(calls, 0);
  assert.equal(f.sync.getStatus().state, 'disabled');
  assert.equal(fs.existsSync(path.join(f.root, 'chat-sync')), false);
});

test('uploads a strict metadata whitelist and redacts known secrets, paths and inline images', async (t) => {
  const f = fixture(t, { getSecrets: () => ['private-model-key'] });
  f.sync.observe(state('private-model-key test-upload-token C:\\Users\\owner\\file.csv /home/user/file.csv data:image/png;base64,aGVsbG8= 正文'));
  await until(() => f.sync.getStatus().pendingCount === 0);
  assert.equal(f.requests.length, 1);
  const { event, init } = f.requests[0], serialized = JSON.stringify(event);
  for (const excluded of ['private-model-key', 'test-upload-token', 'private-tool', 'private-result', 'private-proposal', 'private-image', 'private-preview', 'private-file', 'private-frames', 'private-key', 'owner', '/home/user', 'aGVsbG8=']) assert.equal(serialized.includes(excluded), false, excluded);
  assert.equal(event.conversation.attachments[0].name, 'test.png');
  assert.match(event.conversation.messages[0].text, /正文/);
  assert.equal(init.headers.Authorization, 'Bearer test-upload-token');
  assert.equal(init.headers['Idempotency-Key'], event.eventId);
  assert.equal(init.redirect, 'error');
  assert.equal(event.revision, 1);
  f.sync.observe(state('private-model-key test-upload-token C:\\Users\\owner\\file.csv /home/user/file.csv data:image/png;base64,aGVsbG8= 正文'));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(f.requests.length, 1, 'identical public snapshots do not upload again');
});

test('offline queue survives restart and retries the same event identifier', async (t) => {
  let firstEvent;
  const root = temporaryRoot(t);
  const first = fixture(t, { root, retryBaseMs: 10000, fetchImpl: async (_url, init) => { firstEvent = JSON.parse(init.body); throw new TypeError('offline'); } });
  first.sync.observe(state());
  await until(() => first.sync.getStatus().state === 'retrying');
  const installationId = first.sync.getStatus().installationId;
  first.sync.dispose();
  const second = fixture(t, { root });
  assert.equal(second.sync.getStatus().pendingCount, 1);
  assert.equal(second.sync.getStatus().installationId, installationId);
  second.sync.retry();
  await until(() => second.sync.getStatus().pendingCount === 0);
  assert.equal(second.requests[0].event.eventId, firstEvent.eventId);
  second.sync.observe(state('下一条问题'));
  await until(() => second.requests.length === 2 && second.sync.getStatus().pendingCount === 0);
  assert.equal(second.requests[1].event.revision, 2);
});

test('an old acknowledgement cannot remove a newer queued revision', async (t) => {
  const pending = [], events = [];
  const f = fixture(t, { fetchImpl: async (_url, init) => { const event = JSON.parse(init.body); events.push(event); return new Promise((resolve) => pending.push(resolve)); } });
  f.sync.observe(state('第一条'));
  await until(() => pending.length === 1);
  f.sync.observe(state('第二条'));
  pending[0](new Response(JSON.stringify({ accepted: true, eventId: events[0].eventId })));
  await until(() => pending.length === 2);
  assert.equal(f.sync.getStatus().pendingCount, 1);
  assert.equal(events[1].revision, 2);
  assert.equal(events[1].conversation.messages[0].text, '第二条');
  pending[1](new Response(JSON.stringify({ accepted: true, eventId: events[1].eventId })));
  await until(() => f.sync.getStatus().pendingCount === 0);
});

test('401 blocks retained records until configuration changes or manual retry', async (t) => {
  let calls = 0;
  const f = fixture(t, { fetchImpl: async (_url, init) => {
    calls++;
    return calls === 1 ? new Response('private server details', { status: 401 }) : new Response(JSON.stringify({ accepted: true, eventId: JSON.parse(init.body).eventId }));
  } });
  f.sync.observe(state());
  await until(() => f.sync.getStatus().state === 'blocked');
  f.sync.observe(state('新输入也不能绕过鉴权失败'));
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(calls, 1);
  assert.equal(f.sync.getStatus().pendingCount, 1);
  assert.equal(f.sync.getStatus().lastError.message.includes('private server details'), false);
  f.setConfig({ token: 'replacement-token' }); f.sync.reconfigure();
  await until(() => f.sync.getStatus().pendingCount === 0);
  assert.equal(calls, 2);
});

test('429 and transient server failures retry with the original eventId', async (t) => {
  const ids = [];
  const f = fixture(t, { fetchImpl: async (_url, init) => {
    const event = JSON.parse(init.body); ids.push(event.eventId);
    if (ids.length < 3) return new Response('', { status: ids.length === 1 ? 429 : 503 });
    return new Response(JSON.stringify({ accepted: true, eventId: event.eventId }));
  } });
  f.sync.observe(state());
  await until(() => f.sync.getStatus().pendingCount === 0);
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 1);
});

test('wrong or oversized acknowledgements retain events instead of reporting success', async (t) => {
  const f = fixture(t, { retryBaseMs: 10000, retryMaxMs: 10000,
    fetchImpl: async () => new Response(JSON.stringify({ accepted: true, eventId: 'wrong-id' })) });
  f.sync.observe(state());
  await until(() => f.sync.getStatus().state === 'retrying');
  assert.equal(f.sync.getStatus().pendingCount, 1);
  assert.equal(f.sync.getStatus().lastSuccessAt, null);
  assert.equal(f.sync.getStatus().lastError.code, 'AGENT_SYNC_ACK_INVALID');
  const huge = fixture(t, { retryBaseMs: 10000, retryMaxMs: 10000, fetchImpl: async () => new Response('a'.repeat(20000)) });
  huge.sync.observe(state());
  await until(() => huge.sync.getStatus().state === 'retrying');
  assert.equal(huge.sync.getStatus().pendingCount, 1);
  assert.equal(huge.sync.getStatus().lastError.code, 'AGENT_SYNC_ACK_INVALID');
});

test('switching endpoint isolates queued history and aborts the previous request', async (t) => {
  let oldRequest;
  const sent = [];
  const f = fixture(t, { fetchImpl: async (url, init) => {
    const event = JSON.parse(init.body); sent.push({ url, event });
    if (url.includes('test.invalid')) { oldRequest = init; return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })); }
    return new Response(JSON.stringify({ accepted: true, eventId: event.eventId }));
  } });
  f.sync.observe(state('old history', 'old-conversation'));
  await until(() => oldRequest);
  f.sync.observe(state('current conversation', 'current-conversation'));
  f.setConfig({ endpoint: 'https://other.invalid/chat', token: 'other-token' });
  f.sync.reconfigure();
  await until(() => f.sync.getStatus().pendingCount === 0);
  assert.equal(oldRequest.signal.aborted, true);
  const newDestination = sent.filter((item) => item.url.includes('other.invalid'));
  assert.equal(newDestination.length, 1);
  assert.equal(newDestination[0].event.conversationId, 'current-conversation');
  assert.equal(fs.readdirSync(path.join(f.root, 'chat-sync', 'outboxes')).length, 2);
});

test('disabling upload aborts work while preserving pending disk records', async (t) => {
  let active;
  const f = fixture(t, { fetchImpl: async (_url, init) => { active = init; return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('abort')), { once: true })); } });
  f.sync.observe(state());
  await until(() => active);
  f.setConfig({ enabled: false }); f.sync.reconfigure();
  assert.equal(active.signal.aborted, true);
  assert.equal(f.sync.getStatus().state, 'disabled');
  const recordFile = path.join(f.root, 'chat-sync', 'outboxes', fs.readdirSync(path.join(f.root, 'chat-sync', 'outboxes'))[0]);
  assert.equal(Object.values(JSON.parse(fs.readFileSync(recordFile)).records).filter((entry) => entry.event).length, 1);
});

test('storage corruption and queue limits never escape observe or overwrite existing records', async (t) => {
  const root = temporaryRoot(t);
  fs.mkdirSync(path.join(root, 'chat-sync'));
  fs.writeFileSync(path.join(root, 'chat-sync', 'installation.json'), 'broken');
  const broken = fixture(t, { root });
  assert.equal(broken.sync.getStatus().state, 'error');
  assert.doesNotThrow(() => broken.sync.observe(state()));
  assert.equal(fs.readFileSync(path.join(root, 'chat-sync', 'installation.json'), 'utf8'), 'broken');
  const capped = fixture(t, { maximumEventBytes: 2000, maximumQueueBytes: 2300, retryBaseMs: 10000, retryMaxMs: 10000, fetchImpl: async () => { throw new Error('offline'); } });
  capped.sync.observe(state('first'));
  await until(() => capped.sync.getStatus().state === 'retrying');
  assert.doesNotThrow(() => capped.sync.observe(state('x'.repeat(5000))));
  assert.equal(capped.sync.getStatus().lastError.code, 'AGENT_SYNC_EVENT_LIMIT');
  assert.equal(capped.sync.getStatus().pendingCount, 1);
  capped.sync.observe(state('first'));
  capped.sync.observe(state('y'.repeat(1000), 'second-conversation'));
  assert.equal(capped.sync.getStatus().lastError.code, 'AGENT_SYNC_QUEUE_FULL');
  assert.equal(capped.sync.getStatus().pendingCount, 1);
});

test('queue capacity errors still drain existing events and retry deferred conversations', async (t) => {
  const pending = [], events = [];
  const f = fixture(t, { maximumQueueBytes: 2400, fetchImpl: async (_url, init) => {
    events.push(JSON.parse(init.body));
    return new Promise((resolve) => pending.push(resolve));
  } });
  f.sync.observe(state('a'.repeat(600), 'first-conversation'));
  await until(() => pending.length === 1);
  f.sync.observe(state('b'.repeat(600), 'second-conversation'));
  assert.equal(f.sync.getStatus().lastError.code, 'AGENT_SYNC_QUEUE_FULL');
  assert.equal(f.sync.getStatus().unsyncedCount, 1);
  f.sync.observe(state('c', 'third-conversation'));
  pending[0](new Response(JSON.stringify({ accepted: true, eventId: events[0].eventId })));
  await until(() => pending.length === 2);
  pending[1](new Response(JSON.stringify({ accepted: true, eventId: events[1].eventId })));
  await until(() => pending.length === 3);
  pending[2](new Response(JSON.stringify({ accepted: true, eventId: events[2].eventId })));
  await until(() => f.sync.getStatus().pendingCount === 0 && f.sync.getStatus().unsyncedCount === 0);
  assert.deepEqual(new Set(events.map((event) => event.conversationId)), new Set(['first-conversation', 'second-conversation', 'third-conversation']));
  assert.equal(f.sync.getStatus().lastError, null);
});

test('corrupt persisted event fields never expand the upload whitelist', async (t) => {
  const root = temporaryRoot(t);
  const first = fixture(t, { root, retryBaseMs: 10000, retryMaxMs: 10000, fetchImpl: async () => { throw new Error('offline'); } });
  first.sync.observe(state());
  await until(() => first.sync.getStatus().state === 'retrying');
  first.sync.dispose();
  const file = path.join(root, 'chat-sync', 'outboxes', fs.readdirSync(path.join(root, 'chat-sync', 'outboxes'))[0]);
  const record = JSON.parse(fs.readFileSync(file));
  record.records['conversation-1'].event.conversation.messages[0].toolArguments = 'private-data';
  fs.writeFileSync(file, JSON.stringify(record));
  const second = fixture(t, { root });
  assert.equal(second.sync.getStatus().state, 'error');
  assert.doesNotThrow(() => second.sync.observe(state()));
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(second.requests.length, 0);
  assert.equal(JSON.parse(fs.readFileSync(file)).records['conversation-1'].event.conversation.messages[0].toolArguments, 'private-data');
});

test('upload timeout aborts the request and leaves durable retry state', async (t) => {
  let aborted = false;
  const f = fixture(t, { requestTimeoutMs: 15, retryBaseMs: 10000, retryMaxMs: 10000, fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => { aborted = true; reject(new Error('timeout')); }, { once: true });
  }) });
  f.sync.observe(state());
  await until(() => f.sync.getStatus().state === 'retrying');
  assert.equal(aborted, true);
  assert.equal(f.sync.getStatus().pendingCount, 1);
});

test('real localhost HTTP endpoint receives bearer token and matching JSON acknowledgement', async (t) => {
  const received = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const event = JSON.parse(Buffer.concat(chunks).toString());
    received.push({ headers: req.headers, event });
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ accepted: true, eventId: event.eventId }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  const f = fixture(t, { getConfig: () => ({ enabled: true, endpoint: `http://127.0.0.1:${server.address().port}/chat`, token: 'synthetic-test-token' }), fetchImpl: globalThis.fetch });
  f.sync.observe(state());
  await until(() => f.sync.getStatus().pendingCount === 0);
  assert.equal(received.length, 1);
  assert.equal(received[0].headers.authorization, 'Bearer synthetic-test-token');
  assert.equal(received[0].headers['idempotency-key'], received[0].event.eventId);
  assert.ok(f.sync.getStatus().lastSuccessAt);
});
