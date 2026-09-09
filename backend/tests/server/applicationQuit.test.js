const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter } = require('events');
const { createApplicationQuitHandler } = require('../../../app/electron/applicationQuit');

/** 为关闭事件记录是否被阻止，避免依赖真实 Electron 窗口。 */
function quitEvent() {
  return { prevented: false, preventDefault() { this.prevented = true; } };
}

/** 加载真实主入口并替换设备依赖，验证清理接线和更新安装时不 dispose updater。 */
async function verifyMainEntry(installing) {
  const app = new EventEmitter();
  const warnings = [];
  let finishBackend, shutdownCalls = 0, disposeCalls = 0, quitCalls = 0;
  app.whenReady = () => ({ then() {} });
  app.quit = () => {
    quitCalls += 1;
    const resumed = quitEvent();
    app.emit('before-quit', resumed);
    assert.strictEqual(resumed.prevented, false);
  };
  const electron = { app, ipcMain: { on() {}, handle() {} } };
  const logger = { info() {}, warn: (...args) => warnings.push(args) };
  const filename = path.resolve(__dirname, '../../../app/electron/index.js');
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8') + '\nmodule.exports.setUpdater = (value) => { appUpdater = value; };', {
    __dirname: path.dirname(filename), module, process, setTimeout, clearTimeout,
    require: (name) => {
      if (name === 'electron') return electron;
      if (name === 'child_process') return { execSync() {} };
      if (name === './applicationQuit') return { createApplicationQuitHandler };
      if (name === '../../backend/runtime') return { shutdownServer() {
        shutdownCalls += 1;
        return new Promise((resolve) => { finishBackend = resolve; });
      } };
      if (name === '../update/autoUpdater') return { AppUpdater: class {} };
      if (name === '../../backend/common/logger') return logger;
      return require(name);
    },
  }, { filename });
  module.exports.setUpdater({ isInstallingUpdate: () => installing, dispose: () => { disposeCalls += 1; } });
  const beforeQuit = app.listeners('before-quit')[0];
  const first = quitEvent();
  const pending = beforeQuit(first);
  assert.strictEqual(beforeQuit(quitEvent()), pending);
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(shutdownCalls, 1);
  assert.strictEqual(quitCalls, 0);
  assert.strictEqual(disposeCalls, installing ? 0 : 1);
  finishBackend();
  await pending;
  assert.strictEqual(quitCalls, 1);
  assert.strictEqual(warnings.length, 0);
}

/** 验证退出会等待清理、重复触发只清理一次，失败与超时仍可退出。 */
async function run() {
  let finish, cleanupCalls = 0, quitCalls = 0;
  const warnings = [];
  const logger = { warn: (...args) => warnings.push(args) };
  const handler = createApplicationQuitHandler({
    app: { quit() {
      quitCalls += 1;
      const resumed = quitEvent();
      handler(resumed);
      assert.strictEqual(resumed.prevented, false);
    } },
    cleanup: () => { cleanupCalls += 1; return new Promise((resolve) => { finish = resolve; }); },
    logger,
  });
  const first = quitEvent(), second = quitEvent();
  const pending = handler(first);
  assert.strictEqual(handler(second), pending);
  assert(first.prevented && second.prevented);
  await Promise.resolve();
  assert.strictEqual(cleanupCalls, 1);
  assert.strictEqual(quitCalls, 0);
  finish();
  await pending;
  assert.strictEqual(quitCalls, 1);
  assert.strictEqual(warnings.length, 0);

  for (const cleanup of [() => { throw new Error('sync cleanup failure'); }, async () => { throw new Error('async cleanup failure'); }]) {
    const failed = createApplicationQuitHandler({ app: { quit: () => { quitCalls += 1; } }, cleanup, logger });
    await failed(quitEvent());
  }
  assert.strictEqual(quitCalls, 3);
  assert.strictEqual(warnings.length, 2);

  let finishLate;
  const stalled = createApplicationQuitHandler({
    app: { quit: () => { quitCalls += 1; } }, logger, timeoutMs: 15,
    cleanup: () => new Promise((resolve) => { finishLate = resolve; }),
  });
  await stalled(quitEvent());
  assert.strictEqual(quitCalls, 4);
  await verifyMainEntry(false);
  await verifyMainEntry(true);
  assert.match(warnings[2][0], /timed out/);
  finishLate();
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(quitCalls, 4);
  console.log('applicationQuit.test.js passed');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
