import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-entry-reuse-'));
const system = 'smallBedNoAlg';
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, 'vite-cache'),
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'entry-reuse-regression',
    /** 使用实际门户与Home，设备和授权接口由每个浏览器场景独立接管。 */
    configureServer(vite) {
      vite.middlewares.use('/__entry-reuse', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__entry-reuse', '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});
let browser;
const pages = [], errors = [], evidence = [];

/** 创建当前设备已验证的有限权限合同，不使用真实密钥或公网请求。 */
function licensePayload() {
  const date = Date.now() + 30 * 86400000;
  return { date, nowDate: Date.now(), selectFlag: [system], valid: true,
    licenseAccess: { schemaVersion: 1, state: 'active', canAcquire: true, canReadHistory: true,
      canAnalyzeHistory: true, canExport: true, canConfigure: true, canStop: true,
      expiresAt: date, licenseExpiresAt: date } };
}

/** 每个页面拥有独立宿主替身，确保请求计数不被其他场景污染。 */
async function createScenario({ bootstrapped = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage(); pages.push(page);
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  const state = { key: bootstrapped ? 'saved-fixture-key' : '', license: bootstrapped ? licensePayload() : null,
    commands: [], sockets: new Set(), denySwitch: false, holdSwitch: false, finishSwitch: null };
  await page.routeWebSocket(/:19999/, socket => {
    state.sockets.add(socket); socket.onClose(() => state.sockets.delete(socket));
    if (state.key) socket.send(JSON.stringify({ licenseKey: state.key }));
    if (state.license) socket.send(JSON.stringify(state.license));
    socket.send(JSON.stringify({ currentSensorType: system, port: [],
      collectionSourceStatus: { systemId: system, connected: false, ready: false, code: 'COLLECTION_DEVICE_NOT_CONNECTED' } }));
  });
  await page.route('http://127.0.0.1:19245/**', async route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/display-systems') return route.fulfill({ headers, json: { displaySystems: { runtimeDefinitions: [] } } });
    if (path === '/api/collection/status') return route.fulfill({ headers, json: { current: null, collectionSummary: null } });
    if (path === '/api/serial/status') return route.fulfill({ headers, json: { serial: [] } });
    if (path === '/api/algorithm-market') return route.fulfill({ headers, json: { packages: [], instances: [] } });
    if (path !== '/api/commands') return route.fulfill({ headers, json: {} });
    const command = route.request().postDataJSON(); state.commands.push(command);
    let results = [];
    if (command.type === 'license.activate') {
      state.key = command.payload.key;
      state.license = licensePayload();
      results = [{ name: 'license-activation', activationCode: 'OK', payload: state.license }];
    }
    if (command.type === 'sensor.switch' && state.denySwitch) return route.fulfill({ status: 403, headers,
      json: { code: 403, message: '当前密钥未授权此系统（隔离回归）' } });
    if (command.type === 'sensor.switch' && state.holdSwitch) await new Promise(resolve => { state.finishSwitch = resolve; });
    return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { results } } } });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__entry-reuse?actual-monitor=1`);
  await page.locator('.portal-topbar').getByText('本机服务已连接').waitFor();
  return { page, context, state };
}

/** 从实际选择器进入小床画布，并等待真实交接完成。 */
async function enter(page) {
  await page.locator(`[data-system="${system}"]`).click();
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
}

/** 经实际退出守卫返回列表，复用同一个门户实例。 */
async function leave(page) {
  await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
}

/** 仅统计授权激活请求，系统切换及其他正常控制请求独立保留。 */
function activations(state) { return state.commands.filter(command => command.type === 'license.activate').length; }

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const manual = await createScenario();
  await manual.page.locator('#portal-home-key').fill('manual-fixture-key');
  await manual.page.getByRole('button', { name: '选择系统', exact: true }).click();
  await manual.page.locator(`[data-system="${system}"]`).waitFor();
  assert.equal(activations(manual.state), 1, '打开列表时首次验证一次');
  await enter(manual.page);
  assert.equal(activations(manual.state), 1, '刚验证后进入不得重复联网激活');
  await leave(manual.page);
  await enter(manual.page);
  assert.equal(activations(manual.state), 1, '退出重进复用同一密钥验证结果');
  await leave(manual.page);
  await manual.page.getByRole('button', { name: '更换密钥', exact: true }).click();
  await manual.page.locator('#portal-system-key').fill('second-fixture-key');
  await manual.page.locator('.portal-validate-button').click();
  await manual.page.locator(`[data-system="${system}"]`).waitFor();
  assert.equal(activations(manual.state), 2, '更换密钥必须重新验证');
  await enter(manual.page);
  assert.equal(activations(manual.state), 2, '新密钥成功验证后进入同样不重复激活');
  await leave(manual.page);
  manual.state.denySwitch = true;
  await manual.page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await manual.page.getByRole('alert').filter({ hasText: '当前密钥未授权此系统（隔离回归）' }).waitFor();
  assert.equal(await manual.page.locator('.portal-runtime-monitor').count(), 0, '后台权限拒绝不能进入');
  assert.equal(activations(manual.state), 2);
  await manual.page.screenshot({ path: join(artifacts, 'backend-switch-denied.png') });
  evidence.push({ scenario: 'manual-verify-enter-reenter-key-change-denial', activations: activations(manual.state),
    switches: manual.state.commands.filter(command => command.type === 'sensor.switch').length });
  await manual.context.close();

  const saved = await createScenario({ bootstrapped: true });
  await saved.page.getByRole('button', { name: '选择系统', exact: true }).click();
  await saved.page.locator(`[data-system="${system}"]`).waitFor();
  await enter(saved.page);
  assert.equal(activations(saved.state), 0, '宿主已有有效授权时进入不再联网激活');
  await saved.page.screenshot({ path: join(artifacts, 'saved-authority-entered.png') });
  await leave(saved.page);
  saved.state.holdSwitch = true;
  await saved.page.getByRole('button', { name: '进入该系统', exact: true }).click();
  const switchDeadline = Date.now() + 20000;
  while (!saved.state.finishSwitch && Date.now() < switchDeadline) await saved.page.waitForTimeout(10);
  assert.equal(typeof saved.state.finishSwitch, 'function', '已验证入口应发起系统切换');
  for (const socket of [...saved.state.sockets]) socket.close({ code: 1001, reason: 'isolated disconnect' });
  await saved.page.getByRole('alert').filter({ hasText: '连接' }).waitFor();
  saved.state.finishSwitch();
  await saved.page.waitForTimeout(200);
  assert.equal(await saved.page.locator('.portal-runtime-monitor').count(), 0, '断线取消后迟到的切换成功不能进入');
  assert.equal(activations(saved.state), 0);
  evidence.push({ scenario: 'saved-authority-disconnect-late-switch', activations: activations(saved.state),
    switches: saved.state.commands.filter(command => command.type === 'sensor.switch').length });
  await saved.context.close();
  assert.deepEqual(errors, []);
  console.log('PORTAL_ENTRY_REUSE_PASS', JSON.stringify({ artifacts, evidence }));
} catch (error) {
  for (let index = 0; index < pages.length; index++) {
    if (!pages[index].isClosed()) await pages[index].screenshot({ path: join(artifacts, `failure-${index}.png`) }).catch(() => {});
  }
  console.error('PORTAL_ENTRY_REUSE_FAILED', JSON.stringify({ artifacts, evidence, errors })); throw error;
} finally { await browser?.close(); await server.close(); }
