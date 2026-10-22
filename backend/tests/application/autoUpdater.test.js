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
function fixture(options = {}) {
  const engine = new EventEmitter(), handlers = new Map(), sent = [], logs = [];
  engine.checkForUpdatesAndNotify = async () => null;
  engine.downloadUpdate = async () => [];
  engine.quitAndInstall = () => {};
  const filename = path.resolve(__dirname, '../../../app/update/autoUpdater.js');
  const nativeRequire = createRequire(filename), module = { exports: {} };
  const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, (...args) => logs.push({ level, args })]));
  const localRequire = name => name === 'electron-updater' ? { autoUpdater: engine }
    : name === 'electron' ? { ipcMain: { removeHandler: key => handlers.delete(key), handle: (key, fn) => handlers.set(key, fn) }, dialog: { showMessageBox: async () => ({ response: 1 }) } }
    : name === '../../backend/common/logger' ? logger
    : name === '../../backend/common/businessEvents' ? { recordBusinessEvent() {} } : nativeRequire(name);
  vm.runInNewContext('(function(require,module,exports){' + fs.readFileSync(filename, 'utf8') + '\n})', { process, setTimeout, clearTimeout, setInterval, clearInterval }, { filename })(localRequire, module, module.exports);
  const updater = new module.exports.AppUpdater({ isDestroyed: () => false, webContents: { send: (_channel, payload) => sent.push(payload) } }, { platform: 'darwin', ...options });
  return { updater, engine, sent, logs, invoke: data => handlers.get('update-command')({}, data) };
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
