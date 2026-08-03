const fs = require('fs');
const vm = require('vm');

function getDefaultPythonCaller() {
  return require('../python/pyWorker').callPy;
}

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
 * Python 算法通过常驻 worker 执行。每个算法运行器最多保留一个正在执行的帧和一个最新等待帧，
 * 防止高频串口数据在 Python 处理速度不足时形成无界队列。
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

  function dropQueuedRequest() {
    if (!queued) return;
    const error = new Error('newer Python algorithm frame replaced the queued frame');
    error.code = 'DISPLAY_ALGORITHM_FRAME_DROPPED';
    queued.reject(error);
    queued = null;
  }

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
