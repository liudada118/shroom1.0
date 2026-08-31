const { createRuntimeStateStore } = require('./runtimeStateStore');

// 旧运行时状态的初值。这七个字段是**由 store 自己保存**的（没有对应的 server.js 变量
// 代理），所以初值必须在这里给：它们在第一帧到达前就会被读到（差分/上一帧比较逻辑），
// 兜成 `[]` 才不会让读取方拿到 undefined 去 `.length`。
//
// 冻结是为了防止有人就地改这份共享常量 —— 它被 cloneDefaultLegacyRuntimeState 分发给
// 每个 store 实例，改到源头就是改到所有实例。
const DEFAULT_LEGACY_RUNTIME_STATE = Object.freeze({
  firstBlueData: [],
  firstBlueData1: [],
  firstBlueData2: [],
  lastBlueData: [],
  lastBlueData1: [],
  lastBlueData2: [],
  newArr: [],
});

// 「已经由 store 接管写入」的字段清单 —— 迁移进度就是这个数组的长度。
//
// 这七个字段在 server.js 里**仍然是 `let` 变量并登记了 accessor**，清单的作用是让命令
// patcher 走 `store.set()`（进而通过 accessor 写回旧变量）这一条统一路径，而不是各处直接
// 调 setter。加一个字段进这里之前，必须确认它在 server.js 的 accessors 里有 get **和**
// set；只有 get 的字段（如 `port1`/`port2`）放进来会让写入静默落到 store 内部状态，
// 而读取仍走 accessor —— 那次写入就彻底丢了。
const STORE_BACKED_RUNTIME_KEYS = Object.freeze([
  'baudRate',
  'db',
  'db1',
  'db2',
  'file',
  'localFlag',
  'nowDate',
]);

/**
 * 拷一份可写的初值（含数组逐个 slice）。
 *
 * 必须逐个 slice 数组，浅拷贝对象不够：外层拷完之后，七个数组仍是**冻结常量里那同一份**
 * 引用。旧链路里这些数组是被就地 `push`/`length = 0` 修改的（差分缓存），所以共享引用会
 * 让两个 store 实例互相污染，改到冻结数组上还会直接抛。
 *
 * 用 `Object.fromEntries(entries.map(...))` 而不是手写七行：字段增删时不必同步两处。
 *
 * @returns {object} 与常量无引用关系的初值对象。
 */
function cloneDefaultLegacyRuntimeState() {
  return Object.fromEntries(
    Object.entries(DEFAULT_LEGACY_RUNTIME_STATE).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.slice() : value,
    ])
  );
}

/**
 * 建 store，并附带一个「按键生成 accessor」的工厂。
 *
 * `runtimeStateAccessor(key)` 返回的是**指向 store 自己**的 get/set 对，用途是把 store 里
 * 的字段再包成 accessor 交给别的模块（例如某个子 store 想代理到这里的字段）。它与
 * `createRuntimeStateStore` 的 `accessors` 参数方向相反：那边是 store → 旧变量，这边是
 * 别人 → store。两者名字像，改的时候看清方向。
 *
 * 拆成独立函数（而不是内联进 createServerRuntimeStateStore）是为了让测试能不带 patcher
 * 地建一份干净 store，见 runtimeStateStoreFactory.test.js。
 *
 * @param {object} [options] 参数。
 * @param {object} [options.initialState] store 内部状态初值。
 * @param {Record<string, {get?: Function, set?: Function}>} [options.accessors] 代理到旧变量。
 * @returns {{runtimeStateAccessor: Function, runtimeStateStore: object}} store 与 accessor 工厂。
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
  // 默认值先展开、调用方的 initialState 后展开：调用方可以覆盖任一默认字段，但不必把
  // 七个字段全列一遍。
  const bindings = createLegacyRuntimeStateBindings({
    initialState: {
      ...cloneDefaultLegacyRuntimeState(),
      ...initialState,
    },
    accessors,
  });

  // 这一行就是打开「patcher 需要 store、store 的装配又在 patcher 之后」这个循环依赖的地方。
  // 两层可选调用是为了让不带 patcher 的调用方（测试、以及将来不再有旧命令的路径）能直接
  // 拿到一个可用 store，而不是被迫造一个假 patcher。
  runtimeStatePatchers?.bindRuntimeStateStore?.(bindings.runtimeStateStore, storeBackedKeys);

  return bindings;
}

module.exports = {
  DEFAULT_LEGACY_RUNTIME_STATE,
  STORE_BACKED_RUNTIME_KEYS,
  createLegacyRuntimeStateBindings,
  createServerRuntimeStateStore,
};
