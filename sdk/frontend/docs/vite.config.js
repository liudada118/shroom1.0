/**
 * vite.config.js - 文档站的构建配置
 *
 * 比 `example/vite.config.js` 多两条，各有各的理由。
 *
 * ## `resolve.dedupe` —— 和 example 同一条，理由也同一套
 *
 * 包是 `file:..` 装进来的，node_modules 里是 symlink，真实路径在 `docs/` 之外。
 * 不 dedupe 的话包内那句裸 `import * as THREE from 'three'` 要么解析不到，
 * 要么解析出第二份 —— 两份 React 让 hooks 直接崩，两份 three 让
 * `instanceof THREE.Xxx` 全部失效。**这条是消费者义务，不是本站特有的配置**，
 * 所以 `pages/Pitfalls.jsx` 会把它当第一条讲。
 *
 * ## `server.fs.allow: ['..']` —— 为了 `?raw` 引 example 的真文件
 *
 * 「快速开始」页显示的源码不是抄的，是 `import src from '../../../example/src/main.jsx?raw'`
 * —— 显示的就是 `example/` 里那个真跑着的文件。它在项目根之外，Vite 默认
 * 拒绝读，要显式放行。放行范围是 `sdk/frontend/`，不是整个仓库。
 *
 * ## `base: './'` —— 产物挂到任意子路径都能开
 *
 * 默认的 `/` 会让 `dist/index.html` 里的资源引用写成绝对路径，丢进
 * `http://内网机/shroom-docs/` 这种子路径就全 404。`'./'` 让它变成相对路径。
 * 现在只跑本地 / 内网，但这一条现在写好，以后挂到哪都不用改代码。
 *
 * ## 不需要的东西
 *
 * - **不需要 `optimizeDeps.include`。** linked 依赖默认不预构建，改包内文件
 *   立刻热更新 —— 一边写包一边看文档站正想要这个行为。
 * - **不需要全局 `.js` → jsx loader。** 包里带 JSX 的文件都是 `.jsx` 后缀。
 */

import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/** `sdk/frontend/` 的绝对路径 —— `?raw` 跨目录读 example 时的放行边界。 */
const packageRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
  },
  server: {
    port: 5181,
    fs: {
      // 只放到包根，不是仓库根。文档站没有任何理由读 `client/` 或 `backend/`。
      allow: [packageRoot],
    },
  },
});
