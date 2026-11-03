const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { runDataWorkflow } = require('./data-workflow.cjs');

const [appRootArg, outputDir] = process.argv.slice(2);
const appRoot = path.resolve(appRootArg);
const originalResolve = Module._resolveFilename;
const loaded = new Set();

/** 限制依赖来自指定产物，缺包时不能借用工作区的 node_modules。 */
function insideTarget(filename) {
  const relative = path.relative(appRoot, filename);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
    || filename.startsWith(`${appRoot}.unpacked${path.sep}`);
}

Module._resolveFilename = function resolveTargetOnly(...args) {
  const resolved = originalResolve.apply(this, args);
  if (path.isAbsolute(resolved)) {
    if (!insideTarget(resolved)) throw new Error(`ACCEPTANCE_DEPENDENCY_OUTSIDE_TARGET: ${resolved}`);
    loaded.add(path.relative(appRoot, resolved));
  }
  return resolved;
};

/** 从目标包根目录加载生产模块；不允许路径穿越或绝对路径。 */
function loadApp(relative) {
  const filename = path.resolve(appRoot, relative);
  if (path.isAbsolute(relative) || !insideTarget(filename)) throw new Error('Invalid target module path');
  if (!fs.existsSync(filename)) throw new Error(`ACCEPTANCE_API_UNAVAILABLE: target version does not provide ${relative}; this workflow cannot be verified`);
  return require(filename);
}

/** 无论链路通过还是失败，都写出运行时、模块来源与测试结果。 */
async function main() {
  const result = { scope: 'production-components-with-simulated-serial', appRoot,
    runtime: { executable: process.execPath, electron: process.versions.electron, node: process.versions.node, abi: process.versions.modules } };
  try {
    if (!process.versions.electron) throw new Error('Electron Node ABI is required');
    result.details = await runDataWorkflow({ loadApp, outputDir });
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.error = { message: error.message, stack: error.stack, details: error.details };
    process.exitCode = 1;
  } finally {
    Module._resolveFilename = originalResolve;
    result.loadedModules = [...loaded].sort();
    fs.writeFileSync(path.join(outputDir, 'components.json'), JSON.stringify(result, null, 2));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
