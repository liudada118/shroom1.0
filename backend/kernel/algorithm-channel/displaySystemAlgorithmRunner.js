/**
 * Display System 自定义算法的两种运行器：进程内 JS（vm）与常驻 Python worker。
 *
 * 这是「装机后二开」最核心的扩展点之一 —— 用户不重新编译就能塞一段算法进数据链路。
 * 两种运行器的取舍：JS 快、同进程、能被超时打断；Python 慢一个数量级但能用 numpy 那套
 * 生态，所以走异步 + 丢帧策略。
 */
const fs = require('fs');
const vm = require('vm');

/**
 * 惰性取 Python worker 的调用函数。
 *
 * 包一层函数（而不是在文件顶部 require）是为了**把 pythonWorker 的加载推迟到真正创建
 * Python 运行器的那一刻**：那个模块在 require 期就会尝试 `require('electron')` 并探测
 * 一堆 Python 运行时路径。只用 JS 算法的部署不该为此付代价，也不该因为找不到 Python
 * 而在加载本文件时就出问题。
 *
 * @returns {Function} pythonWorker 的 callPy。
 */
function getDefaultPythonCaller() {
  return require('./pythonWorker').callPy;
}

/**
 * 创建进程内 JavaScript 算法运行器。
 *
 * 源码**只在创建时加载执行一次**，之后复用返回的函数，所以算法模块顶层变量会跨帧保留（做历史
 * 缓冲区正需要这个）；而每次调用本函数都建独立 context，两个展示系统用同一个算法文件也不共享
 * 这些变量。数组进出都拷贝（进去防算法改坏调用方的帧缓冲，出来防它交回一个还会改的活引用）；
 * 每帧结束把三个全局清成 null（释放引用 + 让算法读不到上一帧残留）。
 *
 * ⚠️ **`vm` 不是安全沙箱**（Node 官方文档也这么说）。这里的目标是**防意外不防恶意**：没有
 * `require`/`process`/`fs`/定时器，`codeGeneration` 关掉了 `eval`/`new Function`/wasm，所以写错
 * 的算法不会顺手删文件。但传进去的 `Math`/`JSON`/`Object` 是**宿主 realm 的对象**，沿原型链能拿到
 * 宿主构造器、也就能逃出去。跑不可信代码必须换子进程/utilityProcess —— 挂在积压里。
 *
 * ⚠️ 执行时再编译一个 `executeScript`（而不是在宿主里直接 `algorithm(values, ctx)`）**是超时的
 * 唯一实现方式**：`vm` 的 `timeout` 只约束 `runInContext` 期间的同步执行，从宿主直接调就绕过了，
 * 死循环算法会卡死整个后端事件循环。挂 `__values`/`__context`/`__result` 三个全局传数据是这个约束
 * 的直接结果。也因为超时只能打断同步代码，沙箱里**故意不给 `Promise`/`setTimeout`**。
 *
 * @param {object} options 配置。
 * @param {string} options.entry 算法文件绝对路径。
 * @param {number} [options.timeoutMs=1000] 单帧同步执行超时。
 * @param {object} [options.fsLike] fs 实现，测试可注入。
 * @param {object} [options.vmLike] vm 实现，测试可注入。
 * @returns {Function} `(values, algorithmContext) => 算法返回值`；数组会被拷成新数组。
 * @throws {Error} 缺 entry、源码加载失败，或模块没有导出函数（装配期错误）。
 */
function createJavaScriptAlgorithmRunner({
  entry,
  timeoutMs = 1000,
  fsLike = fs,
  vmLike = vm,
} = {}) {
  if (!entry) throw new Error('JavaScript algorithm entry is required');
  const source = fsLike.readFileSync(entry, 'utf8');
  const sandbox = {
    module: { exports: {} },
    exports: {},
    Math,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
  };
  const context = vmLike.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
  });
  const loadScript = new vmLike.Script(`'use strict';\n${source}`, { filename: entry });
  loadScript.runInContext(context, { timeout: timeoutMs });
  // 同时接受 `module.exports = fn` 和 `module.exports.default = fn` 两种写法：
  // 二开者可能用打包工具从 ESM 转出来，那种产物导出在 `.default` 上。
  const algorithm = sandbox.module.exports?.default || sandbox.module.exports;
  if (typeof algorithm !== 'function') {
    throw new Error('JavaScript algorithm module must export a function');
  }

  sandbox.__algorithm = algorithm;
  const executeScript = new vmLike.Script(
    `'use strict'; __result = __algorithm(__values, __context);`,
    { filename: `${entry}:execute` },
  );

  return (values, algorithmContext = {}) => {
    sandbox.__values = [...values];
    sandbox.__context = {
      data: algorithmContext.data || null,
      rawData: [...(algorithmContext.rawData || values)],
      normalizedData: [...(algorithmContext.normalizedData || [])],
      matrix: algorithmContext.matrix || null,
      input: algorithmContext.algorithm?.input || {},
      output: algorithmContext.algorithm?.output || {},
    };
    sandbox.__result = null;
    executeScript.runInContext(context, { timeout: timeoutMs });
    const result = sandbox.__result;
    sandbox.__values = null;
    sandbox.__context = null;
    sandbox.__result = null;
    return Array.isArray(result) ? Array.from(result) : result;
  };
}

/**
 * 创建 Display System Python 算法运行器。
 *
 * **「至多一个在跑 + 至多一个排队、后来的顶掉先来的」是这个运行器的全部核心**：串口帧率固定而
 * Python 处理速度不是，不设上界队列会无界增长到 OOM，而画面早就停在几十秒前。展示场景下「显示
 * 最新一帧」比「每帧都算」重要，所以策略是最新者胜。传给 Python 的上下文键是 snake_case
 * （`raw_data`/`normalized_data`），那是与 Python 约定的入参协议，改名要两边一起改。
 *
 * ⚠️ 被顶掉的帧是**带 code 的 reject**（`DISPLAY_ALGORITHM_FRAME_DROPPED`）而非静默丢弃，好让调用
 * 方能统计丢帧（静默丢会让「算法太慢」完全不可见）。所以调用方**必须处理这个 reject**，否则
 * unhandled rejection。
 *
 * ⚠️ `timeoutMs` 交给 worker 层执行，这里没有本地兜底定时器 —— worker 超时失效的话这个 runner 会
 * 永远停在 `running = true`。
 *
 * @param {object} options 运行器配置。
 * @param {string} options.entry Python 算法文件绝对路径。
 * @param {number} [options.timeoutMs] 单帧执行超时。
 * @param {Function} [options.callPython] Python worker 调用函数，测试时可注入。
 * @returns {Function} 接收 rawData 和 context 的异步算法函数。
 */
function createPythonAlgorithmRunner({
  entry,
  timeoutMs = 1000,
  callPython = getDefaultPythonCaller(),
} = {}) {
  if (!entry) throw new Error('Python algorithm entry is required');

  let running = false;
  let queued = null;

  /**
   * 把排队中的那一帧丢掉（reject 掉它的 Promise）。
   *
   * 必须 reject 而不是直接 `queued = null`：调用方手里那个 Promise 否则永远不 settle，
   * 于是每丢一帧就泄漏一个挂起的 Promise 和它闭包里的整帧数据。
   *
   * @returns {void}
   */
  function dropQueuedRequest() {
    if (!queued) return;
    const error = new Error('newer Python algorithm frame replaced the queued frame');
    error.code = 'DISPLAY_ALGORITHM_FRAME_DROPPED';
    queued.reject(error);
    queued = null;
  }

  /**
   * 真正发起一次 Python 调用，并在结束后自动接着跑排队的那一帧。
   *
   * `.finally` 里的顺序（清 running → 取出 queued → 清 queued → 递归 start）就是这个泵：先清空槽位
   * 再启动下一帧，避免新帧刚进来又被自己顶掉。递归 `start` 不会栈溢出（在微任务里，每次都是新栈）。
   *
   * ⚠️ `try/catch` 把 `callPython` 的**同步抛错转成 rejected Promise**，好让 `.finally` 一定执行。
   * 少了它，worker 已死导致的同步抛错会让 `running` 永远停在 true —— 现象是算法通道彻底哑掉、
   * 不再报任何错，只能重启。
   *
   * @param {{values: number[], context: object, resolve: Function, reject: Function}} request
   *        待执行的帧请求。
   * @returns {void}
   */
  function start(request) {
    running = true;
    let task;
    try {
      task = callPython('run_display_system_algorithm', {
        entry,
        raw_data: request.values,
        context: {
          data: request.context.data || null,
          raw_data: request.context.rawData || request.values,
          normalized_data: request.context.normalizedData || [],
          matrix: request.context.matrix || null,
          input: request.context.algorithm?.input || {},
          output: request.context.algorithm?.output || {},
        },
      }, { timeoutMs });
    } catch (error) {
      task = Promise.reject(error);
    }
    Promise.resolve(task)
      .then(request.resolve, request.reject)
      .finally(() => {
        running = false;
        const next = queued;
        queued = null;
        if (next) start(next);
      });
  }

  return (values, algorithmContext = {}) => new Promise((resolve, reject) => {
    const request = {
      values: [...values],
      context: algorithmContext,
      resolve,
      reject,
    };
    if (!running) {
      start(request);
      return;
    }
    dropQueuedRequest();
    queued = request;
  });
}

module.exports = {
  createJavaScriptAlgorithmRunner,
  createPythonAlgorithmRunner,
};
