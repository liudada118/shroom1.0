import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { FrameDispatcher } from '../../mobile/src/frameDispatcher.ts';
import { parseUsbCommand, serializeHostState } from '../../mobile/src/hostControl.ts';

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
const commands = [];
let deviceState = { status: '等待连接', error: '', devices: [], selectedDevice: undefined,
  baudRate: 1000000, busy: false, frameCount: 0, source: null };
let scriptQueue = Promise.resolve();
const host = new FrameDispatcher((script) => { scriptQueue = scriptQueue.then(() => page.evaluate(script)); });
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => { if (!/^(data|blob):/.test(request.url())) requests.push(request.url()); });
await page.exposeFunction('forwardNativeMessage', (encoded) => {
  const message = JSON.parse(encoded);
  messages.push(message);
  if (message.type === 'web.ready') host.setReady();
  if (message.type === 'web.frame') host.acknowledge(message.sequence);
  if (message.type === 'usb.command') {
    const command = parseUsbCommand(encoded);
    commands.push(command);
    if (command.action === 'refresh') deviceState = { ...deviceState,
      devices: [{ id: 'ch340-test', name: 'Shroom CH340', vendorId: 6790, productId: 29987 }], selectedDevice: 'ch340-test' };
    if (command.action === 'connect') deviceState = { ...deviceState, status: 'USB 已连接，等待压力帧', source: 'usb', baudRate: command.baudRate };
    if (command.action === 'disconnect') { host.reset(null); deviceState = { ...deviceState, source: null, status: '等待连接' }; }
    scriptQueue = scriptQueue.then(() => page.evaluate(serializeHostState(deviceState)));
  }
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
  await page.getByRole('heading', { name: 'Shroom Vision', exact: true }).waitFor();
  await page.getByRole('button', { name: '选择系统', exact: true }).click();
  await page.getByRole('heading', { name: '选择你的展示系统' }).waitFor();
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.getByRole('button', { name: '热力图', exact: true }).click();
  await page.getByRole('button', { name: '连接设备', exact: true }).click();
  await page.getByRole('button', { name: '刷新 USB', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('select[aria-label="USB 设备"]')?.value === 'ch340-test');
  await page.getByRole('textbox', { name: '串口波特率' }).fill('921600');
  await page.getByRole('button', { name: '连接 USB', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.mobile-host-status')?.textContent.includes('USB 已连接'));
  assert.equal(commands[0].action, 'refresh');
  assert.deepEqual({ action: commands[1].action, deviceId: commands[1].deviceId, baudRate: commands[1].baudRate },
    { action: 'connect', deviceId: 'ch340-test', baudRate: 921600 }, '真实页面控件传递所选端口及波特率');
  await page.getByRole('button', { name: '关闭设备与显示设置', exact: true }).click();
  host.reset('usb');
  assert.equal(publish('usb', 0, 200), true);
  assert.equal(publish('usb', 1, 201), true);
  await page.waitForFunction(() => document.querySelector('.mobile-metrics')?.textContent.includes('201'));
  assert.equal(messages.filter((message) => message.type === 'web.frame').length, 2, '当前 ACK 推进宿主待发帧');
  host.reset('demo');
  assert.equal(publish('usb', 2, 202), false, '切源拒绝迟到 USB 事件');
  assert.equal(publish('demo', 0, 66), true);
  await page.waitForFunction(() => document.querySelector('.mobile-stream-status')?.textContent.includes('演示数据'));
  await page.waitForFunction(() => document.querySelector('.mobile-metrics')?.textContent.includes('66'));
  assert.ok((await page.locator('.mobile-metrics').textContent()).includes('66'));
  host.reset(null);
  await page.locator('.mobile-waiting').waitFor();
  assert.ok((await page.locator('.mobile-stream-status').textContent()).includes('尚无数据'));
  assert.ok(!(await page.locator('.mobile-metrics').textContent()).includes('66'), '停止后清空最近压力值');
  assert.equal(publish('demo', 1, 77), false, '停止后不再接受旧来源');
  await page.getByRole('button', { name: '退出监测返回系统列表', exact: true }).click();
  await page.getByRole('heading', { name: '选择你的展示系统' }).waitFor();
  assert.equal(commands.at(-1).action, 'disconnect', '返回列表必须通知原生层停止');
  await scriptQueue;
  assert.deepEqual(messages.filter((message) => message.type === 'web.error'), []);
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
  console.log(JSON.stringify({ passed: true, generatedHtml: true, ready: 1,
    acknowledgedFrames: messages.filter((message) => message.type === 'web.frame').length,
    networkRequests: 0, errors }));
} finally {
  await page.close();
  await browser.close();
}
