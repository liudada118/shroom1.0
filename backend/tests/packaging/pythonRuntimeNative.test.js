const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const {
  NATIVE_FILENAME,
  runtimeNativeMatchesSource,
} = require('../../kernel/algorithm-channel/pythonRuntimeNative');

/** 构造隔离的源码与 PyInstaller 运行时目录。 */
function withRuntime(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-native-runtime-'));
  const appDir = path.join(root, 'python', 'app');
  const runtimeDir = path.join(root, 'python', 'dist', 'onbed_server');
  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(path.join(runtimeDir, '_internal'), { recursive: true });
  fs.writeFileSync(path.join(appDir, NATIVE_FILENAME), 'new native artifact');
  fs.writeFileSync(path.join(runtimeDir, 'onbed_server.exe'), 'runtime placeholder');
  fs.writeFileSync(path.join(runtimeDir, '_internal', NATIVE_FILENAME), 'new native artifact');
  const oldStamp = new Date('2000-01-01T00:00:00Z');
  fs.utimesSync(path.join(appDir, NATIVE_FILENAME), oldStamp, oldStamp);
  fs.utimesSync(appDir, oldStamp, oldStamp);
  try {
    return run({ root, appDir, runtimeDir, oldStamp });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('checks actual native bytes for PyInstaller internal and legacy flat layouts', () => withRuntime((fixture) => {
  const options = { ...fixture, platform: 'win32' };
  assert.equal(runtimeNativeMatchesSource(options), true);
  const internal = path.join(fixture.runtimeDir, '_internal', NATIVE_FILENAME);
  const flat = path.join(fixture.runtimeDir, NATIVE_FILENAME);
  fs.renameSync(internal, flat);
  assert.equal(runtimeNativeMatchesSource(options), true);
  fs.writeFileSync(internal, 'stale shadowing native artifact');
  assert.equal(runtimeNativeMatchesSource(options), false);
}));

test('rejects mismatched native bytes even when their modification times are identical', () => withRuntime((fixture) => {
  const internal = path.join(fixture.runtimeDir, '_internal', NATIVE_FILENAME);
  fs.writeFileSync(internal, 'old native artifact');
  fs.utimesSync(internal, fixture.oldStamp, fixture.oldStamp);
  assert.equal(runtimeNativeMatchesSource({ ...fixture, platform: 'win32' }), false);
}));

test('rejects missing native artifacts and leaves non-Windows freshness behavior unchanged', () => withRuntime((fixture) => {
  fs.rmSync(path.join(fixture.runtimeDir, '_internal', NATIVE_FILENAME));
  assert.equal(runtimeNativeMatchesSource({ ...fixture, platform: 'win32' }), false);
  fs.rmSync(path.join(fixture.appDir, NATIVE_FILENAME));
  assert.equal(runtimeNativeMatchesSource({ ...fixture, platform: 'win32' }), false);
  assert.equal(runtimeNativeMatchesSource({ ...fixture, platform: 'darwin' }), true);
}));

/** 执行真实构建或 worker 新鲜度逻辑，替换目录与平台而不启动服务。 */
function loadFreshnessFunction(relativeFile, fixture, functionName) {
  const filePath = path.resolve(__dirname, '../../..', relativeFile);
  const realRequire = createRequire(filePath);
  let source = fs.readFileSync(filePath, 'utf8');
  if (relativeFile.startsWith('scripts/')) source = source.slice(0, source.lastIndexOf('\ntry {'));
  const sandbox = {
    __dirname: relativeFile.startsWith('scripts/') ? path.join(fixture.root, 'scripts') : path.join(fixture.root, 'backend/kernel/algorithm-channel'),
    process: { platform: 'win32', env: { isPackaged: 'false' } },
    module: { exports: {} },
    require(id) {
      if (id.endsWith('pythonRuntimeNative')) {
        return {
          runtimeNativeMatchesSource: (options) => runtimeNativeMatchesSource({ ...options, platform: 'win32' }),
        };
      }
      if (id === 'electron') return { app: { isPackaged: false } };
      return realRequire(id);
    },
  };
  vm.runInNewContext(source, sandbox, { filename: filePath });
  return sandbox[functionName];
}

for (const [file, functionName] of [
  ['scripts/build-python-runtime.js', 'runtimeIsFresh'],
  ['backend/kernel/algorithm-channel/pythonWorker.js', 'resolveFreshDevExe'],
]) {
  test(`${functionName} rejects stale PYD bytes despite a newer runtime timestamp`, () => withRuntime((fixture) => {
    const check = loadFreshnessFunction(file, fixture, functionName);
    assert.ok(check());
    const sourcePath = path.join(fixture.appDir, NATIVE_FILENAME);
    fs.writeFileSync(sourcePath, 'another native artifact');
    fs.utimesSync(sourcePath, fixture.oldStamp, fixture.oldStamp);
    assert.equal(Boolean(check()), false);
  }));
}
