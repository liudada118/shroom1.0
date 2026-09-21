const assert = require('assert');
const express = require('express');
const http = require('http');
const { EventEmitter } = require('events');
const { createSerialManager } = require('@shroom/backend/serial/serialManager.js');
const { createControlCommandRouter } = require('../../kernel/platform/commands/controlCommandRouter');
const { createControlCommandService } = require('../../kernel/platform/commands/controlCommandService');
const { registerSerialControlHandlers } = require('../../kernel/serial/serialControlService');
const { createSerialPortOrchestrator } = require('../../kernel/serial/serialPortOrchestrator');
const { registerControlRoutes } = require('../../kernel/platform/http/controlRoutes');

/** 运行真实 HTTP → 路由 → 串口 handler → 管理器，硬件打开由测试控制。 */
async function run() {
  const ports = [];
  const events = [];
  let failScan = false;
  const manager = createSerialManager({ openTimeoutMs: 40, closeTimeoutMs: 30,
    onStatus: (status) => events.push(status),
    createSerialPort: () => {
      const port = new EventEmitter();
      port.isOpen = false;
      port.open = (callback) => { port.finish = (error) => { port.isOpen = !error; callback(error); }; };
      port.close = (callback) => { port.isOpen = false; port.emit('close'); callback?.(); };
      ports.push(port);
      return port;
    },
  });
  const router = createControlCommandRouter();
  const serialRoles = manager.roles;
  const orchestrator = createSerialPortOrchestrator({ serialManager: manager,
    getSensorType: () => 'test', listSerialChannels: () => [
      { serialRole: 'armLeft', baudRate: 115200 }, { serialRole: 'armRight', baudRate: 115200 },
    ], logger: { warn() {} },
  });
  const deps = {
    serialRoles, getRuntime: () => ({ nowDate: 1, endDate: 2 }), setRuntime: () => {},
    openSitSerialPort: (path) => manager.open('sit', { path }),
    openManifestSerialPorts: orchestrator.openManifestSerialPorts,
    waitForSerialOpen: manager.waitForOpen,
    closeManagedSerialPort: manager.close,
    closeManagedSerialPorts: (roles) => roles.map((role) => manager.close(role)),
    listPorts: async () => { if (failScan) throw new Error('scan failed'); return []; },
    getPort: (portsList) => portsList, logSerialPortList: () => {},
    publishSystemEvent: (event) => events.push(event), logger: { error() {}, warn() {} },
  };
  registerSerialControlHandlers(router, deps);
  const app = express(); app.use(express.json());
  registerControlRoutes(app, { ...deps, serialManager: manager,
    controlCommandService: createControlCommandService({ commandRouter: router }) });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  /** 提交规范命令并读取回执。 */
  async function command(type, payload) {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/commands', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, payload, requestId: 'serial-test' }),
    });
    return { status: response.status, body: await response.json() };
  }
  /** 等到 HTTP 请求进入物理打开，防止测试依赖网络调度速度。 */
  async function waitPort(index) {
    for (let count = 0; count < 100 && !ports[index]?.finish; count += 1) await new Promise((resolve) => setTimeout(resolve, 1));
    assert.ok(ports[index]?.finish);
  }
  try {
    let responded = false;
    const opening = command('serial.open', { role: 'sit', path: 'COM3' }).then((result) => { responded = true; return result; });
    await waitPort(0);
    assert.strictEqual(responded, false, 'HTTP cannot ACK before the driver callback');
    ports[0].finish(new Error('Access denied'));
    const failed = await opening;
    assert.strictEqual(failed.status, 409);
    assert.strictEqual(failed.body.data.ok, false);
    assert.strictEqual(failed.body.data.code, 'SERIAL_PORT_BUSY');
    assert.strictEqual(failed.body.data.data.path, 'COM3');

    const dynamic = command('serial.open', { role: 'armLeft', path: 'COM4' });
    await waitPort(1); ports[1].finish();
    const success = await dynamic;
    assert.strictEqual(success.status, 200);
    assert.ok(success.body.data.data.serial.find((status) => status.role === 'armLeft' && status.isOpen));
    const duplicate = await command('serial.open', { role: 'sit', path: 'COM4' });
    assert.strictEqual(duplicate.body.data.code, 'SERIAL_PORT_BUSY');
    assert.strictEqual(ports[1].isOpen, true);
    assert.strictEqual(duplicate.body.data.data.role, 'sit');

    const right = command('serial.open', { role: 'armRight', path: 'COM6' });
    await waitPort(2); ports[2].finish(); await right;
    const occupied = await command('serial.open', { role: 'armLeft', path: 'COM6' });
    assert.strictEqual(occupied.body.data.code, 'SERIAL_PORT_BUSY');
    assert.strictEqual(ports[1].isOpen, true, 'failed manifest replacement must preserve the previous connection');
    assert.strictEqual(ports[2].isOpen, true);

    const timeout = await command('serial.open', { role: 'sit', path: 'COM5' });
    assert.strictEqual(timeout.status, 504);
    assert.strictEqual(timeout.body.data.code, 'SERIAL_CONNECT_TIMEOUT');
    ports[3].finish();
    assert.strictEqual(ports[3].isOpen, false);
    const closed = await command('serial.close', { roles: ['armLeft'] });
    assert.strictEqual(closed.body.data.ok, true);
    assert.strictEqual(ports[1].isOpen, false);

    await command('serial.refresh', {});
    assert.ok(events.some((event) => event.serialNotice?.code === 'SERIAL_NO_PORTS'));
    failScan = true;
    const scan = await command('serial.refresh', {});
    assert.strictEqual(scan.body.data.code, 'SERIAL_LIST_FAILED');
  } finally {
    await manager.closeAll();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

run().then(() => console.log('serialConnectionApi.test.js passed')).catch((error) => { console.error(error); process.exitCode = 1; });
