/**
 * 键**存在**就调 setter —— 判存在而不判真值，这是整个 patch 机制的地基。
 *
 * 旧命令处理器返回的是一个「本次改了哪些字段」的补丁对象，里面绝大多数字段的合法值都
 * 包含假值：`flag: false`（停止采集）、`localFlag: false`（退出回放）、`nowIndex: 0`
 * （回放跳到第一帧）、`saveTime: undefined`（清空采集起始时间）。用 `if (next[key])`
 * 或 `!= null` 判断，这些命令会被静默丢掉 —— 现象是「点了停止采集但一直在采」。
 *
 * 反过来，键**不在**补丁里就必须什么都不做：补丁是增量的，把缺失的键当成 `undefined`
 * 写进去会把所有未提及的状态清空。
 *
 * `hasOwnProperty.call` 而不是 `in`：补丁对象来自 WebSocket/HTTP 的 JSON 反序列化结果，
 * 用 `in` 会命中 `Object.prototype` 上的名字。
 *
 * setter 不做类型检查（调用点保证传的是函数），也不接返回值 —— 写入失败与否由各 setter
 * 自己负责。
 *
 * @param {object} next 补丁对象。
 * @param {string} key 字段名。
 * @param {Function} setter 写入函数，只在键存在时被调用。
 * @returns {void}
 */
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
  // 这两张清单是「已经迁进专用 store」的字段，写它们要走各自的 setter 而不是旧变量。
  // 清单写死在这里（而不是由 server.js 传入）是刻意的：它们对应两个具体的 store
  // （playbackStateStore / collectionStateStore），字段与 store 是一对一绑定的，
  // 参数化只会让「某个字段属于哪个 store」这条事实散到两个文件里。
  const playbackKeys = ['nowIndex', 'localData', 'localDataBack', 'localDataHead', 'indexArr'];
  const collectionKeys = ['saveTime', 'flag', 'colHZ', 'collectOptions'];
  let boundRuntimeStateStore = runtimeStateStore || null;
  let boundStoreBackedKeys = new Set(storeBackedKeys);

  /**
   * 尝试把一个字段写进 RuntimeStateStore；不该由 store 接管就返回 false。
   *
   * 返回值的含义是「**这个字段我处理掉了吗**」，`applyCommonPatch` 靠它决定要不要再走
   * `mutableSetters` 那条旧路 —— 两条路都走会写两次（旧变量 + store 里的代理），而 store
   * 的代理最终也指向同一个旧变量，等于同一个值写两遍，第二次覆盖第一次。目前两条路的值
   * 相同所以看不出问题，但一旦某个 setter 带了副作用（重开 db、重连串口）就会做两次。
   *
   * 三个条件的顺序也是优先级：先判字段在不在补丁里（不在就与 store 无关），再判 store
   * 有没有绑上、这个字段是否在 store-backed 清单里。**没绑 store 时全部返回 false**，
   * 于是整个模块退回纯旧变量模式 —— 这是迁移期的必要行为，`bindRuntimeStateStore` 要在
   * store 建好之后才会被调用（见 runtimeStateStoreFactory），而在那之前命令就可能到达。
   *
   * @param {object} next 补丁对象。
   * @param {string} key 字段名。
   * @returns {boolean} 是否已由 store 写入。
   */
  function setStoreBackedKey(next, key) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) return false;
    if (!boundRuntimeStateStore || !boundStoreBackedKeys.has(key)) return false;
    boundRuntimeStateStore.set(key, next[key]);
    return true;
  }

  /**
   * 应用两类命令补丁的公共部分：回放字段、串口字段，以及全部旧变量。
   *
   * 三段的先后顺序有意义 —— 回放/串口字段先落到各自的专用 store，最后才遍历
   * `mutableSetters`。如果某个字段同时出现在 `playbackKeys` 和 `mutableSetters` 里，它会
   * 被写两次（后者覆盖前者）。当前 server.js 的两张表没有交集，新增字段时要保持这一点。
   *
   * `serialport` 单独一行而不是像回放那样列个数组：它是唯一一个走串口 store 的字段。
   *
   * 两处用可选调用（`setPlaybackState?.` / `setSerialPortState?.`）而不是先判后调，是因为
   * 这个 factory 也被测试用最小依赖构造（见 runtimeStatePatchFactory.test.js），缺哪一路
   * 就静默跳过那一路，而不是让整条命令失败。
   *
   * @param {object} [next] 补丁对象。
   * @returns {void}
   */
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

  /**
   * 应用**运行时命令**（采集/回放类）返回的状态补丁。
   *
   * 与 `applySerialCommandPatch` 的唯一差别就是多处理采集字段。分成两个入口而不是一个带
   * 开关的函数，是为了让「串口命令不该改采集状态」这条约束由结构保证：串口层拿不到能写
   * `flag` / `saveTime` 的入口，就不可能因为一次串口重连把正在进行的采集停掉。
   *
   * @param {object} [next] 补丁对象。
   * @returns {void}
   */
  function applyRuntimeCommandPatch(next = {}) {
    collectionKeys.forEach((key) => {
      if (setCollectionState) setIfPresent(next, key, (value) => setCollectionState(key, value));
    });
    applyCommonPatch(next);
  }

  /**
   * 应用**串口命令**返回的状态补丁 —— 只有公共部分，不含采集字段（理由见上）。
   *
   * 现在只是转调，看着多余；保留独立函数是为了给串口侧留一个稳定的名字，将来串口专属的
   * 补丁规则加进来时不必去改所有调用点。
   *
   * @param {object} [next] 补丁对象。
   * @returns {void}
   */
  function applySerialCommandPatch(next = {}) {
    applyCommonPatch(next);
  }

  /**
   * 事后绑定 RuntimeStateStore 与 store-backed 字段清单。
   *
   * 之所以要「事后」：patcher 必须先建出来交给命令层，而 store 的构造又需要 patcher
   * （`createServerRuntimeStateStore` 建好 store 后立刻回调这里，见 runtimeStateStoreFactory）
   * —— 典型的循环依赖，用一次后绑定打开。
   *
   * `keys` 默认 `[]` 而不是保留原清单：调用 `bindRuntimeStateStore(store)` 不给清单，语义
   * 就是「绑了 store 但暂时不让它接管任何字段」，全部走旧变量。传 `null` 作为 store 则是
   * 显式解绑，退回纯旧变量模式。
   *
   * 每次调用**整体替换**而非合并，所以两次绑定不会叠加清单 —— 这让「当前哪些字段由 store
   * 接管」永远只有一个出处。
   *
   * @param {object|null} store RuntimeStateStore；传空则解绑。
   * @param {string[]} [keys] 由 store 接管的字段清单。
   * @returns {object} patcher 自身（链式）。
   */
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
