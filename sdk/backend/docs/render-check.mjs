/**
 * render-check.mjs - 把每一页在 Node 里渲染一遍
 *
 * 用法：`npm run check`（在 `sdk/backend/docs/` 下），或仓库根的
 * `npm run sdk:backend-docs-check`。
 *
 * ## 为什么 build 通过还不够
 *
 * `npm run build` 只证明**能打出包**。而这个站几乎每一页的表格都是**渲染时**
 * 才从 `@shroom/backend` 里读出来的 —— `probeLineOrders()` 会把 37 个导出各调一次、
 * 传感器页会遍历 57 条定义、契约页会摊开 `HTTP_ROUTES`。
 * 往包里改一个常量把某张表读崩，build 照样绿。
 *
 * 后端站比前端站更吃这一条：前端站的表格读的是几个常量对象，后端站是**真的在调函数**。
 *
 * 所以这个脚本走 Vite 的 SSR 通道，逐页 `renderToStaticMarkup`。
 * 它替代的是验收清单里那条「逐页点过」——**但只替代了一半**：它证明页面不崩、
 * 表格能渲染，证明不了热力图真的画出了形状、下拉换一项画面真的变。那部分仍要在浏览器里看。
 *
 * ## 这个检查跑的是 Node 版的包，不是浏览器版的
 *
 * `@shroom/backend` 是 CJS，在 SSR 里被 external 掉，由 Node 的 `require` 原样加载。
 * 也就是说这里的 `fs` / `crypto` / `events` 是**真的 node 内置模块**，
 * 不是 `vite.config.js` 里那三个浏览器垫片。
 *
 * 试过反过来（`ssr.noExternal` 把包拉进 Vite 管道好让 alias 生效），走不通：
 * Vite 的 SSR 转换只认 ESM，CJS 进去第一句 `require` 就是 `require is not defined`。
 * CJS→ESM 那一步只发生在 client 的 `optimizeDeps` 和生产构建的 commonjs 插件里。
 *
 * 所以这个脚本抓的是**页面逻辑和包数据**的错，抓不到「只在浏览器里才炸」的那类
 * —— 典型是某页走到了需要文件系统的分支（`shims/fs.js` 会抛，Node 下却正常返回）。
 * 那类只能靠浏览器里点一遍。
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// 页面链路会碰到这几个浏览器 API。造最小垫片 —— 目的是抓页面自己的逻辑错。
globalThis.window = globalThis.window || {
  innerWidth: 1440,
  innerHeight: 900,
  location: { hash: '' },
  addEventListener() {},
  removeEventListener() {},
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
  // 必须显式写。Vite 的 SSR **默认不 external 掉 linked 依赖** —— 对 ESM 的包这是优点
  // （改包内文件立刻生效），对 CJS 就是上面说的那条死路。
  ssr: { external: ['@shroom/backend'] },
});

const { ROUTES } = await server.ssrLoadModule('/src/routes.js');

let bad = 0;
for (const route of ROUTES) {
  try {
    // 直接调路由自己的 load()：Vite 的 SSR transform 会把 import() 改写掉，
    // 从 toString() 里抠路径抠不到。调 load() 反而更真 —— 走的就是站点那条路。
    const mod = await route.load();
    const html = renderToStaticMarkup(React.createElement(mod.default));
    console.log(`  OK   ${route.id.padEnd(16)} ${String(html.length).padStart(7)} chars  ${route.title}`);
  } catch (error) {
    bad += 1;
    console.log(`  FAIL ${route.id.padEnd(16)} ${error.message}`);
    if (process.env.VERBOSE) console.log(error.stack);
  }
}

await server.close();
console.log(bad ? `\n${bad} 页渲染失败` : `\n${ROUTES.length} 页全部渲染通过`);
process.exit(bad ? 1 : 0);
