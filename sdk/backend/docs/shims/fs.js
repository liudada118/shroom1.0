/**
 * fs.js - 抛错桩，不是垫片
 *
 * **这是文档站的桩，不是 `@shroom/backend` 的要求。**
 *
 * 包里有两处顶层 `require('fs')`：
 *
 * - `processing/configMappingExecutor.js` —— 只有 `loadJsonDefinition()` 用它读配置文件。
 * - `protocol/presets/index.js` —— 扫预设目录。
 *
 * 这两个能力在浏览器里**没有意义**（没有文件系统），文档站也不拿它们做活演示：
 * 预设数据走 Vite 直接 `import` 那些 `.json`，拿到的是同一份真数据。
 *
 * 但打包器会静态解析那两句 require，解析不到 'fs' 就构建失败。所以这里给一个桩，
 * 让**加载**能过、**调用**会响 —— 故意抛而不是返回空值：静默返回空会让页面显示
 * 「0 份预设」，而那比一条明确的错误难查得多。
 *
 * @see ../vite.config.js 里的 alias
 */

function refuse(method) {
  return () => {
    throw new Error(
      `[docs] fs.${method}() 在浏览器里不可用。这是文档站的桩，说明某个页面走到了需要文件系统的分支。`
      + '预设数据请直接 import protocol/presets/*.json，不要走 loadSerialProtocolPresets()。',
    );
  };
}

export const readFileSync = refuse('readFileSync');
export const readdirSync = refuse('readdirSync');
export const existsSync = () => false;
export const statSync = refuse('statSync');
export const writeFileSync = refuse('writeFileSync');
export const mkdirSync = refuse('mkdirSync');

export default {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
};
