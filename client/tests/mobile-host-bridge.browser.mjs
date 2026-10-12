import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { FrameDispatcher } from '../../mobile/src/frameDispatcher.ts';

const requireRoot = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = requireRoot('playwright');
const generated = await readFile(new URL('../../mobile/generated/display.ts', import.meta.url), 'utf8');
const literal = generated.match(/export const displayHtml\s*=\s*("[\s\S]*");\s*$/)?.[1];
assert.ok(literal, 'RN 生成模块必须导出离线 HTML 字符串');
const html = JSON.parse(literal);
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const requests = [];
const errors = [];
const messages = [];
let scriptQueue = Promise.resolve();
const host = new FrameDispatcher((script) => { scriptQueue = scriptQueue.then(() => page.evaluate(script)); });
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => requests.push(request.url()));
await page.exposeFunction('forwardNativeMessage', (encoded) => {
  const message = JSON.parse(encoded);
  messages.push(message);
  if (message.type === 'web.ready') host.setReady();
  if (message.type === 'web.frame') host.acknowledge(message.sequence);
});

/** 模拟原生收帧；真实宿主负责序号与 ACK，页面消费生成后的完整离线 HTML。 */
function publish(source, sequence, value) {
  return host.publish({ type: 'pressure.frame', version: 1, source, sequence,
    timestamp: Date.now(), rows: 32, columns: 32, values: Array(1024).fill(value) });
}

try {
  await page.setContent(html.replace('</head>', '<script>window.ReactNativeWebView={postMessage:function(message){window.forwardNativeMessage(message);}};</script></head>'));
  await page.waitForFunction(() => Boolean(window.ShroomMobile));
  await page.waitForTimeout(100);
  await scriptQueue;
  assert.equal(messages.filter((message) => message.type === 'web.ready').length, 1);
  host.reset('usb');
  assert.equal(publish('usb', 0, 200), true);
  assert.equal(publish('usb', 1, 201), true);
  await page.waitForFunction(() => document.querySelector('.mobile-metrics')?.textContent.includes('201'));
  assert.equal(messages.filter((message) => message.type === 'web.frame').length, 2, '当前 ACK 推进宿主待发帧');
  host.reset('demo');
  assert.equal(publish('usb', 2, 202), false, '切源拒绝迟到 USB 事件');
  assert.equal(publish('demo', 0, 66), true);
  await page.waitForFunction(() => document.querySelector('.mobile-stream-status')?.textContent.includes('演示数据'));
  assert.ok((await page.locator('.mobile-metrics').textContent()).includes('66'));
  host.reset(null);
  await page.locator('.mobile-waiting').waitFor();
  assert.ok((await page.locator('.mobile-stream-status').textContent()).includes('尚无数据'));
  assert.ok(!(await page.locator('.mobile-metrics').textContent()).includes('66'), '停止后清空最近压力值');
  assert.equal(publish('demo', 1, 77), false, '停止后不再接受旧来源');
  await scriptQueue;
  assert.deepEqual(messages.filter((message) => message.type === 'web.error'), []);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  console.log(JSON.stringify({ passed: true, generatedHtml: true, ready: 1,
    acknowledgedFrames: messages.filter((message) => message.type === 'web.frame').length,
    networkRequests: 0, errors }));
} finally {
  await browser.close();
}
