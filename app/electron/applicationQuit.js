/**
 * 拦住第一次退出，等资源清理完成后重新发起退出；重复关闭共用同一次清理。
 * ⚠️ Electron 不会等待异步 before-quit 回调，必须 preventDefault 后再 app.quit。
 * @param {object} options 应用、清理函数、日志和最大等待时间。
 * @returns {Function} 可直接注册到 before-quit 的处理函数。
 */
function createApplicationQuitHandler({ app, cleanup, logger, timeoutMs = 8000 }) {
  let readyToQuit = false;
  let pendingQuit = null;

  /** 清理完成前阻止退出，超时或清理失败保留日志并允许最终退出。 */
  return function beforeQuit(event) {
    if (readyToQuit) return;
    event.preventDefault();
    if (pendingQuit) return pendingQuit;

    pendingQuit = new Promise((resolve) => {
      const timer = setTimeout(() => {
        logger.warn(`[Main] Cleanup timed out after ${timeoutMs}ms; finishing quit`);
        resolve();
      }, timeoutMs);
      Promise.resolve()
        .then(cleanup)
        .catch((error) => logger.warn('[Main] Cleanup failed:', error.message))
        .finally(() => {
          clearTimeout(timer);
          resolve();
        });
    }).then(() => {
      readyToQuit = true;
      app.quit();
    });

    return pendingQuit;
  };
}

module.exports = { createApplicationQuitHandler };
