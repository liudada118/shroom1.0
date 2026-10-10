import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { build, preview } = requireClient('vite');
// 与 Vite CLI 的发布构建一致，包含项目按 NODE_ENV 配置的日志移除规则。
process.env.NODE_ENV = 'production';
const root = fileURLToPath(new URL('../../client', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'shroom-production-monitoring-'));
const buildIndex = process.argv.indexOf('--build-dir');
const outDir = buildIndex >= 0 ? resolve(process.argv[buildIndex + 1]) : join(temporary, 'build');
const systemId = 'company-hand-fixture';
const name = '测试公司手部系统';
const definition = {
  sensorDefinition: { id: systemId, type: systemId, ports: ['sit'] },
  displayMetadata: { id: systemId, sensorType: systemId, name, managed: true,
    source: 'builtin-template', matrix: { rows: 32, cols: 32 } },
  builtinTemplate: { id: systemId, sourceType: 'hand', name,
    configuration: { algorithms: [], charts: [], showPressure: true, showArea: true } },
};
let server;
let browser;
let page;

/** 只返回合成客户授权，不接触本机密钥、员工令牌或设备。 */
function license() {
  return { date: Date.now() + 30 * 86400000, nowDate: Date.now(), valid: true, selectFlag: [systemId] };
}

try {
  if (buildIndex < 0) await build({ root, logLevel: 'error', build: { outDir, emptyOutDir: true } });
  const homeAsset = (await readdir(join(outDir, 'assets'))).find((item) => /^Home-.*\.js$/.test(item));
  assert.ok(homeAsset, '生产构建必须生成 Home chunk，不能留下运行时 assets/Home 导入');
  server = await preview({ root, logLevel: 'error', build: { outDir },
    preview: { host: '127.0.0.1', port: 0, open: false } });
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const moduleResponse = await fetch(`${origin}/assets/${homeAsset}`);
  assert.equal(moduleResponse.status, 200);
  assert.match(moduleResponse.headers.get('content-type'), /javascript/);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  const requests = [];
  const commands = [];
  const sockets = new Set();
  page.on('pageerror', (error) => { errors.push(error.message); console.error('PAGE_ERROR', error.message); });
  await page.routeWebSocket(/:19999/, (ws) => {
    sockets.add(ws);
    ws.onClose(() => sockets.delete(ws));
    ws.send(JSON.stringify({ ...license(), licenseKey: 'synthetic-customer-key', file: systemId,
      currentSensorType: systemId, port: [] }));
  });
  await page.route('http://127.0.0.1:19245/**', async (route) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    let json = {};
    if (path === '/api/display-systems') json = { displaySystems: { runtimeDefinitions: [definition], systems: [] } };
    else if (path === '/api/system-packages/status' || path === '/api/system-packages/sync') {
      json = { available: [{ systemId, name, version: 1 }], installed: [], errors: [] };
    } else if (path === '/api/system-packages/staff-credential') json = { configured: false };
    else if (path === '/api/system-packages/revisions') json = { drafts: [] };
    else if (path === '/api/algorithm-market') json = { packages: [], instances: [], allowed: true };
    else if (path === '/api/commands') {
      const command = route.request().postDataJSON();
      commands.push(command);
      if (command.type === 'license.activate') {
        json = { code: 0, data: { ok: true, data: { results: [
          { name: 'license-activation', activationCode: 'OK', payload: license() },
        ] } } };
      } else {
        json = { code: 0, data: { ok: true } };
        if (command.type === 'serial.refresh') for (const ws of sockets) ws.send(JSON.stringify({ port: [] }));
      }
    } else if (path === '/api/system-packages/staff/releases') {
      return route.fulfill({ status: 400, headers, json: { error: 'SYSTEM_SUBMISSION_TOKEN_REQUIRED' } });
    }
    return route.fulfill({ headers, json });
  });
  await page.goto(origin);
  await page.getByRole('button', { name: '系统列表', exact: true }).click();
  await page.locator(`[data-system="${systemId}"]`).click();
  assert.equal(await page.getByRole('button', { name: '员工：从此系统创建更新草稿' }).count(), 0,
    '未配置员工令牌的客户不应看到员工修订入口');
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.portal-runtime-monitor')?.dataset.handoff === 'complete');
  assert.equal(await page.locator('.portal-monitor-content .home').count(), 1, '生产模块必须实际渲染 Home');
  assert.equal(commands.filter((item) => item.type === 'sensor.switch').at(-1)?.payload.sensorType, systemId);
  await page.screenshot({ path: join(temporary, 'company-monitor.png') });
  await page.getByRole('button', { name: '返回系统列表', exact: false }).first().click();
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.getByRole('heading', { name: 'Shroom Vision', exact: true }).waitFor();

  // 客户误入员工深链时给出中性说明，仍允许读取本机草稿，不发出必然失败的员工请求。
  await page.goto(`${origin}/#/display-systems?companySystem=${systemId}`);
  const dialog = page.getByRole('dialog', { name: '公司系统库 · 版本更新', exact: true });
  await dialog.getByText('客户进入已发布系统只需有效软件密钥', { exact: false }).waitFor();
  assert.equal(await dialog.getByRole('alert').count(), 0);
  assert.equal(requests.filter((path) => path === '/api/system-packages/staff/releases').length, 0);
  await page.screenshot({ path: join(temporary, 'customer-revision-info.png') });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: '返回系统', exact: true }).click();
  await page.locator('.home').waitFor();
  assert.equal(await page.locator('.home').count(), 1, '配置器返回系统路由也必须加载生产 Home 模块');
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Shroom Vision', exact: true }).waitFor();
  assert.deepEqual(errors, [], '生产进入、返回和员工入口均不得抛出页面错误');
  console.log('PRODUCTION_MONITORING_PASSED', { homeAsset, commands: commands.length, artifacts: temporary });
} catch (error) {
  if (page && !page.isClosed()) {
    console.error('PRODUCTION_TEST_DIALOGS', await page.getByRole('dialog').allTextContents());
    await page.screenshot({ path: join(temporary, 'failure.png') });
    console.error('PRODUCTION_TEST_ARTIFACTS', temporary);
  }
  throw error;
} finally {
  await browser?.close();
  await server?.close();
}
