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
      closeWithTimeout('server1', closeWsServer(runtime.server1, 'server1')),
      closeWithTimeout('server2', closeWsServer(runtime.server2, 'server2')),
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
