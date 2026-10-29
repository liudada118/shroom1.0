const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const { normalizeEvent, restoreEvent, scrub } = require('../../../app/electron/usageAnalytics');
const { compactStackLocations } = require('../../../app/electron/diagnosticStack');

/** Execute the production logger bridge while capturing its local output and reported metadata. */
function loggerFixture() {
  const reports = [], logs = [], module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../common/logger.js'), 'utf8'), {
    module, Error, require: name => name === '@shroom/backend/logger.js'
      ? { error: (...args) => { logs.push(args); return 'logged'; } }
      : { recordBusinessEvent: (eventName, properties) => reports.push({ eventName, properties }) },
  });
  return { logger: module.exports, reports, logs };
}

/** Create a synthetic identity accepted by the actual uploader contract. */
function identity() {
  return { installationId: randomUUID(), sessionId: randomUUID(), appVersion: '1.1.43', environment: 'test', scope: 'fixture',
    runtimeVersions: { frontendBuildId: 1793184355048, hostContract: 1 } };
}

test('updater labels and public diagnostic codes survive without serializing extra objects', () => {
  const f = loggerFixture(), detail = { code: 'UPDATE_NETWORK_UNAVAILABLE', message: '无法连接安装包更新服务',
    request: { Authorization: 'private-header' }, body: 'private-body', rawFrames: [101, 202] };
  assert.equal(f.logger.error('[Updater] 安装包更新失败:', detail), 'logged');
  assert.equal(f.reports[0].properties.message, '[Updater] 无法连接安装包更新服务');
  assert.equal(f.reports[0].properties.errorCode, 'UPDATE_NETWORK_UNAVAILABLE');
  assert.equal(f.logs[0][1], detail, 'the local logger keeps the original object');
  assert.doesNotMatch(JSON.stringify(f.reports), /private|rawFrames|101|202/);
  f.logger.error('[InstallerUpdater] engine', { level: 'error', code: 'MAC_RELEASE_UNAVAILABLE', channel: 'latest-mac.yml' });
  assert.equal(f.reports[1].properties.message, '[InstallerUpdater] engine');
  assert.equal(f.reports[1].properties.errorCode, 'MAC_RELEASE_UNAVAILABLE');
});

test('native errors retain type/code/stack and distinct diagnostic causes are not collapsed', () => {
  const f = loggerFixture(), error = Object.assign(new TypeError('Invalid frame'), { code: 'FRAME_INVALID' });
  f.logger.error('[Frame] failed', error);
  assert.equal(f.reports[0].properties.errorType, 'TypeError');
  assert.equal(f.reports[0].properties.errorCode, 'FRAME_INVALID');
  assert.equal(f.reports[0].properties.message, '[Frame] Invalid frame');
  assert.equal(f.reports[0].properties.stack, error.stack);
  f.logger.error('[Updater] failed', { code: 'UPDATE_NETWORK_UNAVAILABLE' });
  f.logger.error('[Updater] failed', { code: 'UPDATE_PACKAGE_UNAVAILABLE' });
  assert.notEqual(JSON.stringify(f.reports[1]), JSON.stringify(f.reports[2]));
});

test('JSON/array logs and arbitrary fields are not uploaded as diagnostics', () => {
  const f = loggerFixture();
  f.logger.error('{"customer":"private-customer"}');
  f.logger.error('["private-message"]');
  f.logger.error({ request: { token: 'private-token' }, data: [1, 2] });
  f.logger.error('operation failed', { code: 'A'.repeat(64) });
  assert.equal(f.reports[0].properties.message, '后端操作异常');
  assert.equal(f.reports[1].properties.message, '后端操作异常');
  assert.equal(f.reports[2].properties.message, '后端操作异常');
  assert.equal(f.reports[3].properties.errorCode, undefined);
  assert.doesNotMatch(JSON.stringify(f.reports), /private-|AAAA/);
  const getter = { get message() { throw new Error('getter failed'); } };
  assert.equal(f.logger.error('operation failed', getter), 'logged');
  assert.equal(f.logs.at(-1)[1], getter);
});

test('stack locations retain safe source coordinates across browser, Windows, macOS and Node formats', () => {
  const raw = [
    'TypeError: Cannot read properties of null',
    '    at C (http://private-user:private-password@private.example/assets/Home-Abc123.js?token=private-query:1:4242)',
    '    at http://private.example/assets/index-Xyz.js:2:30',
    '    at start (C:\\Users\\private-user\\App Data\\Shroom\\server.js:14:22)',
    '    at start (/Volumes/Private Disk/Shroom.app/Contents/Resources/app.asar/index.js:18:25)',
    '    at parse (file:///home/private-user/project/handler.cjs:19:8)',
    'handler@https://private.example/assets/handler.mjs?secret=private-query:20:9',
    '    at Server.setup (node:net:1940:16)',
  ].join('\n');
  const event = normalizeEvent({ eventName: 'error_reported', properties: { module: 'renderer', message: 'test', stack: raw } }, identity());
  for (const source of ['Home-Abc123.js:1:4242', 'index-Xyz.js:2:30', 'server.js:14:22', 'index.js:18:25', 'handler.cjs:19:8', 'handler.mjs:20:9', 'node:net:1940:16']) {
    assert.ok(event.properties.stack.includes(source), source);
  }
  assert.doesNotMatch(event.properties.stack, /private|http|file:\/|Volumes|Users|App Data|token|secret/);
  assert.equal(event.properties.stack, compactStackLocations(event.properties.stack), 'locations remain stable on durable retries');
  assert.deepEqual(restoreEvent(event, event.installationId, []), event);
});

test('unknown source names and credentials stay hidden while ordinary message URLs remain redacted', () => {
  const secret = 'local-fixture-private-key';
  const event = normalizeEvent({ eventName: 'error_reported', properties: {
    message: `Request https://private.example/main.js?token=private-query failed with password="two words" ${secret}`,
    stack: `Error: ${secret}\n    at C (http://private.example/assets/%70rivate.js:1:9)\n    at C (https://private.example/${secret}.js:1:10)\n    at C (/Users/person/private-report.txt:3:5)`,
  } }, identity(), [secret]);
  assert.doesNotMatch(JSON.stringify(event), /local-fixture|private-query|two words|private-report|https?:|%70/);
  assert.match(event.properties.stack, /\[source\]:1:9/);
  assert.match(event.properties.stack, /\[source\]:3:5/);
  assert.equal(scrub('/Volumes/Private/Shroom.app /Applications/Private.app /data/private.txt'), '[path] [path] [path]');
});

test('safe legacy records retain their IDs and bytes and invalid private records are not rewritten for retry', () => {
  const id = identity();
  const legacy = normalizeEvent({ eventName: 'error_reported', properties: {
    module: 'backend', message: '后端操作异常', stack: 'Error: failed\n    at C ([url]\n  at run (node:net:1940:16)',
  } }, id);
  delete legacy.runtimeVersions;
  assert.deepEqual(restoreEvent(legacy, id.installationId, []), legacy);
  const unsafe = { ...legacy, properties: { ...legacy.properties, stack: '    at start (/Volumes/Private/App/index.js:1:2)' } };
  assert.throws(() => restoreEvent(unsafe, id.installationId, []), /USAGE_QUEUE_INVALID/);
  assert.match(unsafe.properties.stack, /Volumes/, 'never edit the original ID payload');
});

test('diagnostic output stays within the existing message, stack and event size limits', () => {
  const event = normalizeEvent({ eventName: 'error_reported', properties: {
    module: 'renderer', errorCode: 'FRAME_INVALID', message: 'x'.repeat(1000),
    stack: Array.from({ length: 80 }, () => '    at callback (https://private.example/assets/Home-Abc.js:1:2444)').join('\n'),
  } }, identity());
  assert.equal(event.properties.message.length, 400);
  assert.equal(event.properties.stack.length, 1800);
  assert.ok(Buffer.byteLength(JSON.stringify(event)) <= 4096);
  assert.deepEqual(restoreEvent(event, event.installationId, []), event);
});
