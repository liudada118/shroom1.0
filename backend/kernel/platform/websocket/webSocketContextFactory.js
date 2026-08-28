const { createMutableAccessor } = require('../runtime/legacyRuntimeAccessorFactory');
const { createWebSocketContextAccessors } = require('../runtime/webSocketContextAccessorFactory');

/**
 * 将 getter/setter 描述转换成 WebSocket handler 可使用的运行态访问器。
 *
 * @param {Record<string, { get: Function, set: Function }>} mutableAccessors 可读写旧变量描述。
 * @returns {Record<string, { get: Function, set: Function }>} 规范化后的运行态访问器。
 */
function buildMutableAccessors(mutableAccessors = {}) {
  return Object.entries(mutableAccessors).reduce((result, [key, accessor]) => {
    result[key] = createMutableAccessor(accessor.get, accessor.set);
    return result;
  }, {});
}

/**
 * 创建 WebSocket handler 的完整上下文。
 *
 * server.js 只负责把依赖和旧运行态变量以 getter/setter 形式传进来；
 * 本模块统一挂载 runtime accessor，避免 WebSocket handler 继续直接耦合 server.js 变量。
 *
 * @param {object} options 创建参数。
 * @param {object} options.dependencies WebSocket handler 需要的稳定服务依赖。
 * @param {Record<string, { get: Function, set: Function }>} options.mutableAccessors 旧运行态变量访问器。
 * @param {Function} options.playbackStateAccessor 回放状态访问器工厂。
 * @param {Function} options.serialPortStateAccessor 串口状态访问器工厂。
 * @param {Function} options.zeroStateAccessor 零点状态访问器工厂。
 * @returns {object} 可直接传给 createWebSocketHandlerAttacher 的上下文。
 */
function createWebSocketHandlerContext({
  dependencies,
  mutableAccessors,
  playbackStateAccessor,
  serialPortStateAccessor,
  zeroStateAccessor,
}) {
  const context = { ...dependencies };

  Object.defineProperties(context, createWebSocketContextAccessors({
    mutableAccessors: buildMutableAccessors(mutableAccessors),
    playbackStateAccessor,
    serialPortStateAccessor,
    zeroStateAccessor,
  }));

  return context;
}

module.exports = {
  buildMutableAccessors,
  createWebSocketHandlerContext,
};
