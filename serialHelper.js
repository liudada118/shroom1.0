/**
 * serialHelper.js
 * 串口管理模块
 *
 * 将 server.js 中串口连接、断开、重连等逻辑统一封装，
 * 提供清晰的串口生命周期管理接口。
 */

const { SerialPort } = require('serialport');
const { DelimiterParser } = require('@serialport/parser-delimiter');
const logger = require('./logger');

// 标准帧分隔符（与原 server.js 保持一致）
const FRAME_DELIMITER = Buffer.from([0xaa, 0x55, 0x03, 0x99]);

/**
 * 获取系统中所有可用串口列表
 * @returns {Promise<Array>} 串口信息数组
 */
async function listPorts() {
  try {
    const ports = await SerialPort.list();
    return ports;
  } catch (err) {
    logger.error('获取串口列表失败', err);
    return [];
  }
}

/**
 * 打开一个串口并返回 { port, parser }
 * @param {string} path - 串口路径，如 'COM3' 或 '/dev/ttyUSB0'
 * @param {number} baudRate - 波特率，默认 1000000
 * @returns {Promise<{port: SerialPort, parser: DelimiterParser}>}
 */
function openPort(path, baudRate = 1000000) {
  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path, baudRate, autoOpen: false });
    const parser = port.pipe(new DelimiterParser({ delimiter: FRAME_DELIMITER }));

    port.open((err) => {
      if (err) {
        logger.error(`串口 ${path} 打开失败`, err.message);
        reject(err);
      } else {
        logger.info(`串口 ${path} 已打开，波特率 ${baudRate}`);
        resolve({ port, parser });
      }
    });

    port.on('error', (err) => {
      logger.error(`串口 ${path} 错误`, err.message);
    });

    port.on('close', () => {
      logger.info(`串口 ${path} 已关闭`);
    });
  });
}

/**
 * 安全关闭串口
 * @param {SerialPort|null} port - 串口实例
 * @returns {Promise<void>}
 */
function closePort(port) {
  return new Promise((resolve) => {
    if (!port || !port.isOpen) {
      resolve();
      return;
    }
    port.close((err) => {
      if (err) {
        logger.warn('串口关闭时出现警告', err.message);
      }
      resolve();
    });
  });
}

module.exports = { listPorts, openPort, closePort, FRAME_DELIMITER };
