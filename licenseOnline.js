/**
 * licenseOnline.js
 * 在线授权验证模块
 *
 * 向服务端发送机器码，服务端返回签名授权数据。
 * 本地用公钥验证后激活。
 *
 * 服务端接口约定：
 *   POST http://sensor.bodyta.com:8080/rcv/license/verify
 *   请求体: { machineId: "A3F8B2C1D4E5F6A7" }
 *   响应体: { code: 0, data: { payload: "Base64...", signature: "Base64..." }, message: "ok" }
 *
 * 如果服务端接口不同，可在此修改 URL 和数据格式。
 */

const http = require('http');
const https = require('https');
const logger = require('./logger');
const { getMachineId } = require('./machineId');
const { verifyOffline, saveLicense } = require('./licenseV2');
const { checkTimeRollback, saveCurrentTime } = require('./timeGuard');

/** 服务端地址（可配置） */
const SERVER_URL = 'http://sensor.bodyta.com:8080/rcv/license/verify';
const TIMEOUT_MS = 10000;

/**
 * 发送 HTTP POST 请求
 * @param {string} url
 * @param {object} body
 * @returns {Promise<object>}
 */
function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;

    const postData = JSON.stringify(body);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`服务端响应解析失败: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * 在线验证授权
 *
 * @returns {Promise<{
 *   valid: boolean,
 *   error: string|null,
 *   sensorTypes: string[]|'all'|null,
 *   expireDate: number,
 *   remainingDays: number,
 *   machineId: string,
 *   rollback: boolean,
 *   mode: 'online'
 * }>}
 */
async function verifyOnline() {
  const machineId = getMachineId();
  const now = Date.now();

  // 时间回拨检测
  const timeCheck = checkTimeRollback(machineId, now);
  if (timeCheck.rollback) {
    return {
      valid: false,
      error: '检测到系统时间被回拨，请恢复正确时间后重试',
      sensorTypes: null,
      expireDate: 0,
      remainingDays: 0,
      machineId,
      rollback: true,
      mode: 'online',
    };
  }

  try {
    logger.info(`[LicenseOnline] 向服务端发送验证请求，机器码: ${machineId}`);
    const response = await httpPost(SERVER_URL, { machineId });

    if (response.code !== 0 || !response.data) {
      const msg = response.message || '服务端返回错误';
      logger.error(`[LicenseOnline] 服务端拒绝: ${msg}`);
      return {
        valid: false,
        error: `在线验证失败: ${msg}`,
        sensorTypes: null,
        expireDate: 0,
        remainingDays: 0,
        machineId,
        rollback: false,
        mode: 'online',
      };
    }

    // 服务端返回签名数据，构造激活码格式进行本地验证
    const serverData = response.data; // { payload, signature }
    const activationCode = Buffer.from(JSON.stringify(serverData)).toString('base64');

    // 用离线验证逻辑校验（公钥验签 + 机器码匹配 + 有效期）
    const result = verifyOffline(activationCode, now);

    if (result.valid) {
      // 在线验证成功，保存到本地作为离线备份
      saveLicense(activationCode);
      logger.info('[LicenseOnline] 在线验证成功，已保存到本地');
    }

    return { ...result, mode: 'online' };
  } catch (e) {
    logger.error(`[LicenseOnline] 在线验证网络错误: ${e.message}`);
    return {
      valid: false,
      error: `网络连接失败: ${e.message}`,
      sensorTypes: null,
      expireDate: 0,
      remainingDays: 0,
      machineId,
      rollback: false,
      mode: 'online',
    };
  }
}

/**
 * 获取网络时间（用于校准）
 * @returns {Promise<Date>}
 */
function fetchNetworkTime() {
  return new Promise((resolve) => {
    const req = http.get('http://sensor.bodyta.com', (res) => {
      const serverDate = res.headers['date'];
      if (serverDate) {
        resolve(new Date(serverDate));
      } else {
        resolve(new Date());
      }
      res.resume();
    });
    req.on('error', () => resolve(new Date()));
    req.setTimeout(5000, () => { req.destroy(); resolve(new Date()); });
  });
}

module.exports = { verifyOnline, fetchNetworkTime };
