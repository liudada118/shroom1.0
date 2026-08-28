const { createRuntimeStateStore } = require('../platform/runtime/runtimeStateStore');
const { createSerialManager } = require('@shroom/backend/serial/serialManager.js');
const { createSerialParserManager } = require('@shroom/backend/serial/serialParserManager.js');

/**
 * 创建串口运行时装配。
 *
 * 这里集中管理 parser manager、serial manager 和串口端口状态，
 * server.js 只负责注入分隔符和把运行时能力传给命令层。
 *
 * @param {object} options 创建参数。
 * @param {Buffer} options.frameDelimiter 普通压力帧分隔符。
 * @param {Buffer} options.smallBed12BDelimiter 小床 12B 帧分隔符。
 * @param {object} options.logger 日志对象。
 * @returns {object} 串口运行时依赖集合。
 */
function createSerialRuntime({
  frameDelimiter,
  smallBed12BDelimiter,
  logger,
  parserManagerFactory = createSerialParserManager,
  serialManagerFactory = createSerialManager,
}) {
  const serialParserManager = parserManagerFactory({
    frameDelimiter,
    smallBed12BDelimiter,
  });
  const serialManager = serialManagerFactory({
    parserManager: serialParserManager,
    logger,
  });
  const serialRoles = serialManager.roles;
  const serialPortStateStore = createRuntimeStateStore({
    initialState: {
      serialport: { a: 1, b: 2 },
    },
  });

  const getSerialPortState = (key) => serialPortStateStore.get(key);
  const setSerialPortState = (key, value) => serialPortStateStore.set(key, value);
  const serialPortStateAccessor = (key) => ({
    get: () => getSerialPortState(key),
    set: (value) => setSerialPortState(key, value),
  });

  return {
    getSerialPortState,
    serialManager,
    serialParserManager,
    serialPortStateAccessor,
    serialPortStateStore,
    serialRoles,
    setSerialPortState,
  };
}

module.exports = {
  createSerialRuntime,
};
