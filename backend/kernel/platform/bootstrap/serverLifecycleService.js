/**
 * 服务生命周期辅助函数。
 *
 * 统一关闭串口、HTTP server 和 WebSocket server，并给关闭流程加超时保护，
 * 避免应用退出或自动更新安装前卡在某个资源释放步骤。
 */
const logger = require('../../../common/logger');

/**
 * 给异步关闭任务增加超时保护，避免退出流程被单个资源永久阻塞。
 *
 * @param {string} name 资源名称，用于日志定位。
 * @param {Promise<unknown>} promise 资源关闭任务。
 * @param {number} timeoutMs 超时时间，单位毫秒。
 * @returns {Promise<unknown | false>} 关闭结果；超时或异常时返回 false。
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
 * 关闭串口连接，并先移除监听器避免退出期间继续触发数据处理。
 *
 * @param {object | null | undefined} portRef serialport 实例。
 * @param {string} name 串口名称。
 * @returns {Promise<null>} 关闭完成信号。
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
 * 关闭 HTTP Server。
 *
 * @param {object | null | undefined} httpServer HTTP 服务实例。
 * @param {string} name 服务名称。
 * @returns {Promise<void>} 关闭完成信号。
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
 * 关闭 WebSocket Server，并终止仍挂起的客户端连接。
 *
 * @param {import('ws').Server | null | undefined} wsServer WebSocket 服务实例。
 * @param {string} name 服务名称。
 * @returns {Promise<void>} 关闭完成信号。
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
