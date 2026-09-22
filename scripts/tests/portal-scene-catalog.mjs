import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'portal-scene-regression',
    /** 复用真实门户夹具；所有设备和授权接口只在本浏览器中拦截。 */
    configureServer(vite) {
      vite.middlewares.use('/__scene-test', async (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml('/__scene-test', '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    } }],
});
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-scene-catalog-'));
let browser;
let page;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(30000);
  const errors = [];
  const resources = new Set();
  page.on('pageerror', (error) => { errors.push(error.message); console.error('PAGE_ERROR', error.message); });
  page.on('request', (request) => { if (request.url().includes('/model/') || /foot(left)?\.png/.test(request.url())) resources.add(new URL(request.url()).pathname); });
  await page.addInitScript(() => {
    window.__sceneGpu = { progress: [], invalid: 0 };
    for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      const locations = new WeakSet();
      const originalLocation = Type.prototype.getUniformLocation;
      /** 检查真正提交给 GPU 的形变权重，不能用 DOM 标记代替动画。 */
      Type.prototype.getUniformLocation = function (program, name) {
        const location = originalLocation.call(this, program, name);
        if (location && name === 'portalProgress') locations.add(location);
        return location;
      };
      const originalUniform = Type.prototype.uniform1f;
      /** 保存有限数量的过渡样本，便于检查进入与反向返回。 */
      Type.prototype.uniform1f = function (location, value) {
        if (locations.has(location)) window.__sceneGpu.progress.push(value);
        return originalUniform.call(this, location, value);
      };
      const originalBuffer = Type.prototype.bufferData;
      /** 矩阵与模型预览不能上传无效顶点。 */
      Type.prototype.bufferData = function (...args) {
        if (args[1] instanceof Float32Array && !args[1].every(Number.isFinite)) window.__sceneGpu.invalid++;
        return originalBuffer.apply(this, args);
      };
    }
  });
  const license = { date: Date.now() + 30 * 86400000, nowDate: Date.now(), selectFlag: 'all', valid: true };
  await page.routeWebSocket(/:19999/, (socket) => {
    socket.send(JSON.stringify({ licenseKey: 'fixture-key' }));
    socket.send(JSON.stringify(license));
  });
  await page.route('http://127.0.0.1:19245/**', (route) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (route.request().url().endsWith('/api/display-systems')) return route.fulfill({ headers, json: { displaySystems: { runtimeDefinitions: [] } } });
    if (route.request().url().endsWith('/api/algorithm-market')) return route.fulfill({ headers, json: { packages: [], instances: [] } });
    if (route.request().url().endsWith('/api/commands')) {
      const request = route.request().postDataJSON();
      const results = request.type === 'license.activate' ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [];
      return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { results } } } });
    }
    return route.fulfill({ status: 404, headers, json: {} });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__scene-test?actual-monitor=1`);
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  const nativeSystems = ['robot1', 'robotSY', 'robotLCF', 'wholeChair', 'minzhen', 'carQX', 'footVideo'];
  const cases = [
    ['robot1', 'robot', '/model/jiqirenGggg.fbx'],
    ['robotSY', 'robotSY', '/model/g-robot.fbx'], ['robotLCF', 'robotLCF', '/model/robot04_marge.fbx'],
    ['wholeChair', 'chair', '/model/0717.fbx'], ['minzhen', 'wheelchair', '/model/minzhen/chair.gltf'],
    ['carQX', 'chairQX', '/model/0717.fbx'], ['humanBodyOptimized', 'humanBody', '/model/human3-low.glb'],
    ['footVideo', 'foot', '/footleft.png'], ['bed4096num', 'matrix64'], ['bed4096', 'heatmap64'],
    ['jqbed', 'smallBed'], ['petCare', 'matrix'], ['petCareMini', 'matrix'],
  ].filter(([key]) => (!process.argv.includes('--native-only') || nativeSystems.includes(key))
    && (!process.argv.includes('--lifecycle-only') || ['robot1', 'wholeChair', 'footVideo'].includes(key)));
  for (const [system, scene, resource] of cases) {
    await page.locator(`[data-system="${system}"]`).click();
    await page.locator(`.system-scene-particle-root[data-scene="${scene}"][data-model-status="ready"]`).waitFor({ timeout: 90000 });
    if (resource) assert.ok(resources.has(resource), `${system} 必须加载其真实模型/底图`);
    await page.screenshot({ path: join(artifacts, `preview-${system}.png`) });
    console.log('SCENE_PREVIEW_PASS', system, scene);
  }
  assert.equal(await page.evaluate(() => window.__sceneGpu.invalid), 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const [system, scene] of cases.filter(([key]) => !process.argv.includes('--lifecycle-only') && !['humanBodyOptimized', 'bed4096'].includes(key))) {
    await page.locator(`[data-system="${system}"]`).click();
    await page.locator(`.system-scene-particle-root[data-scene="${scene}"][data-model-status="ready"]`).waitFor();
    await page.evaluate(() => { window.__sceneGpu.progress = []; });
    await page.getByRole('button', { name: '进入该系统', exact: true }).click();
    if (nativeSystems.includes(system)) {
      await page.waitForFunction(() => {
        const canvas = document.querySelector('.portal-data-renderer canvas');
        const progress = Number(canvas?.dataset.particleEntrance);
        return progress > .08 && progress < .9;
      });
      await page.screenshot({ path: join(artifacts, `transition-${system}.png`) });
    }
    const monitor = page.locator('.portal-runtime-monitor[data-handoff="complete"]');
    await monitor.waitFor();
    assert.equal(await monitor.getAttribute('data-presentation'), 'particle-morph');
    assert.ok((await monitor.getAttribute('class')).includes('is-direct-entry'));
    assert.ok((await page.evaluate(() => window.__sceneGpu.progress)).some((value) => value > .05 && value < .95), '必须有实际 GPU 中间帧');
    const canvas = page.locator('.portal-data-renderer canvas').first();
    const bounds = await canvas.boundingBox();
    assert.ok(bounds.width >= 1438 && bounds.height >= 898, '真实画布应适配宿主尺寸');
    await page.screenshot({ path: join(artifacts, `monitor-${system}.png`) });
    await page.evaluate(() => { window.__sceneGpu.progress = []; });
    await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
    await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
    assert.ok((await page.evaluate(() => window.__sceneGpu.progress)).some((value) => value > .05 && value < .95), '返回也应有反向 GPU 中间帧');
    assert.equal(await page.locator('.system-scene-particle-host').evaluate((node) => node.style.visibility + node.style.opacity), '');
    console.log('SCENE_HANDOFF_PASS', system);
  }
  // 原生加载超过旧 4 秒上限时，必须继续等待，不能先显示空画布。
  await page.locator('[data-system="robot1"]').click();
  await page.locator('.system-scene-particle-root[data-scene="robot"][data-model-status="ready"]').waitFor();
  await page.route('**/model/jiqirenGggg.fbx', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5200));
    await route.continue();
  });
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-data-renderer canvas[data-model-state="loading"]').waitFor({ state: 'attached' });
  await page.waitForTimeout(4300);
  assert.equal(await page.locator('.portal-data-renderer canvas').first().getAttribute('data-model-state'), 'loading');
  assert.notEqual(await page.locator('.portal-runtime-monitor').getAttribute('data-handoff'), 'complete');
  await page.locator('.portal-runtime-monitor[data-handoff="complete"][data-presentation="particle-morph"]').waitFor();
  await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await page.unroute('**/model/jiqirenGggg.fbx');
  console.log('NATIVE_SLOW_MODEL_HANDOFF_PASS');

  await page.route('**/model/jiqirenGggg.fbx', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1800));
    await route.continue();
  });
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-data-renderer canvas[data-model-state="loading"]').waitFor({ state: 'attached' });
  await page.getByRole('button', { name: '取消进入', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await page.locator('[data-system="footVideo"]').click();
  await page.waitForTimeout(2200);
  assert.equal(await page.locator('.portal-runtime-monitor').count(), 0);
  await page.locator('.system-scene-particle-root[data-scene="foot"][data-model-status="ready"]').waitFor();
  await page.unroute('**/model/jiqirenGggg.fbx');
  console.log('NATIVE_MODEL_CANCEL_PASS');

  // 原生主资源与备用资源均失败时，保留明确提示和返回入口。
  await page.locator('[data-system="wholeChair"]').click();
  await page.locator('.system-scene-particle-root[data-scene="chair"][data-model-status="ready"]').waitFor();
  await page.route('**/model/0717.fbx', (route) => route.abort());
  await page.route('**/model/chair3.glb', (route) => route.abort());
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.getByText('场景加载失败，请返回系统列表重试', { exact: true }).waitFor();
  await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await page.unroute('**/model/0717.fbx');
  await page.unroute('**/model/chair3.glb');
  console.log('NATIVE_MODEL_FAILURE_PASS');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('[data-system="footVideo"]').click();
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  console.log('PORTAL_SCENE_CATALOG_PASS', artifacts);
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('SCENE_ARTIFACTS', artifacts);
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
