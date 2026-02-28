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

const CONFIG_FILE = path.join(__dirname, 'config.txt');
const TIME_SERVER = 'http://sensor.bodyta.com';

/**
 * 从 config.txt 读取并解密授权截止日期
 * @returns {string|null} 授权截止日期字符串（如 '2026-12-31'），失败返回 null
 */
function readEndDate() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      logger.warn('config.txt 不存在，授权验证跳过');
      return null;
    }
    const encrypted = fs.readFileSync(CONFIG_FILE, 'utf-8').trim();
    const decrypted = module2.decrypt(encrypted);
    logger.info(`授权截止日期: ${decrypted}`);
    return decrypted;
  } catch (err) {
    logger.error('读取授权文件失败', err.message);
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
      // 使用响应头中的 Date 字段作为网络时间
      const serverDate = res.headers['date'];
      if (serverDate) {
        resolve(new Date(serverDate));
      } else {
        logger.warn('无法从响应头获取时间，使用本地时间');
        resolve(new Date());
      }
      res.resume(); // 消耗响应体，防止内存泄漏
    });

    req.on('error', (err) => {
      logger.warn(`获取网络时间失败，使用本地时间: ${err.message}`);
      resolve(new Date());
    });

    req.setTimeout(5000, () => {
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
  if (!endDate) return true; // 无 config.txt 时不限制（开发模式）
  return nowDate <= new Date(endDate);
}

/**
 * 初始化授权：读取截止日期并获取网络时间
 * @returns {Promise<{ nowDate: Date, endDate: string|null, valid: boolean }>}
 */
async function initLicense() {
  const endDate = readEndDate();
  const nowDate = await fetchNetworkTime();
  const valid = isLicenseValid(nowDate, endDate);

  if (!valid) {
    logger.warn(`授权已过期！当前时间: ${nowDate.toISOString()}, 截止: ${endDate}`);
  } else {
    logger.info(`授权有效，截止: ${endDate || '无限制'}`);
  }

  return { nowDate, endDate, valid };
}

module.exports = { readEndDate, fetchNetworkTime, isLicenseValid, initLicense };
