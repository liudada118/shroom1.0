/**
 * 创建运行时状态仓库。
 *
 * 该仓库支持两类状态：
 * 1. 内部状态：由 store 自己保存。
 * 2. 适配状态：通过 getter/setter 代理到旧代码中的局部变量。
 *
 * 这样可以渐进式迁移 server.js 的全局运行时变量，而不需要一次性重写所有调用点。
 */
function createRuntimeStateStore({ initialState = {}, accessors = {} } = {}) {
  const state = { ...initialState };
  const accessorMap = { ...accessors };

  function hasAccessor(key) {
    return Object.prototype.hasOwnProperty.call(accessorMap, key);
  }

  function get(key) {
    if (hasAccessor(key) && typeof accessorMap[key].get === 'function') {
      return accessorMap[key].get();
    }
    return state[key];
  }

  function set(key, value) {
    if (hasAccessor(key) && typeof accessorMap[key].set === 'function') {
      accessorMap[key].set(value);
      return value;
    }
    state[key] = value;
    return value;
  }

  function patch(next = {}) {
    Object.entries(next).forEach(([key, value]) => {
      set(key, value);
    });
    return snapshot(Object.keys(next));
  }

  function snapshot(keys = null) {
    const sourceKeys = Array.isArray(keys)
      ? keys
      : Array.from(new Set([
        ...Object.keys(state),
        ...Object.keys(accessorMap),
      ]));

    return sourceKeys.reduce((result, key) => {
      result[key] = get(key);
      return result;
    }, {});
  }

  function bind(key, accessor) {
    accessorMap[key] = accessor;
    return api;
  }

  function bindMany(nextAccessors = {}) {
    Object.entries(nextAccessors).forEach(([key, accessor]) => {
      bind(key, accessor);
    });
    return api;
  }

  const api = {
    bind,
    bindMany,
    get,
    patch,
    set,
    snapshot,
  };

  return api;
}

module.exports = {
  createRuntimeStateStore,
};
