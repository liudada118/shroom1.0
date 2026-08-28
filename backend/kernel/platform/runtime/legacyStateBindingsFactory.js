const { createRuntimeStateStore } = require('./runtimeStateStore');

/**
 * 创建旧实时 runtime 状态绑定。
 *
 * 这是旧变量和新 runtime 服务之间的过渡层。server.js 只需要拿到 store
 * 和 accessor，不再关心 store 的初始字段结构。
 *
 * @param {object} options 创建参数。
 * @param {object} [options.initialState] 初始状态。
 * @param {object} [options.accessors] 旧变量 accessor。
 * @returns {{ runtimeStateStore: object, runtimeStateAccessor: Function }} 状态绑定。
 */
function createLegacyRuntimeStateBindings({ initialState = {}, accessors = {} } = {}) {
  const runtimeStateStore = createRuntimeStateStore({
    initialState,
    accessors,
  });
  const runtimeStateAccessor = (key) => ({
    get: () => runtimeStateStore.get(key),
    set: (value) => runtimeStateStore.set(key, value),
  });

  return {
    runtimeStateAccessor,
    runtimeStateStore,
  };
}

module.exports = {
  createLegacyRuntimeStateBindings,
};
