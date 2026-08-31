const {
  closeHttpServer,
  closeWithTimeout,
  closeWsServer,
} = require('./serverLifecycleService');

/**
 * 清理托管定时器并记录日志。
 *
 * @param {object} logger 日志对象。
 * @param {string} name 日志中展示的定时器名称。
 * @param {NodeJS.Timeout | null} timerRef 定时器句柄。
 * @returns {null} 清理后统一返回 null，便于调用方重置引用。
 */
function clearManagedInterval(logger, name, timerRef) {
  if (!timerRef) return null;
  clearInterval(timerRef);
  logger.info(`[Server] Cleared ${name}`);
  return null;
}

/**
 * 关闭 SQLite 数据库连接，并把回调式 close 包装成 Promise。
 *
 * @param {object} logger 日志对象。
 * @param {object | null} dbRef 数据库连接。
 * @param {string} name 日志中展示的数据库名称。
 * @returns {Promise<void>} 关闭完成 Promise。
 */
function closeDatabase(logger, dbRef, name) {
  if (!dbRef || typeof dbRef.close !== 'function') return Promise.resolve();

  return new Promise((resolve) => {
    try {
      dbRef.close((err) => {
        if (err) {
          logger.warn(`[Server] ${name} close failed:`, err.message || err);
        } else {
          logger.info(`[Server] ${name} closed`);
        }
        resolve();
      });
    } catch (err) {
      logger.warn(`[Server] ${name} close threw:`, err.message);
      resolve();
    }
  });
}

/**
 * 创建服务关闭编排器。
 *
 * server.js 只提供当前资源快照和状态写回入口；关闭顺序、超时保护和重复关闭保护
 * 统一收敛在这里。
 *
 * @param {object} options 创建参数。
 * @param {Function} options.getRuntime 获取当前关闭相关资源和状态。
 * @param {object} options.logger 日志对象。
 * @param {object} options.serialManager 串口管理器。
 * @param {Function} options.setRuntime 写回关闭后的运行态。
 * @param {Function} options.stopPlaybackTimer 停止历史回放定时器。
 * @param {Function} options.stopWorker 停止 Python worker。
 * @returns {{ shutdownServer: Function }} 关闭编排能力。
 */
function createServerShutdownOrchestrator({
  getRuntime,
  logger,
  serialManager,
  setRuntime,
  stopPlaybackTimer,
  stopWorker,
}) {
  /**
   * 关闭后端的全部资源：定时器、串口、WebSocket、HTTP、Python worker、三路数据库。
   *
   * **可重复调用且返回同一个 Promise**（Electron 有多条退出路径都会走到这里）。六个资源并行关
   * 且各套 `closeWithTimeout`（默认 3 秒），所以最坏约 3 秒而不是 18 秒 —— Electron 退出超时后会
   * 直接杀进程，那时数据库可能停在未 checkpoint 状态。`stopWorker()` 单独用同步 try/catch 包起来：
   * 它是杀子进程，失败也只是留个孤儿 Python，不该阻断后面六项。
   *
   * ⚠️ **`runtime` 快照在开头取一次、之后不再重读，是有意的顺序依赖**：下面那次 `setRuntime` 把
   * `com`/`reportHttpServer` 等清空了，而底部的关闭调用用的是**快照里的**句柄。改成关闭前再
   * `getRuntime()` 会拿到已清空的引用 —— 现象是「进程退出了但端口还占着 / 数据库还锁着」，
   * 且无任何报错。先清状态、再用快照关句柄，才能同时「立刻不接新活」和「旧句柄仍关得掉」。
   *
   * ⚠️ 三个顺序必要点：① `stopPlaybackTimer` + `stopReconnectLoop` 必须最前（重连循环不停的话，
   * 刚关掉的串口一秒后被它重开）；② `sitClose` 等标志在**异步关闭之前**置位（让在飞的 data 回调
   * 立刻停止写库和广播）；③ `serverOpened: false` 在**全部关完之后**才置位，与
   * `webSocketHandlerFactory` 的幂等守卫配对 —— 关闭中途不允许重新挂监听器。
   *
   * ⚠️ **这个 Promise 永不 reject**（`closeWithTimeout` 把超时和异常都转成 `resolve(false)`）：退出
   * 流程里一个 unhandled rejection 会让 Electron 卡在退出中间态，比某个资源没关干净严重得多。
   * 代价是调用方无法从返回值判断是否全关成功，只能去日志看 warn。
   *
   * @returns {Promise<void>} 全部资源关闭（或超时放弃）后 resolve；永不 reject。
   */
  function shutdownServer() {
    const runtime = getRuntime();
    if (runtime.serverShutdownRequested) {
      return runtime.serverShutdownPromise || Promise.resolve();
    }

    setRuntime({ serverShutdownRequested: true });
    logger.info('[Server] Shutdown requested, closing sockets/timers/workers...');

    stopPlaybackTimer();
    serialManager.stopReconnectLoop();

    setRuntime({
      jqbedTimer: clearManagedInterval(logger, 'jqbed timer', runtime.jqbedTimer),
      petCareTimer: clearManagedInterval(logger, 'petCare timer', runtime.petCareTimer),
      petCareMiniTimer: clearManagedInterval(logger, 'petCareMini timer', runtime.petCareMiniTimer),
      localFlag: false,
      sitClose: true,
      backClose: true,
      headClose: true,
      sensorClose: true,
      com: undefined,
      com1: undefined,
      comhead: undefined,
      comSensor: undefined,
      reportHttpServer: null,
    });

    try {
      stopWorker();
    } catch (err) {
      logger.warn('[Server] stopWorker failed:', err.message);
    }

    const shutdownPromise = Promise.all([
      closeWithTimeout('serial ports', serialManager.closeAll('shutdown')),
      closeWithTimeout('server', closeWsServer(runtime.server, 'server')),
      closeWithTimeout('report HTTP server', closeHttpServer(runtime.reportHttpServer, 'report HTTP server')),
      closeWithTimeout('db', closeDatabase(logger, runtime.db, 'db')),
      closeWithTimeout('db1', closeDatabase(logger, runtime.db1, 'db1')),
      closeWithTimeout('db2', closeDatabase(logger, runtime.db2, 'db2')),
    ]).then(() => {
      setRuntime({ serverOpened: false });
    });

    setRuntime({ serverShutdownPromise: shutdownPromise });
    return shutdownPromise;
  }

  return {
    shutdownServer,
  };
}

module.exports = {
  clearManagedInterval,
  closeDatabase,
  createServerShutdownOrchestrator,
};
