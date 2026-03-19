/**
 * licenseV2.js
 * 新授权核心模块（V2）
 *
 * 使用 RSA-2048 非对称签名方案：
 * - 私钥仅管理员持有，用于生成激活码
 * - 公钥内置于软件，用于验证激活码
 * - 激活码绑定机器码，无法跨设备使用
 *
 * 激活码格式：Base64 编码的 JSON：
 *   { payload: Base64(JSON), signature: Base64(RSA-SHA256签名) }
 *
 * payload 内容：
 *   { machineId, sensorTypes, expireDate, issuedAt, version }
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');
const { getMachineId } = require('./machineId');
const { checkTimeRollback, saveCurrentTime } = require('./timeGuard');

const PUBLIC_KEY_PATH = path.join(__dirname, 'keys', 'public.pem');
const LICENSE_FILE = path.join(__dirname, 'license.dat');

/** 授权数据版本号 */
const LICENSE_VERSION = 2;

/**
 * 读取内置公钥
 */
function getPublicKey() {
  try {
    return fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8');
  } catch (e) {
    logger.error('[LicenseV2] 读取公钥失败:', e.message);
    return null;
  }
}

/**
 * 验证激活码签名
 * @param {string} payloadB64 - Base64 编码的 payload
 * @param {string} signatureB64 - Base64 编码的签名
 * @returns {boolean}
 */
function verifySignature(payloadB64, signatureB64) {
  const publicKey = getPublicKey();
  if (!publicKey) return false;

  try {
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(payloadB64);
    verify.end();
    return verify.verify(publicKey, signatureB64, 'base64');
  } catch (e) {
    logger.error('[LicenseV2] 签名验证异常:', e.message);
    return false;
  }
}

/**
 * 解析激活码
 * @param {string} activationCode - 激活码字符串
 * @returns {{ valid: boolean, payload: object|null, error: string }}
 */
function parseActivationCode(activationCode) {
  try {
    const trimmed = activationCode.trim();
    const decoded = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf-8'));

    if (!decoded.payload || !decoded.signature) {
      return { valid: false, payload: null, error: '激活码格式无效' };
    }

    // 验证签名
    const sigValid = verifySignature(decoded.payload, decoded.signature);
    if (!sigValid) {
      return { valid: false, payload: null, error: '激活码签名验证失败，密钥可能被篡改' };
    }

    // 解析 payload
    const payload = JSON.parse(Buffer.from(decoded.payload, 'base64').toString('utf-8'));

    // 版本校验
    if (payload.version !== LICENSE_VERSION) {
      return { valid: false, payload: null, error: `激活码版本不匹配（需要 v${LICENSE_VERSION}）` };
    }

    return { valid: true, payload, error: null };
  } catch (e) {
    logger.error('[LicenseV2] 解析激活码失败:', e.message);
    return { valid: false, payload: null, error: '激活码解析失败，请检查格式' };
  }
}

/**
 * 离线验证激活码
 * 完整流程：解析 → 验签 → 校验机器码 → 校验有效期 → 时间回拨检测
 *
 * @param {string} activationCode - 激活码字符串
 * @param {number} [nowTimestamp] - 当前时间戳（可选，用于测试）
 * @returns {{
 *   valid: boolean,
 *   error: string|null,
 *   sensorTypes: string[]|'all',
 *   expireDate: number,
 *   remainingDays: number,
 *   machineId: string,
 *   rollback: boolean
 * }}
 */
function verifyOffline(activationCode, nowTimestamp) {
  const machineId = getMachineId();
  const now = nowTimestamp || Date.now();

  // 1. 解析并验签
  const { valid, payload, error } = parseActivationCode(activationCode);
  if (!valid) {
    return { valid: false, error, sensorTypes: null, expireDate: 0, remainingDays: 0, machineId, rollback: false };
  }

  // 2. 校验机器码
  if (payload.machineId !== machineId) {
    logger.error(`[LicenseV2] 机器码不匹配！激活码: ${payload.machineId}, 本机: ${machineId}`);
    return { valid: false, error: '激活码与本设备不匹配，请使用本机专属激活码', sensorTypes: null, expireDate: 0, remainingDays: 0, machineId, rollback: false };
  }

  // 3. 时间回拨检测
  const timeCheck = checkTimeRollback(machineId, now);
  if (timeCheck.rollback) {
    return { valid: false, error: '检测到系统时间被回拨，请恢复正确时间后重试', sensorTypes: null, expireDate: payload.expireDate, remainingDays: 0, machineId, rollback: true };
  }

  // 4. 校验有效期
  const expireDate = payload.expireDate;
  const remainingDays = Math.ceil((expireDate - now) / (1000 * 60 * 60 * 24));

  if (now > expireDate) {
    logger.error(`[LicenseV2] 授权已过期！到期: ${new Date(expireDate).toISOString()}`);
    // 过期也要更新时间记录
    saveCurrentTime(machineId, now);
    return { valid: false, error: '授权已过期', sensorTypes: payload.sensorTypes, expireDate, remainingDays, machineId, rollback: false };
  }

  // 5. 验证通过，更新时间记录
  saveCurrentTime(machineId, now);

  logger.info(`[LicenseV2] 离线验证通过，传感器: ${JSON.stringify(payload.sensorTypes)}, 剩余 ${remainingDays} 天`);
  return {
    valid: true,
    error: null,
    sensorTypes: payload.sensorTypes,
    expireDate,
    remainingDays,
    machineId,
    rollback: false,
  };
}

/**
 * 保存激活码到本地文件
 * @param {string} activationCode
 */
function saveLicense(activationCode) {
  try {
    fs.writeFileSync(LICENSE_FILE, activationCode.trim(), 'utf-8');
    logger.info('[LicenseV2] 激活码已保存到 license.dat');
  } catch (e) {
    logger.error('[LicenseV2] 保存激活码失败:', e.message);
  }
}

/**
 * 读取本地保存的激活码
 * @returns {string|null}
 */
function loadLicense() {
  try {
    if (!fs.existsSync(LICENSE_FILE)) return null;
    const content = fs.readFileSync(LICENSE_FILE, 'utf-8').trim();
    return content || null;
  } catch (e) {
    logger.warn('[LicenseV2] 读取本地激活码失败:', e.message);
    return null;
  }
}

/**
 * 在线验证结果处理
 * 服务端返回的数据格式与离线激活码相同（带签名），本地用公钥验证。
 *
 * @param {object} serverResponse - 服务端返回的授权数据
 *   { payload: Base64, signature: Base64 }
 * @param {number} [nowTimestamp]
 * @returns {同 verifyOffline 返回值}
 */
function verifyOnline(serverResponse, nowTimestamp) {
  const machineId = getMachineId();
  const now = nowTimestamp || Date.now();

  try {
    // 服务端返回的也是签名数据，用同样的方式验证
    const activationCode = Buffer.from(JSON.stringify(serverResponse)).toString('base64');
    const result = verifyOffline(activationCode, now);

    if (result.valid) {
      // 在线验证成功，保存到本地作为离线备份
      saveLicense(activationCode);
    }

    return result;
  } catch (e) {
    logger.error('[LicenseV2] 在线验证处理失败:', e.message);
    return { valid: false, error: '在线验证数据处理失败', sensorTypes: null, expireDate: 0, remainingDays: 0, machineId, rollback: false };
  }
}

/**
 * 初始化授权（启动时调用）
 * 优先读取本地 license.dat 进行离线验证
 *
 * @returns {{ valid: boolean, error: string|null, sensorTypes, expireDate, remainingDays, machineId, rollback: boolean, mode: 'offline'|'none' }}
 */
function initLicense() {
  const machineId = getMachineId();

  // 尝试读取本地激活码
  const localCode = loadLicense();
  if (localCode) {
    const result = verifyOffline(localCode);
    return { ...result, mode: 'offline' };
  }

  // 兼容旧版 config.txt（过渡期）
  const oldConfigPath = path.join(__dirname, 'config.txt');
  if (fs.existsSync(oldConfigPath)) {
    logger.info('[LicenseV2] 检测到旧版 config.txt，需要重新激活');
  }

  logger.info('[LicenseV2] 未找到有效授权，等待激活');
  return {
    valid: false,
    error: '未找到有效授权，请输入激活码或联网激活',
    sensorTypes: null,
    expireDate: 0,
    remainingDays: 0,
    machineId,
    rollback: false,
    mode: 'none',
  };
}

module.exports = {
  verifyOffline,
  verifyOnline,
  saveLicense,
  loadLicense,
  initLicense,
  parseActivationCode,
  getMachineId,
  LICENSE_VERSION,
};
