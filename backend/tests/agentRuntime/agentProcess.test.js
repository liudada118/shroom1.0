const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createAgentSettings } = require('../../../app/electron/agentSettings');
const { createAgentProcess, isTrustedAgentSender, registerAgentIpc, loadAgentWindowUrl } = require('../../../app/electron/agentProcess');
const { readClipboardFiles } = require('../../../app/electron/agentClipboard');
const { subscribeBusinessEvents } = require('../../common/businessEvents');

test('Windows file paste reads the OS file list using static code, never pasted text commands', async () => {
  const dangerousName = 'C:\\data\\$(not-a-command).txt';
  const paths = await readClipboardFiles({ availableFormats: () => ['FileNameW'] }, 'win32', async (program, args, options) => {
    assert.equal(program, 'powershell.exe'); assert.ok(args.includes('-STA')); assert.equal(options.windowsHide, true);
    assert.ok(!args.join(' ').includes(dangerousName));
    return { stdout: JSON.stringify([dangerousName, 'C:\\data\\photo.png']) };
  });
  assert.equal(paths[0], dangerousName);
  assert.deepEqual(await readClipboardFiles({ availableFormats: () => ['text/plain'] }, 'win32', () => { throw new Error('must not execute'); }), []);
  await assert.rejects(readClipboardFiles({ availableFormats: () => ['FileNameW'] }, 'win32', async () => { throw new Error('clipboard busy'); }), { code: 'AGENT_CLIPBOARD_FAILED' });
});

const safeStorage = { isEncryptionAvailable: () => true, encryptString: (value) => Buffer.from(value.split('').reverse().join('')),
  decryptString: (value) => value.toString().split('').reverse().join('') };

test('proposal applications from waiting or historical tasks report transitions without recounting history', async t => {
  const items = [], off = subscribeBusinessEvents(event => items.push(event)); t.after(off);
  const processRef = new EventEmitter();
  processRef.postMessage = message => setImmediate(() => processRef.emit('message', { id: message.id, ok: true, data: {} }));
  processRef.kill = () => processRef.emit('exit', 0);
  const manager = createAgentProcess({ root: temporaryRoot(t), electron: { safeStorage, utilityProcess: { fork: () => {
    setImmediate(() => processRef.emit('message', { ready: true })); return processRef;
  } } }, getWindow: () => null });
  t.after(() => manager.dispose()); await manager.invoke('getState');
  /** Publish synthetic persisted state from the worker, without running a model request. */
  function state(status, error) {
    processRef.emit('message', { event: { type: 'state', state: { conversation: { id: 'fixture', tasks: [{ id: 'old-task', status: 'awaiting_action',
      proposals: [{ id: 'fixture-proposal', kind: 'update_display', status, error }] }] } } } });
  }
  state('pending'); state('pending');
  assert.equal(items.length, 0, 'opening history is not generation or application');
  state('applying'); state('applied'); state('applied');
  assert.equal(items.filter(item => item.properties.action === 'apply_update_display').length, 2);
  assert.equal(items.at(-1).properties.result, 'success');
  state('restoring'); state('failed', { code: 'FIXTURE_RESTORE_FAILED', message: 'secret body' });
  assert.equal(items.at(-1).properties.action, 'restore_update_display');
  assert.equal(items.at(-1).properties.result, 'failure');
  state('applying'); state('applied');
  assert.equal(items.at(-1).properties.action, 'apply_update_display');
  assert(!JSON.stringify(items).includes('secret body'));
});

/** 给每个主进程案例隔离临时存储。 */
function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-agent-process-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('inline algorithm data confirmation forwards only the request identity and user selection', async (t) => {
  const requests = [];
  const child = new EventEmitter();
  child.postMessage = (message) => {
    requests.push(message);
    setImmediate(() => child.emit('message', { id: message.id, ok: true, data: { resumed: true } }));
  };
  child.kill = () => child.emit('exit', 0);
  const manager = createAgentProcess({ root: temporaryRoot(t), electron: { safeStorage, utilityProcess: { fork: () => {
    setImmediate(() => child.emit('message', { ready: true })); return child;
  } } }, getWindow: () => null });
  t.after(() => manager.dispose());
  const selection = { systemId: 'fixture-system', records: [{ id: 'fixture-record', label: '拍打' }] };
  const result = await manager.invoke('submitAlgorithmData', { taskId: 'fixture-task', requestId: 'fixture-request', selection,
    apiKey: 'must-not-forward', tool: 'analyze_algorithm_data', arbitraryPath: 'C:/private.db' });
  assert.deepEqual(result, { resumed: true });
  assert.deepEqual(requests.find((message) => message.action === 'submitAlgorithmData').payload,
    { taskId: 'fixture-task', requestId: 'fixture-request', selection });
  await assert.rejects(manager.invoke('executeTool', { name: 'analyze_algorithm_data' }), { code: 'AGENT_ACTION_UNKNOWN' });
});

test('history selection and cancellation cross only the finite desktop bridge', async t => {
  const requests = [], child = new EventEmitter();
  child.postMessage = request => { requests.push(request); setImmediate(() => child.emit('message', { id: request.id, ok: true, data: {} })); };
  child.kill = () => child.emit('exit', 0);
  const manager = createAgentProcess({ root: temporaryRoot(t), getWindow: () => null,
    electron: { safeStorage, utilityProcess: { fork: () => { setImmediate(() => child.emit('message', { ready: true })); return child; } } } });
  t.after(() => manager.dispose());
  const selection = { systemId: 'fixture-system', records: [{ id: 'fixture-record', startFrame: 0, endFrame: 10 }] };
  await manager.invoke('listHistoryRecords', { offset: 3, arbitraryPath: 'C:/private' });
  await manager.invoke('setHistorySelection', { selection, apiKey: 'must-not-forward' });
  await manager.invoke('completeHistoryDataRequest', { taskId: 'task-a', requestId: 'request-a', selection, tool: 'arbitrary-tool' });
  await manager.invoke('cancelHistoryDataRequest', { taskId: 'task-a', arbitraryPath: 'C:/private' });
  assert.deepEqual(requests.find(item => item.action === 'listHistoryRecords').payload, { offset: 3 });
  assert.deepEqual(requests.find(item => item.action === 'setHistorySelection').payload, { selection });
  assert.deepEqual(requests.find(item => item.action === 'completeHistoryDataRequest').payload, { taskId: 'task-a', requestId: 'request-a', selection });
  assert.deepEqual(requests.find(item => item.action === 'cancelHistoryDataRequest').payload, { taskId: 'task-a' });
  assert.ok(!JSON.stringify(requests).includes('must-not-forward'));
});

test('worker dispatch calls the actual history runtime methods and maps cancellation to cancelTask', async () => {
  const vm = require('node:vm'), parent = new EventEmitter(), posted = [], calls = [];
  parent.postMessage = message => posted.push(message);
  const runtime = Object.fromEntries(['configure', 'listHistoryRecords', 'setHistorySelection', 'completeHistoryDataRequest', 'cancelTask']
    .map(name => [name, input => { calls.push({ name, input }); return {}; }]));
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../agent-runtime/worker.js'), 'utf8'), {
    process: { parentPort: parent },
    require: name => {
      if (name === './runtime') return { createAgentRuntime: () => runtime };
      if (name === './tools') return { createAgentTools: () => ({}) };
      if (name === './errors') return require('../../agent-runtime/errors');
      if (name === './provider') return { requestModelResponse: () => ({}) };
      if (name === 'electron') return { net: { fetch: () => { assert.fail('no model request expected'); } } };
      throw new Error(`Unexpected worker import: ${name}`);
    },
  });
  const selection = { systemId: 'fixture', records: [{ id: 'record' }] };
  for (const [action, payload] of [['initialize', { settings: {} }], ['listHistoryRecords', { offset: 2 }], ['setHistorySelection', { selection }],
    ['completeHistoryDataRequest', { taskId: 'task', requestId: 'request', selection }], ['cancelHistoryDataRequest', { taskId: 'task' }]]) {
    parent.emit('message', { data: { id: action, action, payload } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(posted.find(item => item.id === action)?.ok, true);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    { name: 'configure', input: {} }, { name: 'listHistoryRecords', input: { offset: 2 } }, { name: 'setHistorySelection', input: selection },
    { name: 'completeHistoryDataRequest', input: { taskId: 'task', requestId: 'request', selection } }, { name: 'cancelTask', input: { taskId: 'task' } },
  ]);
});

test('credentials remain encrypted, redact public settings and clear on endpoint change', (t) => {
  const root = temporaryRoot(t);
  const settings = createAgentSettings({ root, safeStorage });
  settings.save({ baseUrl: 'https://example.com/v1', model: 'test', apiKey: 'secret-123' });
  assert.equal(settings.getPublic().hasApiKey, true); assert.equal(settings.getPublic().apiKey, undefined);
  assert.ok(!fs.readFileSync(path.join(root, 'settings.json'), 'utf8').includes('secret-123'));
  assert.equal(createAgentSettings({ root, safeStorage }).getPrivate().apiKey, 'secret-123');
  settings.save({ baseUrl: 'https://another.example/v1', model: 'test' });
  assert.equal(settings.getPublic().hasApiKey, false);
});

test('switching from a relay to DeepSeek replaces the key and keeps it when changing DeepSeek model', (t) => {
  const root = temporaryRoot(t);
  const settings = createAgentSettings({ root, safeStorage });
  settings.save({ baseUrl: 'https://relay.example/v1', model: 'gpt-6-astra', apiKey: 'relay-key' });
  settings.save({ baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash', apiKey: 'deepseek-key' });
  assert.equal(settings.getPrivate().apiKey, 'deepseek-key');
  assert.equal(settings.getPublic().apiKey, undefined);
  settings.save({ baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-pro' });
  assert.equal(createAgentSettings({ root, safeStorage }).getPrivate().apiKey, 'deepseek-key');
});

test('unavailable system encryption fails closed without a plaintext fallback', (t) => {
  const root = temporaryRoot(t);
  const settings = createAgentSettings({ root, safeStorage: { ...safeStorage, isEncryptionAvailable: () => false } });
  assert.throws(() => settings.save({ model: 'test', apiKey: 'secret' }), { code: 'AGENT_ENCRYPTION_UNAVAILABLE' });
  assert.equal(fs.existsSync(path.join(root, 'settings.json')), false);
});

test('IPC trusts the frontend actually loaded by main, including dynamic ports', async () => {
  const mainFrame = { url: 'http://127.0.0.1:3001/#/' };
  const window = { isDestroyed: () => false, webContents: { mainFrame }, loadURL: async (url) => { mainFrame.url = url; } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  assert.equal(isTrustedAgentSender(event, window), false);
  await loadAgentWindowUrl(window, mainFrame.url);
  assert.equal(isTrustedAgentSender(event, window), true);
  mainFrame.url = 'http://127.0.0.1:3001/#/workspace'; assert.equal(isTrustedAgentSender(event, window), true);
  assert.equal(isTrustedAgentSender({ ...event, senderFrame: { url: mainFrame.url } }, window), false);
  assert.equal(isTrustedAgentSender({ ...event, sender: {} }, window), false);
  for (const address of ['http://127.0.0.1:3000', 'http://127.0.0.1:12321', 'http://localhost:3001']) {
    mainFrame.url = address; assert.equal(isTrustedAgentSender(event, window), false);
  }
  mainFrame.url = 'https://untrusted.example'; assert.equal(isTrustedAgentSender(event, window), false);
  let handler;
  registerAgentIpc({ ipcMain: { handle: (_name, callback) => { handler = callback; } }, getWindow: () => window, getProcess: () => { throw new Error('must not run'); } });
  assert.equal((await handler(event, 'getState', {})).error.code, 'AGENT_FORBIDDEN');
  await loadAgentWindowUrl(window, 'http://127.0.0.1:12321');
  assert.equal(isTrustedAgentSender(event, window), true);
});

test('failed or nonlocal frontend loads cannot grant Agent access', async () => {
  const mainFrame = { url: 'http://127.0.0.1:3001' };
  const window = { isDestroyed: () => false, webContents: { mainFrame }, loadURL: async () => { throw new Error('load failed'); } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  await assert.rejects(loadAgentWindowUrl(window, mainFrame.url), /load failed/);
  assert.equal(isTrustedAgentSender(event, window), false);
  for (const address of ['https://untrusted.example', 'file:///index.html', 'http://key@127.0.0.1:3001']) {
    await assert.rejects(loadAgentWindowUrl(window, address), { code: 'AGENT_WINDOW_URL_INVALID' });
  }
});

test('lazy utility-process startup is shared and shutdown reaps its child', async (t) => {
  let forks = 0, killed = 0;
  const messages = [], calls = [];
  const processRef = new EventEmitter();
  processRef.postMessage = (message) => {
    calls.push(message.action);
    setImmediate(() => processRef.emit('message', { id: message.id, ok: true, data: message.action === 'getState' ? { activeTask: null } : {} }));
  };
  processRef.kill = () => { killed++; processRef.emit('exit', 0); };
  const manager = createAgentProcess({ root: temporaryRoot(t), electron: { safeStorage, utilityProcess: { fork: () => {
    forks++; setImmediate(() => processRef.emit('message', { ready: true })); return processRef;
  } } }, getWindow: () => ({ isDestroyed: () => false, webContents: { isDestroyed: () => false, send: (...args) => messages.push(args) } }) });
  await Promise.all([manager.invoke('getState'), manager.invoke('getState')]);
  assert.equal(forks, 1); assert.equal(calls.filter((action) => action === 'initialize').length, 1);
  await manager.dispose(); assert.equal(killed, 1);
  await assert.rejects(manager.invoke('getState'), { code: 'AGENT_CLOSED' });
});

test('worker exit rejects pending requests and supports a fresh restart', async (t) => {
  let generation = 0;
  const processes = [];
  const manager = createAgentProcess({ root: temporaryRoot(t), timeoutMs: 300, electron: { safeStorage, utilityProcess: { fork: () => {
    const ref = new EventEmitter(); processes.push(ref); generation++;
    const current = generation;
    ref.kill = () => ref.emit('exit', 1);
    ref.postMessage = (message) => setImmediate(() => {
      if (message.action === 'getState' && current === 1) ref.emit('exit', 1);
      else ref.emit('message', { id: message.id, ok: true, data: { activeTask: null } });
    });
    setImmediate(() => ref.emit('message', { ready: true })); return ref;
  } } }, getWindow: () => null });
  await assert.rejects(manager.invoke('getState'), { code: 'AGENT_PROCESS_EXITED' });
  await manager.invoke('getState'); assert.equal(processes.length, 2);
  await manager.dispose();
});

test('chat sync settings do not start the model worker and never enter worker or renderer credentials', async (t) => {
  const root = temporaryRoot(t), calls = [], events = [], uploads = [];
  let forks = 0, manager;
  const state = { conversation: { id: 'conversation-sync', messages: [], tasks: [] }, attachments: [], activeTask: null };
  const ref = new EventEmitter();
  ref.kill = () => ref.emit('exit', 0);
  ref.postMessage = (message) => {
    calls.push(message);
    setImmediate(() => {
      if (message.action === 'startTask') {
        state.conversation.messages.push({ id: 'message-sync', role: 'user', text: message.payload.text });
        ref.emit('message', { event: { type: 'state', state: JSON.parse(JSON.stringify(state)) } });
      }
      ref.emit('message', { id: message.id, ok: true, data: message.action === 'getState' ? state : {} });
    });
  };
  manager = createAgentProcess({ root, electron: { safeStorage,
    net: { fetch: async (_url, options) => { uploads.push(options); return new Response('{}', { status: 503 }); } },
    utilityProcess: { fork: () => { forks++; setImmediate(() => ref.emit('message', { ready: true })); return ref; } },
  }, getWindow: () => ({ isDestroyed: () => false, webContents: { isDestroyed: () => false, send: (_channel, event) => events.push(event) } }) });
  try {
    const fresh = await manager.invoke('getState');
    assert.equal(fresh.settings.hasApiKey, false);
    assert.equal(fresh.chatSync.settings.enabled, true);
    await manager.invoke('saveSettings', { baseUrl: 'https://example.invalid/v1', model: 'test', apiKey: 'model-fixture-secret' });
    await manager.invoke('saveSyncSettings', { enabled: true, endpoint: 'https://example.invalid/chat', token: 'upload-fixture-secret' });
    assert.equal(uploads.length, 0, 'empty conversations are not uploaded');
    await manager.invoke('startTask', { text: '合成数据查询' });
    for (let attempt = 0; attempt < 50 && uploads.length === 0; attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(uploads.length, 1);
    assert.equal(uploads[0].headers.Authorization, 'Bearer upload-fixture-secret');
    assert.equal(JSON.parse(uploads[0].body).conversation.messages[0].text, '合成数据查询');
    const failed = await manager.invoke('getState');
    assert.equal(failed.chatSync.status.pendingCount, 1);
    assert.equal(failed.chatSync.status.state, 'retrying');
    assert.ok(!JSON.stringify(calls).includes('upload-fixture-secret'));
    assert.ok(!JSON.stringify(events).includes('upload-fixture-secret'));
    assert.ok(!JSON.stringify(events).includes('model-fixture-secret'));
    assert.ok(!fs.readFileSync(path.join(root, 'sync-settings.json'), 'utf8').includes('upload-fixture-secret'));
    await manager.dispose();
    const restarter = createAgentProcess({ root, electron: { safeStorage, utilityProcess: { fork: () => { throw new Error('worker must stay stopped'); } },
      net: { fetch: async () => { throw new Error('must not send while disabled'); } } }, getWindow: () => null });
    try {
      await restarter.invoke('saveSyncSettings', { enabled: false });
      assert.equal(forks, 1);
      assert.equal(createAgentSettings({ root, safeStorage }).getPrivate().apiKey, 'model-fixture-secret');
    } finally { await restarter.dispose(); }
  } finally { await manager.dispose(); }
});

test('desktop queue actions do not implicitly upload the previous conversation after credential changes', async t => {
  const uploads = [], children = [];
  let state = { conversation: { id: 'conversation-queue', tasks: [], messages: [{ id: 'message-a', role: 'user', text: 'synthetic customer A history' }] }, attachments: [], activeTask: null };
  /** Match the real worker's configure events and keep historical state across utility-process restart. */
  function fork() {
    const child = new EventEmitter(); children.push(child);
    child.kill = () => child.emit('exit', 0);
    child.postMessage = request => setImmediate(() => {
      if (request.action === 'newConversation') state = { conversation: { id: 'conversation-new', tasks: [], messages: [] }, attachments: [], activeTask: null };
      if (request.action === 'startTask') state.conversation.messages.push({ id: 'message-new', role: 'user', text: request.payload.text });
      if (['initialize', 'configure', 'openConversation', 'newConversation', 'startTask'].includes(request.action)) {
        child.emit('message', { event: { type: 'state', state: JSON.parse(JSON.stringify(state)) } });
      }
      child.emit('message', { id: request.id, ok: true, data: request.action === 'getState' ? JSON.parse(JSON.stringify(state)) : {} });
    });
    setImmediate(() => child.emit('message', { ready: true })); return child;
  }
  const manager = createAgentProcess({ root: temporaryRoot(t), getWindow: () => null, electron: { safeStorage,
    utilityProcess: { fork },
    net: { fetch: async (_url, options) => { uploads.push(options); return new Response('{}', { status: 401 }); } } } });
  t.after(() => manager.dispose());
  await manager.invoke('saveSyncSettings', { endpoint: 'https://tenant.example.test/chat', token: 'customer-a-token', enabled: true });
  const initial = await manager.invoke('getState');
  assert.equal(initial.chatSync.status.pendingCount, 0, 'initialization and read-only refresh do not upload historical chats');
  await manager.invoke('openConversation', { conversationId: state.conversation.id });
  for (let index = 0; index < 50 && uploads.length === 0; index++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(uploads.length, 1);
  const changed = await manager.invoke('saveSyncSettings', { token: 'customer-b-token' });
  assert.equal(changed.status.pendingCount, 0);
  assert.equal(changed.status.recoverableQueues.length, 1);
  const afterChange = await manager.invoke('getState');
  assert.equal(afterChange.chatSync.status.pendingCount, 0, 'the renderer refresh after save cannot enqueue customer A under customer B');
  await manager.invoke('saveSettings', { baseUrl: 'https://model.example.test/v1', model: 'fixture', apiKey: 'fixture-model-key' });
  assert.equal((await manager.invoke('getState')).chatSync.status.pendingCount, 0, 'model configure state is not a new chat action');
  await manager.invoke('retryChatSync');
  assert.equal((await manager.invoke('getState')).chatSync.status.pendingCount, 0);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(uploads.length, 1, 'settings and retry cannot observe stale lastState into the new customer');
  await assert.rejects(manager.invoke('restoreChatSyncQueue', { queueId: changed.status.recoverableQueues[0].queueId }), { code: 'AGENT_SYNC_OWNERSHIP_REQUIRED' });
  await manager.invoke('restoreChatSyncQueue', { queueId: changed.status.recoverableQueues[0].queueId, confirmed: true });
  for (let index = 0; index < 50 && uploads.length < 2; index++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(uploads[1].headers.Authorization, 'Bearer customer-b-token');
  assert.equal(JSON.parse(uploads[1].body).eventId, JSON.parse(uploads[0].body).eventId);
  const cleared = await manager.invoke('clearChatSyncQueue', { includeLegacy: true });
  assert.equal(cleared.pendingCount, 0);
  assert.equal((await manager.invoke('getState')).chatSync.status.pendingCount, 0, 'the renderer refresh after clear cannot recreate pending snapshots');
  children.at(-1).emit('exit', 1);
  assert.equal((await manager.invoke('getState')).chatSync.status.pendingCount, 0, 'worker restart configure cannot recreate cleared snapshots');
  assert.equal(children.length, 2);
  await manager.invoke('retryChatSync');
  assert.equal((await manager.invoke('getState')).chatSync.status.pendingCount, 0);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(uploads.length, 2);
  await manager.invoke('newConversation');
  await manager.invoke('startTask', { text: 'synthetic customer B new chat' });
  for (let index = 0; index < 50 && uploads.length < 3; index++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(uploads.length, 3, 'a real new chat still uploads under the current credential');
  assert.equal(uploads[2].headers.Authorization, 'Bearer customer-b-token');
  const freshEvent = JSON.parse(uploads[2].body);
  assert.equal(freshEvent.conversation.id, 'conversation-new');
  assert.equal(freshEvent.conversation.messages[0].text, 'synthetic customer B new chat');
  assert(!uploads[2].body.includes('synthetic customer A history'));
});
