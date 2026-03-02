/**
 * portFinder.js
 * 端口管理工具
 *
 * 提供端口可用性检测和自动递增绑定功能，
 * 解决多实例运行或端口被占用时的冲突问题。
 *
 * 使用方式：
 *   const { isPortAvailable, listenWithRetry, findAvailablePort } = require('./portFinder');
 *
 *   // 检测端口是否可用
 *   const available = await isPortAvailable(19999);
 *
 *   // 绑定服务器，端口冲突时自动递增
 *   const actualPort = await listenWithRetry(server, 19999);
 */

const net = require('net');

/**
 * 检测指定端口是否可用
 * @param {number} port - 要检测的端口号
 * @param {string} [host='127.0.0.1'] - 主机地址
 * @returns {Promise<boolean>} 端口是否可用
 */
async function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

/**
 * 为 HTTP/WebSocket 服务器绑定端口，端口冲突时自动递增
 * @param {net.Server} server - 要绑定的服务器实例
 * @param {number} startPort - 起始端口号
 * @param {object} [options] - 选项
 * @param {string} [options.host='127.0.0.1'] - 主机地址
 * @param {number} [options.maxRetries=10] - 最大重试次数
 * @returns {Promise<number>} 实际绑定的端口号
 */
async function listenWithRetry(server, startPort, options = {}) {
  const { host = '127.0.0.1', maxRetries = 10 } = options;

  for (let i = 0; i < maxRetries; i++) {
    const port = startPort + i;
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.removeAllListeners('error');
          resolve();
        });
      });
      if (i > 0) {
        console.log(`[PortFinder] 端口 ${startPort} 被占用，已自动切换到 ${port}`);
      }
      return port;
    } catch (err) {
      server.removeAllListeners('error');
      if (err.code !== 'EADDRINUSE') {
        throw err;
      }
      console.log(`[PortFinder] 端口 ${port} 被占用，尝试下一个...`);
    }
  }

  throw new Error(
    `[PortFinder] 从端口 ${startPort} 开始，连续 ${maxRetries} 个端口均被占用`
  );
}

/**
 * 查找一个可用端口（不绑定）
 * @param {number} startPort - 起始端口号
 * @param {number} [maxRetries=10] - 最大重试次数
 * @returns {Promise<number>} 可用的端口号
 */
async function findAvailablePort(startPort, maxRetries = 10) {
  for (let i = 0; i < maxRetries; i++) {
    const port = startPort + i;
    const available = await isPortAvailable(port);
    if (available) return port;
  }
  throw new Error(
    `[PortFinder] 从端口 ${startPort} 开始，连续 ${maxRetries} 个端口均被占用`
  );
}

module.exports = { isPortAvailable, listenWithRetry, findAvailablePort };
