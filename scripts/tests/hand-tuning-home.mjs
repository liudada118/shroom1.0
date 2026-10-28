import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import monitorTranslations from '../../client/src/i18n/monitorAuditTranslations.js';

const { createServer } = createRequire(new URL('../../client/package.json', import.meta.url))('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-hand-tuning-'));
const sockets = new Set(), errors = [];
let activeSystem = 'hand', sequence = 0, browser, page;
const license = { date: Date.now() + 30 * 86400000, nowDate: Date.now(), valid: true, selectFlag: 'all' };
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'hand-tuning-test',
    /** 使用真实Home和调节抽屉，只拦截设备与授权接口。 */
    configureServer(vite) {
      vite.middlewares.use('/__hand-tuning', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__hand-tuning', '<html><head><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});

/** 投递当前系统的真实规范帧形状，不调用生产后台或串口。 */
function pressure(value) {
  const payload = { type: 'sensor.frame', schemaVersion: 1, source: 'realtime', displaySystemId: activeSystem, sensorType: activeSystem,
    sensorId: 'sit', channelId: `${activeSystem}:sit`, outputChannel: 'sit', sequence: ++sequence, timestamp: Date.now(), quality: 'good',
    serial: { role: 'sit', path: 'COM_HAND_TEST', baudRate: 1000000, parserChannel: `${activeSystem}:sit` },
    payload: { value: Array(1024).fill(0).fill(value * 16, 0, 64), matrix: { rows: 32, cols: 32, total: 1024 } } };
  for (const socket of sockets) socket.send(JSON.stringify(payload));
}

/** 找到实际Home实例，仅用于观察状态，不替换真实参数处理或渲染。 */
async function state() {
  return page.locator('.home').evaluate(element => {
    let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
    while (fiber && typeof fiber.stateNode?.syncDisplayRendererConfig !== 'function') fiber = fiber.return;
    const home = fiber?.stateNode;
    return { system: home?.state.matrixName, initial: home?.state.valuelInit1 };
  });
}

/** 按真实门户系统入口进入，确保切换与挂载都会恢复本系统参数。 */
async function enter(system, language = 'zh') {
  activeSystem = system;
  await page.locator(`[data-system="${system}"]`).click();
  await page.getByRole('button', { name: monitorTranslations.monitorUi.enterSystem[language], exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
}

/** 等待真实侧栏的压力总和，不以内部数组冒充显示效果。 */
async function total(expected) {
  await page.waitForFunction(value => Number(document.querySelector('.aside .pressData')?.textContent) === value, expected);
}

/** 在手部与小床真实初始值滑块上进行键盘操作。 */
async function initial(keys) {
  await page.getByRole('button', { name: '调节', exact: true }).click();
  const slider = page.locator('.ant-drawer:visible [role="slider"]').last();
  await slider.focus();
  for (const key of keys) await slider.press(key);
  const value = Number(await slider.getAttribute('aria-valuenow'));
  await page.locator('.ant-drawer:visible .ant-drawer-close').click();
  return value;
}

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Type) continue;
      for (const method of ['bufferData', 'bufferSubData']) {
        const original = Type.prototype[method];
        /** 观察真实72×72点阵的GPU高度，颜色数组不能冒充位置。 */
        Type.prototype[method] = function (...args) {
          const positions = args.find(value => value instanceof Float32Array && value.length === 72 * 72 * 3
            && Math.abs(value[0]) > 5 && Math.abs(value[2]) > 5);
          if (positions) {
            let height = 0;
            for (let index = 1; index < positions.length; index += 3) height = Math.max(height, Math.abs(positions[index]));
            window.handGpuHeight = height;
          }
          return original.apply(this, args);
        };
      }
    }
  });
  await page.routeWebSocket(/:19999/, socket => {
    sockets.add(socket); socket.onClose(() => sockets.delete(socket));
    socket.send(JSON.stringify({ licenseKey: 'fixture-key', ...license, currentSensorType: activeSystem }));
  });
  await page.route('http://127.0.0.1:19245/**', route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/collection/status') return route.fulfill({ headers, json: { current: null, collectionSummary: null, recent: [] } });
    if (path === '/api/display-systems') return route.fulfill({ headers, json: { displaySystems: { runtimeDefinitions: [] } } });
    if (path === '/api/algorithm-market') return route.fulfill({ headers, json: { packages: [], instances: [] } });
    if (path === '/api/commands') {
      const command = route.request().postDataJSON();
      const results = command.type === 'license.activate' ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [];
      return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { results } } } });
    }
    return route.fulfill({ headers, json: {} });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__hand-tuning?actual-monitor=1`);
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await enter('hand');
  const high = await initial(['End']); assert.equal(high, 5000);
  for (let index = 0; index < 5; index++) { pressure(1); await page.waitForTimeout(120); }
  await total(0);
  await page.waitForFunction(() => window.handGpuHeight === 0);
  assert.equal(await initial(['Home']), 0);
  await total(1024); // 降低阈值无需新帧即可恢复末帧。
  assert.equal(await initial(['End']), 5000);
  for (let index = 0; index < 5; index++) { pressure(1); await page.waitForTimeout(120); }
  await total(0);
  pressure(5); await total(5120);
  await page.waitForFunction(() => window.handGpuHeight > 0);
  await page.screenshot({ path: join(artifacts, 'threshold-and-pressure.png') });
  await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await enter('smallBedNoAlg');
  const bedInitial = await initial(['Home', 'ArrowRight']);
  assert.notEqual(bedInitial, 5000);
  await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await enter('hand'); assert.equal((await state()).initial, 5000);
  pressure(1); await total(0);
  await page.reload();
  await enter('hand'); assert.equal((await state()).initial, 5000);
  pressure(1); await total(0);
  await page.screenshot({ path: join(artifacts, 'restored-after-reload.png') });
  const copy = monitorTranslations.monitorUi;
  for (const [language, option, documentLanguage] of [['en', '英文', 'en-US'], ['ja', 'Japanese', 'ja-JP']]) {
    await page.locator('.portal-display-language .ant-select').click();
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: option }).click();
    await page.waitForFunction(expected => document.documentElement.lang === expected, documentLanguage);
    assert.equal(await page.locator('#portal-display-title').textContent(), copy.renderDisplay[language]);
    assert.equal(await page.getByRole('button', { name: copy.startCollection[language], exact: true }).count(), 1);
    assert.equal(await page.locator('.portal-quick-tools-heading strong').textContent(), copy.quickTools[language]);
    if (language === 'en') {
      assert.doesNotMatch(await page.locator('.portal-display-panel').innerText(), /\p{Script=Han}/u);
      assert.doesNotMatch(await page.locator('.portal-observatory-heading').innerText(), /\p{Script=Han}/u);
      await page.setViewportSize({ width: 1280, height: 720 });
      const overflow = await page.locator('.portal-session-modes button, .portal-quick-tools-grid button').evaluateAll(elements =>
        elements.filter(element => element.scrollWidth > element.clientWidth + 2).map(element => ({ text: element.innerText, width: element.clientWidth, content: element.scrollWidth })));
      assert.deepEqual(overflow, [], 'translated monitoring controls must fit');
      const identity = await page.locator('.portal-monitor-identity').boundingBox();
      const session = await page.locator('.home > .title').boundingBox();
      assert.ok(identity.x + identity.width <= session.x, 'system title must not overlap session controls');
    }
    await page.screenshot({ path: join(artifacts, `monitor-${language}.png`) });
  }
  await page.reload();
  await page.waitForFunction(() => document.documentElement.lang === 'ja-JP');
  assert.equal(await page.getByRole('button', { name: copy.enterSystem.ja, exact: true }).count(), 1);
  await enter('hand', 'ja');
  assert.equal((await state()).initial, 5000);
  assert.deepEqual(errors, []);
  console.log('HAND_TUNING_HOME_PASS', JSON.stringify({ artifacts, restored: await state(), bedInitial }));
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('HAND_TUNING_HOME_FAILED', JSON.stringify({ artifacts, errors })); throw error;
} finally { await browser?.close(); await server.close(); }
