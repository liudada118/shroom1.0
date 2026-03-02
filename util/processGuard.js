/**
 * processGuard.js
 * 进程异常处理与优雅关闭
 *
 * 捕获未处理的异常和 Promise 拒绝，防止进程静默崩溃。
 * 提供优雅关闭机制，确保资源（数据库、串口、WebSocket）被正确释放。
 *
 * 使用方式：
 *   const { installGuard } = require('./processGuard');
 *   installGuard({ onShutdown: async () => { ... } });
 */

const logger = require('../logger');

let shutdownCallbacks = [];
let isShuttingDown = false;

/**
 * 安装进程守护
 * @param {object} [options]
 * @param {function} [options.onShutdown] - 关闭前的清理回调（可以是 async 函数）
 */
function installGuard(options = {}) {
  if (options.onShutdown) {
    shutdownCallbacks.push(options.onShutdown);
  }

  // 捕获未处理的异常
  process.on('uncaughtException', (err) => {
    logger.error('[ProcessGuard] 未捕获的异常:', err.message);
    logger.error(err.stack);
    gracefulShutdown(1);
  });

  // 捕获未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('[ProcessGuard] 未处理的 Promise 拒绝:', reason);
    // 不立即退出，仅记录日志
  });

  // 系统信号处理
  process.on('SIGINT', () => {
    logger.info('[ProcessGuard] 收到 SIGINT 信号，准备关闭...');
    gracefulShutdown(0);
  });

  process.on('SIGTERM', () => {
    logger.info('[ProcessGuard] 收到 SIGTERM 信号，准备关闭...');
    gracefulShutdown(0);
  });

  logger.info('[ProcessGuard] 进程守护已安装');
}

/**
 * 注册额外的关闭回调
 * @param {function} callback - 关闭时执行的回调
 */
function onShutdown(callback) {
  shutdownCallbacks.push(callback);
}

/**
 * 执行优雅关闭
 * @param {number} exitCode - 退出码
 */
async function gracefulShutdown(exitCode) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info('[ProcessGuard] 开始优雅关闭...');

  // 设置超时强制退出
  const forceExitTimer = setTimeout(() => {
    logger.error('[ProcessGuard] 优雅关闭超时，强制退出');
    process.exit(exitCode);
  }, 5000);

  try {
    for (const callback of shutdownCallbacks) {
      try {
        await callback();
      } catch (err) {
        logger.error('[ProcessGuard] 关闭回调执行失败:', err.message);
      }
    }
  } finally {
    clearTimeout(forceExitTimer);
    logger.info('[ProcessGuard] 关闭完成，退出码:', exitCode);
    process.exit(exitCode);
  }
}

module.exports = { installGuard, onShutdown, gracefulShutdown };
