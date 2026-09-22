const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const { createAgentDeviceConnectionService } = require('../../kernel/platform/commands/agentDeviceConnectionService');
const { createHttpApp } = require('../../kernel/platform/http/httpAppFactory');

/** 构造纯内存的连接服务，控制命令仅记录调用，不触碰硬件。 */
function fixture() {
  const runtime = { currentSensorType: 'old', collecting: false, localPlayback: false, playing: false, historyMode: false, licensed: true, licenseScope: 'all' };
  const serial = []; const commands = [];
  const target = { id: 'target', sensors: [{ id: 'sit', type: 'target-pressure' }] };
  let revision = 'a'.repeat(64); let failType = null;
  const control = { executeHttp(command) {
    commands.push(command);
    if (command.type === failType) return { ok: false, handled: true, results: [{ error: 'failure' }] };
    if (command.type === 'sensor.switch') runtime.currentSensorType = command.payload.sensorType;
    if (command.type === 'serial.open') serial.push({ role: command.payload.role, path: command.payload.path, isOpen: false, status: 'opening', reconnect: true });
    return { ok: true, handled: true, results: [] };
  } };
  const service = createAgentDeviceConnectionService({ getRuntimeState: () => runtime, getSerialStatus: () => serial,
    getSystem: (id) => id === target.id ? target : null, getEditor: () => ({ revision }), controlCommandService: control,
    listSerialChannels: (type) => ['old', 'target'].includes(type) ? [{ channelId: `${type}:sit`, displaySystemId: type, sensorId: 'sit', serialRole: 'sit' }] : [],
  });
  const input = { systemId: 'target', sensorId: 'sit', portPath: 'COM8', requestId: 'test-connect', expectedCurrentSystemId: 'old', expectedCurrentSensorType: 'old', expectedRevision: revision };
  return { service, runtime, serial, commands, target, input, setRevision(value) { revision = value; }, failCommand(type) { failType = type; } };
}

test('guard validates identity, configuration, idle state, actual port and license before any command', () => {
  for (const mutation of [
    (f) => { f.runtime.alternateTransportBusy = true; },
    (f) => { f.runtime.collecting = true; }, (f) => { f.runtime.playing = true; }, (f) => { f.runtime.localPlayback = true; }, (f) => { f.runtime.historyMode = true; },
    (f) => { f.serial.push({ role: 'back', status: 'opening', isOpen: false, reconnect: false }); },
    (f) => { f.serial.push({ role: 'back', status: 'closed', isOpen: false, reconnect: true }); },
    (f) => { f.runtime.licensed = false; }, (f) => { f.runtime.currentSensorType = 'changed'; }, (f) => f.setRevision('b'.repeat(64)),
    (f) => { f.target.sensors[0].type = 'jqbed'; f.runtime.licenseScope = ['hand']; },
    (f) => { f.input.portPath = 'COM99'; }, (f) => { f.input.extraCommand = 'collection.start'; },
  ]) {
    const f = fixture(); mutation(f);
    assert.throws(() => f.service.connect(f.input, [{ path: 'COM8' }]));
    assert.equal(f.commands.length, 0);
  }
});

test('current-system description follows canonical display identity when sensor type differs', () => {
  const service = createAgentDeviceConnectionService({
    getRuntimeState: () => ({ currentSensorType: 'custom-pressure' }), getSerialStatus: () => [],
    getSystem: (id) => id === 'custom' ? { id, name: '当前矩阵', origin: 'user', editable: true } : null,
    listSerialChannels: () => [{ channelId: 'custom:sit', displaySystemId: 'custom', sensorId: 'sit', serialRole: 'sit' }],
  });
  assert.deepEqual(service.snapshot().currentSystem, { id: 'custom', name: '当前矩阵', kind: 'manifest', sensorType: 'custom-pressure',
    origin: 'user', editable: true, copyTool: 'prepare_duplicate_system' });
});

test('guard dispatches exact activation then open synchronously and reports partial failure as uncertain', () => {
  const f = fixture();
  const result = f.service.connect(f.input, [{ path: 'COM8' }]);
  assert.equal(result.accepted, true); assert.equal(result.connected, false); assert.equal(result.liveVerified, false);
  assert.deepEqual(f.commands.map(({ type, payload }) => ({ type, payload })), [
    { type: 'sensor.switch', payload: { sensorType: 'target' } }, { type: 'serial.open', payload: { role: 'sit', path: 'COM8' } },
  ]);
  const broken = fixture(); broken.failCommand('serial.open');
  assert.throws(() => broken.service.connect(broken.input, [{ path: 'COM8' }]), (error) => error.code === 'AGENT_OPERATION_UNCERTAIN' && error.details.completedCommands[0] === 'sensor.switch');
  assert.equal(broken.runtime.currentSensorType, 'target');
  assert.equal(broken.commands.length, 2, 'No rollback command may be invented');
});

test('HTTP rejects remote Origin and rechecks state after asynchronous port enumeration', async () => {
  const f = fixture(); let releasePorts; let enumerated;
  const enumerationStarted = new Promise((resolve) => { enumerated = resolve; });
  const app = createHttpApp({ agentDeviceConnectionService: f.service, getPort: (ports) => ports,
    listPorts: () => { enumerated(); return new Promise((resolve) => { releasePorts = resolve; }); },
    serialManager: { getStatus: () => [] }, logger: { warn() {}, error() {} },
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/agent-device/connect`;
  try {
    const forbidden = await fetch(url, { method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json' }, body: JSON.stringify(f.input) });
    assert.equal(forbidden.status, 403); assert.equal(f.commands.length, 0);
    const pending = fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f.input) });
    await enumerationStarted;
    f.runtime.collecting = true;
    releasePorts([{ path: 'COM8' }]);
    const conflict = await pending;
    assert.equal(conflict.status, 409); assert.equal((await conflict.json()).code, 'AGENT_DEVICE_BUSY'); assert.equal(f.commands.length, 0);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});
