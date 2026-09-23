const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createAgentSettings } = require('../../../app/electron/agentSettings');
const { createAgentProcess, isTrustedAgentSender, registerAgentIpc, loadAgentWindowUrl } = require('../../../app/electron/agentProcess');
const { readClipboardFiles } = require('../../../app/electron/agentClipboard');

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

/** 给每个主进程案例隔离临时存储。 */
function temporaryRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-agent-process-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

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
    assert.equal(fresh.chatSync.settings.enabled, false);
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
