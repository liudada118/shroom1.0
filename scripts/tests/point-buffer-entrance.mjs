import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const { createServer } = createRequire(new URL('../../client/package.json', import.meta.url))('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-point-buffer-entrance-'));
const errors = [], sockets = new Set();
let browser, page;
const license = { date: Date.now() + 30 * 86400000, nowDate: Date.now(), valid: true, selectFlag: 'all' };
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, 'vite-cache'), server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'point-buffer-entrance', enforce: 'pre',
    /** 临时只读场景入口；进出场、材质切换和动画时间都使用生产逻辑。 */
    transform(source, id) {
      if (!id.replaceAll('\\', '/').split('?')[0].endsWith('/components/three/smallBed.jsx')) return null;
      const hook = 'disposeParticleEntrance = installParticleEntrance(';
      assert.ok(source.includes(hook));
      return source.replace(hook, 'window.__entryScene = () => ({ points: particles, renderer, camera });\n' + hook);
    },
    /** 以真实门户进入小床，不启动采集或外部后台。 */
    configureServer(vite) {
      vite.middlewares.use('/__buffer-entrance', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__buffer-entrance', '<html><head><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});

/** 在真实时间推进到中段时暂停GSAP，renderer RAF继续运行以观测实际GPU绘制。 */
async function armPause(reverse = false) {
  await page.evaluate(backwards => {
    window.__entryPause = { reverse: backwards, stopped: false, samples: [] };
    let previous = backwards ? 1 : 0;
    const poll = () => {
      const state = window.__entryPause;
      if (state.stopped) return;
      const scene = window.__entryScene?.();
      const value = Number(scene?.renderer.domElement.dataset.particleEntrance);
      if (Number.isFinite(value)) {
        state.samples.push({ time: performance.now(), value });
        const moving = backwards ? value < previous : value > previous;
        previous = value;
        if (moving && value > 0.2 && value < 0.8) {
          window.__portalTestTimeline.pause();
          state.stopped = true;
          return;
        }
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  }, reverse);
}

/** 读取实际临时属性和两次GPU draw，不以canvas存在代替动画一致性。 */
async function snapshot() {
  return page.evaluate(() => {
    const { points, renderer } = window.__entryScene();
    const border = points.children.find(child => child.name === 'pressure-edge-buffer') || window.__entryLastBorder;
    window.__entryLastBorder = border;
    const origin = points.geometry.attributes.portalOrigin;
    const childOrigin = border.geometry.attributes.portalOrigin;
    const anchors = border.userData.particleEntranceAnchors;
    let mismatch = 0;
    if (origin && childOrigin && anchors) for (let index = 0; index < childOrigin.count; index++) {
      for (let axis = 0; axis < 3; axis++) if (childOrigin.array[index * 3 + axis] !== origin.array[anchors[index] * 3 + axis]) mismatch++;
    }
    return { progress: Number(renderer.domElement.dataset.particleEntrance),
      mainMaterial: points.material.uuid, childMaterial: border.material.uuid,
      mainKey: points.material.customProgramCacheKey(), childKey: border.material.customProgramCacheKey(),
      mainCount: points.geometry.attributes.position.count, childCount: border.geometry.attributes.position?.count || 0,
      mainAttributes: Object.keys(points.geometry.attributes), childAttributes: Object.keys(border.geometry.attributes),
      anchorCount: anchors?.length, mismatch, originCount: childOrigin?.count,
      recentDraws: window.__entryGpu.draws.slice(-12), pause: window.__entryPause,
      finite: Array.from(border.geometry.attributes.position?.array || []).every(Number.isFinite) };
  });
}

/** 检查主点和边框共用推进值、边框起点严格取主点锚点。 */
function verifyAnimated(state) {
  assert.ok(state.progress > 0 && state.progress < 1);
  assert.match(state.mainKey, /shroom-particle-entrance/);
  assert.match(state.childKey, /shroom-particle-entrance/);
  for (const key of ['portalOrigin', 'portalColor', 'portalSize', 'portalAlpha']) {
    assert.ok(state.mainAttributes.includes(key)); assert.ok(state.childAttributes.includes(key));
  }
  assert.equal(state.originCount, state.childCount);
  assert.equal(state.anchorCount, state.childCount);
  assert.equal(state.mismatch, 0);
  const main = state.recentDraws.filter(draw => draw.count === state.mainCount).at(-1);
  const child = state.recentDraws.filter(draw => draw.count === state.childCount).at(-1);
  assert.ok(main && child, 'both main and border must draw to the actual WebGL context');
  assert.ok(Math.abs(main.progress - state.progress) < 0.00001);
  assert.ok(Math.abs(child.progress - main.progress) < 0.00001);
  assert.ok(state.finite);
}

/** 通过当前真实渲染器接口重建边框，覆盖动画中的热调参。 */
async function changeEdge(width) {
  console.log('CHANGE_EDGE_START', width);
  await page.locator('.home').evaluate((element, value) => {
    let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
    while (fiber && typeof fiber.stateNode?.syncDisplayRendererConfig !== 'function') fiber = fiber.return;
    fiber.stateNode.com.current.sitValue({ edgeBuffer: value });
  }, width);
  console.log('CHANGE_EDGE_DONE', width);
}

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('valueConfig', JSON.stringify({ smallBedNoAlg__normal: { edgeBuffer1: 8, __explicitTuningFields: ['edgeBuffer1'] } }));
    window.__entryGpu = { draws: [] };
    for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Type) continue;
      const locations = new WeakMap(), progress = new WeakMap();
      const getLocation = Type.prototype.getUniformLocation;
      const setFloat = Type.prototype.uniform1f;
      const draw = Type.prototype.drawArrays;
      Type.prototype.getUniformLocation = function (program, name) {
        const location = getLocation.call(this, program, name);
        if (location && name === 'portalProgress') locations.set(location, program);
        return location;
      };
      Type.prototype.uniform1f = function (location, value) {
        const program = location && locations.get(location);
        if (program) progress.set(program, value);
        return setFloat.call(this, location, value);
      };
      Type.prototype.drawArrays = function (...args) {
        const scene = window.__entryScene?.();
        if (args[0] === this.POINTS && scene?.renderer.domElement === this.canvas) {
          window.__entryGpu.draws.push({ time: performance.now(), count: args[2], progress: progress.get(this.getParameter(this.CURRENT_PROGRAM)) });
          if (window.__entryGpu.draws.length > 500) window.__entryGpu.draws.splice(0, 100);
        }
        return draw.apply(this, args);
      };
    }
  });
  await page.routeWebSocket(/:19999/, socket => {
    sockets.add(socket); socket.onClose(() => sockets.delete(socket));
    socket.send(JSON.stringify({ licenseKey: 'fixture-key', ...license, currentSensorType: 'smallBedNoAlg' }));
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
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__buffer-entrance?actual-monitor=1`);
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.locator('[data-system="smallBedNoAlg"]').click();
  await armPause();
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.waitForFunction(() => window.__entryPause?.stopped);
  await page.waitForTimeout(120);
  const entering = await snapshot(); verifyAnimated(entering);
  console.log('ENTRANCE_MIDPOINT_PASS', entering.progress, entering.childCount);
  assert.equal(entering.childCount, 4608, 'saved width 8 must be part of the initial animation');
  await page.screenshot({ path: join(artifacts, 'enter-midpoint.png') });
  await changeEdge(4); await page.waitForTimeout(150);
  const resized = await snapshot(); verifyAnimated(resized);
  assert.notEqual(resized.childCount, entering.childCount);
  await changeEdge(0); await page.waitForTimeout(80);
  await changeEdge(8); await page.waitForTimeout(150);
  const recreated = await snapshot(); verifyAnimated(recreated);
  console.log('ENTRANCE_REBUILD_PASS', resized.childCount, recreated.childCount);
  assert.equal(recreated.childCount, entering.childCount);
  await page.evaluate(() => { window.__portalTestTimeline.resume(); });
  console.log('ENTRANCE_RESUMED');
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  await page.waitForTimeout(100);
  const completed = await snapshot();
  console.log('ENTRANCE_COMPLETED', completed.progress);
  assert.equal(completed.mainMaterial, completed.childMaterial);
  assert.ok(!completed.mainAttributes.some(key => key.startsWith('portal')) && !completed.childAttributes.some(key => key.startsWith('portal')));
  assert.doesNotMatch(completed.mainKey, /shroom-particle-entrance/);
  await page.screenshot({ path: join(artifacts, 'enter-complete.png') });
  await armPause(true);
  await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
  await page.waitForFunction(() => window.__entryPause?.stopped);
  await page.waitForTimeout(120);
  const exiting = await snapshot(); verifyAnimated(exiting);
  console.log('EXIT_MIDPOINT_PASS', exiting.progress);
  assert.ok(exiting.pause.samples.some((sample, index, all) => index > 0 && sample.value < all[index - 1].value));
  await page.screenshot({ path: join(artifacts, 'exit-midpoint.png') });
  await page.evaluate(() => { window.__portalTestTimeline.resume(); });
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  const returned = await snapshot();
  assert.ok(!returned.mainAttributes.some(key => key.startsWith('portal')) && !returned.childAttributes.some(key => key.startsWith('portal')));
  assert.equal(returned.mainMaterial, completed.mainMaterial);
  assert.equal(returned.childMaterial, completed.childMaterial);
  assert.deepEqual(errors, []);
  console.log('POINT_BUFFER_ENTRANCE_PASS', JSON.stringify({ artifacts, entering, resized, recreated, completed, exiting, returned }));
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('POINT_BUFFER_ENTRANCE_FAILED', JSON.stringify({ artifacts, errors, state: await snapshot().catch(() => null) })); throw error;
} finally { await browser?.close(); await server.close(); }
