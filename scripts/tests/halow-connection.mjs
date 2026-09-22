import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-halow-browser-'));
const server = await createServer({
  root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, 'vite-cache'), logLevel: 'error',
  optimizeDeps: { entries: ['tests/fixtures/halowConnection.jsx'] },
  server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [{ name: 'halow-browser-fixture',
    /** 单独挂载真实 HaLow 控件，不启动产品后端或读取本机采集库。 */
    configureServer(vite) {
      vite.middlewares.use('/__halow-test', async (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml('/__halow-test', '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/halowConnection.jsx"></script></body></html>'));
      });
    },
  }],
});

let browser;
let page;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1120, height: 960 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(15000);
  const errors = [];
  const commands = [];
  const wsCommands = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let socket;
  let rejectNextStart = true;
  let snapshot = { phase: 'stopped', running: false, host: '', port: 12345, clients: [],
    addresses: [{ address: '192.168.100.2', name: 'HaLow Ethernet', internal: false },
      { address: '127.0.0.1', name: 'loopback', internal: true }],
    selectedDeviceId: null, receivedFrames: 0, receivedBytes: 0, error: null };
  await page.routeWebSocket('ws://127.0.0.1:19999/', (connection) => {
    socket = connection;
    connection.onMessage((message) => wsCommands.push(message));
  });
  await page.route('http://127.0.0.1:19245/**', async (route) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const command = route.request().postDataJSON();
    commands.push(command);
    assert.equal(command.type, 'halow.control');
    const { action, host, port, deviceId } = command.payload;
    if (action === 'start' && rejectNextStart) {
      rejectNextStart = false;
      return route.fulfill({ status: 409, headers, json: { code: 1, data: {
        ok: false, code: 'HALOW_PORT_BUSY', message: 'TCP 端口已被占用（合成拒绝）', requestId: command.requestId,
      } } });
    }
    if (action === 'start') snapshot = { ...snapshot, host, port, phase: 'listening', running: true, error: null };
    if (action === 'select') snapshot = { ...snapshot, selectedDeviceId: deviceId };
    if (action === 'stop') snapshot = { ...snapshot, phase: 'stopped', running: false, clients: [], selectedDeviceId: null };
    if (action !== 'status') socket.send(JSON.stringify({ halowStatus: snapshot }));
    return route.fulfill({ headers, json: { code: 0, data: { ok: true, requestId: command.requestId,
      data: { results: [{ name: 'halow-control', halowStatus: snapshot }] } } } });
  });

  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__halow-test`);
  await page.waitForFunction(() => JSON.parse(document.querySelector('#fixture-state').textContent).connected);
  await page.getByRole('button', { name: 'HaLow 连接', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('192.168.100.2 · HaLow Ethernet', { exact: true }).waitFor();
  assert.equal(await dialog.getByRole('spinbutton', { name: 'HaLow TCP 端口' }).inputValue(), '12345');
  assert.equal(commands[0].payload.action, 'status');
  console.log('HALOW_STATUS_AND_ADDRESSES_PASS');

  const start = dialog.getByRole('button', { name: /开启\s*TCP\s*接收/ });
  const stop = dialog.getByRole('button', { name: '停止接收', exact: true });
  await start.click();
  await dialog.getByRole('alert').filter({ hasText: 'TCP 端口已被占用（合成拒绝）' }).waitFor();
  assert.equal(await start.isEnabled(), true);
  await page.screenshot({ path: join(artifacts, 'http-rejection.png') });
  await start.click();
  await dialog.getByText('等待 B 板连接', { exact: true }).waitFor();
  assert.deepEqual(commands.filter((command) => command.payload.action === 'start').at(-1).payload,
    { action: 'start', host: '192.168.100.2', port: 12345 });
  console.log('HALOW_HTTP_REJECTION_AND_START_PASS');

  snapshot = { ...snapshot, selectedDeviceId: 'board-a', receivedFrames: 17, receivedBytes: 17408,
    clients: [
      { clientId: 'a', deviceId: 'board-a', address: '192.168.100.10', frames: 12, fps: 50, ageMs: 10 },
      { clientId: 'b', deviceId: 'board-b', address: '192.168.100.11', frames: 5, fps: 50, ageMs: 15 },
    ] };
  socket.send(JSON.stringify({ halowStatus: snapshot }));
  await dialog.getByText('正在接收', { exact: true }).waitFor();
  const boardB = dialog.getByRole('row').filter({ hasText: 'board-b' });
  await boardB.getByRole('button', { name: /选\s*择/ }).click();
  await boardB.getByText('当前设备', { exact: true }).waitFor();
  assert.deepEqual(commands.at(-1).payload, { action: 'select', deviceId: 'board-b' });
  // WS 状态可能先于 HTTP ACK 到达，等待命令结束再检查下一步操作权限。
  await page.waitForFunction((button) => !button.disabled, await stop.elementHandle());
  await page.screenshot({ path: join(artifacts, 'receiving-selected-board.png') });
  console.log('HALOW_WS_STATUS_AND_SELECT_PASS');

  for (const runtime of [{ history: 'now', collecting: true }, { history: 'playback', collecting: false }]) {
    await page.evaluate((value) => window.setHalowFixtureRuntime(value), runtime);
    await dialog.getByRole('alert').filter({ hasText: '采集或回放期间不能启动连接或切换设备' }).waitFor();
    assert.equal(await start.isDisabled(), true);
    assert.equal(await dialog.getByRole('row').filter({ hasText: 'board-a' }).getByRole('button', { name: /选\s*择/ }).isDisabled(), true);
    assert.equal(await stop.isEnabled(), true);
    console.log('HALOW_RUNTIME_GUARD_PASS', runtime.history, runtime.collecting);
  }
  await page.screenshot({ path: join(artifacts, 'playback-locked.png') });
  await stop.click();
  await dialog.getByText('未开启', { exact: true }).waitFor();
  assert.equal(commands.at(-1).payload.action, 'stop');
  assert.equal(await start.isDisabled(), true);
  await page.evaluate(() => window.setHalowFixtureRuntime({ history: 'now', collecting: false }));
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((button) => button.textContent === '开启 TCP 接收' && !button.disabled));
  assert.equal(await stop.isDisabled(), true);
  assert.deepEqual(wsCommands, [], '控制必须全部走 HTTP，WebSocket 只收低频状态');
  assert.deepEqual(errors, []);
  console.log('HALOW_CONNECTION_BROWSER_PASS', artifacts);
} catch (error) {
  console.error('HALOW_BROWSER_DOM', await page?.locator('body').ariaSnapshot().catch(() => 'unavailable'));
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('HALOW_BROWSER_ARTIFACTS', artifacts);
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
