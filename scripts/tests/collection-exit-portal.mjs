import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-collection-exit-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'collection-exit-regression',
    /** 保留真实门户和Home，设备与授权请求全部由浏览器夹具接管。 */
    configureServer(vite) {
      vite.middlewares.use('/__collection-exit', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__collection-exit', '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});

let browser, page, current = null, recent = null, revision = 0, failNextStop = false;
const sockets = new Set(), commands = [], errors = [];
const system = 'smallBedNoAlg';
const license = { date: Date.now() + 30 * 86400000, nowDate: Date.now(), selectFlag: 'all', valid: true };

/** 广播低频采集回执，不连接真实后台或向真实串口发送命令。 */
function publish(payload) { for (const socket of sockets) socket.send(JSON.stringify(payload)); }

/** 标记当前会话已经保存完成，模拟后台尾部写入结束的实际回执。 */
function finish(phase = 'completed', reason = 'USER_STOPPED') {
  recent = { ...current, phase, reason, result: 'saved', completedAt: Date.now(), stoppedAt: current.stoppedAt || Date.now(),
    channels: { sit: { queued: 12, committed: 12, pending: 0, failed: 0 } } };
  current = null; publish({ collectionSummary: recent });
}

/** 通过实际采集配置弹窗启动，不能直接改Home状态冒充采集成功。 */
async function startCollection() {
  await page.getByRole('button', { name: '开始采集', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '开始采集', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="结束采集"]')?.textContent.includes('停止'));
}

/** 读取真实Home的计时展示，验证终态到达后秒表不会继续增加。 */
async function readElapsed() {
  return page.locator('.home').evaluate(element => {
    let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
    while (fiber && typeof fiber.stateNode?.preparePortalExit !== 'function') fiber = fiber.return;
    return fiber?.stateNode?.title.current?.state?.num;
  });
}

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket(/:19999/, socket => {
    sockets.add(socket); socket.onClose(() => sockets.delete(socket));
    socket.send(JSON.stringify({ licenseKey: 'fixture-key' })); socket.send(JSON.stringify(license));
    socket.send(JSON.stringify({ currentSensorType: system, port: [{ path: 'COM_COLLECTION_TEST' }], collectionSummary: current || recent }));
  });
  await page.route('http://127.0.0.1:19245/**', route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/collection/status') return route.fulfill({ headers, json: { collectionSummary: current || recent, current, recent: recent ? [recent] : [] } });
    if (path === '/api/display-systems') return route.fulfill({ headers, json: { displaySystems: { runtimeDefinitions: [] } } });
    if (path === '/api/algorithm-market') return route.fulfill({ headers, json: { packages: [], instances: [] } });
    if (path !== '/api/commands') return route.fulfill({ headers, json: {} });
    const command = route.request().postDataJSON(); commands.push(command);
    if (command.type === 'sensor.switch' && current) return route.fulfill({ status: 409, headers,
      json: { code: 409, message: '请先停止采集，再切换系统。' } });
    if (command.type === 'collection.control') {
      if (command.payload.active) {
        current = { id: `collection-${++revision}`, phase: 'collecting', result: 'pending', startedAt: Date.now(), stoppedAt: null,
          channels: { sit: { queued: 12, committed: 10, pending: 2, failed: 0 } } };
      } else if (failNextStop) {
        failNextStop = false;
        return route.fulfill({ status: 503, headers, json: { code: 503, message: '测试停止失败，请重试' } });
      } else if (current) current = { ...current, phase: 'finalizing', stoppedAt: Date.now() };
      if (current) publish({ collectionSummary: current });
    }
    const results = command.type === 'license.activate' ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [];
    return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { results } } } });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__collection-exit?actual-monitor=1`);
  await page.getByRole('button', { name: /康养监测/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.locator(`[data-system="${system}"]`).click();
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  await startCollection();
  await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.portal-monitor-navigation button')?.textContent.includes('正在结束采集'));
  await page.waitForTimeout(350);
  assert.equal(current?.phase, 'finalizing');
  assert.equal(await page.locator('.portal-runtime-monitor').count(), 1, '尾部未保存时不能先卸载监测页');
  assert.equal(commands.filter(command => command.type === 'collection.control' && !command.payload.active).length, 1);
  await page.screenshot({ path: join(artifacts, 'waiting-for-storage.png') });
  finish();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  assert.equal(commands.filter(command => command.type === 'serial.close').length, 0, '重进页面不能主动断开串口');

  await startCollection();
  failNextStop = true;
  await page.getByRole('button', { name: '退出监测返回系统列表', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '测试停止失败' }).waitFor();
  assert.equal(await page.locator('#portal-monitor-content').evaluate(element => element.inert), false);
  await page.getByRole('button', { name: '关闭退出错误提示', exact: true }).click();
  publish({ serialStatus: { role: 'sit', path: 'COM_COLLECTION_TEST', connectionId: 1, revision: 2, status: 'closed', isOpen: false } });
  finish('interrupted', 'SERIAL_DISCONNECTED');
  await page.waitForFunction(() => document.querySelector('[aria-label="结束采集"]')?.disabled);
  const stoppedAt = await readElapsed();
  assert.equal(typeof stoppedAt, 'number');
  await page.waitForTimeout(1150);
  assert.equal(await readElapsed(), stoppedAt, '串口中断回执必须冻结计时');
  await page.screenshot({ path: join(artifacts, 'serial-disconnected.png') });
  const notice = page.getByRole('alert').filter({ hasText: '采集已中断，已接收的数据保存完成' });
  await notice.locator('.ant-alert-close-icon').click();
  await notice.waitFor({ state: 'hidden' });
  publish({ collectionSummary: recent });
  await page.waitForTimeout(100);
  assert.equal(await notice.count(), 0, '关闭后相同回执不得重新弹出');
  await page.getByRole('button', { name: '退出监测返回系统列表', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  assert.deepEqual(errors, []);
  console.log('COLLECTION_EXIT_PORTAL_PASS', JSON.stringify({ artifacts, commands: commands.map(command => command.type), stoppedAt }));
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('COLLECTION_EXIT_PORTAL_FAILED', JSON.stringify({ artifacts, errors })); throw error;
} finally { await browser?.close(); await server.close(); }
