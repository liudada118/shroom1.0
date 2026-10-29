const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const vm = require('node:vm');
const { EventEmitter, once } = require('node:events');
const { createRequire } = require('node:module');
const { spawn } = require('node:child_process');
const { claimApplicationInstance, checkLocalPort, checkApplicationPorts, startupFailureText } = require('../../../app/electron/startupGuard');
const { subscribeLocalServiceErrors, watchLocalServiceErrors } = require('../../common/localServiceErrors');
const { createWebSocketServer } = require('../../kernel/platform/websocket/websocketRuntimeFactory');
const { startLocalHttpServer } = require('../../kernel/platform/bootstrap/bootstrapServer');
const indexPath = path.resolve(__dirname, '../../../app/electron/index.js');
const source = fs.readFileSync(indexPath, 'utf8');
const silentLogger = { info() {}, warn() {}, error() {} };

/** 创建只占用随机端口的测试监听，不接触应用的固定端口。 */
async function occupiedPort(t, host = '127.0.0.1') {
  const server = net.createServer(socket => socket.end('owned-fixture'));
  server.listen({ ...(host ? { host } : {}), port: 0, exclusive: true });
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { server, port: server.address().port };
}

test('a second entry exits before importing the backend or registering IPC', () => {
  let quits = 0;
  const imported = [];
  const execute = vm.runInNewContext(`(function(require) { ${source}\n})`);
  execute(name => {
    imported.push(name);
    if (name === 'electron') return { app: { requestSingleInstanceLock: () => false, quit: () => quits++ } };
    if (name === './startupGuard') return { claimApplicationInstance };
    throw new Error('Duplicate instance loaded runtime: ' + name);
  });
  assert.equal(quits, 1);
  assert.deepEqual(imported, ['electron', './startupGuard']);
});

test('the primary instance receives a second launch without claiming another service', () => {
  const app = new EventEmitter();
  let activations = 0;
  app.requestSingleInstanceLock = () => true;
  app.quit = () => assert.fail('Primary must not quit');
  assert.equal(claimApplicationInstance(app, () => activations++), true);
  app.emit('second-instance');
  app.emit('second-instance');
  assert.equal(activations, 2);
});

test('occupied ports are reported without killing or connecting to their owner', async t => {
  const { server, port } = await occupiedPort(t);
  let connections = 0;
  server.on('connection', () => connections++);
  await assert.rejects(checkApplicationPorts([{ host: '127.0.0.1', port }]), error => error.code === 'EADDRINUSE' && error.port === port);
  assert.equal(server.listening, true);
  assert.equal(connections, 0);
});

test('successful port checks release their temporary listener', async () => {
  await checkLocalPort({ host: '127.0.0.1', port: 0 });
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  await checkLocalPort({ host: '127.0.0.1', port });
  server.listen(port, '127.0.0.1');
  await once(server, 'listening');
  await new Promise(resolve => server.close(resolve));
});

test('default preflight checks IPv4 websocket access before the all-interface listener', async () => {
  const probes = [];
  let occupiedIpv4 = false;
  const guardPath = path.resolve(__dirname, '../../../app/electron/startupGuard.js');
  const context = vm.createContext({ module: { exports: {} }, setTimeout, clearTimeout,
    require: name => {
      assert.equal(name, 'node:net');
      return { createServer: () => {
        const server = new EventEmitter();
        server.listen = options => {
          probes.push([options.port, options.host || '*']);
          queueMicrotask(() => {
            if (occupiedIpv4 && options.port === 19999 && options.host === '127.0.0.1') {
              server.emit('error', Object.assign(new Error('occupied fixture'), { code: 'EADDRINUSE' }));
            } else server.emit('listening');
          });
          return server;
        };
        server.close = callback => queueMicrotask(() => callback());
        return server;
      } };
    },
  });
  vm.runInContext(fs.readFileSync(guardPath, 'utf8'), context);
  await context.module.exports.checkApplicationPorts();
  assert.deepEqual(probes, [[19999, '127.0.0.1'], [19999, '*'], [19245, '127.0.0.1'], [12321, '127.0.0.1']]);
  probes.length = 0; occupiedIpv4 = true;
  await assert.rejects(context.module.exports.checkApplicationPorts(), error => error.code === 'EADDRINUSE' && error.port === 19999);
  assert.deepEqual(probes, [[19999, '127.0.0.1']], 'an available IPv6 listener cannot conceal an occupied IPv4 service');
});

test('actual websocket and control HTTP bind failures reach the host once each', { timeout: 5000 }, async t => {
  const { port: wsPort } = await occupiedPort(t, null);
  const { port: httpPort } = await occupiedPort(t);
  const failures = [], logs = [];
  const unsubscribe = subscribeLocalServiceErrors(item => failures.push(item));
  t.after(unsubscribe);
  const logger = { info() {}, error: (...args) => logs.push(args) };
  const ws = createWebSocketServer({ port: wsPort, logger });
  await once(ws, 'error');
  await new Promise(resolve => ws.close(resolve));
  const control = startLocalHttpServer({ port: httpPort, logger, app: { listen: (...args) => http.createServer().listen(...args) } });
  await once(control, 'error');
  await new Promise(resolve => control.close(resolve));
  assert.deepEqual(failures.map(item => [item.service, item.error.code, item.port]), [
    ['websocket', 'EADDRINUSE', wsPort], ['control-http', 'EADDRINUSE', httpPort],
  ]);
  assert.equal(logs.length, 2);
});

test('startup messages explain the exact port and do not expose error text', () => {
  for (const locale of ['zh-CN', 'en-US', 'ja-JP']) {
    const result = startupFailureText({ code: 'EADDRINUSE', port: 12321, message: 'secret-file-or-key' }, locale);
    assert.match(result.message, /12321/);
    assert(!JSON.stringify(result).includes('secret-file-or-key'));
  }
});

test('the real entry rejects preflight failure before initializing backend or usage', async () => {
  const app = new EventEmitter(), dialogs = [], exits = [], backendCalls = [];
  let resolveReady;
  app.requestSingleInstanceLock = () => true;
  app.whenReady = () => new Promise(resolve => { resolveReady = resolve; });
  app.getLocale = () => 'zh-CN';
  app.exit = code => exits.push(code);
  app.quit = () => assert.fail('Preflight failure must not invoke backend cleanup');
  const localRequire = createRequire(indexPath);
  const execute = vm.runInNewContext(`(function(require, __dirname, process) { ${source}\n})`, { console, module: { exports: {} } });
  execute(name => {
    if (name === 'electron') return { app, dialog: { showErrorBox: (...args) => dialogs.push(args) }, ipcMain: { on() {}, handle() {} } };
    if (name === './startupGuard') return { claimApplicationInstance, startupFailureText,
      checkApplicationPorts: async () => { throw Object.assign(new Error('occupied'), { code: 'EADDRINUSE', port: 19999 }); } };
    if (name === '../../backend/runtime') return { openServer: () => backendCalls.push('open'), shutdownServer: () => backendCalls.push('close') };
    if (name === '../update/autoUpdater') return {};
    if (name === '../../backend/common/logger') return silentLogger;
    if (name === '../../backend/common/localServiceErrors') return { subscribeLocalServiceErrors() {} };
    return localRequire(name);
  }, path.dirname(indexPath), { platform: 'linux' });
  resolveReady();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(backendCalls, []);
  assert.deepEqual(exits, [1]);
  assert.equal(dialogs.length, 1);
  assert.match(dialogs[0][1], /19999/);
});

test('application service initialization failure cannot lazily start a backend during cleanup', async () => {
  const app = new EventEmitter(), dialogs = [], exits = [], backendCalls = [];
  let resolveReady, quits = 0, analyticsAttempts = 0;
  app.requestSingleInstanceLock = () => true;
  app.whenReady = () => new Promise(resolve => { resolveReady = resolve; });
  app.getLocale = () => 'zh-CN';
  app.getPath = () => os.tmpdir();
  app.getVersion = () => '1.1.43';
  app.isPackaged = true;
  app.exit = code => exits.push(code);
  app.quit = () => { quits++; app.emit('before-quit', { preventDefault() {} }); };
  /** 提供主进程初始化所需的窗口，不加载任何真实前端或设备。 */
  class TestWindow extends EventEmitter {
    /** 保留服务状态发布所需的安全窗口接口。 */
    constructor() { super(); this.webContents = { send() {} }; }
    /** 允许入口完成窗口布局步骤，不显示真实窗口。 */
    maximize() {}
    /** 初始化期间窗口保持有效，覆盖状态发布触发的诊断路径。 */
    isDestroyed() { return false; }
  }
  const localRequire = createRequire(indexPath);
  const execute = vm.runInNewContext(`(function(require, __dirname, process) { ${source}\n})`, { console, module: { exports: {} } });
  execute(name => {
    if (name === 'electron') return { app, BrowserWindow: TestWindow, net: { fetch() {} },
      dialog: { showErrorBox: (...args) => dialogs.push(args) }, ipcMain: { on() {}, handle() {} },
      powerSaveBlocker: { start: () => 1, isStarted: () => true }, powerMonitor: new EventEmitter() };
    if (name === './startupGuard') return { claimApplicationInstance, startupFailureText, checkApplicationPorts: async () => {} };
    if (name === '../../backend/runtime') return {
      openServer: () => backendCalls.push('open'), shutdownServer: () => backendCalls.push('shutdown'),
      getRuntimeStatus: () => { backendCalls.push('getRuntimeStatus'); return {}; },
    };
    if (name === '../update/frontendCache') return { createFrontendCache: () => ({ status: () => ({}), dispose() {} }) };
    if (name === './usageAnalytics') return { createUsageAnalytics: options => {
      analyticsAttempts++;
      // 初始化上报会读取版本并发布状态；这两条路径都不能隐式加载后台。
      options.getRuntimeVersions();
      options.onStatus({ enabled: true });
      throw new Error('fixture: unreadable analytics settings');
    } };
    if (name === './agentProcess') return { registerAgentIpc() {} };
    if (name === '../../backend/kernel/platform/license/licenseKeyStore') return { readStoredLicenseKey: () => '' };
    if (name === '../update/autoUpdater') return {};
    if (name === '../../backend/common/logger') return silentLogger;
    if (name === '../../backend/common/localServiceErrors') return { subscribeLocalServiceErrors() {} };
    return localRequire(name);
  }, path.dirname(indexPath), { platform: 'linux', on() {} });
  resolveReady();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(analyticsAttempts, 1);
  assert.deepEqual(backendCalls, []);
  assert.equal(quits, 0);
  assert.deepEqual(exits, [1]);
  assert.equal(dialogs.length, 1);
});

test('reopening a window reuses HTTP and retains rollback after the previous window closes', async t => {
  const acorn = createRequire(path.resolve(__dirname, '../../../client/package.json'))('acorn');
  const declaration = acorn.parse(source, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }).body
    .find(node => node.type === 'FunctionDeclaration' && node.id.name === 'startStaticServer');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-static-reopen-'));
  const pendingRoot = path.join(directory, 'pending'), fallbackRoot = path.join(directory, 'fallback');
  fs.mkdirSync(pendingRoot); fs.mkdirSync(fallbackRoot);
  fs.writeFileSync(path.join(pendingRoot, 'index.html'), 'pending-page');
  fs.writeFileSync(path.join(fallbackRoot, 'index.html'), 'fallback-page');
  t.after(() => {
    assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const loads = [], timers = new Map();
  let created = 0, rollbackChecks = 0;
  const context = vm.createContext({ staticServer: null, startupFailed: false, appCleanupPromise: null, packagedFrontendRoot: fallbackRoot,
    http: { createServer: handler => { created++; return http.createServer(handler); } },
    fs, path, logger: silentLogger, resolveBuildRoot: () => pendingRoot, watchLocalServiceErrors,
    getAppServices: () => ({ frontend: {
      rollback: root => { assert.equal(root, fallbackRoot); rollbackChecks++; return true; },
      selectRoot: () => fallbackRoot,
    } }),
    require: name => { assert.equal(name, './agentProcess'); return { loadAgentWindowUrl: async win => loads.push(win.id) }; },
    setTimeout: (callback, delay) => { assert.equal(delay, 30000); const timer = { unref() {} }; timers.set(timer, callback); return timer; },
    clearTimeout: timer => timers.delete(timer),
  });
  vm.runInContext(source.slice(declaration.start, declaration.end), context);
  /** 模拟 macOS 关闭窗口但保留主进程，触发真实的 closed 监听。 */
  function windowFixture(id) {
    const win = new EventEmitter();
    let destroyed = false;
    win.id = id;
    win.isDestroyed = () => destroyed;
    win.close = () => { destroyed = true; win.emit('closed'); };
    return win;
  }
  /** 读取随机端口上的真实响应，确认回滚同时更新 HTTP 文件根目录。 */
  function readPage(server) {
    return new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port: server.address().port, path: '/', agent: false }, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk; });
        response.on('end', () => resolve(body));
        response.on('error', reject);
      }).on('error', reject);
    });
  }
  const first = windowFixture('closed'), second = windowFixture('replacement');
  context.startStaticServer({ hostname: '127.0.0.1', port: 0, win: first });
  const server = context.staticServer;
  t.after(() => new Promise(resolve => server.close(resolve)));
  first.close();
  context.startStaticServer({ hostname: '127.0.0.1', port: 0, win: second });
  await once(server, 'listening');
  assert.equal(timers.size, 1);
  second.close();
  assert.equal(timers.size, 0, 'closing a loaded window cancels only its boot check');
  context.startStaticServer({ hostname: '127.0.0.1', port: 0, win: windowFixture('third') });
  assert.equal(created, 1);
  assert.deepEqual(loads, ['replacement', 'third']);
  assert.equal(timers.size, 1, 'a reused listener must still check the replacement page');
  assert.equal(await readPage(server), 'pending-page');
  const [timer, check] = timers.entries().next().value;
  timers.delete(timer); check();
  assert.equal(rollbackChecks, 1);
  assert.deepEqual(loads, ['replacement', 'third', 'third']);
  assert.equal(await readPage(server), 'fallback-page');
});

test('two real Electron processes share one isolated instance and activate the first', { timeout: 20000 }, async t => {
  if (!process.versions.electron) return t.skip('Run with the project Electron ABI');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-instance-test-'));
  const fixture = path.join(directory, 'main.cjs');
  const guardPath = path.resolve(__dirname, '../../../app/electron/startupGuard');
  fs.writeFileSync(fixture, `const {app}=require('electron'); app.setPath('userData',${JSON.stringify(path.join(directory, 'profile'))}); app.disableHardwareAcceleration();
const {claimApplicationInstance}=require(${JSON.stringify(guardPath)});
if (!claimApplicationInstance(app,()=>{console.log('ACTIVATED');setTimeout(()=>app.quit(),40);})) {console.log('SECOND_EXIT');return;}
app.whenReady().then(()=>{console.log('PRIMARY_READY');setTimeout(()=>app.exit(2),10000).unref();});`);
  const children = [];
  /** 运行只加载实例守卫的隔离 Electron，不启动真实设备、授权或上报服务。 */
  function launch() {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(process.execPath, [fixture], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    let output = '';
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    const done = new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => resolve(code)); });
    return { child, done, output: () => output };
  }
  t.after(async () => {
    for (const child of children) if (child.exitCode === null) child.kill();
    assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const first = launch();
  const deadline = Date.now() + 8000;
  while (!first.output().includes('PRIMARY_READY') && Date.now() < deadline && first.child.exitCode === null) {
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  assert.match(first.output(), /PRIMARY_READY/);
  const second = launch();
  assert.equal(await second.done, 0);
  assert.equal(await first.done, 0);
  assert.match(second.output(), /SECOND_EXIT/);
  assert.match(first.output(), /ACTIVATED/);
  assert(!second.output().includes('PRIMARY_READY'));
});
