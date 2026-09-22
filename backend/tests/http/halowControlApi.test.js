const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
const { once } = require('node:events');
const express = require('express');
const { createHalowService, hasSerialConnection, registerHalowControlHandler } = require('../../kernel/transport/halowService');
const { createControlCommandRouter } = require('../../kernel/platform/commands/controlCommandRouter');
const { createControlCommandService } = require('../../kernel/platform/commands/controlCommandService');
const { registerControlRoutes } = require('../../kernel/platform/http/controlRoutes');
const { createSerialPortOrchestrator } = require('../../kernel/serial/serialPortOrchestrator');

/** 取得一个本机可用的临时 TCP 端口。 */
async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** 等待真实网络回调，不依赖固定延时。 */
async function waitFor(check) {
  const deadline = Date.now() + 3000;
  while (!check()) {
    assert.ok(Date.now() < deadline, 'network operation timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** 创建可切换授权、系统和采集状态的测试服务。 */
function fixture(publish) {
  const state = { file: 'humanBodyOptimized', systemId: 'body-copy', licenseValid: true };
  const frames = [];
  const service = createHalowService({ getContext: () => state, publish,
    onFrame: (frame) => frames.push(frame),
    receiverOptions: { getAddresses: () => [{ address: '127.0.0.1' }] },
  });
  return { state, service, frames };
}

test('HTTP start waits for TCP bind, preserves copy identity, excludes serial and reports port errors', async (t) => {
  const events = [];
  const { state, service, frames } = fixture((event) => events.push(event));
  const router = createControlCommandRouter();
  registerHalowControlHandler(router, { getService: () => service });
  const commands = createControlCommandService({ commandRouter: router });
  const app = express(); app.use(express.json());
  registerControlRoutes(app, { controlCommandService: commands, serialManager: { getStatus: () => [] } });
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => {
    await service.dispose();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  /** 提交真正的 HTTP command envelope 并读取最终状态回执。 */
  async function command(action, options = {}) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/commands`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'halow.control', requestId: 'halow-test', payload: { action, ...options } }),
    });
    return { status: response.status, ack: (await response.json()).data };
  }
  const port = await freePort();
  const result = await command('start', { host: '127.0.0.1', port });
  assert.equal(result.status, 200);
  assert.equal(result.ack.data.results[0].halowStatus.phase, 'listening');
  assert.equal(state.systemId, 'body-copy');
  let registered = 0;
  const serial = createSerialPortOrchestrator({ beforeOpen: service.requireSerialAvailable,
    serialManager: { registerPort: () => { registered += 1; }, start: () => {} } });
  assert.throws(() => serial.openManagedSerialPort('sit', {}), /停止 HaLow/);
  assert.equal(registered, 0, 'denied open must not leave a reconnect registration');
  const socket = net.connect(port, '127.0.0.1');
  t.after(() => socket.destroy());
  await once(socket, 'connect');
  socket.write(Buffer.concat([Buffer.from([0xaa, 0x55, 0, 1, 65, 0xaa, 0x55, 3, 0x99]), Buffer.alloc(1024, 73)]));
  await waitFor(() => frames.length === 1);
  assert.deepEqual(frames[0], Buffer.alloc(1024, 73));
  state.collecting = true;
  assert.equal((await command('select', { deviceId: 'A' })).status, 409);
  socket.write(Buffer.concat([Buffer.from([0xaa, 0x55, 3, 0x99]), Buffer.alloc(1024, 74)]));
  await waitFor(() => frames.length === 2);
  state.licenseValid = false;
  const stopped = await command('stop');
  assert.equal(stopped.status, 200, 'expired license must still permit cleanup');
  assert.equal(stopped.ack.data.results[0].halowStatus.selectedDeviceId, null);
  assert.ok(events.some((event) => event.halowClear));
  assert.equal(frames.length, 2, 'clear events must never create pressure frames');
  assert.equal((await command('status')).status, 403);
  state.collecting = false; state.licenseValid = true;
  const blocker = net.createServer(); blocker.listen(port, '127.0.0.1'); await once(blocker, 'listening');
  t.after(() => new Promise((resolve) => blocker.close(resolve)));
  const failed = await command('start', { host: '127.0.0.1', port });
  assert.equal(failed.ack.ok, false);
  assert.match(failed.ack.message, /已被占用/);
  const wsResult = commands.executeWs({ halow: { action: 'start', host: '127.0.0.1', port } });
  assert.equal(wsResult.ok, false);
  assert.equal(service.snapshot().running, false);
});

test('authorization, system, playback, collection and serial guards reject before listening', async (t) => {
  const { state, service } = fixture(); t.after(() => service.dispose());
  const port = await freePort();
  for (const change of [{ licenseValid: false }, { file: 'hand' }, { playback: true }, { collecting: true }, { serialBusy: true }]) {
    const original = { ...state }; Object.assign(state, change);
    assert.throws(() => service.execute({ action: 'start', host: '127.0.0.1', port }));
    assert.equal(service.snapshot().phase, 'stopped');
    for (const key of Object.keys(state)) delete state[key]; Object.assign(state, original);
  }
  for (const status of [{ isOpen: true }, { status: 'opening' }, { status: 'stopping' }, { reconnect: true }]) {
    assert.equal(hasSerialConnection([status]), true);
  }
  assert.equal(hasSerialConnection([{ status: 'closed', reconnect: false }]), false);
});

test('start rechecks changing context after binding and synchronously reserves transport', async (t) => {
  for (const change of [{ systemId: 'another-copy' }, { collecting: true }, { playback: true }, { licenseValid: false }, { serialBusy: true }]) {
    let state;
    const setup = fixture((event) => {
      if (event.halowStatus?.phase === 'starting') Object.assign(state, change);
    });
    state = setup.state;
    t.after(() => setup.service.dispose());
    const port = await freePort();
    const opening = setup.service.execute({ action: 'start', host: '127.0.0.1', port });
    assert.throws(setup.service.requireSerialAvailable, /停止 HaLow/);
    await assert.rejects(opening, /取消/);
    assert.equal(setup.service.snapshot().phase, 'stopped');
    setup.service.requireSerialAvailable();
    const probe = net.createServer(); probe.listen(port, '127.0.0.1'); await once(probe, 'listening');
    await new Promise((resolve) => probe.close(resolve));
  }
});

test('system switch cancels pending bind and releases the TCP port', async (t) => {
  const { state, service } = fixture(); t.after(() => service.dispose());
  const alreadyStopped = service.stop();
  service.requireSerialAvailable();
  assert.equal(service.isBusy(), false, 'switching with no TCP listener must not block synchronous Agent serial open');
  await alreadyStopped;
  const opening = service.execute({ action: 'start', host: '127.0.0.1', port: await freePort() });
  const stopping = service.stop(); state.systemId = 'next-copy';
  await assert.rejects(opening, /不允许|取消/); await stopping;
  assert.equal(service.snapshot().phase, 'stopped');
});

test('TCP frames reuse native processing and collection format with canonical copy identity', async (t) => {
  const { createLegacySerialFrameRuntime } = require('../../extensions/built-in-sensors/legacySerialFrameRuntime');
  const { createSit1024FrameProcessor } = require('../../extensions/built-in-sensors/sit1024FrameProcessor');
  const { createServerFramePipeline } = require('../../kernel/realtime/framePipelineFactory');
  const { createRealtimeTelemetryGateway } = require('../../kernel/realtime/realtimeTelemetryGateway');
  const sensors = require('@shroom/backend/sensors');
  const state = { file: 'humanBodyOptimized', systemId: 'body-copy', licenseValid: true, collecting: false };
  const frames = [], records = [];
  const gateway = createRealtimeTelemetryGateway({ getSensorType: () => state.systemId,
    channelBus: { publish() {} }, wsSubscriptions: { publish: (_id, frame) => { frames.push(frame); return 1; } } });
  const { frameOutputPipeline } = createServerFramePipeline({
    runtimeContext: { getSensorType: () => state.file, getDatabase: () => 'copy-database' },
    publishRealtimeChannel: gateway.publishRealtimeFrame,
    isCollecting: () => state.collecting,
    shouldStoreCollectionFrame: () => true, hasEnoughCollectionDiskSpace: () => true,
    enqueueCollectionFrame: (db, data, channel) => records.push({ db, data, channel }),
    isZeroFrameStorageType: () => false, isSmallBedMatrixType: sensors.isSmallBedMatrixType,
  });
  const runtime = createLegacySerialFrameRuntime({ file: state.file, nowDate: 1, endDate: 2,
    sit1024FrameProcessor: createSit1024FrameProcessor({
      isCar: () => false, isSmallBedMatrixType: sensors.isSmallBedMatrixType,
      isPetCareSystem: () => false,
    }), colOrSendData: frameOutputPipeline.publishSit });
  const service = createHalowService({ getContext: () => state, onFrame: runtime.handleSitSerialFrame,
    receiverOptions: { getAddresses: () => [{ address: '127.0.0.1' }] } });
  t.after(() => service.dispose());
  const port = await freePort();
  await service.execute({ action: 'start', host: '127.0.0.1', port });
  const socket = net.connect(port, '127.0.0.1'); t.after(() => socket.destroy()); await once(socket, 'connect');
  const payload = Buffer.from(Array.from({ length: 1024 }, (_, index) => index % 256));
  const packet = Buffer.concat([Buffer.from([0xaa, 0x55, 3, 0x99]), payload]);
  socket.write(Buffer.concat([Buffer.from([0xaa, 0x55, 0, 1, 65]), packet]));
  await waitFor(() => frames.length === 1);
  assert.equal(records.length, 0, 'idle realtime traffic must not be recorded');
  assert.equal(frames[0].type, 'sensor.frame');
  assert.equal(frames[0].channelId, 'body-copy:sit');
  assert.deepEqual(frames[0].payload.value, [...payload]);
  state.collecting = true; socket.write(packet);
  await waitFor(() => records.length === 1);
  assert.equal(records[0].db, 'copy-database');
  assert.equal(records[0].channel, 'sit');
  assert.deepEqual(JSON.parse(records[0].data), [...payload], 'native replay and CSV retain their 1024 point array');
  state.playback = true; socket.write(packet);
  await waitFor(() => socket.destroyed);
  assert.equal(frames.length, 2, 'live data must not overwrite playback');
  assert.equal(records.length, 1);
});
