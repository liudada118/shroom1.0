const { createLegacySerialRuntimeContext } = require('../sensors/runtime/legacySerialContextFactory');
const { createLegacySerialRuntimeBinding } = require('../sensors/runtime/legacySerialRuntimeBinding');

/**
 * 绑定旧串口运行时。
 *
 * 旧 parser 仍然依赖大量可变状态，这里把 context 创建和 parser 绑定集中收口，
 * 避免 server.js 继续直接知道 legacy runtime 的内部装配细节。
 *
 * @param {object} options 绑定参数。
 * @param {object} options.baseContext 旧运行时基础依赖。
 * @param {Function} options.collectionStateAccessor 采集状态访问器。
 * @param {Function} options.getManagedSerialPort 串口读取函数。
 * @param {object} options.mutableBindings 旧可变变量绑定。
 * @param {Function} options.runtimeStateAccessor 运行时状态访问器。
 * @param {object} options.serialRoles 串口角色常量。
 * @param {Function} options.zeroStateAccessor 零点状态访问器。
 * @param {object} options.serialParserManager parser manager。
 * @returns {object} legacy runtime 绑定结果。
 */
function bindLegacySerialRuntime({
  baseContext,
  collectionStateAccessor,
  getManagedSerialPort,
  mutableBindings,
  runtimeStateAccessor,
  serialRoles,
  zeroStateAccessor,
  serialParserManager,
}) {
  const legacySerialRuntimeContext = createLegacySerialRuntimeContext({
    baseContext,
    collectionStateAccessor,
    getManagedSerialPort,
    mutableBindings,
    runtimeStateAccessor,
    serialRoles,
    zeroStateAccessor,
  });

  const legacySerialRuntimeBinding = createLegacySerialRuntimeBinding({
    accessors: legacySerialRuntimeContext.accessors,
    baseContext: legacySerialRuntimeContext.baseContext,
    serialParserManager,
  });

  return {
    legacySerialRuntimeBinding,
    legacySerialRuntimeContext,
  };
}

module.exports = {
  bindLegacySerialRuntime,
};
