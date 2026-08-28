const { createLegacyRuntimeStateBindings } = require('./legacyStateBindingsFactory');

const DEFAULT_LEGACY_RUNTIME_STATE = Object.freeze({
  firstBlueData: [],
  firstBlueData1: [],
  firstBlueData2: [],
  lastBlueData: [],
  lastBlueData1: [],
  lastBlueData2: [],
  newArr: [],
});

const STORE_BACKED_RUNTIME_KEYS = Object.freeze([
  'baudRate',
  'db',
  'db1',
  'db2',
  'file',
  'localFlag',
  'nowDate',
]);

function cloneDefaultLegacyRuntimeState() {
  return Object.fromEntries(
    Object.entries(DEFAULT_LEGACY_RUNTIME_STATE).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.slice() : value,
    ])
  );
}

/**
 * 创建 server 旧运行时状态 store，并把命令 patcher 绑定到 store-backed 写入路径。
 *
 * server.js 仍然声明旧变量 accessor，但初始状态、store-backed key 清单和 patcher 绑定规则
 * 已集中到这里，避免启动编排文件继续维护这批迁移细节。
 *
 * @param {object} options 创建参数。
 * @param {object} options.accessors 旧变量 accessor。
 * @param {object} [options.runtimeStatePatchers] runtimeStatePatchFactory 返回的 patcher。
 * @param {object} [options.initialState] 额外初始状态。
 * @param {string[]} [options.storeBackedKeys] 需要优先写入 store 的字段。
 * @returns {{ runtimeStateAccessor: Function, runtimeStateStore: object }} store 绑定结果。
 */
function createServerRuntimeStateStore({
  accessors = {},
  runtimeStatePatchers,
  initialState = {},
  storeBackedKeys = STORE_BACKED_RUNTIME_KEYS,
} = {}) {
  const bindings = createLegacyRuntimeStateBindings({
    initialState: {
      ...cloneDefaultLegacyRuntimeState(),
      ...initialState,
    },
    accessors,
  });

  runtimeStatePatchers?.bindRuntimeStateStore?.(bindings.runtimeStateStore, storeBackedKeys);

  return bindings;
}

module.exports = {
  DEFAULT_LEGACY_RUNTIME_STATE,
  STORE_BACKED_RUNTIME_KEYS,
  createServerRuntimeStateStore,
};
