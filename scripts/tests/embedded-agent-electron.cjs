const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const electron = require('electron');
const { createAgentProcess } = require('../../app/electron/agentProcess');
const { buildSdkContractSnapshot } = require('../../sdk/backend/contract/sdkApiContract');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-agent-electron-'));
const proxyMode = process.argv.includes('--proxy');
const algorithmMode = process.argv.includes('--algorithm');
const syncMode = process.argv.includes('--chat-sync');
const uploads = [];
let acceptUploads = false;
electron.app.setPath('userData', root);
electron.app.disableHardwareAcceleration();
let manager, server, requests = 0;
let classifierModules = path.resolve(__dirname, '../../backend/agent-runtime/algorithm-lab');
const events = [];
const watchdog = setTimeout(() => { console.error('Agent Electron smoke timed out'); electron.app.exit(1); }, 30000);

/** 用有限文件构建临时 ASAR，验证打包路径的进程入口与依赖解析。 */
async function packedProcessFactory() {
  const project = path.resolve(__dirname, '../..');
  const stage = path.join(root, 'bundle');
  const files = [
    ['app/electron/agentProcess.js', 'app/electron/agentProcess.js'],
    ['app/electron/agentClipboard.js', 'app/electron/agentClipboard.js'],
    ['app/electron/agentSettings.js', 'app/electron/agentSettings.js'],
    ['app/electron/agentSyncSettings.js', 'app/electron/agentSyncSettings.js'],
    ['backend/agent-runtime', 'backend/agent-runtime'],
    ['backend/extension-host/manifest', 'backend/extension-host/manifest'],
    ['backend/extension-host/workspace/builtinSystemTemplates.js', 'backend/extension-host/workspace/builtinSystemTemplates.js'],
    ['backend/extension-host/workspace/builtinSystemConfiguration.js', 'backend/extension-host/workspace/builtinSystemConfiguration.js'],
    ['licenseScopes.js', 'licenseScopes.js'],
    ['licenseSensorGroups.json', 'licenseSensorGroups.json'],
    ['sdk/backend/package.json', 'node_modules/@shroom/backend/package.json'],
    ['sdk/backend/contract', 'node_modules/@shroom/backend/contract'],
    ['sdk/backend/protocol', 'node_modules/@shroom/backend/protocol'],
    ['sdk/backend/processing', 'node_modules/@shroom/backend/processing'],
    ['sdk/backend/sensors', 'node_modules/@shroom/backend/sensors'],
    ['sdk/backend/logger.js', 'node_modules/@shroom/backend/logger.js'],
  ];
  for (const [source, destination] of files) {
    const target = path.join(stage, destination);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(project, source), target, { recursive: true });
  }
  fs.cpSync(path.dirname(require.resolve('ws/package.json')), path.join(stage, 'node_modules/ws'), { recursive: true });
  const archive = path.join(root, 'agent-smoke.asar');
  await require('../pack-runtime-dependencies').loadAsar().createPackage(stage, archive);
  classifierModules = path.join(archive, 'backend/agent-runtime/algorithm-lab');
  assert.equal(typeof require(path.join(archive, 'backend/agent-runtime/tools')).createAgentTools, 'function');
  return require(path.join(archive, 'app/electron/agentProcess.js')).createAgentProcess;
}

/** 启动完全本机的合成模型和业务 API，不读取真实设备或密钥。 */
async function createFixtureServer() {
  const service = http.createServer(async (req, res) => {
    const requestPath = new URL(req.url, 'http://localhost').pathname;
    if (requestPath === '/agent/chat-sync') {
      let body = ''; for await (const part of req) body += part;
      const event = JSON.parse(body);
      assert.equal(req.headers.authorization, 'Bearer fixture-upload-key');
      assert.equal(req.headers['idempotency-key'], event.eventId);
      assert.ok(!body.includes('fixture-only-key'));
      assert.ok(!body.includes('fixture-upload-key'));
      uploads.push(event);
      res.writeHead(acceptUploads ? 200 : 503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ accepted: acceptUploads, eventId: event.eventId }));
      return;
    }
    if (requestPath === '/v1/responses') {
      let text = ''; for await (const part of req) text += part;
      const request = JSON.parse(text);
      assert.ok(request.input.some((item) => typeof item.content === 'string'
        && item.content.includes('本次任务的当前系统快照') && item.content.includes('"id":"hand"')),
      'The first model request must already know the selected native system');
      requests++;
      let output = request.input.some((item) => item.type === 'function_call_output')
        ? [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '已查询本机设备：当前没有连接设备。' }] }]
        : [{ type: 'function_call', name: 'get_current_state', call_id: 'call-fixture', arguments: '{}' }];
      if (algorithmMode) {
        const replies = request.input.filter((item) => item.type === 'function_call_output');
        output = replies.length === 0 ? [{ type: 'function_call', name: 'test_algorithm', call_id: 'algorithm-test', arguments: JSON.stringify({ name: '合成分类', source: 'def predict(f):\n    return 0', validation: false }) }]
          : replies.length === 1 ? [{ type: 'function_call', name: 'prepare_algorithm_package', call_id: 'algorithm-prepare', arguments: JSON.stringify({ draftId: JSON.parse(replies[0].output).draftId }) }]
            : [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '已测试并生成离线算法提案。' }] }];
      }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      if (output[0].type === 'message') res.write(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: output[0].content[0].text })}\n\n`);
      res.end(`data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output } })}\n\n`);
      return;
    }
    if (algorithmMode && requestPath.startsWith('/api/agent-algorithms/')) {
      let text = ''; for await (const part of req) text += part;
      const body = JSON.parse(text || '{}');
      const result = requestPath.endsWith('/records') ? { systemId: 'hand', offset: 0, records: ['a', 'b'].map((id) => ({ id, date: id, count: 32, maxId: 32, systemId: 'hand', channel: 'sit' })) }
        : { frames: Array.from({ length: body.limit }, (_, index) => ({ id: body.offset + index + 1, timestamp: 1000 + (body.offset + index) * 20, values: [1, 2, 3, 4], stage: 'stored-array' })) };
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(result)); return;
    }
    const routes = {
      '/api/sdk/contract': buildSdkContractSnapshot(),
      '/api/agent-apps/policy': { code: 0, data: { policy: { schemaVersion: 1 } } },
      '/api/display-systems': { code: 0, data: { displaySystems: { systems: [] } } },
      '/api/channels': { code: 0, data: { channels: [] } },
      '/api/ws/status': { code: 0, data: { connected: true } },
      '/api/serial/status': { code: 0, data: { ports: [] } },
      '/api/serial/ports': { code: 0, data: [] },
      '/api/sensor/current': { code: 0, data: { sensorType: null } },
      '/api/agent-device/status': { schemaVersion: 1, currentSystemId: 'hand', currentSensorType: 'hand',
        currentSystem: { id: 'hand', name: '手部检测', kind: 'builtin', sourceType: 'hand', editable: false, copyTool: 'prepare_builtin_system' },
        licensed: algorithmMode, idle: true, portsIdle: true, serial: [], availablePorts: [] },
    };
    res.writeHead(Object.hasOwn(routes, req.url) ? 200 : 404, { 'content-type': 'application/json' });
    res.end(JSON.stringify(routes[req.url] || { code: 404, message: req.url }));
  });
  await new Promise((resolve) => service.listen(0, '127.0.0.1', resolve));
  return service;
}

/** 释放一个临时端口作为不可直连的模型地址，避免 Chromium 禁止的固定端口。 */
async function unavailableModelBase() {
  const target = http.createServer();
  await new Promise((resolve) => target.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${target.address().port}`;
  await new Promise((resolve) => target.close(resolve));
  return base;
}

/** 等待真正的子进程发布任务终态，超时由总看门狗兜底。 */
async function waitForTask(taskId) {
  for (let attempt = 0; attempt < 120; attempt++) {
    const state = await manager.invoke('getState');
    const task = state.conversation.tasks.find((item) => item.id === taskId);
    if (task && !state.activeTask) return { state, task };
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Agent task did not finish');
}

/** 等待真实网络上传状态，超时由总看门狗兜底。 */
async function waitForSync(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const state = await manager.invoke('getState');
    if (predicate(state.chatSync.status)) return state;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Chat sync did not reach expected state');
}

/** 验证真实 Electron utilityProcess、系统加密、Responses 流和工具调用。 */
async function main() {
  // 代理开关必须在 Chromium 网络上下文初始化前设置；生产代码仍读取用户系统代理。
  server = await createFixtureServer();
  const base = `http://127.0.0.1:${server.address().port}`;
  const modelBase = proxyMode ? await unavailableModelBase() : base;
  if (proxyMode) {
    electron.app.commandLine.appendSwitch('proxy-server', base);
    electron.app.commandLine.appendSwitch('proxy-bypass-list', '<-loopback>');
  }
  await electron.app.whenReady();
  const createProcess = process.argv.includes('--asar') ? await packedProcessFactory() : createAgentProcess;
  // 夹具只发送合成数据，保留子进程报错以定位包内缺失依赖。
  const fixtureElectron = { ...electron, utilityProcess: { fork(modulePath, args, options) {
    const child = electron.utilityProcess.fork(modulePath, args, { ...options, stdio: 'pipe' });
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    return child;
  } } };
  manager = createProcess({ electron: fixtureElectron, root, backendEndpoints: { httpBaseUrl: base },
    getWindow: () => ({ isDestroyed: () => false, webContents: { isDestroyed: () => false, send: (_channel, event) => events.push(event) } }) });
  await manager.invoke('getState');
  await manager.invoke('saveSettings', { baseUrl: `${modelBase}/v1`, model: 'fixture-model', apiKey: 'fixture-only-key' });
  if (algorithmMode) {
    const catalog = await manager.invoke('listAlgorithmRecords');
    await manager.invoke('setAlgorithmSelection', { selection: { systemId: 'hand', windowFrames: 16, records: catalog.records.map((item, index) => ({ id: item.id, label: `类别${index}`, split: 'development', startFrame: 0, frameLimit: 32 })) } });
  }
  const task = await manager.invoke('startTask', { text: '当前设备是什么状态？' });
  const result = await waitForTask(task.id);
  if (algorithmMode) {
    assert.equal(result.task.status, 'awaiting_action', JSON.stringify(result.task.error));
    const proposal = result.task.proposals[0];
    assert.equal(proposal.after.report.accuracy, 0.5);
    await manager.invoke('applyProposal', { taskId: task.id, proposalId: proposal.id });
    const applied = await waitForTask(task.id);
    assert.equal(applied.task.proposals[0].status, 'applied', JSON.stringify(applied.task.error));
    assert.equal(applied.task.proposals[0].result.offlineOnly, false);
    const { realtimePackage } = require(path.join(classifierModules, 'realtimeCatalog'));
    const { createRealtimeClassifier } = require(path.join(classifierModules, 'realtimeRunner'));
    const saved = JSON.parse(fs.readFileSync(path.join(root, 'algorithm-lab', 'installed', `${applied.task.proposals[0].result.id}.json`), 'utf8'));
    const run = createRealtimeClassifier(realtimePackage(saved, true).resolvedPackage);
    try {
      let output;
      for (let index = 0; index < 16; index++) output = await run([1, 2, 3, 4], { timestamp: 1000 + index * 20 });
      assert.equal(output.metrics.classIndex, 0);
    } finally { await run.dispose(); }
    console.log(`PASS: actual Electron${process.argv.includes('--asar') ? ' ASAR' : ''} Agent model/tool loop, measured report, saved catalog and realtime classification worker.`);
    return;
  }
  assert.equal(result.task.status, 'succeeded', JSON.stringify(result.task.error));
  assert.equal(result.task.steps[0].status, 'succeeded');
  assert.equal(result.task.steps[0].name, 'get_current_system');
  assert.equal(result.task.systemContext.currentSystem.id, 'hand');
  assert.ok(result.state.conversation.messages.at(-1).text.includes('没有连接设备'));
  assert.equal(requests, 2);
  assert.ok(events.some((event) => event.type === 'text.delta'));
  assert.ok(!JSON.stringify(events).includes('fixture-only-key'));
  assert.ok(!fs.readFileSync(path.join(root, 'settings.json'), 'utf8').includes('fixture-only-key'));
  if (syncMode) {
    assert.equal(uploads.length, 0, 'sync defaults to disabled');
    await manager.invoke('saveSyncSettings', { enabled: true, endpoint: `${base}/agent/chat-sync`, token: 'fixture-upload-key' });
    const offline = await waitForSync((status) => status.state === 'retrying');
    assert.equal(offline.chatSync.status.pendingCount, 1);
    assert.equal(uploads[0].conversation.messages.length, result.state.conversation.messages.length);
    assert.equal(uploads[0].conversation.tasks[0].steps, undefined);
    assert.ok(!fs.readFileSync(path.join(root, 'sync-settings.json'), 'utf8').includes('fixture-upload-key'));
    const eventId = uploads[0].eventId;
    await manager.dispose(); manager = null;
    acceptUploads = true;
    manager = createProcess({ electron: fixtureElectron, root, backendEndpoints: { httpBaseUrl: base }, getWindow: () => null });
    const restored = await manager.invoke('getState');
    assert.equal(restored.settings.hasApiKey, true);
    assert.equal(restored.chatSync.settings.hasToken, true);
    assert.equal(restored.conversation.id, result.state.conversation.id);
    assert.deepEqual(restored.conversation.messages, result.state.conversation.messages);
    await manager.invoke('retryChatSync');
    const synced = await waitForSync((status) => status.pendingCount === 0 && status.lastSuccessAt);
    assert.equal(uploads.at(-1).eventId, eventId);
    assert.equal(synced.chatSync.status.installationId, offline.chatSync.status.installationId);
    console.log('PASS: actual Electron net.fetch upload, 503 queue retention, restart with own encrypted keys/history and matching idempotent ACK.');
  }
  await manager.dispose(); manager = null;
  console.log(`PASS: real Electron Agent process${process.argv.includes('--asar') ? ' from temporary ASAR' : ''}${proxyMode ? ' through HTTP proxy (direct target unavailable)' : ''}, encrypted settings, streamed tool loop, persisted result and shutdown. Synthetic local model/device fixtures only.`);
}

main().then(async () => {
  clearTimeout(watchdog);
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'shroom-agent-electron-'));
  // Windows 会锁住已加载的 ASAR，退出后由调用方按打印的临时路径清理。
  if (process.argv.includes('--asar')) console.log(`Temporary ASAR fixture (remove after exit): ${root}`);
  else require('original-fs').rmSync(root, { recursive: true, force: true });
  electron.app.exit(0);
}).catch(async (error) => {
  console.error(error);
  clearTimeout(watchdog);
  await manager?.dispose();
  if (server) server.closeAllConnections();
  electron.app.exit(1);
});
