const {
  createLegacySerialFrameRuntimeAccessors,
  createMutableAccessor,
} = require('../../kernel/platform/runtime/legacyRuntimeAccessorFactory');

/**
 * 把旧串口 runtime 需要的可变变量描述转换成 accessor。
 *
 * server.js 只传入 getter/setter 描述，本模块统一包装成 legacy runtime
 * 可以通过 Object.defineProperties 挂载的 accessor。
 *
 * @param {Record<string, { get: Function, set: Function }>} mutableBindings 可变运行态变量绑定。
 * @returns {Record<string, { get: Function, set: Function }>} legacy runtime accessor。
 */
function buildLegacyMutableAccessors(mutableBindings = {}) {
  return Object.entries(mutableBindings).reduce((result, [key, binding]) => {
    result[key] = createMutableAccessor(binding.get, binding.set);
    return result;
  }, {});
}

/**
 * 创建 legacy 串口帧 runtime 的依赖上下文和状态 accessor。
 *
 * 该 factory 收敛旧协议 runtime 的上下文拼装逻辑，让 server.js 只保留
 * “提供哪些能力”和“哪些旧变量还没迁出”的声明。
 *
 * @param {object} options 创建参数。
 * @param {object} options.baseContext 固定函数、常量和服务依赖。
 * @param {Function} options.collectionStateAccessor 采集状态 accessor 工厂。
 * @param {Function} options.getManagedSerialPort 串口实例读取函数。
 * @param {Record<string, { get: Function, set: Function }>} options.mutableBindings 旧变量 getter/setter。
 * @param {Function} options.runtimeStateAccessor 通用 runtime 状态 accessor 工厂。
 * @param {object} options.serialRoles 串口角色常量。
 * @param {Function} options.zeroStateAccessor 零点状态 accessor 工厂。
 * @returns {{ baseContext: object, accessors: object }} legacy binding 入参。
 */
function createLegacySerialRuntimeContext({
  baseContext,
  collectionStateAccessor,
  getManagedSerialPort,
  mutableBindings,
  runtimeStateAccessor,
  serialRoles,
  zeroStateAccessor,
}) {
  const accessors = createLegacySerialFrameRuntimeAccessors({
    collectionStateAccessor,
    getManagedSerialPort,
    mutableAccessors: buildLegacyMutableAccessors(mutableBindings),
    runtimeStateAccessor,
    serialRoles,
    zeroStateAccessor,
  });

  return {
    baseContext: { ...baseContext },
    accessors,
  };
}

module.exports = {
  buildLegacyMutableAccessors,
  createLegacySerialRuntimeContext,
};
