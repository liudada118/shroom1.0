/**
 * vite.config.js - 后端文档站的构建配置
 *
 * 这份配置和前端文档站（`sdk/frontend/docs/vite.config.js`）最大的不同，来自一个
 * 无法回避的事实：**`@shroom/backend` 是 CommonJS，而且是给 Node 用的。**
 * 把它的纯计算层塞进浏览器跑活预览，要付两笔代价，下面两节各解释一笔。
 *
 * ## 代价一：`optimizeDeps.include` —— 不列进来，CJS 在浏览器里直接崩
 *
 * 包是 `file:..` 装进来的，node_modules 里是 symlink。Vite **默认不预构建 linked 依赖**
 * —— 对前端那个 ESM 包这是优点（改包内文件立刻热更新），但对 CJS 是致命的：
 * 不预构建就等于把 `module.exports = {...}` 原样丢给浏览器，`module` 未定义，页面白屏。
 *
 * 所以这里必须**显式列出**每一个会被 import 的子路径，强制 esbuild 把它们转成 ESM。
 * 加一页用到新的子模块，就要往这个数组里加一行 —— 麻烦，但漏了会在浏览器里立刻白屏，
 * 不会悄悄错。
 *
 * 生产构建走的是另一条路（Vite 内置的 `@rollup/plugin-commonjs`），
 * `build.commonjsOptions.include` 把包放行给它。
 *
 * ## 代价二：四个 node 内置模块的 alias
 *
 * 包里有四处顶层 `require` 了 node 内置模块。它们在 Node 里理所当然，在浏览器里不存在：
 *
 * | 模块 | 谁需要 | 换成什么 |
 * | :--- | :--- | :--- |
 * | `events` | `telemetry/channelBus.js` 的 EventEmitter | `shims/events.js`，只实现用到的 4 个方法 |
 * | `crypto` | `contract/commandProtocol.js` 生成 requestId | `shims/crypto.js`，转发浏览器原生 crypto |
 * | `fs` | `configMappingExecutor.js`、`presets/index.js` | `shims/fs.js`，**抛错桩**，不是垫片 |
 * | `path` | `logger.js`（声明了没用）、`presets/index.js` | `shims/path.js`，同样是抛错桩 |
 *
 * 还有两处是**全局标识符**而不是 import，alias 管不了，得在 `src/main.jsx` 里挂进
 * `globalThis`：`Buffer`（解码时 `Buffer.from()`）和 `process`（`logger.js` 与
 * `processing/lineOrders.js` 顶层读 `process.env`）。后者少了就是整页白屏，
 * 而且 `build` 和 SSR 检查都抓不到 —— 见 `main.jsx` 里的说明。
 *
 * **这些垫片是文档站的代价，不是包的要求。** 站上「坑与已知妥协」那页会明说这件事 ——
 * 不说清楚，读者会以为在浏览器里用这个 SDK 是被支持的（不是，串口 / SQLite / CSV
 * 那几层根本没法跑）。
 *
 * ## 和前端站相同的三条
 *
 * - `base: './'` —— 产物挂到任意子路径都能开。默认的 `/` 会写绝对路径，
 *   丢进 `http://内网机/shroom-docs/` 就全 404。
 * - `server.fs.allow` 只放到**包根**（`sdk/backend/`），不是仓库根。文档站要 `?raw`
 *   读 `examples/quickstart.js`，那在 `docs/` 之外，得显式放行；但它没有任何理由读
 *   `client/` 或 `backend/`。
 * - 端口和前端站错开（5181 → 5182），两个站可以同时开着对照。
 */

import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/** `sdk/backend/` 的绝对路径 —— `?raw` 跨目录读 examples 时的放行边界。 */
const packageRoot = fileURLToPath(new URL('..', import.meta.url));

/** `docs/shims/` 的绝对路径。 */
const shim = (name) => fileURLToPath(new URL(`./shims/${name}.js`, import.meta.url));

/**
 * 会在浏览器里被 import 的包内子路径。
 *
 * 只列**纯计算**的那些。`serial` / `storage` / `export` / `client` / `session`
 * 不在这里，也不该在 —— 它们要 serialport / better-sqlite3 / csv-writer / ws，
 * 浏览器里没有，站上只展示源码。
 */
/**
 * 包里**能在浏览器里跑**的目录。既用来生成 CJS 转换的匹配规则，也是「哪些层是纯计算」
 * 这件事的唯一声明处。
 */
const BROWSER_SAFE_DIRS = ['processing', 'contract', 'sensors', 'telemetry', 'collection', 'protocol'];

/**
 * 生产构建时，哪些文件要交给 commonjs 插件。
 *
 * **这条规则匹配的是真实路径，不是包名。** `file:..` 装出来的是软链，rollup 解析后
 * 拿到的 id 是 `…/sdk/backend/processing/lineOrders.js` —— 里面根本没有 `@shroom/backend`
 * 这几个字。按包名写规则的话，构建会以 `"default" is not exported by …` 报错
 * （问是问 lineOrders.js 要 default，但它压根没被转成 ESM）。
 *
 * 只圈到上面那几个子目录，不是整个包根：`docs/` 自己也在包根下面，
 * 圈进去等于让 commonjs 插件去处理本站的 ESM 源码。
 */
const PACKAGE_CJS = [
  new RegExp(`[\\\\/]sdk[\\\\/]backend[\\\\/](${BROWSER_SAFE_DIRS.join('|')})[\\\\/]`),
  /[\\/]sdk[\\/]backend[\\/]logger\.js$/,
  // npm 在某些环境下不建软链而是整包复制，那时 id 里就有包名了。两种都盖住。
  /@shroom[\\/]backend/,
];

const PACKAGE_ENTRIES = [
  '@shroom/backend/contract',
  '@shroom/backend/contract/sdkApiContract.js',
  '@shroom/backend/contract/commandProtocol.js',
  '@shroom/backend/sensors',
  '@shroom/backend/telemetry',
  '@shroom/backend/collection',
  '@shroom/backend/protocol/displaySystemProtocol.js',
  '@shroom/backend/processing/lineOrders.js',
  '@shroom/backend/processing/matrixTransforms.js',
  '@shroom/backend/processing/pressureTransforms.js',
  '@shroom/backend/processing/mathUtils.js',
  '@shroom/backend/processing/lineOrderMapper.js',
  '@shroom/backend/processing/interpolationAlgorithms.js',
];

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      events: shim('events'),
      crypto: shim('crypto'),
      fs: shim('fs'),
      path: shim('path'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // 见顶部「代价一」。漏一个 → 浏览器白屏，不会静默出错。
    include: PACKAGE_ENTRIES,
  },
  build: {
    commonjsOptions: {
      // linked 包不在 node_modules 的真实路径下，默认不被 commonjs 插件处理。
      // `/node_modules/` 是 Vite 的默认值，显式写回来 —— 一旦传了 include 就是整个覆盖。
      include: [...PACKAGE_CJS, /node_modules/],
    },
  },
  server: {
    port: 5182,
    fs: {
      allow: [packageRoot],
    },
  },
});
