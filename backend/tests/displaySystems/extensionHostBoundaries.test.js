const assert = require('assert');
const fs = require('fs');
const path = require('path');

const hostRoot = path.resolve(__dirname, '../../extension-host');

/**
 * 递归收集目录下所有 `.js` 文件的绝对路径。
 *
 * 静态扫源码而不 require —— require 会执行模块并连带拉进依赖，就分不清谁 import 了谁。
 *
 * @param {string} directory 起始目录（绝对路径）。
 * @returns {string[]} 所有 .js 文件的绝对路径。
 */
function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listJavaScriptFiles(entryPath) : entryPath.endsWith('.js') ? [entryPath] : [];
  });
}

/**
 * 取出一个文件里所有**相对路径** `require` 的请求串。
 *
 * 只认 `./` 和 `../` 开头的；包名 require（`fs`、`@shroom/backend/...`）不管，
 * 本测试只守 extension-host 内部分层。
 *
 * @param {string} filePath 要扫的文件绝对路径。
 * @returns {string[]} 原始请求串，如 `'../runtime/foo'`。
 */
function relativeImports(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  return [...source.matchAll(/require\(['"](\.{1,2}\/[^'"]+)['"]\)/g)].map((match) => match[1]);
}

/**
 * 断言某个子目录**不依赖**另外几个子目录，守住 extension-host 的单向分层
 * （`manifest` ← `workspace` ← `runtime`，下层不能反向引用上层）。
 *
 * 用法：`assertNoImports('manifest', ['runtime', 'workspace'])`。
 * 请求串会先 resolve 成绝对路径再比，所以 `../runtime/x` 和绕远的写法都能抓到；
 * 判前缀时拼上路径分隔符，避免 `runtime` 误命中 `runtimeHelpers`。
 *
 * @param {string} directoryName 被检查的子目录名（相对 hostRoot）。
 * @param {string[]} forbiddenSegments 不允许被依赖的子目录名。
 * @throws {AssertionError} 发现反向依赖时抛，信息里带文件名和 require 串。
 */
function assertNoImports(directoryName, forbiddenSegments) {
  const directory = path.join(hostRoot, directoryName);
  for (const filePath of listJavaScriptFiles(directory)) {
    for (const request of relativeImports(filePath)) {
      const resolved = path.normalize(path.resolve(path.dirname(filePath), request));
      for (const segment of forbiddenSegments) {
        const forbiddenRoot = path.normalize(path.join(hostRoot, segment));
        assert(
          resolved !== forbiddenRoot && !resolved.startsWith(`${forbiddenRoot}${path.sep}`),
          `${path.relative(hostRoot, filePath)} must not depend on ${segment}: ${request}`,
        );
      }
    }
  }
}

assertNoImports('manifest', ['runtime', 'workspace']);
assertNoImports('workspace', ['runtime']);

for (const filePath of [
  path.join(hostRoot, 'appRuntimeFactory.js'),
  path.join(hostRoot, 'runtime/displaySystemRuntimeFactory.js'),
]) {
  assert(
    !relativeImports(filePath).some((request) => /(?:^|\/)index$/.test(request)),
    `${path.relative(hostRoot, filePath)} must import internal modules directly instead of the public index`,
  );
}

console.log('extension-host dependency boundaries tests passed');
