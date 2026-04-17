/**
 * licenseHelper.js
 * 授权管理模块
 *
 * 将 server.js 中分散的授权验证逻辑（AES 解密 config.txt、
 * 网络时间获取、有效期校验）统一封装为独立模块。
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const module2 = require('./aes_ecb');
const logger = require('./logger');
let electronApp = null;
try {
  ({ app: electronApp } = require('electron'));
} catch {}

const TIME_SERVER = 'http://sensor.bodyta.com';
const TIMEOUT_MS = 5000;

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

  if (packaged && process.execPath) {
    candidates.push(path.join(path.dirname(process.execPath), 'config.txt'));
  }

  if (packaged && process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'config.txt'));
  }

  if (!packaged) {
    candidates.push(path.join(__dirname, 'config.txt'));
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
  if (fs.existsSync(writableConfig)) {
    return writableConfig;
  }

  const existingReadonlyConfig = getConfigFileCandidates()
    .filter((candidate) => candidate !== writableConfig)
    .find((candidate) => fs.existsSync(candidate));

  if (existingReadonlyConfig) {
    try {
      fs.mkdirSync(path.dirname(writableConfig), { recursive: true });
      fs.copyFileSync(existingReadonlyConfig, writableConfig);
      logger.info(`[License] copied config.txt to writable path: ${writableConfig}`);
      return writableConfig;
    } catch (err) {
      logger.warn(`[License] failed to copy config.txt to writable path, fallback to readonly file: ${err.message}`);
      return existingReadonlyConfig;
    }
  }

  return writableConfig;
}

/**
 * 从 config.txt 读取并解密授权截止日期
 * @returns {string|null} 授权截止日期字符串（如 '2026-12-31'），失败返回 null
 */
function readEndDate() {
  try {
    const configFile = resolveConfigFile();

    if (!fs.existsSync(configFile)) {
      logger.warn(`[License] config.txt not found, searched: ${getConfigFileCandidates().join(', ')}`);
      return null;
    }

    logger.info(`[License] Using config file: ${configFile}`);

    const encrypted = fs.readFileSync(configFile, 'utf-8').trim();
    if (!encrypted) {
      logger.warn('config.txt 为空');
      return null;
    }
    const decrypted = module2.decrypt(encrypted);
    logger.info(`授权截止日期: ${decrypted}`);
    return decrypted;
  } catch (err) {
    logger.error('读取授权文件失败', err);
    return null;
  }
}

/**
 * 从远程时间服务器获取当前时间
 * @returns {Promise<Date>} 网络时间，失败时返回本地时间
 */
function fetchNetworkTime() {
  return new Promise((resolve) => {
    const req = http.get(TIME_SERVER, (res) => {
      const serverDate = res.headers['date'];
      if (serverDate) {
        resolve(new Date(serverDate));
      } else {
        logger.warn('无法从响应头获取时间，使用本地时间');
        resolve(new Date());
      }
      res.resume();
    });

    req.on('error', (err) => {
      logger.warn(`获取网络时间失败: ${err.message}，使用本地时间`);
      resolve(new Date());
    });

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      logger.warn('获取网络时间超时，使用本地时间');
      resolve(new Date());
    });
  });
}

/**
 * 校验授权是否有效
 * @param {Date} nowDate - 当前时间
 * @param {string|null} endDate - 授权截止日期字符串
 * @returns {boolean}
 */
function isLicenseValid(nowDate, endDate) {
  if (!endDate) return true;
  return nowDate <= new Date(endDate);
}

/**
 * 计算授权剩余天数
 * @param {Date} nowDate - 当前时间
 * @param {string|null} endDate - 授权截止日期字符串
 * @returns {number} 剩余天数，-1 表示无限制
 */
function getRemainingDays(nowDate, endDate) {
  if (!endDate) return -1;
  const diff = new Date(endDate) - nowDate;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * 初始化授权：读取截止日期并获取网络时间
 * @returns {Promise<{ nowDate: Date, endDate: string|null, valid: boolean, remainingDays: number }>}
 */
async function initLicense() {
  const endDate = readEndDate();
  const nowDate = await fetchNetworkTime();
  const valid = isLicenseValid(nowDate, endDate);
  const remainingDays = getRemainingDays(nowDate, endDate);

  if (!valid) {
    logger.error(`授权已过期！当前: ${nowDate.toISOString()}, 截止: ${endDate}`);
  } else if (remainingDays >= 0 && remainingDays <= 30) {
    logger.warn(`授权即将到期，剩余 ${remainingDays} 天`);
  } else {
    logger.info(`授权有效，截止: ${endDate || '无限制'}`);
  }

  return { nowDate, endDate, valid, remainingDays };
}

module.exports = {
  getConfigFileCandidates,
  getWritableConfigFile,
  resolveConfigFile,
  readEndDate,
  fetchNetworkTime,
  isLicenseValid,
  getRemainingDays,
  initLicense,
};
