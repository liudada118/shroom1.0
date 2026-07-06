const {
  closeHttpServer,
  closeWithTimeout,
  closeWsServer,
} = require('../services/lifecycle/serverLifecycleService');

/**
 * 娓呯悊鎵樼瀹氭椂鍣ㄥ苟璁板綍鏃ュ織銆? *
 * @param {object} logger 鏃ュ織瀵硅薄銆? * @param {string} name 鏃ュ織涓睍绀虹殑瀹氭椂鍣ㄥ悕绉般€? * @param {NodeJS.Timeout | null} timerRef 瀹氭椂鍣ㄥ彞鏌勩€? * @returns {null} 娓呯悊鍚庣粺涓€杩斿洖 null锛屼究浜庤皟鐢ㄦ柟閲嶇疆寮曠敤銆? */
function clearManagedInterval(logger, name, timerRef) {
  if (!timerRef) return null;
  clearInterval(timerRef);
  logger.info(`[Server] Cleared ${name}`);
  return null;
}

/**
 * 鍏抽棴 SQLite 鏁版嵁搴撹繛鎺ワ紝骞舵妸鍥炶皟寮?close 鍖呰鎴?Promise銆? *
 * @param {object} logger 鏃ュ織瀵硅薄銆? * @param {object | null} dbRef 鏁版嵁搴撹繛鎺ャ€? * @param {string} name 鏃ュ織涓睍绀虹殑鏁版嵁搴撳悕绉般€? * @returns {Promise<void>} 鍏抽棴瀹屾垚 Promise銆? */
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
 * 鍒涘缓鏈嶅姟鍏抽棴缂栨帓鍣ㄣ€? *
 * server.js 鍙彁渚涘綋鍓嶈祫婧愬揩鐓у拰鐘舵€佸啓鍥炲叆鍙ｏ紱鍏抽棴椤哄簭銆佽秴鏃朵繚鎶ゅ拰閲嶅鍏抽棴淇濇姢
 * 缁熶竴鏀舵暃鍦ㄨ繖閲屻€? *
 * @param {object} options 鍒涘缓鍙傛暟銆? * @param {Function} options.getRuntime 鑾峰彇褰撳墠鍏抽棴鐩稿叧璧勬簮鍜岀姸鎬併€? * @param {object} options.logger 鏃ュ織瀵硅薄銆? * @param {object} options.serialManager 涓插彛绠＄悊鍣ㄣ€? * @param {Function} options.setRuntime 鍐欏洖鍏抽棴鍚庣殑杩愯鎬併€? * @param {Function} options.stopPlaybackTimer 鍋滄鍘嗗彶鍥炴斁瀹氭椂鍣ㄣ€? * @param {Function} options.stopWorker 鍋滄 Python worker銆? * @returns {{ shutdownServer: Function }} 鍏抽棴缂栨帓鑳藉姏銆? */
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

