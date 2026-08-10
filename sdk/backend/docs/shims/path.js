/**
 * path.js - 第四个桩，理由和 `fs.js` 一样
 *
 * **这是文档站的桩，不是 `@shroom/backend` 的要求。**
 *
 * 包里有两处顶层 `require('path')`：
 *
 * - `logger.js:24` —— 声明了但全文没用到（真正写文件的是 `fs.createWriteStream`）。
 * - `protocol/presets/index.js:16` —— 拼预设目录路径，配合 `fs.readdirSync` 扫盘。
 *
 * 两处在浏览器里都到不了（预设走 `import.meta.glob`，见 `demos/ProtocolDecoder.jsx`）。
 * 不配这个 alias 也能构建 —— Vite 会自动 externalize 并打一条警告，
 * 运行到才炸。配上它是为了**让构建输出干净**：一条常驻警告等于没有警告，
 * 真出问题时没人会注意到多了一条。
 *
 * 和 `fs.js` 同样的取舍：故意抛，不返回空串。静默返回 `''` 会让路径拼接
 * 悄悄退化成相对路径，比一条明确的错难查得多。
 *
 * @see ../vite.config.js 里的 alias
 * @see ./fs.js
 */

function refuse(method) {
  return () => {
    throw new Error(
      `[docs] path.${method}() 在浏览器里不可用。这是文档站的桩，`
      + '说明某个页面走到了需要文件系统路径的分支（多半是 loadSerialProtocolPresets()）。',
    );
  };
}

export const join = refuse('join');
export const resolve = refuse('resolve');
export const dirname = refuse('dirname');
export const basename = refuse('basename');
export const extname = refuse('extname');
export const sep = '/';

export default { basename, dirname, extname, join, resolve, sep };
