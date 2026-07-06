/**
 * 鏈嶅姟鐢熷懡鍛ㄦ湡杈呭姪鍑芥暟銆?
 *
 * 缁熶竴鍏抽棴涓插彛銆丠TTP server 鍜?WebSocket server锛屽苟缁欏叧闂祦绋嬪姞瓒呮椂淇濇姢锛?
 * 閬垮厤搴旂敤閫€鍑烘垨鑷姩鏇存柊瀹夎鍓嶅崱鍦ㄦ煇涓祫婧愰噴鏀炬楠ゃ€?
 */
const logger = require('../../common/logger');

/**
 * 缁欏紓姝ュ叧闂换鍔″鍔犺秴鏃朵繚鎶わ紝閬垮厤閫€鍑烘祦绋嬭鍗曚釜璧勬簮姘镐箙闃诲銆?
 *
 * @param {string} name 璧勬簮鍚嶇О锛岀敤浜庢棩蹇楀畾浣嶃€?
 * @param {Promise<unknown>} promise 璧勬簮鍏抽棴浠诲姟銆?
 * @param {number} timeoutMs 瓒呮椂鏃堕棿锛屽崟浣嶆绉掋€?
 * @returns {Promise<unknown | false>} 鍏抽棴缁撴灉锛涜秴鏃舵垨寮傚父鏃惰繑鍥?false銆?
 */
function closeWithTimeout(name, promise, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      logger.warn(`[Server] ${name} close timed out after ${timeoutMs}ms`);
      resolve(false);
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        logger.warn(`[Server] ${name} close failed:`, err.message || err);
        resolve(false);
      });
  });
}

/**
 * 鍏抽棴涓插彛杩炴帴锛屽苟鍏堢Щ闄ょ洃鍚櫒閬垮厤閫€鍑烘湡闂寸户缁Е鍙戞暟鎹鐞嗐€?
 *
 * @param {object | null | undefined} portRef serialport 瀹炰緥銆?
 * @param {string} name 涓插彛鍚嶇О銆?
 * @returns {Promise<null>} 鍏抽棴瀹屾垚淇″彿銆?
 */
function closeSerialPort(portRef, name) {
  if (!portRef) return Promise.resolve(null);

  try {
    portRef.removeAllListeners?.();
  } catch (err) {
    logger.warn(`[Server] ${name} removeAllListeners failed:`, err.message);
  }

  if (!portRef.isOpen || typeof portRef.close !== 'function') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      portRef.close((err) => {
        if (err) {
          logger.warn(`[Server] ${name} close failed:`, err.message || err);
        } else {
          logger.info(`[Server] ${name} closed`);
        }
        resolve(null);
      });
    } catch (err) {
      logger.warn(`[Server] ${name} close threw:`, err.message);
      resolve(null);
    }
  });
}

/**
 * 鍏抽棴 HTTP Server銆?
 *
 * @param {object | null | undefined} httpServer HTTP 鏈嶅姟瀹炰緥銆?
 * @param {string} name 鏈嶅姟鍚嶇О銆?
 * @returns {Promise<void>} 鍏抽棴瀹屾垚淇″彿銆?
 */
function closeHttpServer(httpServer, name) {
  if (!httpServer || typeof httpServer.close !== 'function') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    try {
      httpServer.close((err) => {
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
 * 鍏抽棴 WebSocket Server锛屽苟缁堟浠嶆寕璧风殑瀹㈡埛绔繛鎺ャ€?
 *
 * @param {import('ws').Server | null | undefined} wsServer WebSocket 鏈嶅姟瀹炰緥銆?
 * @param {string} name 鏈嶅姟鍚嶇О銆?
 * @returns {Promise<void>} 鍏抽棴瀹屾垚淇″彿銆?
 */
function closeWsServer(wsServer, name) {
  if (!wsServer) return Promise.resolve();

  try {
    wsServer.clients?.forEach((client) => {
      try {
        client.terminate?.();
      } catch (err) {
        logger.warn(`[Server] ${name} client terminate failed:`, err.message);
      }
    });
  } catch (err) {
    logger.warn(`[Server] ${name} enumerate clients failed:`, err.message);
  }

  return new Promise((resolve) => {
    try {
      wsServer.close((err) => {
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

module.exports = {
  closeHttpServer,
  closeSerialPort,
  closeWithTimeout,
  closeWsServer,
};

