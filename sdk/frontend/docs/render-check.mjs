/**
 * render-check.mjs - 把每一页在 Node 里渲染一遍
 *
 * 用法：`npm run check`（在 `sdk/frontend/docs/` 下）
 *
 * ## 为什么 build 通过还不够
 *
 * `npm run build` 只证明**能打出包**。页面里那些
 * `listRenderers()` / `deriveGrid()` / `validateRendererDescriptor()`
 * 是**渲染时**才执行的 —— 表格数据全部从 `core` 读，这正是本站的立身之本，
 * 也正是构建期看不见的地方。改一个 core 常量把某张表读崩了，build 照样绿。
 *
 * 所以这个脚本走 Vite 的 SSR 通道，逐页 `renderToStaticMarkup`。
 * 它替代的是验收清单里那条「逐页点过」——**但只替代了一半**：
 * 它证明页面不崩、表格能渲染，证明不了 WebGL 画面真的画出了东西。
 * 那部分仍然要在浏览器里看（尤其是「一览」那页的上下文限流）。
 *
 * 页面链路会碰 `window` / `ResizeObserver` / `IntersectionObserver`，
 * 下面造了最小垫片。**垫片只为让渲染跑完，不是在验证浏览器行为。**
 */
import React from 'react';
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';

// 页面链路会碰到这几个浏览器 API。造最小垫片 —— 目的是抓页面自己的逻辑错。
globalThis.window = globalThis.window || {
  innerWidth: 1440, innerHeight: 900, addEventListener() {}, removeEventListener() {},
};
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.IntersectionObserver = class { observe() {} disconnect() {} };

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  // 关掉依赖预打包：SSR 通道用不上它，但它会在后台跑 esbuild，
  // 脚本 close() 时那个任务被打断，于是刷一条 "The build was canceled"。
  // 那条不是失败，只是噪音 —— 而这个站的规矩是控制台必须干净。
  optimizeDeps: { noDiscovery: true, include: [] },
});

const { ROUTES } = await server.ssrLoadModule('/src/routes.js');
const { registerBuiltinRenderers } = await server.ssrLoadModule('@shroom/frontend/react');
registerBuiltinRenderers();
await server.ssrLoadModule('/src/demos/registerHeatBars.js');

let bad = 0;
for (const route of ROUTES) {
  try {
    // 直接调路由自己的 load()：Vite 的 SSR transform 会把 import() 改写掉，
    // 从 toString() 里抠路径抠不到。调 load() 反而更真 —— 走的就是站点那条路。
    const mod = await route.load();
    const html = renderToStaticMarkup(React.createElement(mod.default));
    console.log(`  OK   ${route.id.padEnd(14)} ${String(html.length).padStart(6)} chars  ${route.title}`);
  } catch (error) {
    bad += 1;
    console.log(`  FAIL ${route.id.padEnd(14)} ${error.message}`);
    if (process.env.VERBOSE) console.log(error.stack);
  }
}

await server.close();
console.log(bad ? `\n${bad} 页渲染失败` : `\n${ROUTES.length} 页全部渲染通过`);
process.exit(bad ? 1 : 0);
