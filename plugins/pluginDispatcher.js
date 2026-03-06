/**
 * pluginDispatcher.js - 插件调度器
 * 
 * 封装了基于插件的波特率获取、线序映射、数据处理等逻辑，
 * 供 server.js 调用以替代原有的 if/else 分支。
 * 
 * 使用方式:
 *   const dispatcher = require('./plugins/pluginDispatcher');
 *   dispatcher.init();
 *   const baudRate = dispatcher.getBaudRate('hand0205');
 *   const mappedData = dispatcher.mapSitData('car', rawData);
 */

const registry = require('./PluginRegistry');
const loadPlugins = require('./loadPlugins');
const logger = require('../logger');
const { numLessZeroToZero } = require('../server/mathUtils');

let initialized = false;

const dispatcher = {
  /**
   * 初始化插件系统 - 加载所有插件
   */
  init() {
    if (initialized) return;
    loadPlugins();
    initialized = true;
    logger.info(`[pluginDispatcher] 初始化完成，共 ${registry.size} 个插件`);
  },

  /**
   * 获取指定传感器类型的波特率
   * 替代原来的: if (['hand0205', ...].includes(file)) baudRate = 921600 ...
   * 
   * @param {string} fileType - 传感器类型
   * @returns {number} 波特率
   */
  getBaudRate(fileType) {
    const plugin = registry.get(fileType);
    if (plugin) {
      return plugin.baudRate;
    }
    logger.warn(`[pluginDispatcher] 未知传感器类型 ${fileType}，使用默认波特率 1000000`);
    return 1000000;
  },

  /**
   * 判断传感器是否为多串口类型
   * 替代原来的: isCar(file)
   * 
   * @param {string} fileType - 传感器类型
   * @returns {boolean}
   */
  isMultiPort(fileType) {
    const plugin = registry.get(fileType);
    return plugin ? plugin.multiPort : false;
  },

  /**
   * 处理主串口 1024 帧数据的线序映射
   * 替代原来 parser.on('data') 中的大量 if/else
   * 
   * @param {string} fileType - 传感器类型
   * @param {number[]} rawData - 原始数据
   * @returns {number[]} 映射后的数据
   */
  mapSitData(fileType, rawData) {
    const plugin = registry.get(fileType);
    if (plugin) {
      return plugin.mapLineOrder(rawData);
    }
    logger.warn(`[pluginDispatcher] 未知传感器类型 ${fileType}，返回原始数据`);
    return rawData;
  },

  /**
   * 处理副串口（靠背）1024 帧数据的线序映射
   * 替代原来 parser2.on('data') 中的 if/else
   * 
   * @param {string} fileType - 传感器类型
   * @param {number[]} rawData - 原始数据
   * @returns {number[]} 映射后的数据
   */
  mapBackData(fileType, rawData) {
    const plugin = registry.get(fileType);
    if (plugin && typeof plugin.mapBackLineOrder === 'function') {
      return plugin.mapBackLineOrder(rawData);
    }
    // 默认使用通用的 carBackLine
    logger.warn(`[pluginDispatcher] ${fileType} 无靠背映射，返回原始数据`);
    return rawData;
  },

  /**
   * 处理头枕数据的线序映射
   * 
   * @param {string} fileType - 传感器类型
   * @param {number[]} rawData - 原始数据
   * @returns {number[]} 映射后的数据
   */
  mapHeadData(fileType, rawData) {
    const plugin = registry.get(fileType);
    if (plugin && typeof plugin.mapHeadLineOrder === 'function') {
      return plugin.mapHeadLineOrder(rawData);
    }
    return rawData;
  },

  /**
   * 构建 WebSocket 发送的 JSON 数据
   * 替代原来的: if (isCar(file)) { jsonData = ... } else { jsonData = ... }
   * 
   * @param {string} fileType - 传感器类型
   * @param {object} params - 数据参数
   * @returns {string} JSON 字符串
   */
  buildPayload(fileType, params) {
    const plugin = registry.get(fileType);
    if (plugin) {
      return plugin.buildPayload(params);
    }
    // 默认 payload
    return JSON.stringify({ sitData: params.sitData, hz: params.hz });
  },

  /**
   * 构建数据库存储数据
   * 
   * @param {string} fileType - 传感器类型
   * @param {object} params - 数据参数
   * @returns {string} JSON 字符串
   */
  buildStorageData(fileType, params) {
    const plugin = registry.get(fileType);
    if (plugin) {
      return plugin.buildStorageData(params);
    }
    return JSON.stringify(params.sitData);
  },

  /**
   * 获取插件实例（用于需要直接访问插件方法的场景）
   * 
   * @param {string} fileType - 传感器类型
   * @returns {import('./BaseSensorPlugin').BaseSensorPlugin|null}
   */
  getPlugin(fileType) {
    return registry.get(fileType);
  },

  /**
   * 获取注册表实例
   * @returns {import('./PluginRegistry')}
   */
  getRegistry() {
    return registry;
  },

  /**
   * 应用归零校准
   * 
   * @param {number[]} data - 当前数据
   * @param {number[]} zeroData - 归零基准数据
   * @returns {number[]} 校准后的数据
   */
  applyZeroCalibration(data, zeroData) {
    if (!zeroData || !zeroData.length) return data;
    return data.map((a, index) => numLessZeroToZero(a - (zeroData[index] || 0)));
  },
};

module.exports = dispatcher;
