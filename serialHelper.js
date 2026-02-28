/**
 * serialHelper.js
 * 串口管理模块
 *
 * 将 server.js 中 52 处串口相关操作统一封装，
 * 提供清晰的串口生命周期管理接口和多串口协调能力。
 */

const { SerialPort } = require('serialport');
const { DelimiterParser } = require('@serialport/parser-delimiter');
const logger = require('./logger');

// 标准帧分隔符（与原 server.js / serialport.js 保持一致）
const FRAME_DELIMITER = Buffer.from([0xaa, 0x55, 0x03, 0x99]);

/**
 * 获取系统中所有可用串口列表，并按平台过滤
 * @returns {Promise<Array>} 串口信息数组
 */
async function listPorts() {
  try {
    const ports = await SerialPort.list();
    logger.info(`检测到 ${ports.length} 个串口`);
    return ports;
  } catch (err) {
    logger.error('获取串口列表失败', err);
    return [];
  }
}

/**
 * 打开一个串口并返回 { port, parser }
 * @param {string} portPath - 串口路径，如 'COM3' 或 '/dev/ttyUSB0'
 * @param {object} options - 配置选项
 * @param {number} [options.baudRate=1000000] - 波特率
 * @param {Buffer} [options.delimiter] - 帧分隔符
 * @returns {Promise<{port: SerialPort, parser: DelimiterParser}>}
 */
function openPort(portPath, options = {}) {
  const { baudRate = 1000000, delimiter = FRAME_DELIMITER } = options;

  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path: portPath, baudRate, autoOpen: false });
    const parser = port.pipe(new DelimiterParser({ delimiter }));

    port.open((err) => {
      if (err) {
        logger.error(`串口 ${portPath} 打开失败`, err.message);
        reject(err);
      } else {
        logger.info(`串口 ${portPath} 已打开 (波特率: ${baudRate})`);
        resolve({ port, parser });
      }
    });

    port.on('error', (err) => {
      logger.error(`串口 ${portPath} 运行时错误`, err.message);
    });

    port.on('close', () => {
      logger.info(`串口 ${portPath} 已关闭`);
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
      if (err) logger.warn('串口关闭时出现警告', err.message);
      resolve();
    });
  });
}

/**
 * 向串口写入数据
 * @param {SerialPort} port - 串口实例
 * @param {Buffer|string} data - 要写入的数据
 * @returns {Promise<void>}
 */
function writeToPort(port, data) {
  return new Promise((resolve, reject) => {
    if (!port || !port.isOpen) {
      reject(new Error('串口未打开'));
      return;
    }
    port.write(data, (err) => {
      if (err) {
        logger.error('串口写入失败', err.message);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

/**
 * 串口管理器 - 管理多个串口的生命周期
 * 用于汽车座椅场景下同时管理坐垫、靠背、头枕三个串口
 */
class SerialManager {
  constructor() {
    /** @type {Map<string, {port: SerialPort, parser: DelimiterParser}>} */
    this._ports = new Map();
  }

  /**
   * 打开并注册一个串口
   * @param {string} name - 串口别名（如 'sit', 'back', 'head'）
   * @param {string} portPath - 串口路径
   * @param {object} options - 配置选项
   * @returns {Promise<{port: SerialPort, parser: DelimiterParser}>}
   */
  async open(name, portPath, options = {}) {
    // 如果已打开同名串口，先关闭
    if (this._ports.has(name)) {
      await this.close(name);
    }
    const result = await openPort(portPath, options);
    this._ports.set(name, result);
    return result;
  }

  /**
   * 关闭指定名称的串口
   * @param {string} name - 串口别名
   */
  async close(name) {
    const entry = this._ports.get(name);
    if (entry) {
      await closePort(entry.port);
      this._ports.delete(name);
    }
  }

  /**
   * 关闭所有已打开的串口
   */
  async closeAll() {
    const names = [...this._ports.keys()];
    for (const name of names) {
      await this.close(name);
    }
    logger.info('所有串口已关闭');
  }

  /**
   * 获取指定名称的串口
   * @param {string} name
   * @returns {{port: SerialPort, parser: DelimiterParser}|undefined}
   */
  get(name) {
    return this._ports.get(name);
  }

  /**
   * 获取所有已打开的串口名称
   * @returns {string[]}
   */
  getOpenNames() {
    return [...this._ports.keys()];
  }
}

module.exports = {
  FRAME_DELIMITER,
  listPorts,
  openPort,
  closePort,
  writeToPort,
  SerialManager,
};
