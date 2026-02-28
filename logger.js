/**
 * logger.js
 * 统一日志模块
 *
 * 替代 server.js 中散落的 152 处 console.log/error/info 调用，
 * 提供带时间戳、级别标记的结构化日志输出，并支持通过环境变量控制日志级别。
 *
 * 使用方式：
 *   const logger = require('./logger');
 *   logger.info('串口已连接', { port: 'COM3' });
 *   logger.warn('授权即将到期');
 *   logger.error('数据库写入失败', err);
 *   logger.debug('原始数据帧', buffer); // 仅在 DEBUG 模式下输出
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

// 通过环境变量 LOG_LEVEL 控制最低输出级别，默认为 info
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

function formatTime() {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

function log(level, message, extra) {
  if (LOG_LEVELS[level] < currentLevel) return;
  const prefix = `[${formatTime()}] [${level.toUpperCase().padEnd(5)}]`;
  if (extra !== undefined) {
    console[level === 'error' ? 'error' : 'log'](`${prefix} ${message}`, extra);
  } else {
    console[level === 'error' ? 'error' : 'log'](`${prefix} ${message}`);
  }
}

const logger = {
  debug: (msg, extra) => log('debug', msg, extra),
  info:  (msg, extra) => log('info',  msg, extra),
  warn:  (msg, extra) => log('warn',  msg, extra),
  error: (msg, extra) => log('error', msg, extra),
};

module.exports = logger;
