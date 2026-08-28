function getStoreValue(runtimeStateStore, key, fallback) {
  if (!runtimeStateStore?.get) return fallback;
  const value = runtimeStateStore.get(key);
  return value === undefined ? fallback : value;
}

/**
 * 创建 server 运行时读取上下文。
 *
 * 写入侧已经通过 RuntimeStateStore 逐步集中；读取侧用这个上下文先读 store，
 * store 尚未初始化或字段不存在时再回退到旧闭包变量，方便分阶段迁移。
 *
 * @param {object} options 创建参数。
 * @param {Function} options.getRuntimeStateStore RuntimeStateStore getter。
 * @param {object} options.fallbacks 旧变量 fallback getter。
 * @returns {object} 运行时读取上下文。
 */
function createServerRuntimeContext({
  getRuntimeStateStore,
  fallbacks = {},
} = {}) {
  function getValue(key) {
    return getStoreValue(getRuntimeStateStore?.(), key, fallbacks[key]?.());
  }

  function getSensorType() {
    return getValue('file');
  }

  function getBaudRate() {
    return getValue('baudRate');
  }

  function getNowDate() {
    return getValue('nowDate');
  }

  function isLocalPlayback() {
    return Boolean(getValue('localFlag'));
  }

  function getDatabase(channel = 'sit') {
    if (channel === 'back') return getValue('db1');
    if (channel === 'head') return getValue('db2');
    return getValue('db');
  }

  return {
    getBaudRate,
    getDatabase,
    getNowDate,
    getSensorType,
    isLocalPlayback,
  };
}

module.exports = {
  createServerRuntimeContext,
  getStoreValue,
};
