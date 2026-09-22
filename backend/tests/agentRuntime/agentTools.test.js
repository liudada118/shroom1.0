const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { test } = require('node:test');
const { WebSocketServer } = require('ws');
const { createAgentTools } = require('../../agent-runtime/tools');
const { createAgentRuntime } = require('../../agent-runtime/runtime');
const { createDisplaySystemWorkspaceService } = require('../../extension-host/workspace/displaySystemWorkspaceService');
const { loadDisplaySystemDirectory } = require('../../extension-host');
const { buildSdkContractSnapshot } = require('@shroom/backend/contract/sdkApiContract.js');
const installedPolicy = require('../../../agent-resources/policy.json');
const { createAgentDeviceConnectionService } = require('../../kernel/platform/commands/agentDeviceConnectionService');
const { createBuiltinSystemTemplates } = require('../../extension-host/workspace/builtinSystemTemplates');

/** 构造带真实校验和临时磁盘的本机平台 API，不接触用户目录或串口。 */
async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-tools-'));
  const workspace = createDisplaySystemWorkspaceService({ writableRoot: root });
  const requests = []; const proposals = [];
  const hooks = {};
  const policy = JSON.parse(JSON.stringify(installedPolicy));
  const protocols = [{ id: 'two-by-two', label: 'Test', protocol: { baudRate: 115200, framing: { type: 'fixedLength', frameLength: 4 }, decoding: { valueType: 'uint8', byteOffset: 0, valueCount: 4 } } }];
  const packages = [{ id: 'trusted', attachable: true, compatibility: { matrixTotals: [4] }, packageManifest: { schemaVersion: 1, id: 'trusted', name: 'Trusted', version: '1.0.0', apiVersion: 2, language: 'python', entry: 'algorithm.py', input: { mode: 'single-sensor' }, output: { metrics: [] } }, algorithmSource: 'def process(request):\n    return {"data": request["normalized_data"]}\n' }];
  /** 从临时目录重新发现刚写入的系统。 */
  function config(id) { if (!id) return null; const directory = path.join(root, id); return fs.existsSync(directory) ? loadDisplaySystemDirectory(directory, { validateFiles: true }).config : null; }
  const native = createBuiltinSystemTemplates({ root: path.join(root, '_native'), isOccupied: (id) => Boolean(config(id)), listPackages: () => packages });
  const runtime = { currentSensorType: 'previous-system', collecting: false, localPlayback: false, playing: false, historyMode: false, licensed: true, licenseScope: 'all' };
  const serial = []; const deviceCommands = [];
  const deviceService = createAgentDeviceConnectionService({ getRuntimeState: () => runtime, getSerialStatus: () => serial,
    getSystem: (id) => native.get(id) || config(id), getEditor: (id) => config(id) ? workspace.read(config(id)) : native.editor(id),
    listSerialChannels: (id) => (config(id)?.sensors || []).map((sensor) => ({ displaySystemId: id, sensorId: sensor.id, serialRole: sensor.id, channelId: `${id}:${sensor.id}` })),
    controlCommandService: { executeHttp(command) {
      deviceCommands.push(command);
      if (command.type === 'sensor.switch') runtime.currentSensorType = command.payload.sensorType;
      if (command.type === 'serial.open') serial.push({ role: command.payload.role, path: command.payload.path, isOpen: true, status: 'open', reconnect: true });
      return { ok: true, handled: true, results: [] };
    } },
  });
  const server = http.createServer(async (req, res) => {
    requests.push({ method: req.method, path: req.url });
    res.setHeader('content-type', 'application/json');
    let body = ''; for await (const chunk of req) body += chunk;
    const input = body ? JSON.parse(body) : {};
    const match = req.url.match(/^\/api\/display-systems\/([^/]+)\/(editor|display|duplicate|native)$/);
    try {
      let result;
      if (req.url === '/api/sdk/contract') result = buildSdkContractSnapshot();
      else if (req.url === '/api/agent-apps/policy') result = { code: 0, data: { policy } };
      else if (req.url === '/api/display-systems/catalog') result = { catalog: { ...workspace.getCatalog(), algorithmPackages: packages, builtinTemplates: native.catalog, builtinTemplateCreation: { supported: true, version: 1 }, nativeSystemEditing: { supported: true, version: 1 } } };
      else if (req.url === '/api/serial/protocols') result = { code: 0, data: { protocols } };
      else if (req.url === '/api/display-systems' && req.method === 'GET') result = { displaySystems: { systems: [...fs.readdirSync(root).filter((id) => id !== '_native' && config(id)).map((id) => ({ id, sensorType: config(id).sensor.type })), ...native.list()] } };
      else if (req.url === '/api/display-systems' && req.method === 'POST') result = { result: input.builtinTemplate ? native.create(input.builtinTemplate) : workspace.save(input) };
      else if (req.url === '/api/agent-device/status') result = { ...deviceService.snapshot(), availablePorts: [{ path: 'COM8' }] };
      else if (req.url === '/api/agent-device/connect') result = deviceService.connect(input, [{ path: 'COM8' }]);
      else if (match?.[2] === 'native' && req.method === 'PATCH') result = { result: native.update(match[1], input) };
      else if (match?.[2] === 'native' && req.method === 'DELETE') result = { result: native.remove(match[1], input.expectedRevision) };
      else if (match && req.method === 'GET') { const loaded = config(match[1]); if (!loaded && !native.editor(match[1])) { res.statusCode = 404; result = { code: 'NOT_FOUND', error: 'not found' }; } else result = { editor: loaded ? workspace.read(loaded) : native.editor(match[1]) }; }
      else if (match && req.method === 'PATCH') result = { result: workspace.saveDisplaySection(config(match[1]), input) };
      else if (match?.[2] === 'duplicate' && req.method === 'POST') { hooks.beforeDuplicate?.(); result = { result: workspace.duplicate(config(match[1]), input) }; }
      else result = {};
      res.end(JSON.stringify(result));
    } catch (error) { res.statusCode = ['DISPLAY_SYSTEM_EXISTS', 'DISPLAY_SYSTEM_REVISION_CONFLICT'].includes(error.code) ? 409 : 400; res.end(JSON.stringify({ error: error.message, code: error.code, details: error.details })); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const wsServer = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve) => wsServer.on('listening', resolve));
  const options = { httpBaseUrl: `http://127.0.0.1:${server.address().port}`, wsUrl: `ws://127.0.0.1:${wsServer.address().port}` };
  const tools = createAgentTools(options);
  const context = { taskId: 'test', createProposal: (proposal) => { const saved = { ...proposal, id: `proposal-${proposals.length}`, status: 'pending' }; proposals.push(saved); return saved; } };
  return { root, workspace, config, native, requests, proposals, tools, context, options, wsServer, packages, policy, runtime, serial, deviceCommands, hooks,
    async close() { for (const client of wsServer.clients) client.terminate(); await new Promise((resolve) => wsServer.close(resolve)); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); const absolute = path.resolve(root); assert.ok(absolute.startsWith(`${path.resolve(os.tmpdir())}${path.sep}`)); fs.rmSync(absolute, { recursive: true, force: true }); },
  };
}
/** 提供必须显式给出线序及点位的最小真实配置。 */
function input(id = 'created') { return { id, name: '测试系统', summary: '创建已知协议的测试系统', rendererId: 'heatmap', sensors: [{ id: 'seat', type: `${id}-pressure`, protocolId: 'two-by-two', matrix: { rows: 2, cols: 2 }, lineOrder: [1, 2, 3, 4], pointOrder: [[0, 0], [0, 1], [1, 0], [1, 1]] }], chartCards: [{ metric: 'maxPressure' }] }; }

test('Agent discovers and binds a saved user classifier without replacing existing native charts', async () => {
  const f = await fixture();
  try {
    const packageId = 'user-agent-classifier';
    f.packages.push({ id: packageId, name: '用户动作识别', runtime: 'restricted-python-v1', systemId: 'agent-hand', attachable: true,
      compatibility: { matrixTotals: [1024] }, packageManifest: { input: { mode: 'single-sensor' } },
      metricDefinitions: [{ id: 'classIndex', label: '识别类别', values: { 0: '抚摸', 1: '拍打', '-1': '未知' } }] });
    f.native.create({ id: 'agent-hand', name: '独立手部', sourceType: 'hand' });
    f.runtime.currentSensorType = 'agent-hand';
    const catalog = await f.tools.execute('get_capabilities', { section: 'algorithms' });
    assert.ok(JSON.stringify(catalog).includes(packageId));
    const editor = await f.tools.execute('read_system', { systemId: 'agent-hand' });
    const configuration = { ...editor.configuration, algorithms: [{ packageId, sensorId: 'sit', enabled: true }],
      charts: [{ id: 'gesture', name: '动作识别', packageId, metricId: 'classIndex', color: '#20B486', decimals: 0 }] };
    await f.tools.execute('prepare_update_native_system', { systemId: 'agent-hand', name: '独立手部', configuration, summary: '绑定用户分类算法' }, f.context);
    assert.equal(f.native.editor('agent-hand').configuration.algorithms.length, 0);
    const applied = await f.tools.apply(f.proposals.at(-1));
    assert.equal(applied.verified, true); assert.equal(applied.liveVerified, false);
    assert.deepEqual(f.native.editor('agent-hand').configuration, configuration);
    assert.equal(f.native.editor('agent-hand').configuration.showPressure, true);
  } finally { await f.close(); }
});

test('current system identifies every native page, its independent copy and a Manifest without name guessing', async () => {
  const f = await fixture();
  try {
    for (const template of f.native.catalog) {
      f.runtime.currentSensorType = template.id;
      const state = await f.tools.execute('get_current_system');
      assert.equal(state.selectionStatus, 'selected');
      assert.deepEqual(state.currentSystem, { id: template.id, name: template.name, kind: 'builtin', sensorType: template.id,
        sourceType: template.id, sourceName: template.name, editable: false, copyTool: 'prepare_builtin_system' });
    }
    f.native.create({ id: 'my-hand', name: '手部副本', sourceType: 'hand' });
    f.runtime.currentSensorType = 'my-hand';
    let state = await f.tools.execute('get_current_system');
    assert.equal(state.currentSystem.id, 'my-hand');
    assert.equal(state.currentSystem.name, '手部副本');
    assert.equal(state.currentSystem.kind, 'builtin-template');
    assert.equal(state.currentSystem.sourceType, 'hand');
    assert.equal(state.currentSystem.sourceName, '手部检测');
    assert.deepEqual((await f.tools.execute('get_current_state')).currentSystem, state.currentSystem);

    await f.tools.execute('prepare_create_system', input('custom'), f.context);
    await f.tools.apply(f.proposals[0], f.context);
    f.runtime.currentSensorType = 'custom';
    state = await f.tools.execute('get_current_system');
    assert.equal(state.currentSystem.id, 'custom');
    assert.equal(state.currentSystem.kind, 'manifest');
    assert.equal(state.currentSystem.name, '测试系统');
    assert.equal(state.currentSystem.copyTool, 'prepare_duplicate_system');
    assert.equal(state.currentChannels[0].displaySystemId, 'custom');

    f.runtime.currentSensorType = 'hand-unknown';
    state = await f.tools.execute('get_current_system');
    assert.equal(state.selectionStatus, 'unresolved');
    assert.equal(state.currentSystem.name, null);
    assert.equal(state.currentSystem.copyTool, null);
    f.runtime.currentSensorType = null;
    state = await f.tools.execute('get_current_system');
    assert.equal(state.selectionStatus, 'unselected');
    assert.equal(state.currentSystem, null);
    assert.equal(f.deviceCommands.length, 0);
  } finally { await f.close(); }
});

test('current-system context refuses an older backend that cannot identify selection', async () => {
  const tools = createAgentTools({ fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify({ currentSensorType: 'hand' }) }) });
  await assert.rejects(tools.execute('get_current_system'), { code: 'AGENT_PLATFORM_RESTART_REQUIRED' });
});

test('Agent can add, edit, restore and remove actual native algorithm charts through reviewed proposals', async () => {
  const f = await fixture();
  try {
    f.packages.push({ id: 'breath', name: '呼吸算法', attachable: true, compatibility: { matrixTotals: [1024] }, metricDefinitions: [{ id: 'respirationRate', label: '呼吸率' }] });
    f.native.create({ id: 'editable-hand', name: '原名称', sourceType: 'hand' });
    await assert.rejects(f.tools.execute('prepare_update_display', { systemId: 'editable-hand', patch: {}, summary: '使用错误的显示工具' }, f.context), (error) => error.code === 'AGENT_INVALID_ARGUMENTS' && error.message.includes('prepare_update_native_system'));
    const configuration = { algorithms: [{ packageId: 'breath', sensorId: 'sit', enabled: true }], charts: [{ id: 'respiration', name: '呼吸率趋势', packageId: 'breath', metricId: 'respirationRate' }], showPressure: true, showArea: false };
    const args = { systemId: 'editable-hand', name: '新名称', configuration, summary: '接入呼吸算法和呼吸率趋势' };
    await f.tools.execute('prepare_update_native_system', args, f.context);
    assert.equal(f.native.editor('editable-hand').configuration.charts.length, 0);
    assert.equal(f.requests.filter((entry) => entry.method !== 'GET').length, 0);
    const proposal = f.proposals.at(-1);
    await f.tools.apply(proposal, f.context);
    assert.equal(f.native.editor('editable-hand').builtinTemplate.name, '新名称');
    assert.equal(f.native.editor('editable-hand').configuration.charts[0].metricId, 'respirationRate');
    assert.deepEqual(f.deviceCommands, [], '保存方案不替用户连接设备');
    proposal.status = 'applied';
    await f.tools.restore(proposal, f.context);
    assert.equal(f.native.editor('editable-hand').configuration.charts.length, 0);
    assert.equal(f.native.editor('editable-hand').builtinTemplate.name, '原名称');
    await f.tools.execute('prepare_update_native_system', args, f.context);
    const stale = f.proposals.at(-1);
    const before = f.native.editor('editable-hand');
    f.native.update('editable-hand', { name: '其他编辑器', configuration: before.configuration, expectedRevision: before.revision });
    await assert.rejects(f.tools.apply(stale, f.context), { code: 'DISPLAY_SYSTEM_REVISION_CONFLICT' });
    await assert.rejects(f.tools.execute('prepare_update_native_system', { ...args, configuration: { ...configuration, charts: [{ ...configuration.charts[0], metricId: 'inventedWaveform' }] } }, f.context), { code: 'DISPLAY_SYSTEM_INVALID' });
    await f.tools.execute('prepare_delete_native_system', { systemId: 'editable-hand', summary: '删除用户指定系统' }, f.context);
    assert.ok(f.native.get('editable-hand'));
    const deleted = await f.tools.apply(f.proposals.at(-1), f.context);
    assert.equal(deleted.dataRetained, true);
    assert.equal(f.native.get('editable-hand'), null);
    assert.equal(f.native.editor('hand').writable, false);
  } finally { await f.close(); }
});

test('native deletion cannot report verified when the directory readback is malformed', async () => {
  const f = await fixture();
  try {
    f.native.create({ id: 'delete-readback', name: '待删除系统', sourceType: 'hand' });
    await f.tools.execute('prepare_delete_native_system', { systemId: 'delete-readback', summary: '删除指定系统' }, f.context);
    const tools = createAgentTools({ ...f.options, fetchImpl: async (url, options) => {
      if (new URL(url).pathname === '/api/display-systems') return { ok: true, text: async () => '{}' };
      return fetch(url, options);
    } });
    await assert.rejects(tools.apply(f.proposals.at(-1)), { code: 'AGENT_OPERATION_UNCERTAIN' });
    assert.equal(f.native.get('delete-readback'), null, '删除已发出，读回缺失不能冒充验证成功');
  } finally { await f.close(); }
});

test('builtin templates are discoverable and only saved after applying a reviewed proposal', async () => {
  const f = await fixture();
  try {
    const capabilities = await f.tools.execute('get_capabilities', { section: 'display' }, f.context);
    assert.equal(capabilities.builtinTemplates.length, 28);
    assert.equal((await f.tools.execute('read_system', { systemId: 'hand' }, f.context)).builtinTemplate.sourceType, 'hand');
    await f.tools.execute('prepare_builtin_system', { id: 'my-hand', name: '我的手部', sourceType: 'hand', summary: '继承手部检测' }, f.context);
    assert.equal(f.native.get('my-hand'), null);
    assert.equal(f.requests.some((request) => request.method === 'POST'), false);
    const result = await f.tools.apply(f.proposals[0], f.context);
    assert.equal(result.verified, true);
    assert.equal(result.liveVerified, false);
    assert.equal(f.native.get('my-hand').builtinTemplate.sourceType, 'hand');
    assert.deepEqual(f.deviceCommands, []);
    assert.equal((await f.tools.execute('read_system', { systemId: 'my-hand' }, f.context)).kind, 'builtin-template');
    await assert.rejects(f.tools.execute('prepare_builtin_system', { id: 'my-hand', name: '重复', sourceType: 'hand', summary: '重复' }, f.context), { code: 'DISPLAY_SYSTEM_EXISTS' });
    await assert.rejects(f.tools.execute('prepare_duplicate_system', { sourceSystemId: 'hand', id: 'bad-copy', name: '错误工具', summary: '复制' }, f.context), { code: 'AGENT_INVALID_ARGUMENTS' });
  } finally { await f.close(); }
});

test('missing sensor definitions explain the required count and copy tool without writing', async () => {
  const f = await fixture();
  try {
    for (const sensors of [[], {}, Array(9).fill(input().sensors[0])]) {
      await assert.rejects(f.tools.execute('prepare_create_system', { ...input(), sensors }, f.context),
        (error) => error.code === 'AGENT_INVALID_ARGUMENTS' && /arguments.sensors/.test(error.message) && (/1～8/.test(error.message) || /必须是数组/.test(error.message)));
    }
    assert.equal(f.requests.length, 0);
    assert.equal(f.proposals.length, 0);
  } finally { await f.close(); }
});

test('failed empty-sensor creation recovers through the actual legacy copy proposal and explicit apply', async () => {
  const f = await fixture();
  try {
    const source = path.resolve(__dirname, '../../../display-systems/hand1231');
    fs.cpSync(source, path.join(f.root, 'hand1231'), { recursive: true });
    fs.mkdirSync(path.join(f.root, 'hand1231/assets'));
    fs.writeFileSync(path.join(f.root, 'hand1231/assets/model.bin'), Buffer.from([0, 1, 2, 255]));
    const before = f.workspace.read(f.config('hand1231'));
    const originalManifest = fs.readFileSync(path.join(f.root, 'hand1231/display-system.json'), 'utf8');
    let turn = 0;
    const runtime = createAgentRuntime({ root: path.join(f.root, 'agent-state'), tools: f.tools,
      modelRequest: async ({ input: messages, onText }) => {
        if (turn++ === 0) return { output: [{ type: 'function_call', name: 'prepare_create_system', call_id: 'bad-create', arguments: JSON.stringify({ ...input('hand-copy'), sensors: [] }) }] };
        if (turn === 2) {
          assert.match(JSON.parse(messages.at(-1).output).error.message, /prepare_duplicate_system/);
          return { output: [{ type: 'function_call', name: 'prepare_duplicate_system', call_id: 'good-copy', arguments: JSON.stringify({ sourceSystemId: 'hand1231', id: 'hand-copy', name: '手部副本', summary: '完整复制手部配置' }) }] };
        }
        onText('副本提案待应用，呼吸算法尚未接入。');
        return { output: [] };
      } });
    runtime.configure({ baseUrl: 'https://example.com/v1', model: 'test', apiKey: 'fixture-only' });
    runtime.startTask({ text: '复制手部系统' }); await runtime.whenIdle();
    let task = runtime.getState().conversation.tasks[0];
    assert.equal(task.status, 'awaiting_action');
    assert.equal(task.error, undefined);
    assert.equal(task.proposals[0].kind, 'duplicate_system');
    assert.equal(f.requests.filter((request) => request.method === 'POST').length, 0);
    assert.equal(fs.existsSync(path.join(f.root, 'hand-copy')), false);
    runtime.applyProposal({ taskId: task.id, proposalId: task.proposals[0].id }); await runtime.whenIdle();
    task = runtime.getState().conversation.tasks[0];
    assert.equal(task.status, 'succeeded', JSON.stringify(task.error));
    const copy = f.workspace.read(f.config('hand-copy'));
    assert.equal(copy.manifest.schemaVersion, 2);
    assert.equal(copy.manifest.sensor.type, 'hand-copy');
    assert.equal(copy.manifest.metadata.derivedFrom, 'hand1231');
    assert.deepEqual(copy.manifest.protocol, before.manifest.protocol);
    assert.deepEqual(copy.manifest.display.profiles, before.manifest.display.profiles);
    assert.deepEqual(copy.definitions, before.definitions);
    assert.deepEqual(fs.readFileSync(path.join(f.root, 'hand-copy/assets/model.bin')), Buffer.from([0, 1, 2, 255]));
    assert.equal(fs.readFileSync(path.join(f.root, 'hand1231/display-system.json'), 'utf8'), originalManifest);
    await runtime.dispose();
  } finally { await f.close(); }
});

test('multi-sensor copies preserve sensor IDs, nested files and charts with independent system types', async () => {
  const f = await fixture();
  try {
    const source = input('multi');
    source.sensors.push({ ...source.sensors[0], id: 'back', type: 'multi-back' });
    await f.tools.execute('prepare_create_system', source, f.context); await f.tools.apply(f.proposals[0]);
    const before = f.workspace.read(f.config('multi'));
    await f.tools.execute('prepare_duplicate_system', { sourceSystemId: 'multi', id: 'multi-copy', name: '副本', summary: '复制双路', patch: { chartCards: [{ metric: 'averagePressure' }] } }, f.context);
    await f.tools.apply(f.proposals[1]);
    const copy = f.workspace.read(f.config('multi-copy'));
    assert.deepEqual(copy.manifest.sensors.map((sensor) => sensor.id), ['seat', 'back']);
    assert.deepEqual(copy.manifest.sensors.map((sensor) => sensor.type), ['multi-copy', 'multi-copy-2']);
    assert.deepEqual(copy.definitions, before.definitions);
    assert.equal(copy.manifest.display.chartCards[0].formula, 'avg');
    assert.deepEqual(f.workspace.read(f.config('multi')).manifest, before.manifest);
    await assert.rejects(f.tools.execute('prepare_duplicate_system', { sourceSystemId: 'multi', id: 'multi-copy', name: '冲突', summary: '复制' }, f.context), { code: 'DISPLAY_SYSTEM_EXISTS' });
  } finally { await f.close(); }
});

test('copy proposals reject changed mappings both before apply and at the backend write boundary', async () => {
  const f = await fixture();
  try {
    await f.tools.execute('prepare_create_system', input(), f.context); await f.tools.apply(f.proposals[0]);
    const args = { sourceSystemId: 'created', id: 'changed-copy', name: '副本', summary: '复制' };
    await f.tools.execute('prepare_duplicate_system', args, f.context);
    const mappingPath = path.join(f.root, 'created/seat/line-order.json');
    fs.writeFileSync(mappingPath, JSON.stringify({ order: [4, 3, 2, 1] }));
    await assert.rejects(f.tools.apply(f.proposals[1]), { code: 'DISPLAY_SYSTEM_REVISION_CONFLICT' });
    await f.tools.execute('prepare_duplicate_system', args, f.context);
    f.hooks.beforeDuplicate = () => fs.writeFileSync(mappingPath, JSON.stringify({ order: [1, 2, 3, 4] }));
    await assert.rejects(f.tools.apply(f.proposals[2]), { code: 'DISPLAY_SYSTEM_REVISION_CONFLICT' });
    assert.equal(fs.existsSync(path.join(f.root, 'changed-copy')), false);
  } finally { await f.close(); }
});

test('copy refuses older backends and cannot smuggle unsupported chart metrics', async () => {
  const f = await fixture();
  try {
    await f.tools.execute('prepare_create_system', input(), f.context); await f.tools.apply(f.proposals[0]);
    const args = { sourceSystemId: 'created', id: 'copy', name: '副本', summary: '复制' };
    await assert.rejects(f.tools.execute('prepare_duplicate_system', { ...args, patch: { chartCards: [{ metric: 'respirationRate' }] } }, f.context), { code: 'AGENT_INVALID_ARGUMENTS' });
    const legacyCatalog = f.workspace.getCatalog(); delete legacyCatalog.duplicateSystem;
    f.workspace.getCatalog = () => legacyCatalog;
    await assert.rejects(f.tools.execute('prepare_duplicate_system', args, f.context), { code: 'AGENT_PLATFORM_RESTART_REQUIRED' });
    assert.equal(f.proposals.length, 1);
    assert.equal(fs.existsSync(path.join(f.root, 'copy')), false);
  } finally { await f.close(); }
});

test('create proposal is read-only, apply validates and reads real saved system without overwriting', async () => {
  const f = await fixture();
  try {
    const result = await f.tools.execute('prepare_create_system', input(), f.context);
    assert.equal(result.applied, false); assert.equal(fs.readdirSync(f.root).length, 0);
    assert.ok(f.requests.some((item) => item.path === '/api/display-systems/catalog'));
    const verified = await f.tools.apply(f.proposals[0], f.context);
    assert.equal(verified.verified, true); assert.equal(verified.liveVerified, false);
    const editor = await f.tools.execute('read_system', { systemId: 'created' });
    assert.equal(editor.manifest.display.chartCards[0].formula, 'max');
    assert.deepEqual(editor.definitions.sensors.seat.lineOrder.order, [1, 2, 3, 4]);
    await assert.rejects(f.tools.apply(f.proposals[0]), { code: 'DISPLAY_SYSTEM_EXISTS' });
    await assert.rejects(f.tools.execute('prepare_create_system', { ...input('evil'), algorithmSource: 'evil' }, f.context), { code: 'AGENT_INVALID_ARGUMENTS' });
    await assert.rejects(f.tools.execute('prepare_create_system', { ...input('evil'), rendererId: 'evil-code' }, f.context), { code: 'AGENT_CAPABILITY_UNAVAILABLE' });
    await assert.rejects(f.tools.execute('get_current_state', JSON.parse('{"__proto__":{}}')), { code: 'AGENT_INVALID_ARGUMENTS' });
    await assert.rejects(f.tools.execute('prepare_create_system', input('created-pressure'), f.context), { code: 'AGENT_SENSOR_TYPE_CONFLICT' });
    f.policy.schemaVersion = 999;
    await assert.rejects(f.tools.execute('prepare_create_system', input('unsupported'), f.context), { code: 'AGENT_CONTRACT_UNSUPPORTED' });
  } finally { await f.close(); }
});

test('display revisions reject stale writes and restore preserves unrelated manifest sections', async () => {
  const f = await fixture();
  try {
    await f.tools.execute('prepare_create_system', input(), f.context); await f.tools.apply(f.proposals[0]);
    const before = f.workspace.read(f.config('created'));
    await f.tools.execute('prepare_update_display', { systemId: 'created', summary: '新配色', patch: { canvas: { colormap: { id: 'classic', reverse: true } } } }, f.context);
    const stale = f.proposals[1];
    f.workspace.saveDisplaySection(f.config('created'), { chartCards: [], expectedRevision: before.revision });
    await assert.rejects(f.tools.apply(stale), { code: 'DISPLAY_SYSTEM_REVISION_CONFLICT' });
    assert.throws(() => f.workspace.saveDisplaySection(f.config('created'), { canvas: null, expectedRevision: before.revision }), { code: 'DISPLAY_SYSTEM_REVISION_CONFLICT' });
    await f.tools.execute('prepare_update_display', { systemId: 'created', summary: '新配色', patch: { canvas: { colormap: { id: 'classic', reverse: true } } } }, f.context);
    const proposal = f.proposals[2]; await f.tools.apply(proposal); proposal.status = 'applied';
    assert.equal(f.workspace.read(f.config('created')).manifest.display.canvas.colormap.reverse, true);
    const restored = await f.tools.restore(proposal); assert.equal(restored.verified, true);
    const after = f.workspace.read(f.config('created'));
    assert.equal(after.manifest.display.canvas, undefined); assert.deepEqual(after.manifest.sensors, before.manifest.sensors); assert.deepEqual(after.manifest.display.chartCards, []);
    await assert.rejects(f.tools.restore(proposal), { code: 'DISPLAY_SYSTEM_REVISION_CONFLICT' });
  } finally { await f.close(); }
});

test('registered package source is copied unchanged and never accepted from model parameters', async () => {
  const f = await fixture();
  try {
    const source = input('package-demo'); source.sensors[0].algorithmType = 'package'; source.sensors[0].packageId = 'trusted';
    await f.tools.execute('prepare_create_system', source, f.context);
    assert.equal(f.proposals[0].payload.definitions.sensors.seat.algorithmSource, f.packages[0].algorithmSource);
    f.packages[0].algorithmSource += '# changed\n';
    await assert.rejects(f.tools.apply(f.proposals[0]), { code: 'AGENT_CAPABILITIES_CHANGED' });
    await f.tools.execute('prepare_create_system', source, f.context); await f.tools.apply(f.proposals[1]);
    assert.equal(fs.readFileSync(path.join(f.root, 'package-demo', 'seat', 'algorithm.py'), 'utf8'), f.packages[0].algorithmSource);
    const catalog = await f.tools.execute('get_capabilities', { section: 'algorithms' });
    assert.equal(catalog.algorithmPackages[0].algorithmSource, undefined);
  } finally { await f.close(); }
});

test('WS inspection validates identity/version and cleans up on success, no frames and cancellation', async () => {
  const f = await fixture();
  try {
    await f.tools.execute('prepare_create_system', input(), f.context); await f.tools.apply(f.proposals[0]);
    let subscription;
    f.wsServer.once('connection', (client) => client.once('message', (raw) => {
      subscription = JSON.parse(String(raw));
      client.send('null');
      client.send('[]');
      const frame = { type: 'sensor.frame', schemaVersion: 1, channelId: 'created:seat', displaySystemId: 'created', sensorId: 'seat', outputChannel: 'seat', source: 'realtime', quality: 'good', timestamp: Date.now(), sequence: 1, payload: { value: [1, 2, null, 4] } };
      client.send(JSON.stringify({ ...frame, schemaVersion: 2 }));
      client.send(JSON.stringify({ ...frame, sensorId: 'other' }));
      client.send(JSON.stringify(frame));
    }));
    const observed = await f.tools.execute('inspect_frames', { systemId: 'created', sensorId: 'seat', maxFrames: 1, durationMs: 1000 });
    assert.deepEqual(subscription, { type: 'subscribe', channels: ['created:seat'], replace: true });
    assert.equal(observed.frameCount, 1); assert.equal(observed.invalidFrames, 2); assert.equal(observed.latest.validPointCount, 3);
    assert.equal(observed.liveVerified, false); assert.equal(observed.invalidSampleFrames, 1); assert.equal(observed.sourceCounts.realtime, 1);
    const empty = await f.tools.execute('inspect_frames', { systemId: 'created', sensorId: 'seat', durationMs: 100 }); assert.equal(empty.status, 'no_frames_observed');
    const controller = new AbortController();
    const pending = f.tools.execute('inspect_frames', { systemId: 'created', sensorId: 'seat', durationMs: 1000 }, { signal: controller.signal });
    setTimeout(() => controller.abort(), 30);
    await assert.rejects(pending, { code: 'AGENT_CANCELLED' });
  } finally { await f.close(); }
});

test('frame diagnosis distinguishes playback, empty or null frames, shape mismatch and invalid metadata', async () => {
  const f = await fixture();
  try {
    await f.tools.execute('prepare_create_system', input(), f.context); await f.tools.apply(f.proposals[0]);
    /** 发布一次固定帧并取得单帧质量诊断。 */
    async function inspect(overrides) {
      f.wsServer.once('connection', (client) => client.once('message', () => client.send(JSON.stringify({ type: 'sensor.frame', schemaVersion: 1, channelId: 'created:seat', displaySystemId: 'created', sensorId: 'seat', outputChannel: 'seat', source: 'realtime', quality: 'good', timestamp: Date.now(), sequence: 1, payload: { value: [1, 2, 3, 4], matrix: { rows: 2, cols: 2 } }, ...overrides }))));
      return f.tools.execute('inspect_frames', { systemId: 'created', sensorId: 'seat', maxFrames: 1, durationMs: 100 });
    }
    assert.equal((await inspect({ source: 'playback' })).status, 'playback_only');
    const empty = await inspect({ payload: { value: [] } }); assert.equal(empty.liveVerified, false); assert.equal(empty.emptyFrames, 1); assert.equal(empty.pointCountMismatch, 1);
    const nulls = await inspect({ payload: { value: [null, null, null, null] } }); assert.equal(nulls.status, 'no_valid_samples'); assert.equal(nulls.liveVerified, false);
    assert.equal((await inspect({ payload: { value: [1, 2] } })).status, 'point_count_mismatch');
    assert.equal((await inspect({ source: 'invented' })).invalidFrames, 1);
    assert.equal((await inspect({ timestamp: -1 })).invalidFrames, 1);
    assert.equal((await inspect({ sequence: 1.5 })).invalidFrames, 1);
    assert.equal((await inspect({ timestamp: 1 })).liveVerified, false);
    const shape = await inspect({ payload: { value: [1, 2, 3, 4], matrix: { rows: 1, cols: 4 } } });
    assert.equal(shape.pointCountMismatch, 0); assert.equal(shape.matrixMismatch, 1); assert.equal(shape.liveVerified, false);
    const missing = await inspect({ payload: { value: [1, 2, 3, 4] } });
    assert.equal(missing.matrixMissing, 1); assert.equal(missing.status, 'matrix_unavailable'); assert.equal(missing.liveVerified, false);
    assert.equal((await inspect({})).liveVerified, true);
  } finally { await f.close(); }
});

test('lost mutation reply is uncertain; cancelled reads and external endpoints fail closed', async () => {
  const f = await fixture();
  try {
    await f.tools.execute('prepare_create_system', input(), f.context);
    const tools = createAgentTools({ ...f.options, fetchImpl: async (url, options) => { if (options.method === 'POST') { await fetch(url, options); throw new Error('lost response'); } return fetch(url, options); } });
    await assert.rejects(tools.apply(f.proposals[0]), { code: 'AGENT_OPERATION_UNCERTAIN' });
    assert.ok(f.config('created'));
    const controller = new AbortController(); controller.abort();
    await assert.rejects(f.tools.execute('get_current_state', {}, { signal: controller.signal }), { code: 'AGENT_CANCELLED' });
    assert.throws(() => createAgentTools({ httpBaseUrl: 'http://example.com' }), { code: 'AGENT_LOCAL_ENDPOINT_REQUIRED' });
  } finally { await f.close(); }
});

test('device proposal is read-only; guarded application checks the selected port and actual realtime frames', async () => {
  const f = await fixture();
  try {
    const configInput = input('connected-pad'); configInput.sensors[0].id = 'sit';
    await f.tools.execute('prepare_create_system', configInput, f.context); await f.tools.apply(f.proposals[0]);
    const result = await f.tools.execute('prepare_connect_device', { systemId: 'connected-pad', sensorId: 'sit', portPath: 'COM8', summary: '连接选定垫子' }, f.context);
    assert.equal(result.applied, false); assert.equal(f.deviceCommands.length, 0);
    const proposal = f.proposals[1];
    assert.equal(proposal.kind, 'connect_device'); assert.equal(proposal.expectedCurrentSystemId, null);
    f.runtime.collecting = true;
    await assert.rejects(f.tools.apply(proposal), { code: 'AGENT_DEVICE_BUSY' }); assert.equal(f.deviceCommands.length, 0);
    f.runtime.collecting = false;
    f.wsServer.once('connection', (client) => client.once('message', () => {
      for (let index = 0; index < 30; index += 1) client.send(JSON.stringify({ type: 'sensor.frame', schemaVersion: 1, channelId: 'connected-pad:sit', displaySystemId: 'connected-pad', sensorId: 'sit', outputChannel: 'sit', source: 'realtime', quality: 'good', timestamp: Date.now(), sequence: index, payload: { value: [1, 2, 3, 4], matrix: { rows: 2, cols: 2 } } }));
    }));
    const connected = await f.tools.apply(proposal);
    assert.equal(connected.connected, true); assert.equal(connected.liveVerified, true);
    assert.deepEqual(f.deviceCommands.map((command) => command.type), ['sensor.switch', 'serial.open']);
    await assert.rejects(f.tools.restore({ ...proposal, status: 'applied' }), { code: 'AGENT_RESTORE_UNAVAILABLE' });
  } finally { await f.close(); }
});

test('device connection keeps a port-open result separate from playback-only data verification', async () => {
  const f = await fixture();
  try {
    const configInput = input('playback-pad'); configInput.sensors[0].id = 'sit';
    await f.tools.execute('prepare_create_system', configInput, f.context); await f.tools.apply(f.proposals[0]);
    await f.tools.execute('prepare_connect_device', { systemId: 'playback-pad', sensorId: 'sit', portPath: 'COM8', summary: '连接' }, f.context);
    f.wsServer.once('connection', (client) => client.once('message', () => {
      for (let index = 0; index < 30; index += 1) client.send(JSON.stringify({ type: 'sensor.frame', schemaVersion: 1, channelId: 'playback-pad:sit', displaySystemId: 'playback-pad', sensorId: 'sit', outputChannel: 'sit', source: 'playback', quality: 'good', timestamp: Date.now(), sequence: index, payload: { value: [1, 2, 3, 4] } }));
    }));
    const result = await f.tools.apply(f.proposals[1]);
    assert.equal(result.connected, true); assert.equal(result.liveVerified, false); assert.equal(result.frames.status, 'playback_only');
  } finally { await f.close(); }
});
