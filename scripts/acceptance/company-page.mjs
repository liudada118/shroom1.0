import assert from 'node:assert/strict';
import path from 'node:path';

const API_ORIGIN = 'http://127.0.0.1:19245';
const SYSTEM_ID = 'acceptance-company';
const SENSOR_TYPE = 'acceptance-company-sit';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };

/** 用完整宿主快照触发正式门户的公司目录同步，不提供真实密钥。 */
function snapshot() {
  const deadline = Date.now() + 86400000;
  return { licenseKey: 'acceptance-company-fixture', valid: true, selectFlag: 'all',
    date: deadline, nowDate: Date.now(), licenseAccess: { schemaVersion: 1, state: 'active',
      canAcquire: true, canReadHistory: true, canAnalyzeHistory: true, canExport: true,
      canConfigure: true, canStop: true, expiresAt: deadline, licenseExpiresAt: deadline } };
}

/** 等待真实请求到达夹具，超时包含缺失的阶段。 */
async function waitForRequest(page, pending, name) {
  const deadline = Date.now() + 10000;
  while (!pending[name] && Date.now() < deadline) await page.waitForTimeout(25);
  assert.ok(pending[name], `Company directory did not request ${name}`);
  return pending[name];
}

/** 独立页面控制响应先后；只检查可见系统卡，不读取 React 私有状态。 */
async function scenario({ browser, origin, outputDir, name }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const pending = {}, sockets = new Set(), requestCounts = {}, commands = [], errors = [], failedResources = [];
  const screenshot = path.join(outputDir, `company-${name}.png`);
  const result = { name, passed: false, requestCounts, commands, errors, failedResources, screenshot };
  const license = snapshot();
  const available = [{ systemId: SYSTEM_ID, name: '验收公司系统', version: 1 }];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (new URL(response.url()).origin === origin && response.status() >= 400) {
      failedResources.push(new URL(response.url()).pathname);
    }
  });
  try {
    await page.routeWebSocket('**/*', socket => {
      const url = new URL(socket.url());
      if (url.hostname !== '127.0.0.1' || url.port !== '19999') { socket.close({ code: 1008, reason: 'isolated acceptance' }); return; }
      sockets.add(socket); socket.onClose(() => sockets.delete(socket));
      socket.send(JSON.stringify(license));
    });
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === origin) return route.continue();
      if (url.origin !== API_ORIGIN) return route.abort('blockedbyclient');
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const key = `${request.method()} ${url.pathname}`;
      requestCounts[key] = (requestCounts[key] || 0) + 1;
      if (url.pathname === '/api/system-packages/status' || url.pathname === '/api/system-packages/sync') {
        const kind = url.pathname.endsWith('/status') ? 'status' : 'sync';
        if (!pending[kind]) { pending[kind] = route; return; }
        return route.fulfill({ headers, json: { available } });
      }
      let json = {};
      if (url.pathname === '/api/display-systems') json = { displaySystems: { runtimeDefinitions: [{
        sensorDefinition: { id: SYSTEM_ID, type: SENSOR_TYPE },
        displayMetadata: { name: '验收公司系统', managed: true },
      }] } };
      else if (url.pathname === '/api/collection/status') json = { current: null, collectionSummary: null, recent: [] };
      else if (url.pathname === '/api/algorithm-market') json = { packages: [], instances: [] };
      else if (url.pathname === '/api/commands') {
        const command = request.postDataJSON(); commands.push(command.type);
        json = { code: 0, data: { ok: true, data: { results: command.type === 'license.activate'
          ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [] } } };
      }
      return route.fulfill({ headers, json });
    });
    await page.goto(origin);
    await page.getByRole('button', { name: /定制系统/ }).click();
    await page.getByRole('button', { name: '全部', exact: true }).click();
    const status = await waitForRequest(page, pending, 'status');
    const sync = await waitForRequest(page, pending, 'sync');
    const card = page.locator(`[data-system="${SENSOR_TYPE}"]`);
    if (name === 'same-access-snapshot') {
      await status.fulfill({ headers, json: { available: [] } });
      for (const socket of sockets) socket.send(JSON.stringify({ ...license, licenseAccess: { ...license.licenseAccess } }));
      // 让快照消息和 React effects 处理完，之后才释放被挂起的同步回执。
      await page.waitForTimeout(200);
      await sync.fulfill({ headers, json: { available, installed: [], errors: [] } });
      await card.waitFor({ state: 'visible', timeout: 5000 });
    } else {
      await sync.fulfill({ headers, json: { available, installed: [], errors: [] } });
      await card.waitFor({ state: 'visible', timeout: 5000 });
      await status.fulfill({ headers, json: { available: [] } });
      // 在旧状态确实返回后连续观察，防止瞬时可见掩盖稍后的错误覆盖。
      for (let check = 0; check < 4; check++) {
        await page.waitForTimeout(75);
        assert.equal(await card.isVisible(), true, 'Late empty status removed the authorized company card');
      }
    }
    assert.equal(requestCounts['POST /api/system-packages/sync'], 1, 'Repeated host snapshots must not restart synchronization');
    assert.equal(commands.includes('sensor.switch'), false, 'Directory acceptance must not enter a company system');
    assert.deepEqual(errors, [], 'Company page must not raise runtime errors');
    assert.deepEqual(failedResources, [], 'Company page assets must exist');
    await card.scrollIntoViewIfNeeded();
    result.passed = true;
  } catch (error) {
    result.error = error.message;
  } finally {
    await page.screenshot({ path: screenshot }).catch(error => { result.screenshotError = error.message; });
    await page.close();
  }
  return result;
}

/** 验证交付网页的两类公司目录竞态；HTTP/WS为隔离夹具，不替代后台授权验收。 */
export async function runCompanyPage({ browser, origin, outputDir }) {
  const scenarios = [];
  for (const name of ['same-access-snapshot', 'late-empty-status']) {
    scenarios.push(await scenario({ browser, origin: new URL(origin).origin, outputDir, name }));
  }
  const result = { scope: 'packaged-company-directory-with-fixture-HTTP-and-WS', scenarios,
    passed: scenarios.every(item => item.passed) };
  if (!result.passed) {
    const error = new Error(`Company directory acceptance failed: ${scenarios.filter(item => !item.passed).map(item => item.name).join(', ')}`);
    error.details = result;
    throw error;
  }
  return result;
}
