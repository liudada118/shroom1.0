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
    getPath(name) {
      return name === 'desktop' ? desktopPath : userDataPath;
    },
  };

  const windowsConfig = createServerPathConfig({
    electronApp,
    processRef: {
      platform: 'win32',
      resourcesPath,
    },
  });

  assert.strictEqual(windowsConfig.csvPath, path.join(resourcesPath, 'data'));
  assert.strictEqual(windowsConfig.imgPath, path.join(userDataPath, 'img'));
  assert.strictEqual(windowsConfig.pdfPath, path.join(resourcesPath, 'OneStep'));
  assert.strictEqual(windowsConfig.filePath, path.join(userDataPath, 'db'));
  assert.strictEqual(
    windowsConfig.displaySystemsPath,
    path.join(userDataPath, 'display-systems'),
  );
  assert.strictEqual(windowsConfig.runtimeResourceRoot, resourcesPath);
  assert.strictEqual(windowsConfig.runtimeWritableRoot, userDataPath);
  assert.strictEqual(windowsConfig.exportRoot, resourcesPath);

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
} finally {
  fs.rmSync(packagedRoot, { force: true, recursive: true });
}

console.log('serverPathConfig.test.js passed');
