/**
 * timeGuard.js
 * 时间回拨检测模块
 *
 * 每次授权验证成功后，将当前时间戳加密写入 timeguard.dat。
 * 下次启动时比较：若当前时间 < 上次记录时间，判定为时间回拨。
 *
 * 存储格式：AES-256-CBC 加密的 JSON { lastTime: timestamp }
 * 密钥由机器码派生，防止跨机器拷贝文件。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

const GUARD_FILE = path.join(__dirname, 'timeguard.dat');

/** 允许的时间误差（5 分钟），避免系统时间微调误判 */
const TOLERANCE_MS = 5 * 60 * 1000;

/**
 * 根据机器码派生加密密钥（AES-256 需要 32 字节）
 * @param {string} machineId - 16 位机器码
 * @returns {{ key: Buffer, iv: Buffer }}
 */
function deriveKey(machineId) {
  const secret = `BODYTA-TG-${machineId}`;
  const hash = crypto.createHash('sha512').update(secret).digest();
  return {
    key: hash.slice(0, 32),
    iv: hash.slice(32, 48),
  };
}

/**
 * 加密数据
 */
function encrypt(data, machineId) {
  const { key, iv } = deriveKey(machineId);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/**
 * 解密数据
 */
function decrypt(hexStr, machineId) {
  const { key, iv } = deriveKey(machineId);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(hexStr, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

/**
 * 读取上次记录的时间戳
 * @param {string} machineId
 * @returns {number|null} 上次时间戳，失败返回 null
 */
function readLastTime(machineId) {
  try {
    if (!fs.existsSync(GUARD_FILE)) return null;
    const content = fs.readFileSync(GUARD_FILE, 'utf-8').trim();
    if (!content) return null;
    const data = decrypt(content, machineId);
    return data.lastTime || null;
  } catch (e) {
    logger.warn('[TimeGuard] 读取时间记录失败:', e.message);
    return null;
  }
}

/**
 * 写入当前时间戳
 * @param {string} machineId
 * @param {number} [timestamp] - 可选，默认 Date.now()
 */
function saveCurrentTime(machineId, timestamp) {
  try {
    const data = { lastTime: timestamp || Date.now() };
    const encrypted = encrypt(data, machineId);
    fs.writeFileSync(GUARD_FILE, encrypted, 'utf-8');
    logger.info('[TimeGuard] 时间记录已更新');
  } catch (e) {
    logger.error('[TimeGuard] 写入时间记录失败:', e.message);
  }
}

/**
 * 检测时间是否被回拨
 * @param {string} machineId
 * @param {number} [nowTimestamp] - 当前时间戳，默认 Date.now()
 * @returns {{ rollback: boolean, lastTime: number|null, currentTime: number }}
 */
function checkTimeRollback(machineId, nowTimestamp) {
  const now = nowTimestamp || Date.now();
  const lastTime = readLastTime(machineId);

  if (lastTime === null) {
    // 首次运行，无记录
    logger.info('[TimeGuard] 首次运行，无历史时间记录');
    return { rollback: false, lastTime: null, currentTime: now };
  }

  const diff = now - lastTime;
  if (diff < -TOLERANCE_MS) {
    // 当前时间比上次记录早超过容差，判定为回拨
    logger.error(`[TimeGuard] 检测到时间回拨！上次: ${new Date(lastTime).toISOString()}, 当前: ${new Date(now).toISOString()}, 差值: ${diff}ms`);
    return { rollback: true, lastTime, currentTime: now };
  }

  logger.info(`[TimeGuard] 时间正常，上次: ${new Date(lastTime).toISOString()}, 当前: ${new Date(now).toISOString()}`);
  return { rollback: false, lastTime, currentTime: now };
}

module.exports = { checkTimeRollback, saveCurrentTime, readLastTime };
