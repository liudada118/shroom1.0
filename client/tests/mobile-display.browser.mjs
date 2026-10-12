import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const requireRoot = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = requireRoot('playwright');
const buildFlag = process.argv.indexOf('--build-dir');
const buildDir = resolve(buildFlag < 0 ? join(tmpdir(), 'shroom-mobile-display') : process.argv[buildFlag + 1]);
const htmlFlag = process.argv.indexOf('--generated-html');
const bridgeOnly = process.argv.includes('--bridge-only');
const screenshots = await mkdtemp(join(tmpdir(), 'shroom-mobile-browser-'));
let html;
if (htmlFlag >= 0) {
  const generated = await readFile(resolve(process.argv[htmlFlag + 1]), 'utf8');
  const literal = generated.match(/export const displayHtml\s*=\s*("[\s\S]*");\s*$/)?.[1];
  assert.ok(literal, 'RN 生成模块必须导出离线 HTML 字符串');
  html = JSON.parse(literal);
} else {
  const script = (await readFile(join(buildDir, 'display.js'), 'utf8')).replace(/<\/script/gi, '<\\/script');
  const style = await readFile(join(buildDir, 'style.css'), 'utf8');
  html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${style}</style></head><body><div id="root"></div><script>${script}</script></body></html>`;
}
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errors = [];
const requests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => requests.push(request.url()));

try {
  await page.setContent(html.replace('</head>', `<script>
    window.messages=[];
    window.ReactNativeWebView={postMessage:function(message){messages.push(JSON.parse(message));}};
    window.drawnLabels=[];
    const nativeFillText=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){drawnLabels.push(String(text));return nativeFillText.call(this,text,...args);};
  </script></head>`));
  await page.waitForFunction(() => window.ShroomMobile && window.messages.some((message) => message.type === 'web.ready'));
  await page.locator('.mobile-waiting').waitFor();
  const firstFrame = { type: 'pressure.frame', version: 1,
    source: 'usb', sequence: 0, timestamp: Date.now(), rows: 32, columns: 32,
    values: Array.from({ length: 1024 }, (_, index) => index % 32 < 16 ? 200 : 0) };
  await page.evaluate(`window.ShroomMobile.receive(${JSON.stringify(JSON.stringify(firstFrame))})`);
  await page.waitForFunction(() => document.querySelector('.mobile-stream-status')?.textContent.includes('USB 数据'));
  assert.deepEqual(await page.evaluate(() => window.messages.filter((message) => message.type === 'web.frame')),
    [{ type: 'web.frame', sequence: 0 }], 'JSON 字符串注入必须正确回报帧序号');
  if (!bridgeOnly) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.mobile-renderer canvas');
    const context = canvas?.getContext('2d');
    return context && Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data)
      .some((value, index) => index % 4 !== 3 && value > 0);
  });
  await page.screenshot({ path: join(screenshots, 'heatmap.png') });
  await page.getByRole('button', { name: '原始数字', exact: true }).click();
  await page.waitForFunction(() => window.drawnLabels.includes('200'));
  await page.screenshot({ path: join(screenshots, 'numbers.png') });
  assert.equal(await page.getByRole('button', { name: '原始数字', exact: true }).getAttribute('aria-pressed'), 'true');
  }
  await page.evaluate(() => window.ShroomMobile.receive({ type: 'pressure.frame', version: 1,
    source: 'usb', sequence: 1, timestamp: Date.now(), rows: 32, columns: 32,
    values: [12.5, ...Array(1023).fill(0)] }));
  await page.getByRole('alert').waitFor();
  assert.ok((await page.getByRole('alert').textContent()).includes('整数'), '生成网页拒绝小数压力值');
  assert.ok((await page.locator('.mobile-metrics').textContent()).includes('200'), '错误帧保留上轮合法统计');
  await page.evaluate(() => window.ShroomMobile.receive({ type: 'stream.reset', version: 1, source: 'demo' }));
  await page.locator('.mobile-waiting').waitFor();
  assert.ok(!(await page.locator('.mobile-metrics').textContent()).includes('200'), '切源重置不能残留旧值');
  await page.getByRole('button', { name: '热力图', exact: true }).click();
  await page.evaluate(() => window.ShroomMobile.receive({ type: 'pressure.frame', version: 1,
    source: 'demo', sequence: 0, timestamp: Date.now(), rows: 32, columns: 32, values: Array(1024).fill(60) }));
  await page.waitForFunction(() => document.querySelector('.mobile-stream-status')?.textContent.includes('演示数据'));
  assert.deepEqual(await page.evaluate(() => window.messages.filter((message) => message.type === 'web.frame')),
    [{ type: 'web.frame', sequence: 0 }, { type: 'web.frame', sequence: 0 }], '重置后允许新来源从零计数');
  if (!bridgeOnly) {
  await page.waitForFunction(() => document.querySelector('.mobile-stream-status')?.textContent.includes('数据已暂停'));
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const buttons = await page.getByRole('button').all();
  for (const button of buttons) assert.ok((await button.boundingBox()).height >= 44, '触摸按钮至少 44px');
  await page.screenshot({ path: join(screenshots, 'narrow.png') });
  }
  assert.deepEqual(errors, [], '离线生产入口无未捕获错误');
  assert.deepEqual(requests, [], '展示入口不能依赖网络资源');
  console.log(JSON.stringify({ passed: true, screenshots, networkRequests: requests.length, errors }));
} catch (error) {
  console.error(JSON.stringify({ errors, requests, screenshots }));
  await page.screenshot({ path: join(screenshots, 'failure.png') });
  throw error;
} finally {
  await browser.close();
}
