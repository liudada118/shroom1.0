const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const express = require('express');
const http = require('http');
const { EventEmitter } = require('events');
const { createSerialManager } = require('@shroom/backend/serial/serialManager.js');
const { createControlCommandRouter } = require('../../kernel/platform/commands/controlCommandRouter');
const { createControlCommandService } = require('../../kernel/platform/commands/controlCommandService');
const { registerSerialControlHandlers } = require('../../kernel/serial/serialControlService');
const { createSerialPortOrchestrator } = require('../../kernel/serial/serialPortOrchestrator');
const { registerControlRoutes } = require('../../kernel/platform/http/controlRoutes');
const { createHttpApp } = require('../../kernel/platform/http/httpAppFactory');
const { getSensorBaudRate } = require('@shroom/backend/sensors/registry.js');

/** 执行组合根的真实默认参数读取函数，不启动后台或复写一套默认值规则。 */
function productionSerialDefaults(context) {
  const source = fs.readFileSync(path.resolve(__dirname, '../../kernel/platform/server.js'), 'utf8');
  const acorn = createRequire(path.resolve(__dirname, '../../../client/package.json'))('acorn');
  const declaration = acorn.parse(source, { ecmaVersion: 'latest' }).body
    .find(node => node.type === 'FunctionDeclaration' && node.id.name === 'readSerialDefaults');
  assert.ok(declaration);
  return vm.runInNewContext(`(${source.slice(declaration.start, declaration.end)})`, context);
}

/** 运行真实 HTTP → 路由 → 串口 handler → 管理器，硬件打开由测试控制。 */
async function run() {
  const ports = [];
  const events = [];
  let failScan = false;
  const current = { sensorType: 'fast256', templateId: null, displaySystemId: null, configuredBaudRate: null };
  const getSerialDefaults = productionSerialDefaults({
    runtimeContext: { getSensorType: () => current.sensorType },
    zeroChannelIdentityResolver: { getActiveDisplaySystemId: () => current.displaySystemId },
    appRuntime: {
      builtinTemplates: { currentId: sensorType => current.templateId || sensorType },
      displaySystems: { getSerialConfig: (sensorType, role) => {
        assert.strictEqual(sensorType, current.sensorType);
        assert.strictEqual(role, 'sit');
        return current.configuredBaudRate == null ? null : { baudRate: current.configuredBaudRate };
      } },
    },
    getSensorBaudRate,
  });
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
  const routeDependencies = { ...deps, serialManager: manager,
    controlCommandService: createControlCommandService({ commandRouter: router }) };
  const app = createHttpApp({ ...routeDependencies, getSerialDefaults });
  const legacyApp = express();
  registerControlRoutes(legacyApp, routeDependencies);
  app.use('/without-defaults', legacyApp);
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
  /** 通过同一状态接口读取最新系统默认值及已有连接，兼容宿主省略默认回调。 */
  async function serialStatus(prefix = '') {
    const response = await fetch('http://127.0.0.1:' + server.address().port + prefix + '/api/serial/status');
    assert.strictEqual(response.status, 200);
    return (await response.json()).data;
  }
  /** 等到 HTTP 请求进入物理打开，防止测试依赖网络调度速度。 */
  async function waitPort(index) {
    for (let count = 0; count < 100 && !ports[index]?.finish; count += 1) await new Promise((resolve) => setTimeout(resolve, 1));
    assert.ok(ports[index]?.finish);
  }
  try {
    const initial = await serialStatus();
    assert.deepStrictEqual(initial.serial, []);
    assert.deepStrictEqual(initial.defaults, { systemId: 'fast256', sensorType: 'fast256', baudRate: 921600 });
    assert.strictEqual((await serialStatus('/without-defaults')).defaults, null);

    current.sensorType = 'smallBed12B';
    assert.deepStrictEqual((await serialStatus()).defaults,
      { systemId: 'smallBed12B', sensorType: 'smallBed12B', baudRate: 1500000 });
    current.sensorType = 'fast256';
    current.templateId = 'fast256-copy';
    assert.deepStrictEqual((await serialStatus()).defaults,
      { systemId: 'fast256-copy', sensorType: 'fast256', baudRate: 921600 });
    current.displaySystemId = 'configured-matrix';
    current.configuredBaudRate = 6000000;
    assert.deepStrictEqual((await serialStatus()).defaults,
      { systemId: 'configured-matrix', sensorType: 'fast256', baudRate: 6000000 });
    current.displaySystemId = null;
    current.configuredBaudRate = null;

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
    let confirmClose;
    ports[1].close = callback => { confirmClose = () => { ports[1].isOpen = false; ports[1].emit('close'); callback?.(); }; };
    let closeResponded = false;
    const closing = command('serial.close', { roles: ['armLeft'] }).then(result => { closeResponded = true; return result; });
    for (let count = 0; count < 100 && !confirmClose; count += 1) await new Promise(resolve => setTimeout(resolve, 1));
    assert.ok(confirmClose);
    assert.strictEqual(closeResponded, false, 'HTTP close ACK waits for the actual driver release');
    assert.strictEqual(ports[1].isOpen, true);
    confirmClose();
    const closed = await closing;
    assert.strictEqual(closed.body.data.ok, true);
    assert.strictEqual(ports[1].isOpen, false);
    current.sensorType = 'bed4096';
    current.templateId = 'bed4096-copy';
    const changedDefaults = await serialStatus();
    assert.ok(changedDefaults.serial.some(status => status.role === 'armLeft' && !status.isOpen && status.baudRate === 115200));
    assert.deepStrictEqual(changedDefaults.defaults,
      { systemId: 'bed4096-copy', sensorType: 'bed4096', baudRate: 3000000 },
      'closed and other-system connections must not determine the current default baud rate');

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
