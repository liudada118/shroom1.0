/**
 * 传感器运行时注册表。
 *
 * registry 负责维护业务通道名到处理函数的映射，让 server.js 不再手写
 * parser channel 与 handler 的对象字面量。后续每个传感器 runtime 可以
 * 通过 register(channel, handler) 挂入。
 */

/**
 * 串口 runtime handler 的标准导出键。
 *
 * registry 内部使用业务 channel，绑定 parser 时需要转换为 bindSerialSensorRuntimes
 * 所需的 handleSitFrame/handleBackFrame 等字段名。
 */
const SERIAL_HANDLER_KEYS = {
  back: 'handleBackFrame',
  bigBedSit: 'handleBigBedSitFrame',
  head: 'handleHeadFrame',
  sit: 'handleSitFrame',
  smallBed12B: 'handleSmallBed12BFrame',
};

/**
 * 创建传感器运行时注册表。
 * @returns {object} registry API。
 */
function createSensorRuntimeRegistry() {
  const handlers = new Map();

  /**
   * 注册指定业务通道的运行时处理函数。
   * @param {string} channel 业务通道名。
   * @param {Function} handler 串口帧处理函数。
   * @returns {object} registry API。
   */
  function register(channel, handler) {
    if (!channel) {
      throw new Error('sensor runtime channel is required');
    }
    if (typeof handler !== 'function') {
      throw new Error(`sensor runtime handler must be a function: ${channel}`);
    }
    handlers.set(channel, handler);
    return api;
  }

  /**
   * 获取指定业务通道的处理函数。
   * @param {string} channel 业务通道名。
   * @returns {Function | undefined} 处理函数。
   */
  function get(channel) {
    return handlers.get(channel);
  }

  /**
   * 按 bindSerialSensorRuntimes 需要的键名导出处理函数。
   * @returns {object} 串口绑定处理器对象。
   */
  function getSerialHandlers() {
    return Object.entries(SERIAL_HANDLER_KEYS).reduce((result, [channel, key]) => {
      result[key] = get(channel);
      return result;
    }, {});
  }

  /**
   * 列出已注册的业务通道。
   * @returns {string[]} 通道列表。
   */
  function list() {
    return Array.from(handlers.keys());
  }

  const api = {
    get,
    getSerialHandlers,
    list,
    register,
  };

  return api;
}

module.exports = {
  createSensorRuntimeRegistry,
};
