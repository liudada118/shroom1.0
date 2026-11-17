import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-monitor-frame-cost-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, '.vite'), logLevel: 'error', server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'monitor-frame-cost-test', enforce: 'pre',
    /** 只在测试里给门户根组件加渲染计数，不改它的状态、回调或渲染结果。 */
    transform(source, id) {
      if (!id.replaceAll('\\', '/').split('?')[0].endsWith('/page/licensePortal/LicensePortal.jsx')) return null;
      const hook = 'export default function LicensePortal({ prepareSystem = loadMonitoringPage }) {';
      assert.ok(source.includes(hook), 'LicensePortal render hook must match the component');
      return source.replace(hook, `${hook}\n  window.__portalRenders = (window.__portalRenders || 0) + 1;`);
    },
    /** 真实门户加真实 Home，只隔离网络和硬件。 */
    configureServer(vite) {
      vite.middlewares.use('/__monitor-frame-cost', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__monitor-frame-cost', '<html><head><meta charset="utf-8"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});

let browser, page;
const sockets = new Set();
let sequence = 0;

/** 投递手部系统的规范帧；前 64 点同值，侧栏压力总和可预期。 */
function sendFrame(pressure) {
  const frame = JSON.stringify({ type: 'sensor.frame', schemaVersion: 1, source: 'realtime', displaySystemId: 'hand', sensorType: 'hand',
    sensorId: 'sit', channelId: 'hand:sit', outputChannel: 'sit', sequence: ++sequence, timestamp: Date.now(), quality: 'good',
    serial: { role: 'sit', path: 'COM_FRAME_COST', baudRate: 1000000, parserChannel: 'hand:sit' },
    payload: { value: Array(1024).fill(0).fill(pressure, 0, 64), matrix: { rows: 32, cols: 32, total: 1024 } } });
  for (const socket of sockets) { try { socket.send(frame); } catch {} }
}

/** 读取门户渲染次数、首页装饰点阵的重画次数，以及当前可见的大块毛玻璃。 */
async function readCost() {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none' && element.getClientRects().length > 0;
    };
    const glass = [...document.querySelectorAll('.fiber-portal *')].filter((element) => {
      const style = getComputedStyle(element);
      if (!style.backdropFilter || style.backdropFilter === 'none' || !visible(element)) return false;
      const bounds = element.getBoundingClientRect();
      // 右上角采样率小标签沿用旧样式，面积可忽略；这里只拦面板级的大块模糊。
      return bounds.width * bounds.height > 10000;
    }).map((element) => `${element.tagName.toLowerCase()}.${String(element.className).split(' ')[0]}`);
    const backdrop = document.querySelector('.system-selector-backdrop');
    return { renders: window.__portalRenders || 0, fieldDraws: window.__fieldDraws || 0, glass,
      homeVisibility: getComputedStyle(document.querySelector('.portal-page')).visibility,
      backdropFilter: backdrop ? getComputedStyle(backdrop).backdropFilter : null };
  });
}

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  // 保留默认动画偏好：减少动画时装饰点阵本来就静止，测不出「被盖住后停绘」。
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const clearRect = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function countFieldDraw(...args) {
      if (this.canvas?.classList?.contains('pressure-field')) window.__fieldDraws = (window.__fieldDraws || 0) + 1;
      return clearRect.apply(this, args);
    };
  });
  const license = { date: Date.now() + 30 * 86400000, nowDate: Date.now(), selectFlag: 'all', valid: true };
  await page.routeWebSocket(/:19999/, socket => {
    sockets.add(socket); socket.onClose(() => sockets.delete(socket));
    socket.send(JSON.stringify({ licenseKey: 'fixture-key', ...license, currentSensorType: 'hand' }));
  });
  await page.route('http://127.0.0.1:19245/**', route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/collection/status') return route.fulfill({ headers, json: { current: null, collectionSummary: null, recent: [] } });
    if (path === '/api/display-systems') return route.fulfill({ headers, json: { displaySystems: { runtimeDefinitions: [] } } });
    if (path === '/api/algorithm-market') return route.fulfill({ headers, json: { packages: [], instances: [] } });
    if (path === '/api/commands') {
      const request = route.request().postDataJSON();
      const results = request.type === 'license.activate' ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [];
      return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { results } } } });
    }
    return route.fulfill({ headers, json: {} });
  });

  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__monitor-frame-cost?actual-monitor=1`);
  await page.getByRole('button', { name: /具身触觉/ }).waitFor();
  const home = await readCost();
  await page.waitForTimeout(1000);
  const homeDraws = (await readCost()).fieldDraws - home.fieldDraws;
  // 指针不动时约每 100ms 重画一次；逐帧重画会是 60 次左右。
  assert.ok(homeDraws >= 4 && homeDraws <= 20, `首页装饰点阵应保持动画但降频重画，一秒内画了 ${homeDraws} 次`);

  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.locator('[data-system="hand"]').click();
  await page.waitForTimeout(400);
  const listed = await readCost();
  await page.waitForTimeout(500);
  assert.equal((await readCost()).fieldDraws, listed.fieldDraws, '系统列表盖住首页后装饰点阵应暂停');
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  // 首页和遮罩模糊在监测底板淡入后才撤掉，留出样式里的 0.4s 延时。
  await page.waitForTimeout(1200);

  const settled = await readCost();
  assert.equal(settled.homeVisibility, 'hidden', '监测页盖住全窗后首页不再参与绘制');
  assert.equal(settled.backdropFilter, 'none', '监测期间选择器遮罩不做整窗模糊');
  assert.deepEqual(settled.glass, [], '监测层不能有压在实时画布上的大块毛玻璃');

  for (let index = 0; index < 40; index++) { sendFrame(200); await page.waitForTimeout(20); }
  await page.waitForFunction(() => Number(document.querySelector('.aside .pressData')?.textContent) === 12800);
  const streamed = await readCost();
  assert.equal(streamed.renders, settled.renders, `40 帧传感数据不应让门户根组件重渲染（多渲染了 ${streamed.renders - settled.renders} 次）`);
  assert.equal(streamed.fieldDraws, settled.fieldDraws, '监测期间首页装饰点阵不应继续重画');
  await page.screenshot({ path: join(artifacts, 'monitoring.png') });

  await page.getByRole('button', { name: '退出监测返回系统列表', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await page.waitForTimeout(600);
  const returned = await readCost();
  assert.equal(returned.homeVisibility, 'visible', '返回列表后首页恢复显示');
  assert.notEqual(returned.backdropFilter, 'none', '返回列表后遮罩恢复模糊');
  assert.equal(returned.fieldDraws, streamed.fieldDraws, '列表仍盖着首页，装饰点阵保持暂停');

  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.locator('.system-selector-backdrop:not(.is-open)').waitFor({ state: 'attached' });
  await page.waitForTimeout(800);
  assert.ok((await readCost()).fieldDraws > returned.fieldDraws, '回到首页后装饰点阵继续动画');

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', artifacts, frames: sequence, portalRenders: streamed.renders, actualDevice: false }));
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('MONITOR_FRAME_COST_FAILED', artifacts);
  throw error;
} finally { await browser?.close(); await server.close(); }
