import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-small-bed-scene-only-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, '.vite'), logLevel: 'error', server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'small-bed-scene-only-test',
    /** 真实门户加全局工具CSS见证节点，只隔离网络和硬件。 */
    configureServer(vite) {
      vite.middlewares.use('/__small-bed-scene-only', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__small-bed-scene-only', '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><div class="shroom-app-tools" role="group" aria-label="应用工具" style="position:fixed;right:12px;bottom:12px;z-index:1000"><button type="button">外部工具CSS见证</button></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});

/** 读取真实原生模式，隐藏控件时仍可验证其值。 */
async function modeLabel(page) {
  return page.locator('.portal-display-native .ant-select-selection-item').first().innerText();
}

/** 使用正式显示选择器切换原始网格和3D点图。 */
async function chooseMode(page, label) {
  const input = page.getByRole('combobox', { name: '显示方式', exact: true });
  await input.locator('xpath=ancestor::div[contains(@class,"ant-select")]').first().locator('.ant-select-selector').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText(label, { exact: true }).click();
}

/** 检查纯点图状态只剩叉叉可点击，且canvas没有被其它元素挡住。 */
async function inspectSceneOnly(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.portal-runtime-monitor');
    const visible = element => {
      const style = getComputedStyle(element), bounds = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0 && !element.closest('[inert], [aria-hidden="true"]');
    };
    const canvas = root.querySelector('.portal-data-renderer #canvas canvas');
    const bounds = canvas?.getBoundingClientRect();
    const hit = bounds ? document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) : null;
    const close = root.querySelector('.portal-monitor-close');
    const closeBounds = close.getBoundingClientRect();
    return { buttons: [...root.querySelectorAll('button')].filter(visible).map(button => button.getAttribute('aria-label') || button.textContent.trim()),
      canvas: Boolean(canvas), canvasHit: canvas === hit, width: bounds?.width, height: bounds?.height,
      toolsVisible: [...document.querySelectorAll('.shroom-app-tools button')].some(visible),
      sampleRateVisible: [...root.querySelectorAll('.portal-sample-rate')].some(visible),
      closeHit: close.contains(document.elementFromPoint(closeBounds.x + closeBounds.width / 2, closeBounds.y + closeBounds.height / 2)),
      closeInBounds: closeBounds.x >= 0 && closeBounds.right <= innerWidth && closeBounds.y >= 0 && closeBounds.bottom <= innerHeight };
  });
}

let browser, page;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(30000);
  const errors = [], sockets = [], commands = [];
  page.on('pageerror', error => errors.push(error.message));
  const license = { date: Date.now() + 30 * 86400000, nowDate: Date.now(), selectFlag: 'all', valid: true };
  await page.routeWebSocket(/:19999/, socket => {
    sockets.push(socket);
    socket.send(JSON.stringify({ licenseKey: 'fixture-key' })); socket.send(JSON.stringify(license));
  });
  await page.route('http://127.0.0.1:19245/**', route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (route.request().url().endsWith('/api/display-systems')) return route.fulfill({ headers, json: { displaySystems: { runtimeDefinitions: [] } } });
    if (route.request().url().endsWith('/api/algorithm-market')) return route.fulfill({ headers, json: { packages: [], instances: [] } });
    if (route.request().url().endsWith('/api/commands')) {
      const request = route.request().postDataJSON(); commands.push(request);
      const results = request.type === 'license.activate' ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [];
      return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { results } } } });
    }
    return route.fulfill({ headers, json: {} });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__small-bed-scene-only?actual-monitor=1`);
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();

  /** 从正式目录进入，保持真实授权与Home冷启动。 */
  async function enter(system) {
    await page.locator(`[data-system="${system}"]`).click();
    await page.getByRole('button', { name: '进入该系统', exact: true }).click();
    await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor({ timeout: 60000 });
  }

  await enter('smallBedNoAlg');
  assert.equal(await page.locator('.portal-runtime-monitor .setIconItem1').count(), 0, '门户不再挂载旧竖排视角图标');
  await page.getByRole('button', { name: '工具', exact: true }).click();
  await page.getByRole('button', { name: 'X 轴 −30°', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Y 轴/ }).count(), 0, '视角调节取消Y轴旋转');
  await page.getByRole('button', { name: 'X 轴 −30°', exact: true }).click();
  await page.getByRole('button', { name: 'X 轴 +30°', exact: true }).click();
  await page.getByRole('button', { name: '收起实用工具', exact: true }).click();
  assert.equal(await page.locator('.portal-runtime-monitor .setIconItem1').count(), 0, '关闭工具箱后旧图标也不能重新出现');
  await page.screenshot({ path: join(artifacts, 'monitor-without-floating-icons.png') });
  await chooseMode(page, '原始数据');
  assert.equal(await modeLabel(page), '原始数据');
  await page.getByRole('group', { name: '应用工具', exact: true }).waitFor();
  await page.getByRole('button', { name: '算法', exact: true }).click();
  const only = page.getByRole('button', { name: '仅显示3D点图', exact: true });
  await only.click();
  await page.locator('.portal-runtime-monitor.is-scene-only .portal-data-renderer #canvas canvas').waitFor();
  assert.equal(await modeLabel(page), '3D 模型');
  let state = await inspectSceneOnly(page);
  assert.deepEqual(state.buttons, ['退出监测返回系统列表']);
  assert.equal(state.canvasHit, true); assert.equal(state.toolsVisible, false); assert.equal(state.closeHit, true);
  assert.equal(state.sampleRateVisible, false, '纯点图不保留采样频率文字');
  assert.ok(state.width >= 1438 && state.height >= 898, JSON.stringify(state));
  await page.screenshot({ path: join(artifacts, 'scene-only-desktop.png') });
  await page.keyboard.press('Escape');
  await page.locator('.portal-runtime-monitor:not(.is-scene-only)').waitFor();
  assert.equal(await modeLabel(page), '原始数据');
  assert.equal(await only.evaluate(element => element === document.activeElement), true, 'Esc恢复入口焦点');
  assert.equal(await page.getByRole('group', { name: '应用工具', exact: true }).isVisible(), true);

  await chooseMode(page, '3D 模型');
  const pointCanvas = await page.locator('.portal-data-renderer #canvas canvas').elementHandle();
  await only.click();
  assert.equal(await pointCanvas.evaluate(element => element === document.querySelector('.portal-data-renderer #canvas canvas')), true, '已有3D视图不能因隐藏重建');
  let sequence = 0;
  /** 注入隔离标准帧，验证隐藏图表后真实点图继续接收压力数据。 */
  async function sendFrame(pressure) {
    const frame = JSON.stringify({ type: 'sensor.frame', schemaVersion: 1, channelId: 'smallBedNoAlg:sit', displaySystemId: 'smallBedNoAlg',
      sensorId: 'sit', sensorLabel: '测试小床', outputChannel: 'sit', sensorType: 'smallBedNoAlg', source: 'realtime',
      sequence: ++sequence, timestamp: Date.now(), quality: 'good', payload: { value: Array(1024).fill(pressure), matrix: { rows: 32, cols: 32, total: 1024 } } });
    for (const socket of sockets) { try { socket.send(frame); } catch {} }
    await page.waitForTimeout(250);
  }
  await sendFrame(0);
  const before = createHash('sha256').update(await page.locator('.portal-data-renderer #canvas canvas').screenshot()).digest('hex');
  await sendFrame(180);
  const after = createHash('sha256').update(await page.locator('.portal-data-renderer #canvas canvas').screenshot()).digest('hex');
  assert.notEqual(after, before, '隐藏期间压力输入必须改变真实3D像素');
  assert.equal(await pointCanvas.evaluate(element => element === document.querySelector('.portal-data-renderer #canvas canvas')), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.portal-monitor-close').evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Escape');
  assert.equal(await modeLabel(page), '3D 模型', '原本3D模式恢复后仍保持3D');

  await page.setViewportSize({ width: 375, height: 812 });
  const bounds = await only.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 375, '窄屏新增按钮不溢出');
  await only.click();
  state = await inspectSceneOnly(page);
  assert.deepEqual(state.buttons, ['退出监测返回系统列表']);
  assert.equal(state.closeInBounds, true); assert.equal(state.closeHit, true); assert.equal(state.canvasHit, true);
  assert.equal(state.sampleRateVisible, false);
  await page.screenshot({ path: join(artifacts, 'scene-only-mobile.png') });
  await page.getByRole('button', { name: '退出监测返回系统列表', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await enter('smallBedNoAlg');
  assert.equal(await page.locator('.portal-runtime-monitor.is-scene-only').count(), 0, '重新进入不保留隐藏状态');
  assert.equal(await only.isVisible(), true);
  await page.getByRole('button', { name: '退出监测返回系统列表', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await enter('hand');
  assert.equal(await only.count(), 0, '其它系统不显示小床专用入口');
  assert.equal(await page.getByRole('group', { name: '应用工具', exact: true }).isVisible(), true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', artifacts, commands: commands.length, actualDevice: false }));
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('SMALL_BED_SCENE_ONLY_FAILED', artifacts);
  throw error;
} finally { await browser?.close(); await server.close(); }
