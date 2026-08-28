function setIfPresent(next, key, setter) {
  if (Object.prototype.hasOwnProperty.call(next, key)) {
    setter(next[key]);
  }
}

/**
 * 创建旧命令运行时状态 patcher。
 *
 * WebSocket/HTTP command handlers 仍会返回一批旧字段。这里集中管理字段到 setter/store 的写入规则，
 * server.js 只声明哪些变量仍是旧状态；后续迁到 RuntimeStateStore 时只改这一层。
 *
 * @param {object} options 依赖。
 * @param {object} options.mutableSetters 旧变量 setter 表。
 * @param {Function} options.setCollectionState 采集状态 setter。
 * @param {Function} options.setPlaybackState 回放状态 setter。
 * @param {Function} options.setSerialPortState 串口状态 setter。
 * @param {object} [options.runtimeStateStore] 运行时状态 store。
 * @param {string[]} [options.storeBackedKeys] 需要优先写入 store 的旧字段。
 * @returns {{ applyRuntimeCommandPatch: Function, applySerialCommandPatch: Function, bindRuntimeStateStore: Function }}
 */
function createRuntimeStatePatchers({
  mutableSetters = {},
  setCollectionState,
  setPlaybackState,
  setSerialPortState,
  runtimeStateStore,
  storeBackedKeys = [],
} = {}) {
  const playbackKeys = ['nowIndex', 'localData', 'localDataBack', 'localDataHead', 'indexArr'];
  const collectionKeys = ['saveTime', 'flag', 'colHZ', 'collectOptions'];
  let boundRuntimeStateStore = runtimeStateStore || null;
  let boundStoreBackedKeys = new Set(storeBackedKeys);

  function setStoreBackedKey(next, key) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) return false;
    if (!boundRuntimeStateStore || !boundStoreBackedKeys.has(key)) return false;
    boundRuntimeStateStore.set(key, next[key]);
    return true;
  }

  function applyCommonPatch(next = {}) {
    playbackKeys.forEach((key) => {
      if (setPlaybackState) setIfPresent(next, key, (value) => setPlaybackState(key, value));
    });
    setIfPresent(next, 'serialport', (value) => setSerialPortState?.('serialport', value));

    Object.entries(mutableSetters).forEach(([key, setter]) => {
      if (setStoreBackedKey(next, key)) return;
      if (typeof setter === 'function') setIfPresent(next, key, setter);
    });
  }

  function applyRuntimeCommandPatch(next = {}) {
    collectionKeys.forEach((key) => {
      if (setCollectionState) setIfPresent(next, key, (value) => setCollectionState(key, value));
    });
    applyCommonPatch(next);
  }

  function applySerialCommandPatch(next = {}) {
    applyCommonPatch(next);
  }

  function bindRuntimeStateStore(store, keys = []) {
    boundRuntimeStateStore = store || null;
    boundStoreBackedKeys = new Set(keys);
    return api;
  }

  const api = {
    applyRuntimeCommandPatch,
    applySerialCommandPatch,
    bindRuntimeStateStore,
  };
  return api;
}

module.exports = {
  createRuntimeStatePatchers,
  setIfPresent,
};
