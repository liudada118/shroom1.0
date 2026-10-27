const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');

const project = path.resolve(__dirname, '../../..');
const installerInclude = path.join(project, 'scripts/installer.nsh');
const builderRequire = createRequire(require.resolve('electron-builder'));
const libraryRoot = path.dirname(builderRequire.resolve('app-builder-lib/package.json'));
const templateRoot = path.join(libraryRoot, 'templates/nsis');

/** 找到已缓存的 Windows NSIS 编译器，不触发下载或安装。 */
function cachedNsis() {
  if (process.platform !== 'win32') return null;
  const cache = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local'), 'electron-builder/Cache/nsis');
  if (!fs.existsSync(cache)) return null;
  return fs.readdirSync(cache).map(name => path.join(cache, name, 'Bin/makensis.exe'))
    .find(filename => fs.existsSync(filename)) || null;
}

/** 只运行临时测试编译器或夹具；从不执行正式安装器、卸载器。 */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, timeout: 20000, ...options });
  if (result.error) throw result.error;
  return result;
}

/** 生成无注册表和删除操作的 NSIS 夹具，用标记记录卸载前后的控制流。 */
function fixture(t, compiler, { unpackedKiB = '1', uninstaller = false, destination, temporaryVolume, cacheVolume } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-installer-preflight-'));
  t.after(() => {
    const resolved = fs.realpathSync(root);
    const temporaryRoot = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(resolved).toLowerCase(), temporaryRoot.toLowerCase());
    assert(path.basename(resolved).startsWith('shroom-installer-preflight-'));
    fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3 });
  });
  const exe = path.join(root, 'fixture.exe');
  const target = destination || path.join(root, 'not-created', 'Shroom');
  const oldMarker = path.join(root, 'old-version.txt');
  const reached = path.join(root, 'uninstall-reached.txt');
  const checked = path.join(root, 'process-check.txt');
  const script = path.join(root, 'fixture.nsi');
  fs.writeFileSync(oldMarker, 'old version remains available');
  const section = [
    'InitPluginsDir',
    `StrCpy $INSTDIR "${target}"`,
    'StrCpy $installMode "all"',
    ...(temporaryVolume || cacheVolume ? [
      `Push "${temporaryVolume || os.tmpdir()}"`,
      `Push "${cacheVolume || os.tmpdir()}"`,
      'Call shroomCheckInstallSpace',
      '!insertmacro _CHECK_APP_RUNNING',
    ] : ['!insertmacro customCheckAppRunning']),
    `FileOpen $0 "${reached}" w`,
    'FileWrite $0 "next-install-step"',
    'FileClose $0',
    'SetErrorLevel 0',
  ].join('\n');
  fs.writeFileSync(script, [
    'Unicode true',
    'Name "Shroom capacity fixture"',
    `OutFile "${exe}"`,
    'RequestExecutionLevel user',
    'SilentInstall silent',
    'SilentUnInstall silent',
    'Var installMode',
    `!addincludedir "${path.join(templateRoot, 'include')}"`,
    `!define APP_64_UNPACKED_SIZE ${unpackedKiB}`,
    ...(uninstaller ? ['!define BUILD_UNINSTALLER'] : []),
    `!include "${installerInclude}"`,
    '!macro _CHECK_APP_RUNNING',
    'StrCpy $pid 0',
    `FileOpen $0 "${checked}" w`,
    'FileWrite $0 "original-process-check"',
    'FileClose $0',
    '!macroend',
    ...(uninstaller ? [
      'Section "create-test-uninstaller"',
      `WriteUninstaller "${path.join(root, 'fixture-uninstall.exe')}"`,
      'SectionEnd',
      'Section "Uninstall"', section, 'SectionEnd',
    ] : ['Section "fake-install"', section, 'SectionEnd']),
  ].join('\n'), 'utf8');
  const compile = run(compiler, ['-INPUTCHARSET', 'UTF8', script], {
    env: { ...process.env, NSISDIR: path.dirname(path.dirname(compiler)) },
  });
  assert.equal(compile.status, 0, compile.stderr || compile.stdout);
  return { root, exe, target, oldMarker, reached, checked };
}

test('capacity hook runs before legacy uninstall and leaves saved installation locations untouched', () => {
  const include = fs.readFileSync(installerInclude, 'utf8');
  const section = fs.readFileSync(path.join(templateRoot, 'installSection.nsh'), 'utf8');
  assert(!/\bWriteReg(?:Expand)?Str\b/.test(include), 'opening the installer must not overwrite an existing install location');
  assert(!/!macro\s+preInit\b/.test(include), 'build-time uninstaller generation must not mutate installation registry');
  assert(section.indexOf('!insertmacro CHECK_APP_RUNNING') < section.indexOf('!insertmacro uninstallOldVersion'));
  assert.match(include, /!macro customCheckAppRunning[\s\S]*!insertmacro _CHECK_APP_RUNNING/);
});

const compiler = cachedNsis();
const skip = compiler ? false : 'Windows NSIS compiler not cached; no download or production install is permitted';

test('silent update refuses insufficient space with exit 112 before touching the old version', { skip }, (t) => {
  const f = fixture(t, compiler, { unpackedKiB: '9007199254740' });
  const result = run(f.exe, ['--updated', '/S']);
  assert.equal(result.status, 112, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(f.oldMarker, 'utf8'), 'old version remains available');
  assert(!fs.existsSync(f.reached), 'uninstall step must remain unreachable');
  assert(!fs.existsSync(f.checked), 'no process is closed when capacity preflight fails');
  assert(!fs.existsSync(f.target), 'checking a missing target must not create it');
});

test('a writable-volume path that does not exist passes and retains the original process check', { skip }, (t) => {
  const f = fixture(t, compiler);
  assert(!fs.existsSync(f.target));
  const result = run(f.exe, ['--updated', '/S']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(f.reached, 'utf8'), 'next-install-step');
  assert.equal(fs.readFileSync(f.checked, 'utf8'), 'original-process-check');
  assert.equal(fs.readFileSync(f.oldMarker, 'utf8'), 'old version remains available');
  assert(!fs.existsSync(f.target));
});

test('capacity calculations above 2 GiB retain the full 64-bit required size', { skip }, (t) => {
  const f = fixture(t, compiler, { unpackedKiB: '4294967296' });
  const result = run(f.exe, ['/S']);
  assert.equal(result.status, 112, '4 TiB cannot wrap to a small or negative required size');
  assert(!fs.existsSync(f.reached));
  assert.equal(fs.readFileSync(f.oldMarker, 'utf8'), 'old version remains available');
});

test('target, temporary extraction and cache on the same volume reserve four copies before uninstalling', { skip }, (t) => {
  const stats = fs.statfsSync(os.tmpdir(), { bigint: true });
  const freeKiB = stats.bavail * stats.bsize / 1024n;
  if (freeKiB < 1048576n) return t.skip('Need at least 1 GiB to distinguish two-copy and four-copy preflight');
  const f = fixture(t, compiler, { unpackedKiB: String(freeKiB * 3n / 8n) });
  const result = run(f.exe, ['--updated', '/S']);
  assert.equal(result.status, 112, 'two copies fit, but target, temporary extraction/archive and installer cache do not');
  assert(!fs.existsSync(f.reached));
  assert.equal(fs.readFileSync(f.oldMarker, 'utf8'), 'old version remains available');
});

test('a separate full TEMP volume refuses the update before uninstalling', { skip }, (t) => {
  const currentVolume = path.parse(os.tmpdir()).root.toLowerCase();
  const fullVolume = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => `${letter}:\\`).find(root => {
    if (root.toLowerCase() === currentVolume || !fs.existsSync(root)) return false;
    try {
      const stats = fs.statfsSync(root, { bigint: true });
      return stats.bavail * stats.bsize < 128n * 1024n * 1024n;
    } catch { return false; }
  });
  if (!fullVolume) return t.skip('No separate full volume is available for the real disk check');
  const f = fixture(t, compiler, { temporaryVolume: path.join(fullVolume, 'shroom-preflight-not-created') });
  const result = run(f.exe, ['--updated', '/S']);
  assert.equal(result.status, 112);
  assert(!fs.existsSync(f.reached));
  assert.equal(fs.readFileSync(f.oldMarker, 'utf8'), 'old version remains available');
});

test('a separate full installer-cache volume refuses the update before uninstalling', { skip }, (t) => {
  const currentVolume = path.parse(os.tmpdir()).root.toLowerCase();
  const fullVolume = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => `${letter}:\\`).find(root => {
    if (root.toLowerCase() === currentVolume || !fs.existsSync(root)) return false;
    try {
      const stats = fs.statfsSync(root, { bigint: true });
      return stats.bavail * stats.bsize < 128n * 1024n * 1024n;
    } catch { return false; }
  });
  if (!fullVolume) return t.skip('No separate full volume is available for the real cache disk check');
  const f = fixture(t, compiler, { cacheVolume: path.join(fullVolume, 'shroom-preflight-cache-not-created') });
  const result = run(f.exe, ['--updated', '/S']);
  assert.equal(result.status, 112);
  assert(!fs.existsSync(f.reached));
  assert.equal(fs.readFileSync(f.oldMarker, 'utf8'), 'old version remains available');
});

test('uninstaller bypasses installation capacity checks while retaining its process check', { skip }, (t) => {
  const f = fixture(t, compiler, { unpackedKiB: '9007199254740', uninstaller: true });
  const generator = run(f.exe, ['/S']);
  assert.equal(generator.status, 0, generator.stderr || generator.stdout);
  const result = run(path.join(f.root, 'fixture-uninstall.exe'), ['/S', `_?=${f.root}`]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.readFileSync(f.reached, 'utf8'), 'next-install-step');
  assert.equal(fs.readFileSync(f.checked, 'utf8'), 'original-process-check');
  assert.equal(fs.readFileSync(f.oldMarker, 'utf8'), 'old version remains available');
});
