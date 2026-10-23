import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-human-body-portal-'));
const baseline = process.argv.includes('--baseline');
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false }, plugins: [{ name: 'human-body-portal-test',
    /** 复用正式门户夹具，保留系统预览、入场遮罩与真实Home装配。 */
    configureServer(vite) {
      vite.middlewares.use('/__human-body-portal', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__human-body-portal', '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});

/** 读取实际人体画布的宿主和遮挡关系，不能把资源请求成功当成页面可见。 */
async function inspectViewport(page) {
  return page.evaluate(() => {
    const viewport = document.querySelector('[data-human-body-viewport="true"]');
    const canvas = viewport?.querySelector('canvas');
    const monitor = document.querySelector('.portal-runtime-monitor');
    const bounds = canvas?.getBoundingClientRect();
    const point = bounds ? { x: bounds.x + bounds.width * .5, y: bounds.y + bounds.height * .45 } : { x: 720, y: 405 };
    const covering = document.elementFromPoint(point.x, point.y);
    return { inMonitor: Boolean(viewport?.closest('.portal-runtime-monitor')), inDataRenderer: Boolean(viewport?.closest('.portal-data-renderer')),
      parent: viewport?.parentElement?.className || viewport?.parentElement?.tagName, handoff: monitor?.dataset.handoff,
      monitorCanvases: monitor?.querySelectorAll('.portal-data-renderer canvas').length || 0,
      covering: { tag: covering?.tagName, className: covering?.className }, viewportCoversPoint: Boolean(viewport?.contains(covering)),
      width: bounds?.width, height: bounds?.height, text: viewport?.textContent?.slice(0, 180) };
  });
}

/** 切换正式显示选择器，确保原始网格与三维模型可往返。 */
async function chooseMode(page, label) {
  const input = page.getByRole('combobox', { name: '显示方式', exact: true });
  await input.locator('xpath=ancestor::div[contains(@class,"ant-select")]').first().locator('.ant-select-selector').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText(label, { exact: true }).click();
}

/** 比较真实画布中心像素与背景色，防止空画布和完成标记造成假通过。 */
async function readModelPixels(page) {
  const image = await page.locator('[data-human-body-viewport="true"] canvas').first().screenshot();
  return page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let different = 0;
    for (let y = Math.floor(canvas.height * .12); y < canvas.height * .88; y += 3) {
      for (let x = Math.floor(canvas.width * .25); x < canvas.width * .75; x += 3) {
        const offset = (y * canvas.width + x) * 4;
        if (Math.abs(pixels[offset] - pixels[0]) + Math.abs(pixels[offset + 1] - pixels[1]) + Math.abs(pixels[offset + 2] - pixels[2]) > 50) different++;
      }
    }
    return { different, width: canvas.width, height: canvas.height };
  }, image.toString('base64'));
}

let browser, page;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(30000);
  const errors = [], responses = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/model/')) responses.push({ url: new URL(response.url()).pathname, status: response.status() }); });
  const license = { date: Date.now() + 30 * 86400000, nowDate: Date.now(), selectFlag: 'all', valid: true };
  await page.routeWebSocket(/:19999/, socket => {
    socket.send(JSON.stringify({ licenseKey: 'fixture-key' })); socket.send(JSON.stringify(license));
  });
  await page.route('http://127.0.0.1:19245/**', route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (route.request().url().endsWith('/api/display-systems')) return route.fulfill({ headers, json: { displaySystems: { runtimeDefinitions: [] } } });
    if (route.request().url().endsWith('/api/algorithm-market')) return route.fulfill({ headers, json: { packages: [], instances: [] } });
    if (route.request().url().endsWith('/api/commands')) {
      const request = route.request().postDataJSON();
      const results = request.type === 'license.activate' ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [];
      return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { results } } } });
    }
    return route.fulfill({ headers, json: {} });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__human-body-portal?actual-monitor=1`);
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  for (const [index, system] of ['pressureVest', 'humanBodyOptimized', 'pressureVest'].entries()) {
    await page.locator(`[data-system="${system}"]`).click();
    await page.locator('.system-scene-particle-root[data-scene="humanBody"][data-model-status="ready"]').waitFor({ timeout: 60000 });
    if (!baseline && index === 0) await page.route('**/model/human3-low.glb', async route => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.getByRole('button', { name: '进入该系统', exact: true }).click();
    if (!baseline && index === 0) {
      await page.locator('.portal-data-renderer canvas[data-model-state="loading"]').waitFor({ state: 'attached' });
      assert.notEqual(await page.locator('.portal-runtime-monitor').getAttribute('data-handoff'), 'complete', '模型仍在加载时不能交接空画布');
    }
    await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
    if (!baseline && index === 0) await page.unroute('**/model/human3-low.glb');
    await page.locator('[data-human-body-viewport="true"] canvas').first().waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-human-body-viewport="true"]')?.textContent.includes('加载'));
    const state = await inspectViewport(page);
    await page.screenshot({ path: join(artifacts, `${index}-${system}-${baseline ? 'baseline' : 'loaded'}.png`) });
    console.log('HUMAN_BODY_PORTAL_STATE', JSON.stringify({ system, state, errors, responses, artifacts }));
    if (baseline) {
      assert.equal(state.inMonitor, false); assert.equal(state.monitorCanvases, 0); assert.equal(state.viewportCoversPoint, false);
    } else {
      assert.equal(state.inMonitor, true); assert.equal(state.inDataRenderer, true); assert.equal(state.viewportCoversPoint, true);
      assert.ok(state.width > 1000 && state.height > 700);
      const pixels = await readModelPixels(page);
      assert.ok(pixels.different > 100, `${system} 必须绘制真实人体而非纯背景: ${JSON.stringify(pixels)}`);
      await chooseMode(page, '原始数据');
      await page.locator('.human-body-raw__atlas').waitFor();
      assert.equal(await page.locator('[data-human-body-viewport="true"]').count(), 0);
      await chooseMode(page, '3D 皮肤');
      await page.locator('[data-human-body-viewport="true"] canvas').first().waitFor();
      await page.waitForFunction(() => !document.querySelector('[data-human-body-viewport="true"]')?.textContent.includes('加载'));
      const returned = await inspectViewport(page);
      assert.equal(returned.inDataRenderer, true); assert.equal(returned.viewportCoversPoint, true);
    }
    assert.deepEqual(errors, []);
    await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
    await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-human-body-viewport="true"]').count(), 0, '退出系统不能留下body孤立画布');
  }
  console.log('HUMAN_BODY_PORTAL_PASS', artifacts);
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('HUMAN_BODY_PORTAL_FAILED', JSON.stringify({ state: await inspectViewport(page).catch(() => null), artifacts }));
  throw error;
} finally { await browser?.close(); await server.close(); }
