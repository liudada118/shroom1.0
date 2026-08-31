/**
 * 创建运行时状态仓库。
 *
 * 该仓库支持两类状态：
 * 1. 内部状态：由 store 自己保存。
 * 2. 适配状态：通过 getter/setter 代理到旧代码中的局部变量。
 *
 * 这样可以渐进式迁移 server.js 的全局运行时变量，而不需要一次性重写所有调用点。
 *
 * 同一个工厂被用来建**三类互不相关的 store**（server.js 里的 playback / collection，
 * serialRuntimeFactory 里的 serialPort，以及 runtimeStateStoreFactory 里的 legacy 总表）。
 * 所以这里刻意不认识任何具体字段 —— 字段清单属于各自的装配层。
 *
 * @param {object} [options] 参数。
 * @param {object} [options.initialState] 内部状态初值（**浅拷贝一份**，此后与调用方的对象无关）。
 * @param {Record<string, {get?: Function, set?: Function}>} [options.accessors] 代理到旧变量的 getter/setter。
 * @returns {{bind: Function, bindMany: Function, get: Function, patch: Function,
 *   set: Function, snapshot: Function}} store 接口。
 */
function createRuntimeStateStore({ initialState = {}, accessors = {} } = {}) {
  // 两处都浅拷贝，为的是「传进来的对象不再是 store 的一部分」：initialState 有时来自
  // 共享常量（见 runtimeStateStoreFactory 的 DEFAULT_LEGACY_RUNTIME_STATE，它是冻结的），
  // 直接持有它 set 会静默失败（非严格模式）或抛错。注意是浅拷贝 —— 初值里的数组仍与
  // 调用方共享，所以那边是先 slice 过一遍再传进来的。
  const state = { ...initialState };
  const accessorMap = { ...accessors };

  /**
   * 判断某个键是否登记了代理（accessor）。
   *
   * 用 `hasOwnProperty.call` 而不是 `key in accessorMap`：键名来自旧 server.js 的变量名
   * 清单，`constructor` / `toString` 这类名字用 `in` 会命中原型链，于是 `get` 会去调
   * `Object.prototype.toString.get`（不存在）并因此把真正的内部状态跳过去。
   *
   * 只判「有没有登记」，不判「get/set 是否齐全」—— 一个键可以只给 get 不给 set（见
   * server.js 里的 `port1`/`port2`，它们只读），`get`/`set` 各自再查一次函数类型。
   *
   * @param {string} key 状态键名。
   * @returns {boolean} 是否登记了代理。
   */
  function hasAccessor(key) {
    return Object.prototype.hasOwnProperty.call(accessorMap, key);
  }

  /**
   * 读一个状态值：有 getter 代理就走代理，否则读内部状态。
   *
   * 代理优先是这个 store 的核心机制。迁移期里 `file`、`db`、`baudRate` 这些变量的**真身
   * 仍然是 server.js 的 `let`**（旧代码里几百处直接读写它们），store 只是一个统一入口。
   * 如果这里先读 `state[key]`，那 store 会返回一份从旧变量被改之后就再没同步过的陈旧值 ——
   * 现象是「切了传感器类型，但某个模块还在按上一个类型解包」。
   *
   * 只有 getter 的代理（如只读的串口对象）也能工作：这里只要求 `get` 是函数。
   *
   * 未登记且内部也没有的键返回 `undefined`，`runtimeContextFactory` 正是靠这个
   * `undefined` 判断「store 还没接管这个字段」并回退到旧闭包。
   *
   * @param {string} key 状态键名。
   * @returns {*} 状态值；未登记且未初始化时为 undefined。
   */
  function get(key) {
    if (hasAccessor(key) && typeof accessorMap[key].get === 'function') {
      return accessorMap[key].get();
    }
    return state[key];
  }

  /**
   * 写一个状态值：有 setter 代理就写回旧变量，否则写内部状态。
   *
   * 代理优先的理由同 `get`，方向相反：写进内部状态而不写回旧变量，旧代码那几百处直接读
   * `file` 的地方就完全看不到这次改动。
   *
   * ⚠️ 走代理时**刻意不写 `state[key]`**（不做「双写」）。双写会造出两份可能不一致的真相，
   * 而 `get` 只读代理那一份，另一份永远是死数据 —— 留着只会在某天代理被摘掉时突然「复活」
   * 一个过期值。
   *
   * 两条路径都返回传入的 `value` 而不是回读一次：只读代理（有 get 无 set）写入时会静默落到
   * 内部状态，回读会拿到代理里那个没被改的旧值，反而更容易误判成写成功了。
   *
   * @param {string} key 状态键名。
   * @param {*} value 新值。
   * @returns {*} 原样返回 value。
   */
  function set(key, value) {
    if (hasAccessor(key) && typeof accessorMap[key].set === 'function') {
      accessorMap[key].set(value);
      return value;
    }
    state[key] = value;
    return value;
  }

  /**
   * 批量写入，并返回**只含本次涉及键**的快照。
   *
   * 返回窄快照（`snapshot(Object.keys(next))`）而不是全量快照，是因为调用方是命令处理器
   * （见 `runtimeStatePatchFactory` 与 `handRuntimeFactory.setRuntime`），它要的是「我这次
   * 改了什么、改成了什么」用于回执和日志；全量快照会把几十个无关字段（含 db 句柄这种不可
   * 序列化的对象）一起带进响应。
   *
   * 逐键走 `set` 而不是直接合并进 `state`：代理必须逐个触发，否则旧变量不会被更新。
   *
   * 遍历用 `Object.entries`，所以**值为 `undefined` 的键也会被写入**（`{saveTime: undefined}`
   * 就是采集状态里一个有意义的「未设置」值），这与「键不存在」是两回事。
   *
   * @param {object} [next] 待写入的键值对。
   * @returns {object} 本次涉及键的写入后快照。
   */
  function patch(next = {}) {
    Object.entries(next).forEach(([key, value]) => {
      set(key, value);
    });
    return snapshot(Object.keys(next));
  }

  /**
   * 导出状态快照：给了键列表就只出这些键，没给则出全部（内部状态 ∪ 代理键）。
   *
   * 全量时把内部状态与代理两套键空间**并集去重** —— 只列一套会漏掉另一套（`file`/`db` 只在代理里，
   * `firstBlueData` 只在内部状态里）。只判 `Array.isArray(keys)`，所以 `snapshot(null)`/`snapshot()`
   * 都是全量。逐键走 `get` 而不是拷 `state`：代理键必须实时读，也保证「读快照」与「单读」同值。
   *
   * ⚠️ 值是**浅引用不拷贝**：快照里的数组就是 store 里那一份，调用方改它会直接改到状态。为了热路径
   * 上不每帧拷贝几个大数组而做的取舍。
   *
   * @param {string[]} [keys] 指定键；非数组则导出全部。
   * @returns {object} 键到值的普通对象。
   */
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

  /**
   * 事后登记一个键的代理。
   *
   * 存在的理由是**装配顺序**：store 要先建出来给早期模块用，而代理要包住的那些旧变量可能
   * 还没初始化（server.js 里 `runtimeStateStoreForContext` 先置 null、拿到 store 之后才
   * 回填，就是同一类循环依赖）。构造时无法一次给齐，所以留了这个后门。
   *
   * **会覆盖同名代理**，且此后该键的内部状态值就被永久遮蔽了（`get` 代理优先）——
   * 内部状态并不会被清掉，只是再也读不到。如果绑定前后两处的初值不同，绑定这一刻的
   * 表现就是「值突然变了」。
   *
   * 返回 `api` 支持链式调用；`api` 定义在下面，靠闭包在调用时才求值。
   *
   * @param {string} key 状态键名。
   * @param {{get?: Function, set?: Function}} accessor 代理。
   * @returns {object} store 自身（链式）。
   */
  function bind(key, accessor) {
    accessorMap[key] = accessor;
    return api;
  }

  /**
   * 批量登记代理，语义与逐个调用 `bind` 完全一致。
   *
   * 没有原子性 —— 中途某个 accessor 有问题也不会回滚前面几个。这里不需要原子性：调用只
   * 发生在装配期，那时还没有并发读者。
   *
   * @param {Record<string, {get?: Function, set?: Function}>} [nextAccessors] 代理表。
   * @returns {object} store 自身（链式）。
   */
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
