const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
const { describeUpdaterError, createUpdaterLogger } = require('../../../app/update/updaterErrors');

const rawMac = 'Cannot find channel "latest-mac.yml" update info: HttpError: 404 "method: GET url: https://user:private@example.invalid/shroom1/latest-mac.yml?token=secret-token\nPlease double check that your authentication token is correct. Headers: { Authorization: Bearer private-token }\n at /Users/private/Shroom.app/app.asar/index.js';

/** Load the real installer bridge with an isolated updater and IPC transport. */
function fixture(options = {}, timers = { setTimeout, clearTimeout, setInterval, clearInterval }) {
  const engine = new EventEmitter(), handlers = new Map(), sent = [], logs = [], businessEvents = [];
  engine.checkForUpdatesAndNotify = async () => null;
  engine.downloadUpdate = async () => [];
  engine.quitAndInstall = () => {};
  const filename = path.resolve(__dirname, '../../../app/update/autoUpdater.js');
  const nativeRequire = createRequire(filename), module = { exports: {} };
  const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, (...args) => logs.push({ level, args })]));
  const localRequire = name => name === 'electron-updater' ? { autoUpdater: engine }
    : name === 'electron' ? { ipcMain: { removeHandler: key => handlers.delete(key), handle: (key, fn) => handlers.set(key, fn) }, dialog: { showMessageBox: async () => ({ response: 1 }) } }
    : name === '../../backend/common/logger' ? logger
    : name === '../../backend/common/businessEvents' ? { recordBusinessEvent: (...args) => businessEvents.push(args) } : nativeRequire(name);
  vm.runInNewContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', { process, ...timers }, { filename })(localRequire, module, module.exports);
  const updater = new module.exports.AppUpdater({ isDestroyed: () => false, webContents: { send: (_channel, payload) => sent.push(payload) } }, { platform: 'darwin', ...options });
  return { updater, engine, sent, logs, businessEvents, handlers, invoke: data => handlers.get('update-command')({}, data) };
}

/** Advance only the updater's timers so interval behavior does not wait four real hours. */
function fakeClock() {
  let now = 0, nextId = 0;
  const tasks = new Map();
  /** Register a timeout or interval; zero is a valid timer ID in this clock. */
  function schedule(callback, delay, interval) {
    const id = nextId++;
    tasks.set(id, { callback, at: now + delay, interval });
    return id;
  }
  /** Run due callbacks in time order and retain only active recurring timers. */
  function advance(milliseconds) {
    const end = now + milliseconds;
    while (true) {
      const entry = [...tasks.entries()].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      const [id, task] = entry;
      now = task.at;
      if (task.interval) task.at += task.interval;
      else tasks.delete(id);
      task.callback();
    }
    now = end;
  }
  return { tasks, advance, timers: {
    /** Schedule a finite delay. */
    setTimeout: (callback, delay) => schedule(callback, delay, 0),
    /** Cancel a finite delay. */
    clearTimeout: id => tasks.delete(id),
    /** Schedule a repeating check. */
    setInterval: (callback, delay) => schedule(callback, delay, delay),
    /** Cancel a repeating check. */
    clearInterval: id => tasks.delete(id),
  } };
}

test('missing installer channel describes the correct platform without credential advice', () => {
  const mac = describeUpdaterError(new Error(rawMac), 'darwin');
  assert.equal(mac.code, 'MAC_RELEASE_UNAVAILABLE'); assert.equal(mac.httpStatus, 404);
  assert.match(mac.message, /尚未发布 macOS 安装包/); assert.match(mac.message, /网页更新/);
  const windows = describeUpdaterError(new Error('Cannot find channel latest.yml HttpError: 404'), 'win32');
  assert.equal(windows.code, 'WINDOWS_RELEASE_UNAVAILABLE'); assert.match(windows.message, /Windows/);
  assert.equal(describeUpdaterError({ message: 'latest-linux.yml', statusCode: 404 }, 'linux').code, 'PLATFORM_RELEASE_UNAVAILABLE');
  assert.equal(describeUpdaterError(new Error('zip download HttpError: 404'), 'darwin').code, 'UPDATE_PACKAGE_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(mac), /https?:|private|token|Headers|app\.asar/);
});

test('network, authentication and unknown failures have bounded public messages', () => {
  for (const message of ['net::ERR_INTERNET_DISCONNECTED', 'getaddrinfo ENOTFOUND example.invalid', 'ETIMEDOUT', 'network timeout'])
    assert.equal(describeUpdaterError(new Error(message), 'win32').code, 'UPDATE_NETWORK_UNAVAILABLE');
  assert.equal(describeUpdaterError({ statusCode: 403, message: 'secret' }).code, 'UPDATE_SERVER_ACCESS_DENIED');
  assert.equal(describeUpdaterError(new Error('private unknown stack https://private.invalid?token=secret')).code, 'SOFTWARE_UPDATE_FAILED');
});

test('checksum, content-length and code signing retain actionable classifications', () => {
  assert.equal(describeUpdaterError(new Error('sha512 checksum mismatch')).code, 'UPDATE_CHECKSUM_MISMATCH');
  assert.equal(describeUpdaterError(new Error('ERR_CONTENT_LENGTH_MISMATCH')).code, 'UPDATE_CONTENT_LENGTH_MISMATCH');
  assert.equal(describeUpdaterError(new Error('Code signature at URL file:///secret did not pass validation')).code, 'UPDATE_SIGNATURE_MISMATCH');
  assert.doesNotMatch(describeUpdaterError(new Error('ERR_CHECKSUM_MISMATCH'), 'win32').message, /mac|zip/i);
});

test('updater engine diagnostics never retain raw strings, credentials or HTTP headers', () => {
  const entries = [], logger = createUpdaterLogger({ info: (...args) => entries.push(args), error: (...args) => entries.push(args) }, 'darwin');
  logger.error(new Error(rawMac)); logger.info('Downloading from https://secret.invalid?token=private');
  const serialized = JSON.stringify(entries);
  assert.match(serialized, /MAC_RELEASE_UNAVAILABLE/); assert.match(serialized, /latest-mac.yml/);
  assert.doesNotMatch(serialized, /secret|private|https?:|Authorization|Headers|app\.asar/);
});

test('real updater events and rejected IPC operations expose only safe installer failures', async () => {
  const app = fixture();
  try {
    app.engine.emit('error', new Error(rawMac));
    app.engine.checkForUpdatesAndNotify = async () => { throw new Error(rawMac); };
    await assert.rejects(app.invoke({ action: 'checkForUpdate' }), error => /尚未发布 macOS/.test(error.message) && !/token|https?:|app\.asar/.test(error.message));
    assert.equal(app.sent.filter(item => item.type === 'update-error').length, 1, 'engine and IPC must not duplicate the same notification');
    assert.equal(app.sent[0].code, 'MAC_RELEASE_UNAVAILABLE');
    assert.doesNotMatch(JSON.stringify({ logs: app.logs, sent: app.sent }), /private|token|https?:|Headers|app\.asar/);
  } finally { app.updater.dispose(); }
});

test('download rejection is normalized even when the engine emits no error event', async () => {
  const app = fixture({ platform: 'win32' });
  try {
    app.engine.downloadUpdate = async () => { throw new Error('ETIMEDOUT https://private.invalid'); };
    await assert.rejects(app.invoke({ action: 'downloadUpdate' }), /检查网络/);
    assert.equal(app.sent.at(-1).code, 'UPDATE_NETWORK_UNAVAILABLE');
  } finally { app.updater.dispose(); }
});

test('only content-length mismatch retries once; missing channel does not retry', async () => {
  const app = fixture();
  let checks = 0;
  try {
    app.engine.checkForUpdatesAndNotify = async () => {
      checks++;
      if (checks === 1) throw new Error('ERR_CONTENT_LENGTH_MISMATCH');
      return { updateInfo: { version: '1.1.38' } };
    };
    assert.equal((await app.updater.checkForUpdates()).updateInfo.version, '1.1.38');
    assert.equal(checks, 2);
    checks = 0;
    app.engine.checkForUpdatesAndNotify = async () => { checks++; throw new Error(rawMac); };
    await assert.rejects(app.invoke({ action: 'checkForUpdate' }), /macOS/);
    assert.equal(checks, 1);
  } finally { app.updater.dispose(); }
});

test('failed shutdown preparation never launches an installer or exposes its raw exception', async () => {
  let installed = 0;
  const app = fixture({ beforeInstall: async () => { throw new Error('private shutdown failure /Users/private/app.asar'); } });
  try {
    app.engine.quitAndInstall = () => installed++;
    await assert.rejects(app.invoke({ action: 'installUpdate' }), error => /未完成/.test(error.message) && !/private|app\.asar/.test(error.message));
    assert.equal(installed, 0); assert.equal(app.updater.isInstallingUpdate(), false);
    assert.equal(app.sent.at(-1).code, 'SOFTWARE_UPDATE_FAILED');
  } finally { app.updater.dispose(); }
});

test('available versions and explicit installation handoff remain unchanged', async () => {
  let prepared = 0, installed = 0;
  const app = fixture({ beforeInstall: async () => { prepared++; } });
  try {
    app.engine.emit('update-available', { version: '1.1.38', releaseNotes: 'fixture' });
    assert.equal(app.sent.at(-1).version, '1.1.38');
    app.engine.quitAndInstall = () => installed++;
    assert.equal(await app.invoke({ action: 'installUpdate' }), true);
    assert.equal(prepared, 1); assert.equal(installed, 1);
    assert.equal(await app.invoke({ action: 'installUpdate' }), false);
  } finally { app.updater.dispose(); }
});

test('automatic checks start immediately without waiting and repeat every four hours only once', () => {
  const clock = fakeClock(), app = fixture({}, clock.timers);
  let checks = 0;
  try {
    app.engine.checkForUpdatesAndNotify = () => { checks++; return new Promise(() => {}); };
    assert.equal(app.updater.startAutoCheck(), undefined, 'startup must not wait for the network response');
    assert.equal(checks, 1, 'the first check is immediate');
    app.updater.startAutoCheck();
    assert.equal(checks, 1, 'repeated startup cannot launch a second request');
    assert.equal(clock.tasks.size, 1, 'no delayed startup timer remains');
    clock.advance(4 * 60 * 60 * 1000 - 1);
    assert.equal(checks, 1);
    clock.advance(1);
    assert.equal(checks, 2);
    app.updater.stopAutoCheck();
    assert.equal(clock.tasks.size, 0);
    clock.advance(8 * 60 * 60 * 1000);
    assert.equal(checks, 2, 'stopping cancels every future automatic check');
    app.updater.startAutoCheck();
    assert.equal(checks, 3, 'explicitly starting again performs a new immediate check');
    app.updater.dispose();
    assert.equal(clock.tasks.size, 0);
    assert.equal(app.handlers.has('update-command'), false);
    clock.advance(8 * 60 * 60 * 1000);
    assert.equal(checks, 3);
  } finally { app.updater.dispose(); }
});

test('late subscribers restore available, progress and downloaded details without another check or telemetry', async () => {
  const app = fixture();
  let checks = 0, downloads = 0;
  try {
    app.engine.checkForUpdatesAndNotify = async () => { checks++; };
    app.engine.downloadUpdate = async () => { downloads++; };
    assert.equal(await app.invoke({ action: 'getStatus' }), null);
    app.updater.setMainWindow(null);
    app.engine.emit('update-available', { version: '1.1.48', releaseDate: '2026-11-06', releaseNotes: [{ version: '1.1.48', note: 'Updated playback' }], files: [{ url: 'https://private.invalid/file?token=private' }] });
    assert.equal(app.sent.length, 0, 'the event may arrive before a renderer exists');
    const observed = app.businessEvents.length;
    const available = await app.invoke({ action: 'getStatus' });
    assert.equal(available.type, 'update-available');
    assert.equal(available.version, '1.1.48');
    assert.equal(available.releaseNotes[0].note, 'Updated playback');
    assert.doesNotMatch(JSON.stringify(available), /files|https?:|private|token/);
    available.releaseNotes[0].note = 'caller mutation';
    assert.equal((await app.invoke({ action: 'getStatus' })).releaseNotes[0].note, 'Updated playback');
    assert.equal(app.businessEvents.length, observed, 'reading a snapshot does not emit telemetry');
    assert.equal(checks, 0); assert.equal(downloads, 0);
    app.engine.emit('download-progress', { percent: 42.8, transferred: 42, total: 100, bytesPerSecond: 20 });
    const progress = await app.invoke({ action: 'getStatus' });
    assert.equal(progress.type, 'download-progress'); assert.equal(progress.percent, 43);
    assert.equal(progress.version, '1.1.48'); assert.equal(progress.releaseDate, '2026-11-06');
    assert.equal(progress.releaseNotes[0].note, 'Updated playback');
    app.engine.emit('update-downloaded', { version: '1.1.48' });
    const ready = await app.invoke({ action: 'getStatus' });
    assert.equal(ready.type, 'update-downloaded'); assert.equal(ready.version, '1.1.48');
    assert.equal(ready.releaseNotes[0].note, 'Updated playback');
    assert.equal(ready.releaseDate, '2026-11-06');
    app.engine.emit('update-available', { version: '1.1.49', releaseNotes: 'New version' });
    const next = await app.invoke({ action: 'getStatus' });
    assert.equal(next.version, '1.1.49'); assert.equal(next.releaseNotes, 'New version');
    assert.equal(next.releaseDate, undefined, 'a new version must not inherit older release metadata');
    assert.equal(checks, 0); assert.equal(downloads, 0);
  } finally { app.updater.dispose(); }
});

test('an immediate automatic rejection is safely cached even without an engine error event', async () => {
  const clock = fakeClock(), app = fixture({}, clock.timers);
  try {
    app.engine.checkForUpdatesAndNotify = async () => { throw new Error(rawMac); };
    app.updater.startAutoCheck();
    await new Promise(resolve => setImmediate(resolve));
    const status = await app.invoke({ action: 'getStatus' });
    assert.equal(status.type, 'update-error'); assert.equal(status.code, 'MAC_RELEASE_UNAVAILABLE');
    assert.equal(app.sent.length, 1);
    const observed = app.businessEvents.length;
    await app.invoke({ action: 'getStatus' });
    assert.equal(app.businessEvents.length, observed);
    assert.doesNotMatch(JSON.stringify({ status, logs: app.logs }), /private|token|https?:|Headers|app\.asar/);
  } finally { app.updater.dispose(); }
});
