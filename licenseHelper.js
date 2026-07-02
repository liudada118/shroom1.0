/**
 * licenseHelper.js
 * 授权文件路径解析辅助
 *
 * 仅保留 config.txt 的路径解析函数（server.js:82 在用）。
 * 原有的授权校验逻辑（readEndDate / fetchNetworkTime / isLicenseValid /
 * getRemainingDays / initLicense）已迁移到 licenseManager.js，此处删除。
 */

const fs = require('fs');
const path = require('path');
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
    candidates.push(path.join(__dirname, 'config.txt'));
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
  }

  return [...new Set(candidates)];
}

function getWritableConfigFile() {
  if (electronApp && typeof electronApp.getPath === 'function') {
    return path.join(electronApp.getPath('userData'), 'config.txt');
  }

  return path.join(__dirname, 'config.txt');
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
