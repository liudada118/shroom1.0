const fs = require('fs');
const vm = require('vm');

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

module.exports = {
  createJavaScriptAlgorithmRunner,
};
