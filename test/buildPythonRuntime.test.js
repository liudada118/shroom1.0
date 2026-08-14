const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  parseRuntimeHealth,
  spawnPython,
  stageOnbedFilterNative,
} = require('../scripts/python-runtime-contract');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function withTempDir(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'jqbed-runtime-test-'));
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('stages an externally supplied native library only after SHA-256 verification', () => withTempDir((root) => {
  const source = path.join(root, 'external-onbed.pyd');
  const appDir = path.join(root, 'app');
  const bytes = Buffer.from('verified native artifact');
  fs.writeFileSync(source, bytes);
  fs.mkdirSync(appDir);

  const staged = stageOnbedFilterNative({
    appDir,
    env: {
      ONBED_FILTER_PYD_SOURCE: source,
      ONBED_FILTER_PYD_SHA256: sha256(bytes).toUpperCase(),
    },
  });

  assert.equal(staged.injected, true);
  assert.deepEqual(fs.readFileSync(staged.path), bytes);
  assert.equal(staged.sha256, sha256(bytes));
  staged.cleanup();
  assert.equal(fs.existsSync(staged.path), false);
}));

test('rejects a mismatched external library without polluting the app directory', () => withTempDir((root) => {
  const source = path.join(root, 'external-onbed.pyd');
  const appDir = path.join(root, 'app');
  fs.writeFileSync(source, 'wrong bytes');
  fs.mkdirSync(appDir);

  assert.throws(() => stageOnbedFilterNative({
    appDir,
    env: {
      ONBED_FILTER_PYD_SOURCE: source,
      ONBED_FILTER_PYD_SHA256: '0'.repeat(64),
    },
  }), /SHA-256 mismatch/);
  assert.equal(fs.existsSync(path.join(appDir, 'onbed_filter.cp311-win_amd64.pyd')), false);
}));

test('requires both the Windows native library and its expected SHA-256', () => withTempDir((root) => {
  const appDir = path.join(root, 'app');
  fs.mkdirSync(appDir);

  assert.throws(
    () => stageOnbedFilterNative({ appDir, env: {} }),
    /ONBED_FILTER_PYD_SOURCE/,
  );
  fs.writeFileSync(path.join(appDir, 'onbed_filter.cp311-win_amd64.pyd'), 'local bytes');
  assert.throws(
    () => stageOnbedFilterNative({ appDir, env: {} }),
    /ONBED_FILTER_PYD_SHA256/,
  );
}));

test('verifies an already staged native library without deleting it on cleanup', () => withTempDir((root) => {
  const appDir = path.join(root, 'app');
  const target = path.join(appDir, 'onbed_filter.cp311-win_amd64.pyd');
  const bytes = Buffer.from('existing verified artifact');
  fs.mkdirSync(appDir);
  fs.writeFileSync(target, bytes);

  const staged = stageOnbedFilterNative({
    appDir,
    env: { ONBED_FILTER_PYD_SHA256: sha256(bytes) },
  });

  assert.equal(staged.injected, false);
  staged.cleanup();
  assert.deepEqual(fs.readFileSync(target), bytes);
}));

test('forces UTF-8 for every spawned Python process', () => {
  const result = spawnPython(
    { command: process.execPath, args: [] },
    ['-e', 'process.stdout.write(`${process.env.PYTHONUTF8}|${process.env.PYTHONIOENCODING}`)'],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0);
  assert.equal(result.stdout, '1|utf-8');
});

test('accepts health output only when the native algorithm is available', () => {
  assert.deepEqual(parseRuntimeHealth(
    '{"id":"build-health","ok":true,"data":{"pong":true,"onbedFilterAvailable":true}}\n',
  ), { pong: true, onbedFilterAvailable: true });
  assert.throws(() => parseRuntimeHealth(
    '{"id":"build-health","ok":true,"data":{"pong":true,"onbedFilterAvailable":false}}\n',
  ), /native onbed_filter module is unavailable/);
  assert.throws(() => parseRuntimeHealth('not-json\n'), /valid JSON health response/);
});
