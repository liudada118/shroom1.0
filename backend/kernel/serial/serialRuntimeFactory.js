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
  // 只有一个键 `serialport`：启动期扫到的串口候选列表（见 bootstrapServer 的
  // `scanStartupSerialPorts`），旧 WebSocket 上下文把它当 `serialport` 暴露给前端。
  //
  // ⚠️ 初值 `{a: 1, b: 2}` 是老代码留下的占位符，**类型是错的** —— 真实值是一个数组。
  // 扫描是异步的（`listPorts()` 返回 Promise），所以在它完成之前有一个窗口：这一刻读到的
  // 是这个对象而不是数组。目前没有观察到问题（前端此时还没连上），但这不是设计，
  // 改成 `[]` 才是对的。留着没动是因为它属于运行行为，不在本轮注释任务范围内。
  const serialPortStateStore = createRuntimeStateStore({
    initialState: {
      serialport: { a: 1, b: 2 },
    },
  });

  /**
   * 读一项串口相关的运行态。
   *
   * @param {string} key 状态键。
   * @returns {*} 当前值；键不存在时 undefined。
   */
  const getSerialPortState = (key) => serialPortStateStore.get(key);

  /**
   * 写一项串口相关的运行态。
   *
   * @param {string} key 状态键。
   * @param {*} value 新值。
   * @returns {void}
   */
  const setSerialPortState = (key, value) => serialPortStateStore.set(key, value);

  /**
   * 把某个状态键包成 `{get, set}` 访问器。
   *
   * 这是 RuntimeStateStore 迁移模式的一环：server.js 里原本是一堆模块级 `let`，
   * 迁移时把它们换成访问器代理到 store，**读写都走访问器、不做双写** —— 双写会让
   * 「哪份才是真的」在排查时变成两个都要看。
   *
   * 返回的是**惰性读写的闭包**而不是当前值快照，所以拿到访问器的模块永远看到最新值，
   * 不需要关心是谁改的。
   *
   * @param {string} key 状态键。
   * @returns {{get: Function, set: Function}} 访问器。
   */
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
