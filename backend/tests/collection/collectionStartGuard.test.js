const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const { EventEmitter, once } = require('node:events');
const { createRequire } = require('node:module');
const express = require('express');
const sensorRegistry = require('@shroom/backend/sensors');
const { createSerialManager } = require('@shroom/backend/serial/serialManager.js');
const { normalizeCollectFrequency, normalizeCollectOptions } = require('@shroom/backend/collection/collectionService.js');
const { createControlCommandRouter } = require('../../kernel/platform/commands/controlCommandRouter');
const { createControlCommandService } = require('../../kernel/platform/commands/controlCommandService');
const { createRuntimeControlService } = require('../../kernel/platform/commands/runtimeControlService');
const { registerRuntimeCommandHandlers } = require('../../kernel/platform/commands/registerRuntimeCommandHandlers');
const { registerControlRoutes } = require('../../kernel/platform/http/controlRoutes');
const { createCollectionSessionService } = require('../../kernel/storage/history/collectionSessionService');
const { createCollectionSourceMonitor } = require('../../kernel/storage/history/collectionSourceMonitor');
const { createChannelBus } = require('@shroom/backend/telemetry/channelBus.js');
const { subscribeBusinessEvents } = require('../../common/businessEvents');

/** 使用真实组合根的连接读取回调，避免测试另写一套角色选择规则。 */
function productionSourceReader(context) {
  const filename = path.resolve(__dirname, '../../kernel/platform/server.js');
  const source = fs.readFileSync(filename, 'utf8');
  const acorn = createRequire(path.resolve(__dirname, '../../../client/package.json'))('acorn');
  const reader = acorn.parse(source, { ecmaVersion: 'latest' }).body
    .find(node => node.type === 'FunctionDeclaration' && node.id.name === 'readCollectionSourceContext');
  return vm.runInNewContext(`(${source.slice(reader.start, reader.end)})`, context);
}

/** 真 HTTP/命令路由/串口管理器和会话日志；只把物理端口替换为可控设备。 */
async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-collection-start-'));
  const ports = [], events = [], state = { flag: false, saveTime: 'unchanged', colHZ: 50, collectOptions: {}, com: 'COM_REMEMBERED' };
  const context = { type: 'hand', playback: false, channels: [], halowConnected: false, now: 1000 };
  const effects = { resets: 0, begins: 0, flushes: 0 };
  const manager = createSerialManager({ createSerialPort: () => {
    const port = new EventEmitter(); port.isOpen = false;
    port.open = callback => { port.ready = error => { port.isOpen = !error; callback(error); }; };
    port.close = callback => { port.isOpen = false; port.emit('close'); callback?.(); };
    ports.push(port); return port;
  } });
  const journal = createCollectionSessionService({ root });
  const unsubscribe = subscribeBusinessEvents(event => events.push(event));
  const getContext = productionSourceReader({ sensorRegistry, serialManager: manager,
    getCollectionState: key => state[key], zeroChannelIdentityResolver: { getActiveDisplaySystemId: () => context.type },
    runtimeContext: { getSensorType: () => context.type, isLocalPlayback: () => context.playback },
    appRuntime: { displaySystems: { listSerialChannels: () => context.channels }, builtinTemplates: { currentId: type => type } },
    halowService: { hasConnectedDevice: () => context.halowConnected,
      snapshot: () => ({ selectedDeviceId: 'fixture', clients: [{ deviceId: 'fixture', clientId: 'fixture-client', ageMs: 0 }] }) },
  });
  const channelBus = createChannelBus();
  const monitor = createCollectionSourceMonitor({ channelBus, getContext, now: () => context.now,
    schedule: () => ({ unref() {} }), unschedule() {},
    onUnavailable: () => { state.flag = false; journal.finish('DATA_STREAM_TIMEOUT'); } });
  const router = createControlCommandRouter();
  registerRuntimeCommandHandlers(router, { getRuntime: () => state, setRuntime: patch => Object.assign(state, patch),
    getCollectionSource: monitor.status, requireAccess() {}, normalizeCollectFrequency, normalizeCollectOptions,
    resetCollectionStorageClock: () => effects.resets++, flushCollectionInsertQueues: () => effects.flushes++,
    onCollectionStarted: runtime => { effects.begins++; journal.begin({ recordKey: runtime.saveTime, systemId: context.type, inputCoverage: 'synchronous' }); },
    onCollectionStopping: () => { state.flag = false; journal.finish(); },
  });
  const commands = createControlCommandService({ commandRouter: router });
  const app = express(); app.use(express.json());
  registerControlRoutes(app, { controlCommandService: commands, serialManager: manager });
  const server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => {
    await manager.closeAll(); monitor.dispose(); unsubscribe(); journal.dispose(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  });
  /** 从标准 HTTP 入口提交采集命令并取得真实回执。 */
  async function command(payload) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/commands`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'collection.control', requestId: 'collection-start-fixture', payload }),
    });
    return { status: response.status, ack: (await response.json()).data };
  }
  /** 驱动真实 SerialManager 进入 opening；由用例决定何时报告物理打开结果。 */
  async function opening(role = 'sit') {
    manager.open(role, { path: `COM_FIXTURE_${role}`, reconnect: true });
    await Promise.resolve(); return ports.at(-1);
  }
  /** 只发布真实数据平面格式，全零代表有效的无压力数据而不是无数据。 */
  function frame(role = 'sit', values = [0, 0, 0, 0]) {
    manager.getPort(role)?.emit('data', Buffer.from([0, 0, 0, 0]));
    channelBus.publish(`${context.type}:${role}`, { type: 'sensor.frame', source: 'realtime', displaySystemId: context.type,
      channelId: `${context.type}:${role}`, sensorId: role, outputChannel: role, payload: { value: values } });
  }
  return { command, commands, manager, journal, opening, context, state, effects, events, monitor, frame };
}

test('HTTP and legacy WS cannot create collection state from remembered, registered, opening or failed ports', async t => {
  const f = await fixture(t);
  /** 拒绝发生前不能改采集名、启动时钟、创建会话或上报采集成功。 */
  async function rejected() {
    const result = await f.command({ active: true, name: 'must-not-create', frequencyHz: 8 });
    assert.equal(result.status, 409); assert.equal(result.ack.code, 'COLLECTION_DEVICE_NOT_CONNECTED');
    assert.equal(f.state.flag, false); assert.equal(f.state.saveTime, 'unchanged'); assert.equal(f.state.colHZ, 50);
    assert.deepEqual(f.effects, { resets: 0, begins: 0, flushes: 0 });
    assert.equal(f.journal.current(), null);
    assert(!f.events.some(event => event.eventName === 'collection_started'));
  }
  await rejected();
  f.manager.registerPort('sit', { path: 'COM_REMEMBERED', reconnect: true }); await rejected();
  const port = await f.opening(); await rejected();
  port.ready(new Error('synthetic unavailable sensor')); await assert.rejects(f.manager.waitForOpen('sit')); await rejected();
  const ws = f.commands.executeWs({ flag: true, colName: 'must-not-create' });
  assert.equal(ws.ok, false); assert.equal(ws.results[0].code, 'COLLECTION_DEVICE_NOT_CONNECTED');
  assert.equal(f.state.saveTime, 'unchanged'); assert.equal(f.effects.begins, 0);
});

test('a real open permits collection, a physical disconnect denies the next start but permits stop and configuration', async t => {
  const f = await fixture(t), port = await f.opening();
  port.ready(); await f.manager.waitForOpen('sit');
  const waiting = await f.command({ active: true });
  assert.equal(waiting.ack.code, 'COLLECTION_DATA_NOT_READY'); assert.equal(f.effects.begins, 0);
  f.frame();
  assert.equal((await f.command({ active: true, name: 'connected-session' })).status, 200);
  assert.equal(f.state.flag, true); assert.equal(f.effects.begins, 1); assert.equal(f.effects.resets, 1);
  const id = f.journal.current().id;
  port.isOpen = false; port.emit('close');
  const denied = await f.command({ active: true, name: 'after-disconnect' });
  assert.equal(denied.ack.code, 'COLLECTION_DEVICE_NOT_CONNECTED'); assert.equal(f.effects.begins, 1);
  assert.equal(f.journal.current().id, id);
  assert.equal((await f.command({ active: false })).status, 200); assert.equal(f.state.flag, false);
  assert.equal(f.journal.current().phase, 'interrupted');
  assert.equal((await f.command({ active: false, frequencyHz: 8 })).status, 200); assert.equal(f.state.colHZ, 8);
});

test('current manifest roles and native right-hand roles admit partial connections but reject an unrelated open port', async t => {
  const f = await fixture(t), port = await f.opening('back'); port.ready(); await f.manager.waitForOpen('back');
  assert.equal((await f.command({ active: true })).status, 409, 'hand uses sit, not another system back');
  f.context.type = 'handR'; f.frame('back'); assert.equal((await f.command({ active: true })).status, 200);
  await f.command({ active: false });
  f.context.type = 'fixture-manifest'; f.context.channels = [{ serialRole: 'armLeft' }, { serialRole: 'armRight' }];
  assert.equal((await f.command({ active: true })).status, 409);
  const left = await f.opening('armLeft'); left.ready(); await f.manager.waitForOpen('armLeft');
  f.frame('armLeft');
  assert.equal((await f.command({ active: true })).status, 200, 'one of the current declared sensors is sufficient');
});

test('playback rejects collection before side effects and a verified HaLow source can collect without serial', async t => {
  const f = await fixture(t); f.context.halowConnected = true; f.context.playback = true;
  const denied = await f.command({ active: true });
  assert.equal(denied.status, 409); assert.equal(denied.ack.code, 'COLLECTION_PLAYBACK_ACTIVE');
  assert.equal(f.effects.begins, 0); assert.equal(f.state.flag, false);
  f.context.playback = false;
  f.frame();
  assert.equal((await f.command({ active: true })).status, 200); assert.equal(f.state.flag, true);
  f.context.halowConnected = false;
  assert.equal((await f.command({ active: false })).status, 200); assert.equal(f.state.flag, false);
});

test('opening or receiving on a second current channel does not interrupt the first channel collection', async t => {
  const f = await fixture(t);
  f.context.type = 'fixture-manifest';
  f.context.channels = [{ serialRole: 'armLeft' }, { serialRole: 'armRight' }];
  const left = await f.opening('armLeft'); left.ready(); await f.manager.waitForOpen('armLeft');
  f.frame('armLeft'); await f.command({ active: true, name: 'multi-source-session' });
  const id = f.journal.current().id;
  const right = await f.opening('armRight'); right.ready(); await f.manager.waitForOpen('armRight');
  assert.equal(f.monitor.status().ready, true, 'opening another channel must not invalidate existing data');
  assert.equal(f.state.flag, true);
  f.frame('armRight');
  assert.equal(f.monitor.status().ready, true);
  assert.equal(f.state.flag, true);
  assert.equal(f.journal.current().id, id);
  assert.equal(f.effects.begins, 1);
});

test('five seconds without a valid frame automatically finishes and never automatically restarts collection', async t => {
  const f = await fixture(t), port = await f.opening(); port.ready(); await f.manager.waitForOpen('sit');
  f.frame(); await f.command({ active: true, name: 'streamed-session' });
  f.context.now += 5001; f.monitor.refresh();
  assert.equal(f.state.flag, false); assert.equal(f.journal.current().reason, 'DATA_STREAM_TIMEOUT');
  assert.equal(f.journal.current().phase, 'interrupted'); assert.equal(f.manager.isOpen('sit'), true);
  assert.equal((await f.command({ active: true })).ack.code, 'COLLECTION_DATA_NOT_READY');
  f.frame(); assert.equal(f.monitor.status().ready, true); assert.equal(f.state.flag, false);
  assert.equal((await f.command({ active: true, name: 'explicit-restart' })).status, 200);
});

test('omitting trusted connection state fails closed even when the caller claims a COM path', () => {
  const service = createRuntimeControlService({ getRuntime: () => ({ com: 'COM_CLAIMED' }), setRuntime: () => assert.fail('must not mutate') });
  assert.throws(() => service.updateCollectionControl({ flag: true, connected: true }), { code: 'COLLECTION_DEVICE_NOT_CONNECTED' });
});
