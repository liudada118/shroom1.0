/**
 * click-check.mjs - 拿真浏览器把十页点一遍
 *
 * ## 为什么 build 和 render-check 不够
 *
 * 这个站有三道关，**互相盖不住**：
 *
 * | 关 | 抓什么 | 抓不到什么 |
 * | :--- | :--- | :--- |
 * | `npm run build` | import 解析不了、CJS 转换失败 | 一切运行期的事 —— 它只打包，不执行 |
 * | `npm run check`（SSR） | 表格从包里读崩、首屏渲染抛错 | 浏览器独有的坑；SSR 跑在 Node 里 |
 * | **这个脚本** | 白屏、拨开关之后才炸的分支、prism 高亮崩 | 长得对不对（那得人眼看） |
 *
 * 这不是假想。写这个站的时候，`logger.js` 和 `processing/lineOrders.js` 顶层读
 * `process.env`，浏览器里没有 `process` —— **四页直接白屏**，而 build 和 SSR 两道关
 * 全是绿的（build 不执行代码，SSR 跑在有 `process` 的 Node 里）。
 * 那个坑是拿浏览器点出来的，修法见 `src/main.jsx`。
 *
 * ## 它顺手把「在线」这件事也验了
 *
 * 脚本不连 dev server，而是**自己起一个静态服务器伺服 `dist/`，并且故意挂在子路径下**
 * （`/some/sub/path/`）。这一步验的是 `vite.config.js` 里的 `base: './'` ——
 * 默认的 `base: '/'` 会把资源写成绝对路径，产物丢进 `http://内网机/shroom-docs/`
 * 就全是 404。一条命令同时证明：产物能跑、子路径能跑、活预览真的活。
 *
 * ## 用法
 *
 * ```bash
 * npm run build && npm run click-check      # 在 sdk/backend/docs 里
 * npm run sdk:backend-docs-click            # 在仓库根上（会先构建）
 * npm run click-check -- http://localhost:5182   # 也可以指着 dev server 点
 * ```
 *
 * `playwright` 是**仓库根**的 devDependency，不是本站的依赖 —— node 会从这个文件所在
 * 目录往上找 node_modules，所以在根上装着就够，站自己不用多背一个 400MB 的依赖。
 * 浏览器也不下载 playwright 自带的 chromium，直接用系统里的 Edge / Chrome。
 */

import { createServer } from 'node:http';
import { access, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { ROUTES } from './src/routes.js';

/** 产物目录。 */
const DIST = fileURLToPath(new URL('./dist', import.meta.url));

/** 故意不是根路径 —— 这就是在验 `base: './'`。 */
const SUBPATH = '/some/sub/path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
};

/**
 * 起一个只读静态服务器，把 `dist/` 挂在 `SUBPATH` 下面。
 *
 * 路径里的 `..` 一律拒掉 —— 这脚本只该读得到 `dist/`。
 *
 * @returns {Promise<{base: string, close: () => Promise<void>, missing: string[]}>}
 *   base 是给浏览器用的完整前缀；missing 收集 404 过的路径（有值就说明 base 配错了）。
 */
async function serveDist() {
  try {
    await access(join(DIST, 'index.html'));
  } catch {
    console.error('没有 dist/index.html —— 先跑 npm run build，或者给个 URL 指着 dev server 点。');
    process.exit(2);
  }

  const missing = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname);

    if (!rel.startsWith(SUBPATH)) {
      res.writeHead(404).end('not under subpath');
      missing.push(rel);
      return;
    }
    rel = rel.slice(SUBPATH.length) || '/';
    if (rel.endsWith('/')) rel += 'index.html';

    const full = join(DIST, normalize(rel));
    if (!full.startsWith(DIST)) {
      res.writeHead(403).end('nope');
      return;
    }
    try {
      const body = await readFile(full);
      res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      missing.push(rel);
      res.writeHead(404).end('not found');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}${SUBPATH}`,
    missing,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/**
 * 用系统装好的浏览器开一个 headless 实例。
 *
 * 顺序是 Edge → Chrome → playwright 自带。前两个 Windows 上基本必有，
 * 这样跑这个脚本不需要先 `npx playwright install` 下 150MB。
 *
 * @returns {Promise<import('playwright').Browser>} 浏览器实例。
 */
async function launchBrowser() {
  const tried = [];
  for (const channel of ['msedge', 'chrome', null]) {
    try {
      const browser = await chromium.launch(channel ? { channel } : {});
      console.log(`浏览器：${channel || 'playwright 自带 chromium'}`);
      return browser;
    } catch (error) {
      tried.push(`${channel || 'bundled chromium'}: ${error.message.split('\n')[0]}`);
    }
  }
  throw new Error(
    `一个浏览器都开不起来，试过：\n  ${tried.join('\n  ')}\n`
    + '装个 Edge/Chrome，或者跑 npx playwright install chromium。',
  );
}

const argBase = process.argv[2];
const served = argBase ? null : await serveDist();
const base = argBase || served.base;
if (served) console.log(`静态服务器：${base}（故意挂在子路径下，验 base: './'）`);

let browser;
try {
  browser = await launchBrowser();
} catch (error) {
  await served?.close();
  console.error(`\n${error.message}`);
  process.exit(2);
}

const page = await browser.newPage();
const problems = [];
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`[console] ${message.text().slice(0, 400)}`);
});
page.on('pageerror', (error) => problems.push(`[pageerror] ${String(error).slice(0, 400)}`));
page.on('requestfailed', (request) => problems.push(`[404?] ${request.url()}`));

let failed = 0;
for (const route of ROUTES) {
  const before = problems.length;
  await page.goto(`${base}/#/${route.id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const text = (await page.textContent('main')) || '';

  // 每个下拉的每个选项都选一遍。37 个线序、18 条命令、57 个传感器全过一遍，
  // 就是这几行在跑 —— 手点没人愿意点第二次。
  const selects = page.locator('main select');
  const nSel = await selects.count();
  let options = 0;
  for (let i = 0; i < nSel; i += 1) {
    const values = await selects.nth(i).locator('option').evaluateAll(
      (els) => els.map((el) => el.value).filter((value) => value !== ''),
    );
    for (const value of values) {
      await selects.nth(i).selectOption(value);
      await page.waitForTimeout(10);
      options += 1;
    }
  }

  // 开关拨到每种组合都碰一遍（采集那页的三条件、协议那页的截断 + 补校验）。
  const boxes = page.locator('main input[type=checkbox]');
  const nBox = await boxes.count();
  for (let i = 0; i < nBox; i += 1) {
    for (const on of [true, false, true]) {
      await boxes.nth(i).setChecked(on);
      await page.waitForTimeout(15);
    }
  }

  // 「显示代码」全按开，确认 prism 高亮不炸、`?raw` 真读到了东西。
  const toggles = page.locator('main .docs-card-toggle');
  const nToggle = await toggles.count();
  for (let i = 0; i < nToggle; i += 1) {
    await toggles.nth(i).click().catch(() => {});
    await page.waitForTimeout(50);
  }

  const after = (await page.textContent('main')) || '';
  // 有 DemoCard 的页面按开源码之后文本必须明显变长 —— 那是 `?raw` 读进来的真源码。
  // 不变长就说明「同一个文件 import 两次」那条承诺断了。
  const codeShown = nToggle === 0 || after.length > text.length * 1.5;
  const fresh = problems.length - before;
  // 白屏的典型长度是几十个字符（只剩壳），正常页面都是四位数。
  const thin = text.length < 400;

  if (fresh || thin || !codeShown) failed += 1;
  console.log(
    `${fresh || thin || !codeShown ? 'FAIL' : ' OK '}  ${route.id.padEnd(12)}`
    + ` ${String(text.length).padStart(6)} → ${String(after.length).padStart(6)} chars`
    + `  ${nSel} 下拉/${options} 选项  ${nBox} 开关  ${nToggle} 源码`
    + `${thin ? '  ← 内容太少，像白屏' : ''}`
    + `${codeShown ? '' : '  ← 显示代码没出源码'}`
    + `${fresh ? `  ← ${fresh} 个运行时错` : ''}`,
  );
}

await browser.close();
await served?.close();

if (served?.missing.length) {
  console.log(`\n${served.missing.length} 个请求 404 了 —— base: './' 可能被改坏了：`);
  [...new Set(served.missing)].slice(0, 10).forEach((path) => console.log(`  ${path}`));
}
if (problems.length) {
  console.log(`\n${problems.length} 个运行时问题：`);
  problems.forEach((problem) => console.log(`  ${problem}`));
}

const bad = failed || problems.length || (served?.missing.length ?? 0);
console.log(bad
  ? `\n${failed} 页有问题`
  : `\n${ROUTES.length} 页点过：没有运行时错误，子路径下资源全部命中`);
process.exit(bad ? 1 : 0);
