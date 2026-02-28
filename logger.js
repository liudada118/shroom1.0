/**
 * logger.js
 * 统一日志模块
 *
 * 替代 server.js 中散落的 152 处 console.log/error/info 调用，
 * 提供带时间戳、级别标记的结构化日志输出。
 *
 * 特性：
 *   - 4 个日志级别：debug / info / warn / error
 *   - 自动添加 ISO 时间戳
 *   - 通过环境变量 LOG_LEVEL 控制最低输出级别（默认 info）
 *   - 支持性能计时（timer / timerEnd）
 *   - 可选文件日志输出
 *
 * 使用方式：
 *   const logger = require('./logger');
 *   logger.info('串口已连接', { port: 'COM3' });
 *   logger.timer('dataProcess');
 *   // ... 处理逻辑
 *   logger.timerEnd('dataProcess'); // 输出耗时
 */

const fs = require('fs');
const path = require('path');

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

// 可选：日志文件路径（通过环境变量 LOG_FILE 指定）
const logFilePath = process.env.LOG_FILE || null;
let logStream = null;
if (logFilePath) {
  try {
    logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  } catch (err) {
    console.error('无法创建日志文件:', err.message);
  }
}

// 性能计时器存储
const timers = new Map();

function formatTime() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function formatExtra(extra) {
  if (extra === undefined) return '';
  if (extra instanceof Error) return ` ${extra.message}\n${extra.stack}`;
  if (typeof extra === 'object') {
    try { return ' ' + JSON.stringify(extra); } catch { return ' [Object]'; }
  }
  return ' ' + String(extra);
}

function log(level, message, extra) {
  if (LOG_LEVELS[level] < currentLevel) return;

  const prefix = `[${formatTime()}] [${level.toUpperCase().padEnd(5)}]`;
  const fullMessage = `${prefix} ${message}${formatExtra(extra)}`;

  // 控制台输出
  if (level === 'error') {
    console.error(fullMessage);
  } else if (level === 'warn') {
    console.warn(fullMessage);
  } else {
    console.log(fullMessage);
  }

  // 文件输出
  if (logStream) {
    logStream.write(fullMessage + '\n');
  }
}

const logger = {
  debug: (msg, extra) => log('debug', msg, extra),
  info:  (msg, extra) => log('info',  msg, extra),
  warn:  (msg, extra) => log('warn',  msg, extra),
  error: (msg, extra) => log('error', msg, extra),

  /**
   * 开始计时
   * @param {string} label - 计时器标签
   */
  timer(label) {
    timers.set(label, Date.now());
  },

  /**
   * 结束计时并输出耗时
   * @param {string} label - 计时器标签
   */
  timerEnd(label) {
    const start = timers.get(label);
    if (start) {
      const elapsed = Date.now() - start;
      timers.delete(label);
      log('debug', `[TIMER] ${label}: ${elapsed}ms`);
    }
  },
};

module.exports = logger;
