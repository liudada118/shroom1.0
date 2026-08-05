/**
 * vite.config.js - demo 的构建配置
 *
 * 这份配置刻意写得**最短**：它同时是「二开者要抄的那段」。除了 react 插件，
 * 只有一件事是必须的 —— `resolve.dedupe`。
 *
 * ## 为什么 dedupe 不能省
 *
 * `@shroom/frontend` 是 `file:..` 装进来的，node_modules 里是个 symlink，真实
 * 路径在 `example/` 之外。Vite/Node 从真实路径向上找 `node_modules` 会走到
 * `sdk/frontend/` 再到仓库根，**那两级都没有 react 和 three**。于是包内那句裸
 * `import * as THREE from 'three'` 要么解析不到，要么（消费者恰好也有一份时）
 * 解析出第二份。
 *
 * dedupe 一条解决两件事：
 * 1. 让包内的裸 `react` / `three` import 指到 `example/node_modules` 这一份；
 * 2. 保证全应用只有一份 —— 两份 React 会让 hooks 直接崩，两份 three 会让
 *    `instanceof THREE.Xxx` 全部失效（sprite3d 后端到处在用）。
 *
 * `client/vite.config.js` 里有同样的一条，注释也是同一套理由。用别的打包器
 * （webpack `resolve.alias` / rollup `dedupe`）的话要各自找对应写法。
 *
 * ## 不需要的东西（对比 client/vite.config.js）
 *
 * - **不需要全局 `.js` → jsx loader。** 包里唯一带 JSX 的文件是 `.jsx` 后缀，
 *   `backends/sprite3d.js` 是纯 three 代码。主应用那条 `optimizeDeps.esbuildOptions`
 *   是为了它自己 500 多个 `.js` 里写 JSX 的历史遗留，与本包无关。
 * - **不需要 `optimizeDeps.include`。** linked 依赖默认不做预构建，源码直接过
 *   Vite 的转换管线，改包内文件立刻热更新 —— 开发本包时正想要这个行为。
 */

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
  },
  server: {
    port: 5180,
  },
});
