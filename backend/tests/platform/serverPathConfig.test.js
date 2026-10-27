const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  PROJECT_ROOT,
  createServerPathConfig,
} = require('../../kernel/platform/serverPathConfig');

const developmentConfig = createServerPathConfig();

assert.strictEqual(developmentConfig.filePath, path.join(PROJECT_ROOT, 'db'));
assert.strictEqual(
  developmentConfig.displaySystemsPath,
  path.join(PROJECT_ROOT, 'display-systems'),
);
assert.strictEqual(developmentConfig.runtimeResourceRoot, PROJECT_ROOT);
assert.strictEqual(developmentConfig.runtimeWritableRoot, PROJECT_ROOT);
assert.strictEqual(developmentConfig.exportRoot, PROJECT_ROOT);
assert.strictEqual(
  developmentConfig.csvPath,
  path.join(PROJECT_ROOT, 'runtime', 'exports', 'csv'),
);
assert.strictEqual(
  developmentConfig.imgPath,
  path.join(PROJECT_ROOT, 'runtime', 'uploads'),
);
assert.strictEqual(
  developmentConfig.pdfPath,
  path.join(PROJECT_ROOT, 'runtime', 'exports', 'reports'),
);

const packagedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-server-paths-'));

try {
  const resourcesPath = path.join(packagedRoot, 'resources');
  const userDataPath = path.join(packagedRoot, 'user-data');
  const desktopPath = path.join(packagedRoot, 'desktop');
  const electronApp = {
    isPackaged: true,
    /**
     * 假的 Electron `app.getPath`，只区分 `desktop`，其它一律当 userData。
     *
     * 打包态的资源只读，Windows 运行期目录与数据库均应落在 userData。
     *
     * @param {string} name Electron 路径名。
     * @returns {string} 对应的临时目录路径。
     */
    getPath(name) {
      return name === 'desktop' ? desktopPath : userDataPath;
    },
  };

  fs.mkdirSync(resourcesPath);
  const bundledResource = path.join(resourcesPath, 'builtin-model.glb');
  fs.writeFileSync(bundledResource, 'bundled read-only model');
  const originalMkdir = fs.mkdirSync;
  const writableDirectories = [];
  let windowsConfig;
  /** 模拟 Program Files 的只读资源权限，禁止启动时在其下创建运行期目录。 */
  fs.mkdirSync = function rejectResourceWrites(directory, options) {
    const resolved = path.resolve(directory);
    if (resolved === resourcesPath || resolved.startsWith(`${resourcesPath}${path.sep}`)) {
      throw Object.assign(new Error('packaged resources are read-only'), { code: 'EPERM' });
    }
    writableDirectories.push(resolved);
    return originalMkdir(directory, options);
  };
  try {
    windowsConfig = createServerPathConfig({
      electronApp,
      processRef: {
        platform: 'win32',
        resourcesPath,
      },
    });
  } finally {
    fs.mkdirSync = originalMkdir;
  }

  assert.strictEqual(windowsConfig.csvPath, path.join(userDataPath, 'data'));
  assert.strictEqual(windowsConfig.imgPath, path.join(userDataPath, 'img'));
  assert.strictEqual(windowsConfig.pdfPath, path.join(userDataPath, 'OneStep'));
  assert.strictEqual(windowsConfig.filePath, path.join(userDataPath, 'db'));
  assert.strictEqual(
    windowsConfig.displaySystemsPath,
    path.join(userDataPath, 'display-systems'),
  );
  assert.strictEqual(windowsConfig.runtimeResourceRoot, resourcesPath);
  assert.strictEqual(windowsConfig.runtimeWritableRoot, userDataPath);
  assert.strictEqual(windowsConfig.exportRoot, userDataPath);
  assert.strictEqual(fs.readFileSync(bundledResource, 'utf8'), 'bundled read-only model');
  assert.deepStrictEqual(fs.readdirSync(resourcesPath), ['builtin-model.glb']);
  assert.strictEqual(writableDirectories.length, 5);
  for (const directory of writableDirectories) {
    assert(directory.startsWith(`${userDataPath}${path.sep}`), 'runtime directories must stay in userData');
    assert(fs.statSync(directory).isDirectory());
  }

  const legacyResources = path.join(packagedRoot, 'legacy-resources');
  const preservedFiles = [
    [path.join(legacyResources, 'data', 'previous.csv'), 'legacy exported CSV'],
    [path.join(legacyResources, 'OneStep', 'previous.pdf'), 'legacy exported PDF'],
    [path.join(windowsConfig.csvPath, 'previous.csv'), 'existing user CSV'],
    [path.join(windowsConfig.pdfPath, 'previous.pdf'), 'existing user PDF'],
  ];
  for (const [filename, contents] of preservedFiles) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, contents);
  }
  const legacyConfig = createServerPathConfig({
    electronApp,
    processRef: { platform: 'win32', resourcesPath: legacyResources },
  });
  assert.strictEqual(legacyConfig.runtimeResourceRoot, legacyResources);
  assert.strictEqual(legacyConfig.csvPath, windowsConfig.csvPath);
  assert.strictEqual(legacyConfig.pdfPath, windowsConfig.pdfPath);
  for (const [filename, contents] of preservedFiles) {
    assert.strictEqual(fs.readFileSync(filename, 'utf8'), contents, 'existing exports must not be moved or overwritten');
  }

  const macConfig = createServerPathConfig({
    electronApp,
    processRef: {
      platform: 'darwin',
      resourcesPath,
    },
  });

  assert.strictEqual(macConfig.csvPath, path.join(desktopPath, 'data'));
  assert.strictEqual(macConfig.imgPath, path.join(userDataPath, 'img'));
  assert.strictEqual(macConfig.pdfPath, path.join(desktopPath, 'oneStepPdf'));
  assert.strictEqual(macConfig.filePath, path.join(userDataPath, 'db'));
  assert.strictEqual(
    macConfig.displaySystemsPath,
    path.join(userDataPath, 'display-systems'),
  );
  assert.strictEqual(macConfig.runtimeResourceRoot, resourcesPath);
  assert.strictEqual(macConfig.runtimeWritableRoot, userDataPath);
  assert.strictEqual(macConfig.exportRoot, desktopPath);

  const linuxConfig = createServerPathConfig({
    electronApp,
    processRef: { platform: 'linux', resourcesPath },
  });
  assert.strictEqual(linuxConfig.exportRoot, resourcesPath);
  assert.strictEqual(linuxConfig.csvPath, path.join(resourcesPath, 'data'));
  assert.strictEqual(linuxConfig.pdfPath, path.join(resourcesPath, 'oneStepPdf'));
  assert.strictEqual(linuxConfig.runtimeResourceRoot, resourcesPath);
  assert.strictEqual(linuxConfig.runtimeWritableRoot, userDataPath);
} finally {
  fs.rmSync(packagedRoot, { force: true, recursive: true });
}

console.log('serverPathConfig.test.js passed');
