/**
 * licenseHelper.js
 * 授权文件路径解析辅助。
 *
 * 这里只保留 config.txt 的路径解析函数。
 * 授权校验、网络时间和剩余天数等逻辑由 licenseManager.js 负责。
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

let electronApp = null;
try {
  ({ app: electronApp } = require('electron'));
} catch {}

function isPackagedRuntime() {
  if (electronApp && typeof electronApp.isPackaged === 'boolean') {
    return electronApp.isPackaged;
  }

  return false;
}

function getConfigFileCandidates() {
  const candidates = [];
  const writableConfig = getWritableConfigFile();
  const packaged = isPackagedRuntime();

  if (writableConfig) {
    candidates.push(writableConfig);
  }

  if (!packaged) {
    candidates.push(path.join(PROJECT_ROOT, 'config.txt'));
  } else {
    if (process.execPath) {
      if (process.platform === 'darwin') {
        const appBundleDir = path.dirname(path.dirname(path.dirname(process.execPath)));
        candidates.push(path.join(path.dirname(appBundleDir), 'config.txt'));
      }

      candidates.push(path.join(path.dirname(process.execPath), 'config.txt'));
    }

    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'config.txt'));
    }

    if (process.platform === 'win32') {
      if (process.execPath) {
        candidates.push(path.join(path.dirname(process.execPath), 'resources', 'config.txt'));
      }
      candidates.push(path.join(process.cwd(), 'resources', 'config.txt'));
    }
  }

  return [...new Set(candidates)];
}

function getWritableConfigFile() {
  if (electronApp && typeof electronApp.getPath === 'function') {
    return path.join(electronApp.getPath('userData'), 'config.txt');
  }

  return path.join(PROJECT_ROOT, 'config.txt');
}

function resolveConfigFile() {
  const writableConfig = getWritableConfigFile();
  const existingConfig = getConfigFileCandidates()
    .find((candidate) => fs.existsSync(candidate));

  if (existingConfig) {
    return existingConfig;
  }

  return writableConfig;
}

module.exports = {
  getConfigFileCandidates,
  getWritableConfigFile,
  resolveConfigFile,
};
