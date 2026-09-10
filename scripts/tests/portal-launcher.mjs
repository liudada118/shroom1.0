import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const requireRoot = createRequire(new URL('../../package.json', import.meta.url));
const { createAlgorithmMarketService } = requireRoot('./backend/extension-host/runtime/algorithmMarketService');
const { discoverBuiltinAlgorithmPackages } = requireRoot('./backend/extension-host/manifest/builtinAlgorithmPackageCatalog');
const { createChannelBus } = requireRoot('@shroom/backend/telemetry/channelBus.js');
const { createRealtimeTelemetryGateway } = requireRoot('./backend/kernel/realtime/realtimeTelemetryGateway');
const algorithmBus = createChannelBus();
let algorithmSystem = 'hand';
const algorithmRequests = [];
const algorithmService = createAlgorithmMarketService({
  channelBus: algorithmBus,
  packages: discoverBuiltinAlgorithmPackages({ roots: [fileURLToPath(new URL('../../agent-resources/algorithm-packages', import.meta.url))], includeResolved: true }).packages,
  getContext: () => ({ allowed: true, playback: false, sensorType: algorithmSystem }),
  createRunner: () => {
    /** 明确的测试算法，不调用本机 Python 或原生生命体征库。 */
    const run = async () => ({ metrics: { respirationRate: 18, copX: 12.5, copY: 10.5, onbedFilterHealthy: 1 } });
    run.dispose = async () => {}; return run;
  },
});
const { createServer } = requireClient('vite');
const server = await createServer({
  root: fileURLToPath(new URL('../../client/', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [{
    name: 'portal-launcher-test',
    /** 仅用于浏览器回归，实际 Home 使用拦截接口，绝不连接真实硬件。 */
    configureServer(vite) {
      vite.middlewares.use('/__portal-test', async (req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml('/__portal-test', '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});
const screenshots = await mkdtemp(join(tmpdir(), 'shroom-portal-'));
let browser;
let page;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'], args: process.argv.includes('--software') ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'no-preference' });
  page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('crash', () => console.error('PORTAL_BROWSER_CRASH'));
  const errors = [];
  // 观察真实 WebGL 上传与绘制，不向页面注入传感器数据。
  await page.addInitScript(() => {
    window.__portalGpu = { invalidBuffers: 0, pointDraws: 0, pressureAllocations: 0, samples: [], flights: [], pressureMorph: [] };
    for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Type) continue;
      const projectionLocations = new WeakSet();
      const morphLocations = new WeakSet();
      const morphPrograms = new WeakMap();
      const locationPrograms = new WeakMap();
      const currentPrograms = new WeakMap();
      const projectionAspects = new WeakMap();
      const getUniformLocation = Type.prototype.getUniformLocation;
      /** 识别真实投影矩阵，检查换宿主首帧的相机与画布比例。 */
      Type.prototype.getUniformLocation = function (...args) {
        const location = getUniformLocation.apply(this, args);
        if (location && args[1] === 'projectionMatrix') projectionLocations.add(location);
        if (location && args[1] === 'portalProgress') {
          morphLocations.add(location); locationPrograms.set(location, args[0]); morphPrograms.set(args[0], 0);
        }
        return location;
      };
      const useProgram = Type.prototype.useProgram;
      /** 区分真实绘制用的是交接着色器还是已经恢复的原生压力材质。 */
      Type.prototype.useProgram = function (program) {
        currentPrograms.set(this, program);
        return useProgram.call(this, program);
      };
      const uniform1f = Type.prototype.uniform1f;
      /** 记录原生压力着色器实际收到的形变进度，不以 CSS 透明度冒充粒子变形。 */
      Type.prototype.uniform1f = function (...args) {
        if (morphLocations.has(args[0])) {
          window.__portalGpu.pressureMorph.push(args[1]); morphPrograms.set(locationPrograms.get(args[0]), args[1]);
        }
        return uniform1f.apply(this, args);
      };
      const uniformMatrix4fv = Type.prototype.uniformMatrix4fv;
      /** 透视投影矩阵的纵横缩放之比就是相机 aspect。 */
      Type.prototype.uniformMatrix4fv = function (...args) {
        if (projectionLocations.has(args[0])) projectionAspects.set(this, args[2][5] / args[2][0]);
        return uniformMatrix4fv.apply(this, args);
      };
      for (const name of ['bufferData', 'bufferSubData']) {
        const original = Type.prototype[name];
        /** 记录无效顶点上传，保持 WebGL 调用及参数不变。 */
        Type.prototype[name] = function (...args) {
          for (const data of args) if (data instanceof Float32Array) {
            if (!data.every(Number.isFinite)) window.__portalGpu.invalidBuffers++;
            if (name === 'bufferData' && data.length === 72 * 72 * 3 && this.canvas.closest('.portal-data-renderer')) window.__portalGpu.pressureAllocations++;
            if (data.length === 10800 && data.some((value) => value < 0)) {
              const root = document.querySelector('.system-scene-particle-root');
              // 扫掠按空间排序；分散采样避免只读到早已到位的第一小簇粒子。
              window.__portalGpu.samples.push({ time: performance.now(), scene: root?.dataset.scene, state: root?.dataset.modelStatus, phase: root?.dataset.morphPhase, positions: Array.from({ length: 192 }, (_, index) => data[Math.floor(index / 3) * 168 + index % 3]) });
              if (window.__portalGpu.samples.length > 2000) window.__portalGpu.samples.shift();
            }
          }
          return original.apply(this, args);
        };
      }
      const originalDraw = Type.prototype.drawArrays;
      /** 确認粒子确实走到了 GPU 绘制调用。 */
      Type.prototype.drawArrays = function (...args) {
        if (args[0] === this.POINTS) window.__portalGpu.pointDraws++;
        if (args[0] === this.POINTS && window.__portalReturnDraws) {
          const monitor = this.canvas.closest('.portal-runtime-monitor');
          if (monitor?.dataset.handoff === 'leaving') window.__portalReturnDraws.push({ time: performance.now(),
            progress: Number(this.canvas.dataset.particleEntrance), shaderProgress: morphPrograms.get(currentPrograms.get(this)) ?? null,
            opacity: Number(this.canvas.style.opacity || 1) });
        }
        const flight = this.canvas.closest('.portal-particle-flight');
        if (flight && args[0] === this.POINTS) {
          const transform = new DOMMatrix(getComputedStyle(flight).transform);
          const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
          window.__portalGpu.flights.push({
            scaleX: Math.hypot(transform.a, transform.b), scaleY: Math.hypot(transform.c, transform.d),
            backingError: Math.abs((this.canvas.width / this.canvas.height) / aspect - 1),
            projectionError: Math.abs(projectionAspects.get(this) / aspect - 1),
          });
          if (window.__portalGpu.flights.length > 2000) window.__portalGpu.flights.shift();
        }
        return originalDraw.apply(this, args);
      };
    }
  });
  page.on('pageerror', (error) => { errors.push(error.message); console.error('PAGE_ERROR', error.message); });
  let socket;
  const sockets = new Set();
  let licenseFailure = false;
  let catalogFailure = false;
  const commands = [];
  await page.routeWebSocket(/:19999/, (ws) => {
    socket = ws;
    sockets.add(ws);
    ws.onClose(() => sockets.delete(ws));
    ws.send(JSON.stringify({ date: Date.now() + 30 * 86400000, nowDate: Date.now(), selectFlag: 'all', licenseKey: 'fixture-key' }));
  });
  await page.route('http://127.0.0.1:19245/**', async (route) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (route.request().url().endsWith('/api/algorithm-market')) {
      try {
        const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
        if (body) algorithmRequests.push(body);
        return route.fulfill({ headers, json: body ? await algorithmService.toggle(body) : algorithmService.snapshot() });
      } catch (error) { return route.fulfill({ status: error.httpStatus || 500, headers, json: { error: error.message } }); }
    }
    if (route.request().url().endsWith('/api/display-systems')) {
      return route.fulfill({ status: catalogFailure ? 500 : 200, headers, json: { displaySystems: { runtimeDefinitions: [{
        sensorDefinition: { type: 'portal-custom-mat' },
        displayMetadata: { id: 'portal-custom-mat', sensorType: 'portal-custom-mat', name: '测试 32×32 呼吸重心系统', matrix: { rows: 32, cols: 32 } },
      }] } } });
    }
    if (route.request().url().endsWith('/api/commands')) {
      const command = route.request().postDataJSON();
      commands.push(command);
      if (command.type === 'sensor.switch') algorithmSystem = command.payload.sensorType;
      if (command.type === 'license.activate') for (const peer of sockets) peer.send(JSON.stringify(licenseFailure
        ? { licenseError: '测试：密钥错误' }
        : { date: Date.now() + 30 * 86400000, nowDate: Date.now(), selectFlag: 'all', valid: true }));
      return route.fulfill({ headers, json: { code: 0, data: { ok: true } } });
    }
    return route.fulfill({ status: 404, headers, json: {} });
  });
  if (!process.argv.includes('--monitor-only')) {
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__portal-test`);
  await page.getByRole('heading', { name: 'Shroom Vision' }).waitFor();
  await page.getByText('本机服务已连接').waitFor();
  await page.locator('.system-scene-particle-root[data-scene="shroom"][data-model-status="ready"]').waitFor();
  const originalCanvas = await page.locator('.system-scene-particle-root canvas').elementHandle();
  await page.screenshot({ path: join(screenshots, 'home.png'), fullPage: true });
  await page.getByRole('button', { name: /具身触觉/ }).focus();
  await page.keyboard.press('Enter');
  await page.locator('.system-scene-particle-root[data-host-transition="flying"]').waitFor();
  const entrance = await page.locator('.system-selector-backdrop').evaluate((node) => ({
    drift: getComputedStyle(node.querySelector('.system-selector-dust'), '::before').animationDuration,
    items: [...node.querySelectorAll('.portal-system-option')].slice(0, 3).map((item) => Number(getComputedStyle(item).opacity)),
    scene: Number(getComputedStyle(node.querySelector('.system-scene-chrome')).opacity),
  }));
  assert.equal(entrance.drift, '18s', '保留参考背景慢漂');
  assert.ok(entrance.items.some((opacity) => opacity < 1) && entrance.scene < 1, '系统逐项与右侧场景必须有分层入场');
  assert.equal(await page.locator('.portal-particle-flight').evaluate((node) => getComputedStyle(node).position), 'fixed', '共享粒子临时层不能参与页面排版');
  await page.screenshot({ path: join(screenshots, 'particles-to-selector.png') });
  await page.getByRole('heading', { name: '选择你的展示系统' }).waitFor();
  await page.waitForFunction(() => document.activeElement?.id === 'portal-selector-heading');
  await page.goBack();
  await page.getByRole('heading', { name: 'Shroom Vision' }).waitFor();
  await page.goForward();
  await page.getByRole('heading', { name: '选择你的展示系统' }).waitFor();
  assert.equal(commands.length, 0, '浏览分类不发送任何控制命令');
  const first = page.locator('.portal-system-option').first();
  await first.click();
  assert.equal(await first.getAttribute('data-system'), 'hand');
  await page.locator('.system-scene-particle-root[data-scene="matrix"][data-model-status="ready"][data-host-transition="idle"]').waitFor();
  await page.screenshot({ path: join(screenshots, 'hand-matrix.png'), fullPage: true });
  await page.locator('[data-system="hand0205"]').click();
  await page.locator('.system-scene-particle-root[data-scene="glove"][data-model-status="ready"]').waitFor();
  // 独立触发一次已加载模型间的切换，不依赖浏览器前进/后退是否合并渲染帧。
  await page.getByRole('button', { name: '座椅感知', exact: true }).click();
  await page.locator('.system-scene-particle-root[data-scene="chair"][data-model-status="ready"]').waitFor();
  await page.evaluate(() => { window.__portalGpu.samples = []; });
  await page.getByRole('button', { name: '具身触觉', exact: true }).click();
  await page.locator('[data-system="hand0205"]').click();
  await page.locator('.system-scene-particle-root[data-scene="glove"][data-model-status="ready"]').waitFor();
  const samples = await page.evaluate(() => window.__portalGpu.samples);
  const changing = samples.filter((sample) => sample.scene === 'glove' && sample.state === 'morphing');
  assert.ok(changing.length >= 2, '正常动画至少上传两个形变中间帧，不能只验证减少动画后的终态');
  assert.ok(changing.some((sample) => sample.positions.some((value, index) => Math.abs(value - changing[0].positions[index]) > 0.1)), '中间帧必须真的改变模型顶点，不只是背景在动');
  const settling = changing.filter((sample) => sample.phase === 'settling');
  assert.ok(settling.length >= 2 && settling.some((sample) => sample.positions.some((value, index) => Math.abs(value - settling[0].positions[index]) > 0.01)), '扫掠结束后保留真实粒子阻尼收尾');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.locator('.system-scene-particle-root[data-host-transition="flying"]').waitFor();
  assert.equal(await page.locator('.system-selector-backdrop').evaluate((node) => getComputedStyle(node).visibility), 'visible', '关闭时不能立即切断倒放');
  await page.screenshot({ path: join(screenshots, 'particles-return-home.png') });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.system-selector-backdrop')).visibility === 'hidden');
  assert.ok(await page.locator('.system-selector-backdrop').evaluate((node) => Number(getComputedStyle(node).opacity) < 0.01), '真正完成退场后才能隐藏');
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.locator('.system-scene-particle-host > .system-scene-particle-root[data-host-transition="idle"]').waitFor();
  assert.equal(await page.locator('.portal-particle-flight').count(), 0, '快速返回再打开不能留下旧飞行层');
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.locator('.system-scene-particle-root[data-host-transition="flying"]').waitFor();
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.locator('.system-scene-particle-host > .system-scene-particle-root[data-host-transition="idle"]').waitFor();
  assert.equal(await page.locator('.portal-particle-flight').count(), 0, '中途反向后清理旧层');
  assert.equal(await page.locator('.system-selector-backdrop').evaluate((node) => getComputedStyle(node).visibility), 'visible', '过期退场回调不能隐藏重新打开的弹层');
  const flights = await page.evaluate(() => window.__portalGpu.flights);
  assert.ok(flights.length >= 2 && flights.some((sample) => Math.abs(sample.scaleX - 1) > 0.01), '必须检查实际缩放中的过渡帧');
  assert.ok(flights.every((sample) => Math.abs(sample.scaleX - sample.scaleY) < 0.00001), `跨宿主往返的每一绘制帧都必须等比缩放：${JSON.stringify(flights.filter((sample) => Math.abs(sample.scaleX - sample.scaleY) >= 0.00001).slice(0, 3))}`);
  assert.ok(flights.every((sample) => sample.backingError < 0.005 && sample.projectionError < 0.005), '换宿主首帧就要同步相机、Canvas 背板与 CSS 比例');
  console.log('PORTAL_NORMAL_MOTION_PASS');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.system-selector-dust').evaluate((node) => getComputedStyle(node, '::before').animationName), 'none');
  await page.locator('[data-system="hand0205"]').click();
  await page.locator('.system-scene-particle-root[data-scene="glove"][data-model-status="ready"]').waitFor();
  assert.equal(await originalCanvas.evaluate((node) => node === document.querySelector('.system-scene-particle-host canvas')), true, '移动同一画布，不重建 WebGL');
  await page.screenshot({ path: join(screenshots, 'glove.png'), fullPage: true });
  await page.getByRole('button', { name: '返回首页', exact: true }).focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('button', { name: '全部', exact: true }).evaluate((node) => document.activeElement === node), true, '弹层焦点不能穿透到首页');
  await page.getByRole('button', { name: '座椅感知', exact: true }).click();
  await page.locator('.system-scene-particle-root[data-scene="chair"][data-model-status="ready"]').waitFor();
  await page.screenshot({ path: join(screenshots, 'chair.png'), fullPage: true });
  await page.getByRole('button', { name: '康养监测', exact: true }).click();
  await page.locator('[data-system="bed4096"]').click();
  await page.locator('.system-scene-particle-root[data-scene="care"][data-model-status="ready"]').waitFor();
  await page.getByRole('button', { name: '具身触觉', exact: true }).click();
  await page.locator('[data-system="robot1"]').click();
  await page.locator('.system-scene-particle-root[data-scene="robot"][data-model-status="ready"]').waitFor({ timeout: 60000 });
  await page.screenshot({ path: join(screenshots, 'robot.png'), fullPage: true });
  await page.getByRole('button', { name: '定制系统', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索系统' }).fill('呼吸重心');
  await page.getByRole('button', { name: /测试 32×32 呼吸重心系统/ }).click();
  await page.locator('.system-scene-particle-root[data-scene="matrix"][data-model-status="ready"]').waitFor();
  const gpu = await page.evaluate(() => window.__portalGpu);
  assert.equal(gpu.invalidBuffers, 0, '所有预览模型顶点必须是有限值');
  assert.ok(gpu.pointDraws > 0, '真实绘制粒子，不只是创建 Canvas');
  await page.screenshot({ path: join(screenshots, 'selector.png'), fullPage: true });
  assert.equal(await page.locator('.portal-system-option').count(), 1);
  assert.equal(commands.length, 0, '选中预览不激活系统');
  licenseFailure = true;
  await page.getByRole('button', { name: '进入该系统' }).click();
  await page.getByRole('alert').filter({ hasText: '测试：密钥错误' }).waitFor();
  assert.ok(!commands.some((command) => command.type === 'sensor.switch'));
  assert.equal(await page.locator('.is-scene-expanded').count(), 0, '授权失败不放大预览或伪装进入系统');
  licenseFailure = false;
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { window.__portalPrepareGate = new Promise((resolve) => { window.__releasePortalPreparation = resolve; }); });
  await page.getByRole('button', { name: '进入该系统' }).click();
  await page.getByRole('button', { name: '返回系统列表', exact: false }).click();
  await page.getByRole('button', { name: '进入该系统' }).waitFor();
  await page.evaluate(() => { window.__releasePortalPreparation(); window.__portalPrepareGate = null; });
  await page.waitForFunction(() => document.querySelector('.system-scene-particle-root')?.dataset.framing === 'preview');
  assert.ok(!page.url().endsWith('/system'), '放大后返回不能被迟到的页面加载结果带走');
  await page.evaluate(() => { window.__portalPrepareFailure = true; });
  await page.getByRole('button', { name: '进入该系统' }).click();
  await page.getByRole('alert').filter({ hasText: '监测页面加载失败' }).waitFor();
  assert.equal(await page.locator('.is-scene-expanded').count(), 0, '界面加载失败要恢复可操作的选择器');
  await page.evaluate(() => { window.__portalPrepareFailure = false; });
  const commandsBeforeEntry = commands.length;
  await page.evaluate(() => { window.__portalPrepareGate = new Promise((resolve) => { window.__releasePortalPreparation = resolve; }); });
  await page.getByRole('button', { name: '进入该系统' }).click();
  await page.locator('.system-selector-panel.is-scene-expanded').waitFor();
  assert.equal(await originalCanvas.evaluate((node) => node === document.querySelector('.system-scene-particle-host canvas')), true, '进入系统放大当前 Canvas，而不是创建另一个模型');
  const expanded = await page.locator('.system-scene-particle-host').boundingBox();
  assert.ok(expanded.width >= 1438 && expanded.height >= 898, '进入阶段的同一 3D 场景必须填满视口');
  await page.screenshot({ path: join(screenshots, 'particles-enter-system.png') });
  await page.evaluate(() => { window.__releasePortalPreparation(); window.__portalPrepareGate = null; });
  await page.getByRole('heading', { name: '已进入：portal-custom-mat' }).waitFor();
  await page.waitForFunction(() => !document.documentElement.dataset.portalNavigating);
  assert.equal(await originalCanvas.evaluate((node) => node === document.querySelector('.system-scene-particle-host canvas')), true, '监测控件出现之后仍然使用同一个粒子 Canvas');
  assert.equal(await page.locator('.portal-particle-flight').count(), 0, '进入后不遗留临时飞行层');
  assert.deepEqual(commands.slice(commandsBeforeEntry).map((command) => command.type), ['license.activate', 'sensor.switch']);
  assert.equal(commands.at(-1).payload.sensorType, 'portal-custom-mat');
  console.log('PORTAL_NAVIGATION_PASS');
  await page.getByRole('button', { name: '返回系统列表', exact: false }).first().click();
  await page.getByRole('heading', { name: '测试 32×32 呼吸重心系统' }).waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [375, 812], [812, 375]]) {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: '进入该系统' }).scrollIntoViewIfNeeded();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(overflow <= 1, `系统目录在 ${width}×${height} 横向溢出 ${overflow}`);
    const bounds = await page.locator('.system-selector-backdrop').evaluate((node) => ({
      x: node.scrollWidth - node.clientWidth, y: node.scrollHeight - node.clientHeight,
      overflow: getComputedStyle(node).overflow, body: getComputedStyle(document.body).overflow,
    }));
    assert.ok(bounds.x <= 1 && bounds.y <= 1, `弹窗不能撑大外层 ${width}×${height}：${JSON.stringify(bounds)}`);
    assert.equal(bounds.overflow, 'clip');
    assert.equal(bounds.body, 'hidden');
    await page.waitForFunction(() => {
      const canvas = document.querySelector('.system-scene-particle-root canvas');
      const rect = canvas.getBoundingClientRect();
      return rect.height > 0 && canvas.height <= Math.ceil(rect.height * 1.5) + 2;
    });
    const heights = await page.evaluate(async () => {
      const canvas = document.querySelector('.system-scene-particle-root canvas');
      const samples = [];
      for (let i = 0; i < 12; i++) {
        await new Promise(requestAnimationFrame);
        samples.push(canvas.getBoundingClientRect().height);
      }
      return samples;
    });
    assert.ok(Math.max(...heights) - Math.min(...heights) < 1, 'Canvas 高度不能形成 DPR/布局反馈循环');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '返回首页', exact: true }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: join(screenshots, 'home-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: /选择系统/, exact: false }).filter({ hasText: '选择系统' }).first().click();
  await page.getByRole('textbox', { name: '搜索系统' }).fill('没有这个系统');
  assert.equal(await page.getByRole('button', { name: '进入该系统' }).isDisabled(), true);
  await page.getByRole('textbox', { name: '搜索系统' }).fill('');
  catalogFailure = true;
  await page.getByRole('button', { name: '刷新系统列表' }).click();
  await page.getByRole('alert').filter({ hasText: '自定义系统读取失败' }).waitFor();
  assert.equal(await page.locator('.portal-system-option').filter({ hasText: '测试 32×32' }).count(), 0);
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'Shroom Vision' }).waitFor();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/model/chair3.glb', (route) => route.fulfill({ status: 404, body: 'missing model' }));
  await page.reload();
  await page.getByRole('button', { name: /座椅感知/ }).click();
  await page.locator('.system-scene-particle-root[data-scene="chair"][data-model-status="error"]').waitFor();
  assert.equal(await page.getByRole('button', { name: '进入该系统' }).isEnabled(), true, '预览失败不阻断真实系统入口');
  await page.getByRole('button', { name: '具身触觉', exact: true }).click();
  await page.locator('.system-scene-particle-root[data-scene="matrix"][data-model-status="ready"]').waitFor();
  console.log('PORTAL_RESPONSIVE_AND_FAILURES_PASS');
  }
  catalogFailure = false;
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__portal-test?actual-monitor=1`);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.locator('[data-system="hand"]').click();
  await page.locator('.system-scene-particle-root[data-scene="matrix"][data-model-status="ready"]').waitFor();
  const runtimeCanvas = await page.locator('.system-scene-particle-root canvas').elementHandle();
  const selectorBounds = await page.locator('.system-scene-particle-host').boundingBox();
  await page.evaluate(() => {
    window.__portalDirect = { framings: [], captures: [] };
    const root = document.querySelector('.system-scene-particle-root');
    root.addEventListener('system-scene:framing-transition', (event) => window.__portalDirect.framings.push(event.detail.framing));
    root.addEventListener('system-scene:capture-particles', () => window.__portalDirect.captures.push(root.getBoundingClientRect().toJSON()));
    window.__portalPrepareGate = new Promise((resolve) => { window.__releasePortalPreparation = resolve; });
  });
  await page.getByRole('button', { name: '进入该系统' }).click();
  await page.getByRole('button', { name: '取消进入', exact: true }).waitFor();
  assert.equal(await page.locator('.is-scene-expanded').count(), 0, '准备期间不能先把装饰预览放大全屏');
  assert.equal(await page.locator('.portal-runtime-monitor').count(), 0);
  assert.deepEqual(await page.locator('.system-scene-particle-host').boundingBox(), selectorBounds, '慢加载不移动列表中的预览');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__releasePortalPreparation(); window.__portalPrepareGate = null; });
  await page.getByRole('button', { name: '进入该系统' }).waitFor();
  assert.equal(await page.locator('.portal-runtime-monitor').count(), 0, '取消后迟到的加载结果不能重新进入系统');
  await page.evaluate(() => { window.__portalPrepareFailure = true; });
  await page.getByRole('button', { name: '进入该系统' }).click();
  await page.getByRole('alert').filter({ hasText: '监测页面加载失败' }).waitFor();
  await page.evaluate(() => { window.__portalPrepareFailure = false; });
  const handEntryCommands = commands.length;
  await page.evaluate(() => {
    window.__portalToolsFrames = [];
    /** 逐帧记录工具卡实际位置，覆盖入场位移和 clearProps 收尾。 */
    function sampleTools() {
      const card = document.querySelector('.portal-quick-tools');
      if (card && Number(getComputedStyle(card).opacity) > .1) {
        const rect = card.getBoundingClientRect();
        window.__portalToolsFrames.push({ y: rect.y, height: rect.height });
      }
      window.__portalToolsFrame = requestAnimationFrame(sampleTools);
    }
    window.__portalToolsFrame = requestAnimationFrame(sampleTools);
  });
  await page.getByRole('button', { name: '进入该系统' }).click();
  console.log('PORTAL_ACTUAL_LOADING');
  await page.locator('.home .title').waitFor({ timeout: 60000 });
  console.log('PORTAL_ACTUAL_MOUNTED');
  await page.locator('.portal-data-renderer canvas').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('.portal-runtime-monitor')?.dataset.handoff === 'entering');
  const handoff = await page.locator('.portal-monitor-content').evaluate((node) => ({
    opacity: Number(getComputedStyle(node).opacity),
    preview: getComputedStyle(document.querySelector('.system-scene-particle-host')).visibility,
  }));
  assert.equal(handoff.opacity, 1, '正式画布直接接管粒子，不用整页透明度切换');
  assert.equal(handoff.preview, 'hidden', '同一形态由正式点图着色器接续，不叠两团粒子');
  assert.equal(await page.locator('.portal-runtime-monitor').getAttribute('data-presentation'), 'particle-morph');
  assert.equal(await page.locator('.is-scene-expanded').count(), 0, '手部从列表直接形变，不能存在中间的放大场景');
  const directEntry = await page.evaluate(() => window.__portalDirect);
  assert.deepEqual(directEntry.framings, [], '手部入口不能启动 focused 镜头过渡');
  assert.equal(directEntry.captures.length, 1, '单次进入只捕获一次列表投影');
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(directEntry.captures[0][key] - selectorBounds[key]) < 1, `形变起点必须留在列表原位：${key}`);
  const actualBounds = await page.locator('.portal-data-renderer canvas').first().boundingBox();
  assert.ok(actualBounds.width >= 1438 && actualBounds.height >= 898, '后台准备的正式渲染器已具有完整视口，交接时不能再改尺寸');
  assert.deepEqual(commands.slice(handEntryCommands).map((command) => command.type).filter((type) => ['license.activate', 'sensor.switch'].includes(type)), ['license.activate', 'sensor.switch'], '形变不能重复授权或切换系统');
  await page.waitForFunction(() => {
    return window.__portalGpu.pressureMorph.some((value) => value > .2 && value < .85);
  });
  await page.screenshot({ path: join(screenshots, 'pressure-particle-morph.png') });
  await page.waitForFunction(() => document.querySelector('.portal-runtime-monitor')?.dataset.handoff === 'complete');
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.portal-observatory')).opacity) > .99);
  const allocationGrowth = await page.evaluate(async () => {
    const before = window.__portalGpu.pressureAllocations;
    for (let index = 0; index < 12; index++) await new Promise(requestAnimationFrame);
    return window.__portalGpu.pressureAllocations - before;
  });
  assert.equal(allocationGrowth, 0, '稳定手部点图应复用顶点缓冲，不逐帧 bufferData 重建');
  const toolsFrames = await page.evaluate(() => {
    cancelAnimationFrame(window.__portalToolsFrame);
    return window.__portalToolsFrames;
  });
  const toolsVerticalTravel = Math.max(...toolsFrames.map((frame) => frame.y)) - Math.min(...toolsFrames.map((frame) => frame.y));
  console.log('QUICK_TOOLS_ENTRY', { frames: toolsFrames.length, verticalTravel: toolsVerticalTravel });
  assert.ok(toolsFrames.length >= 5, '必须采样真实入场帧，不能只检查动画终点');
  assert.ok(toolsVerticalTravel < 1, '快捷工具入场只横向淡入，布局定位不能被动画覆盖而上下跳动');
  await page.screenshot({ path: join(screenshots, 'actual-monitor-waiting.png') });
  assert.ok(await page.evaluate(() => window.__portalGpu.pressureMorph.filter((value) => value > 0 && value < 1).length > 2), '正式点图 GPU 必须收到真实的中间形变进度');
  // 仅在隔离 WS 中发送测试帧，验证自动交接之后真实统计链仍在工作。
  socket.send(JSON.stringify({
    type: 'sensor.frame', schemaVersion: 1, channelId: 'hand:sit', displaySystemId: 'hand',
    sensorId: 'sit', sensorLabel: '测试手垫', outputChannel: 'sit', sensorType: 'hand',
    source: 'realtime', sequence: 1, timestamp: Date.now(), quality: 'good',
    payload: { value: Array(1024).fill(128), matrix: { rows: 32, cols: 32, total: 1024 } },
  }));
  await page.waitForFunction(() => Number(document.querySelector('.aside .pressData')?.textContent) === 131072);
  await page.screenshot({ path: join(screenshots, 'actual-hand-monitor.png') });
  assert.equal(await page.evaluate(() => localStorage.getItem('file')), 'hand');
  assert.equal(await runtimeCanvas.evaluate((node) => node === document.querySelector('.system-scene-particle-host canvas')), true, '真实监测页保留原粒子 Canvas');
  const homeNode = await page.locator('.home').elementHandle();
  const commandsBeforeView = commands.length;
  assert.equal(await page.getByRole('button', { name: '压力数据视图', exact: true }).count(), 0, '进入即为压力视图，不要求第二次选择');
  assert.equal(await page.getByRole('button', { name: '粒子场景', exact: true }).count(), 0);
  assert.equal(await page.locator('.portal-data-renderer').evaluate((node) => getComputedStyle(node).visibility), 'visible');
  assert.equal(await page.locator('.system-scene-particle-host').evaluate((node) => getComputedStyle(node).visibility), 'hidden');
  await page.screenshot({ path: join(screenshots, 'actual-pressure-view.png') });
  const dockLayout = await page.locator('.aside').evaluate((node) => ({
    bottom: node.getBoundingClientRect().bottom,
    top: node.getBoundingClientRect().top,
    display: getComputedStyle(node).display,
    cards: [...node.querySelectorAll(':scope > .asideContent')].slice(0, 2).map((card) => ({ x: card.getBoundingClientRect().x, y: card.getBoundingClientRect().y })),
  }));
  assert.equal(dockLayout.display, 'block', '正式展示使用参考项目最新的左侧纵向图表');
  assert.ok(dockLayout.top < 220 && dockLayout.cards[1].y > dockLayout.cards[0].y && dockLayout.cards[1].x === dockLayout.cards[0].x);
  const toolsBounds = await page.locator('.portal-quick-tools').boundingBox();
  assert.ok(toolsBounds.x > 1200 && Math.abs(toolsBounds.width - 184) < 1, '右侧工具卡必须使用最新宽度');
  assert.ok((await page.locator('.home > .title').boundingBox()).y < 30, '会话栏位于顶部而非场景下方');
  const typeScale = await page.locator('.aside').evaluate((node) => ({
    heading: parseFloat(getComputedStyle(node.querySelector('.asideTitle')).fontSize),
    reading: parseFloat(getComputedStyle(node.querySelector('.pressData')).fontSize),
    label: parseFloat(getComputedStyle(node.querySelector('.dataItem')).fontSize),
    modes: [...document.querySelectorAll('.portal-session-modes button')].map((button) => getComputedStyle(button).whiteSpace),
  }));
  assert.ok(typeScale.heading >= 16 && typeScale.reading >= 28 && typeScale.label >= 12, '展示页不能再用微字呈现关键数据');
  assert.deepEqual(typeScale.modes, ['nowrap', 'nowrap'], '放大后的实时与回放文字不能挤成两行');
  await page.getByRole('button', { name: '算法', exact: true }).click();
  const market = page.getByRole('complementary', { name: '算法超市', exact: true });
  await market.waitFor();
  assert.ok(Math.abs((await page.locator('.portal-quick-tools').boundingBox()).y - toolsBounds.y) < 1, '展开算法超市不能推移快捷工具');
  console.log('PORTAL_MARKET_OPEN');
  assert.equal(await page.locator('.display-system-builder-shell').filter({ visible: true }).count(), 0, '算法入口应直接展开超市，不是配置弹窗');
  const marketBounds = await market.boundingBox();
  const observatoryBounds = await page.locator('.portal-observatory').boundingBox();
  assert.ok(marketBounds.x >= observatoryBounds.x + observatoryBounds.width && marketBounds.x + marketBounds.width <= toolsBounds.x, '桌面超市位于图表与工具栏之间');
  await market.getByRole('button', { name: '添加峰值压力', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('shroom.formulaCharts.v1.hand') || '[]').length === 1);
  console.log('PORTAL_MARKET_CLICK_ADDED');
  assert.equal(await page.locator('.canvas-draft-bar').evaluate((node) => getComputedStyle(node).visibility), 'hidden', '旧配置浮条不能盖住超市卡片的添加按钮');
  await page.screenshot({ path: join(screenshots, 'algorithm-first-add.png') });
  await market.getByRole('button', { name: '已添加峰值压力', exact: true }).click();
  console.log('PORTAL_MARKET_DUPLICATE_CHECKED');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('shroom.formulaCharts.v1.hand')).length), 1, '重复添加不删除、不覆盖已有图表');
  const activePoints = market.getByRole('button', { name: '添加有效点数', exact: true });
  await activePoints.scrollIntoViewIfNeeded();
  // Windows 无头 Chrome 的原生拖动会阻塞 CDP mouseUp，使用真实 DataTransfer 驱动 DOM 拖放协议。
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await activePoints.dispatchEvent('dragstart', { dataTransfer: transfer });
  await page.locator('.portal-observatory').dispatchEvent('dragover', { dataTransfer: transfer });
  assert.equal(await page.locator('.is-algorithm-drop-active').count(), 1, '拖入时显示落点提示');
  await page.locator('.portal-observatory').dispatchEvent('drop', { dataTransfer: transfer });
  await market.getByRole('button', { name: '已添加有效点数', exact: true }).dispatchEvent('dragend', { dataTransfer: transfer });
  await transfer.dispose();
  console.log('PORTAL_MARKET_DRAG_RELEASED');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('shroom.formulaCharts.v1.hand') || '[]').length === 2);
  assert.equal(await page.locator('.is-algorithm-drop-active').count(), 0, '释放后清理落点高亮');
  socket.send(JSON.stringify({
    type: 'sensor.frame', schemaVersion: 1, channelId: 'hand:sit', displaySystemId: 'hand',
    sensorId: 'sit', sensorLabel: '测试手垫', outputChannel: 'sit', sensorType: 'hand',
    source: 'realtime', sequence: 2, timestamp: Date.now(), quality: 'good',
    payload: { value: Array(1024).fill(128), matrix: { rows: 32, cols: 32, total: 1024 } },
  }));
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('.customChartCard')];
    return cards.some((card) => card.querySelector('h2')?.textContent === '峰值压力' && Number(card.querySelector('.pressData').textContent) === 128)
      && cards.some((card) => card.querySelector('h2')?.textContent === '有效点数' && Number(card.querySelector('.pressData').textContent) === 1024);
  });
  await page.getByRole('button', { name: '删除 有效点数', exact: true }).click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: /删\s*除/ }).click();
  await market.getByRole('button', { name: '添加有效点数', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('shroom.formulaCharts.v1.hand')).length), 1, '原生图表删除要同步超市状态');
  await page.screenshot({ path: join(screenshots, 'algorithm-market.png') });
  await market.getByRole('button', { name: /Python 算法包/ }).click();
  await market.getByRole('button', { name: '启用床垫生命体征', exact: true }).waitFor();
  assert.equal(await market.getByRole('button', { name: '启用床垫生命体征', exact: true }).isEnabled(), false, '未收实时帧不能伪装成已启用');
  const marketGateway = createRealtimeTelemetryGateway({ channelBus: algorithmBus, getSensorType: () => 'hand', wsSubscriptions: { publish: () => 0 } });
  /** 隔离测试使用实际旧帧格式过标准网关，不手填生产中缺失的矩阵字段。 */
  const publishAlgorithmFrame = () => marketGateway.publishRealtimeFrame('sit', { sitData: Array(1024).fill(2), hz: 49 });
  publishAlgorithmFrame();
  await page.waitForFunction(() => !document.querySelector('[aria-label="启用床垫生命体征"]')?.disabled);
  assert.match(await market.getByLabel('算法输入传感器').innerText(), /32×32/);
  assert.equal(await market.getByRole('button', { name: '启用足压实时重心分析', exact: true }).isEnabled(), false, '4096 点包不能用 1024 点输入启用');
  await market.getByRole('button', { name: '启用床垫生命体征', exact: true }).click();
  await market.getByRole('button', { name: '停用床垫生命体征', exact: true }).waitFor();
  publishAlgorithmFrame();
  await page.waitForFunction(() => document.querySelector('.portal-package-value')?.textContent.includes('18'));
  const packageOutput = page.locator('.portal-observatory .portal-package-output');
  await packageOutput.scrollIntoViewIfNeeded();
  assert.equal(await packageOutput.count(), 1, '启用算法结果应进入宿主左侧而非主画布 iframe');
  await packageOutput.getByLabel('床垫生命体征显示指标').selectOption('copX');
  await page.waitForFunction(() => document.querySelector('.portal-package-value')?.textContent.includes('12.5'));
  await page.screenshot({ path: join(screenshots, 'algorithm-package-enabled.png') });
  await packageOutput.getByRole('button', { name: '停用床垫生命体征', exact: true }).click();
  await packageOutput.waitFor({ state: 'detached' });
  assert.deepEqual(algorithmRequests.map(({ enabled }) => enabled), [true, false]);
  await market.getByRole('button', { name: /指标图表/ }).click();
  await market.getByRole('button', { name: '收起算法超市', exact: true }).focus();
  await page.keyboard.press('Escape');
  await market.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.canvas-draft-bar').evaluate((node) => getComputedStyle(node).visibility), 'visible', '收起超市后保留原草稿提示和撤销入口');
  assert.equal(await page.getByRole('button', { name: '算法', exact: true }).evaluate((node) => node === document.activeElement), true, '关闭超市回到工具入口');
  await page.getByRole('button', { name: '算法', exact: true }).click();
  await market.getByRole('button', { name: '已添加峰值压力', exact: true }).waitFor();
  await market.getByRole('button', { name: '算法包设置', exact: true }).click();
  await page.locator('.display-system-builder-shell').filter({ visible: true }).waitFor();
  await page.waitForFunction(() => Boolean(document.activeElement.closest('.ant-modal-wrap')));
  await page.keyboard.press('Escape');
  await page.locator('.display-system-builder-shell').filter({ visible: true }).waitFor({ state: 'hidden' });
  assert.equal(await market.isVisible(), true, '关闭算法设置弹窗不能连带关闭超市');
  await market.getByRole('button', { name: '收起算法超市', exact: true }).click();
  await page.locator('.aside').evaluate((node) => { node.scrollTop = 0; });
  await page.getByRole('button', { name: '图表', exact: true }).click();
  assert.equal(await page.locator('.aside').evaluate((node) => getComputedStyle(node).visibility), 'hidden');
  assert.equal(await page.locator('.home > .title').evaluate((node) => getComputedStyle(node).visibility), 'visible', '隐藏图表不能隐藏设备操作');
  await page.getByRole('button', { name: '图表', exact: true }).click();
  assert.equal(await page.locator('.aside').evaluate((node) => getComputedStyle(node).visibility), 'visible');
  assert.ok(Math.abs((await page.locator('.portal-quick-tools').boundingBox()).y - toolsBounds.y) < 1, '切换图表显隐不能推移快捷工具');
  assert.equal(commands.length, commandsBeforeView, '自动交接不重连串口或重新切换系统');
  assert.equal(Number(await page.locator('.aside .pressData').first().innerText()), 131072, '压力视图使用真实帧读数');
  assert.equal(await homeNode.evaluate((node) => node === document.querySelector('.home')), true, '自动交接不重建采集和图表状态');
  assert.equal(await runtimeCanvas.evaluate((node) => node === document.querySelector('.system-scene-particle-host canvas')), true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.portal-monitor-content').evaluate((node) => Number(getComputedStyle(node).opacity)), 1, '运行中减少动画不能隐藏压力页');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.equal(await page.locator('.portal-monitor-content').evaluate((node) => Number(getComputedStyle(node).opacity)), 1, '恢复动画偏好不能重播压力页入场');
  assert.ok(Math.abs((await page.locator('.portal-quick-tools').boundingBox()).y - toolsBounds.y) < 1, '改变动画偏好不能重置快捷工具位置');
  await page.locator('.portal-device-launch').click();
  await page.locator('.portal-native-controls.is-open').waitFor();
  assert.equal(await page.getByRole('button', { name: '展示系统配置器', exact: true }).isVisible(), true, '紧凑栏保留原生配置入口');
  await page.getByRole('button', { name: '关闭设备设置', exact: true }).click();
  await page.getByRole('button', { name: '调节', exact: true }).click();
  await page.locator('.ant-drawer-open').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.ant-drawer-open').waitFor({ state: 'hidden' });
  assert.ok(Math.abs((await page.locator('.portal-quick-tools').boundingBox()).y - toolsBounds.y) < 1, '关闭调节面板不能推移快捷工具');
  await page.getByRole('button', { name: '开始采集', exact: true }).click();
  await page.locator('.collectionModal').filter({ visible: true }).first().waitFor();
  await page.waitForFunction(() => Boolean(document.activeElement.closest('.ant-modal-wrap')));
  await page.keyboard.press('Escape');
  await page.locator('.collectionModal').filter({ visible: true }).first().waitFor({ state: 'hidden' });
  assert.equal(commands.length, commandsBeforeView, '打开采集配置与调节不提前发送控制命令');
  await page.getByRole('button', { name: /编辑.*图表公式/ }).first().click();
  await page.locator('.ant-modal-wrap').filter({ visible: true }).first().waitFor();
  await page.waitForFunction(() => Boolean(document.activeElement.closest('.ant-modal-wrap')));
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => Boolean(document.activeElement.closest('.ant-modal-wrap'))), '宿主弹窗焦点不能被选择器抢走');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.portal-runtime-monitor').count(), 1, '关闭图表弹窗不能同时退出系统');
  for (const viewport of [{ width: 375, height: 812 }, { width: 900, height: 600 }]) {
    await page.setViewportSize(viewport);
    const fit = await page.locator('.aside').evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, right: rect.right, bottom: rect.bottom, width: innerWidth,
        height: innerHeight, scrollWidth: document.documentElement.scrollWidth };
    });
    assert.ok(fit.x >= 0 && fit.right <= fit.width + 1 && fit.bottom <= fit.height + 1 && fit.scrollWidth <= fit.width + 1, '窄屏控制台只能内部滚动，不能撑大窗口');
    const compactTools = await page.locator('.portal-quick-tools').boundingBox();
    const expectedToolsTop = viewport.width <= 820 ? 178 : viewport.height / 2 - compactTools.height * .42;
    assert.ok(Math.abs(compactTools.y - expectedToolsTop) < 1, '响应式定位由布局层负责，不能残留桌面入场 transform');
    assert.ok(compactTools.x >= 0 && compactTools.x + compactTools.width <= viewport.width && compactTools.y + compactTools.height <= viewport.height, '快捷工具必须留在视口内');
    await page.getByRole('button', { name: '算法', exact: true }).click();
    await page.waitForFunction(() => {
      const style = getComputedStyle(document.querySelector('.portal-algorithm-market'));
      return style.transform === 'none' && Number(style.opacity) === 1;
    });
    const compactMarket = await market.boundingBox();
    assert.ok(compactMarket.x >= 0 && compactMarket.x + compactMarket.width <= viewport.width && compactMarket.y + compactMarket.height <= viewport.height, '算法超市不能撑出窄屏视口');
    if (viewport.width < 560) assert.ok(await market.locator('.portal-algorithm-market-track').evaluate((node) => node.scrollWidth > node.clientWidth), '窄屏卡片只在超市内部横向滚动');
    await page.screenshot({ path: join(screenshots, `algorithm-market-${viewport.width}.png`) });
    await market.getByRole('button', { name: '收起算法超市', exact: true }).click();
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.ok(Math.abs((await page.locator('.portal-quick-tools').boundingBox()).y - toolsBounds.y) < 1, '恢复桌面尺寸后快捷工具回到原位置');
  await page.getByRole('button', { name: '算法', exact: true }).click();
  await page.evaluate(() => {
    window.__portalReturnSamples = [];
    window.__portalResumeSamples = [];
    window.__portalReturnDraws = [];
    const root = document.querySelector('.portal-runtime-monitor');
    const panel = document.querySelector('.system-selector-panel');
    const previewRoot = panel.querySelector('.system-scene-particle-root');
    const api = root.querySelector('.portal-data-renderer canvas').shroomParticleEntrance;
    const play = api.play;
    /** 记录真实返回目标，不改点位或推进测试时钟。 */
    api.play = (source, options) => play(source, { ...options, resolveSource: options.resolveSource && ((progress) => {
      const snapshot = options.resolveSource(progress);
      if (snapshot) window.__portalResumeSamples.push({ stage: 'return', progress, time: performance.now(),
        positions: Array.from(snapshot.positions.slice(0, 192)) });
      return snapshot;
    }) });
    const bounds = panel.getBoundingClientRect();
    let resumedFrames = 0;
    /** 逐帧检查退场的重叠阶段，避免只测终态而漏掉弹窗、背景和工具栏跳切。 */
    const sampleReturn = () => {
      if (!root.isConnected) {
        const detail = { snapshot: null };
        previewRoot.dispatchEvent(new CustomEvent('system-scene:capture-particles', { detail }));
        if (detail.snapshot) window.__portalResumeSamples.push({ stage: 'preview', time: performance.now(),
          positions: Array.from(detail.snapshot.positions.slice(0, 192)) });
        if (++resumedFrames >= 8) { window.__portalReturnComplete = true; return; }
      }
      if (root.isConnected && root.dataset.handoff === 'leaving') {
        const rect = panel.getBoundingClientRect();
        window.__portalReturnSamples.push({
          progress: Number(root.querySelector('.portal-data-renderer canvas')?.dataset.particleEntrance),
          panel: Number(getComputedStyle(panel).opacity), background: Number(getComputedStyle(root, '::before').opacity),
          navigation: Number(getComputedStyle(root.querySelector('.portal-monitor-navigation')).opacity),
          market: Number(getComputedStyle(root.querySelector('.portal-algorithm-market')).opacity),
          legacyTools: Number(getComputedStyle(root.querySelector('.setIcons')).opacity),
          preview: getComputedStyle(panel.querySelector('.system-scene-particle-host')).visibility,
          previewOpacity: Number(getComputedStyle(panel.querySelector('.system-scene-particle-host')).opacity),
          canvasOpacity: Number(root.querySelector('.portal-data-renderer canvas').style.opacity || 1),
          inert: root.inert && panel.inert,
          positionError: Math.abs(rect.x - bounds.x) + Math.abs(rect.y - bounds.y) + Math.abs(rect.width - bounds.width) + Math.abs(rect.height - bounds.height),
        });
      }
      requestAnimationFrame(sampleReturn);
    };
    requestAnimationFrame(sampleReturn);
  });
  await page.getByRole('button', { name: '返回系统列表', exact: false }).first().click();
  await page.waitForFunction(() => document.querySelector('.portal-runtime-monitor')?.dataset.handoff === 'leaving');
  assert.equal(await page.locator('.system-scene-particle-host').evaluate((node) => getComputedStyle(node).visibility), 'hidden', '返回由正式点图反向形变完成后，才交回预览粒子');
  await page.screenshot({ path: join(screenshots, 'monitor-return-overlap.png') });
  await page.getByRole('heading', { name: '选择你的展示系统' }).waitFor();
  await page.waitForFunction(() => window.__portalReturnComplete);
  const returnSamples = await page.evaluate(() => window.__portalReturnSamples);
  assert.ok(returnSamples.some((sample) => sample.progress > .1 && sample.progress < .9 && sample.panel > .1 && sample.panel < 1 && sample.background > 0 && sample.background < .9), '粒子归位过程中弹窗和背景必须已经交叉渐变，而非最后突然显示');
  assert.ok(returnSamples.some((sample) => sample.progress > .1 && sample.navigation < .1 && sample.market < .1 && sample.legacyTools < .1), '导航、算法超市与旧版缩放按钮应一起提前退场');
  assert.ok(returnSamples.every((sample) => sample.inert && sample.positionError < 1), '交接期间不能放开交互或移动弹窗');
  assert.ok(returnSamples.filter((sample) => sample.progress >= .004).every((sample) => sample.preview === 'hidden'), '飞行中的两个场景不能提前叠出双点云');
  const blended = returnSamples.filter((sample) => sample.progress < .004 && sample.previewOpacity > 0 && sample.previewOpacity < 1);
  assert.ok(blended.length > 1, '卸载前必须已有多帧真实预览参与混合，不能最后硬切材质');
  assert.ok(blended.every((sample) => sample.preview === 'visible' && Math.abs(sample.previewOpacity + sample.canvasOpacity - 1) < .001), '贴合后的两个画布使用互补透明度，不能亮度加倍');
  const resumeSamples = await page.evaluate(() => window.__portalResumeSamples);
  const targets = resumeSamples.filter((sample) => sample.stage === 'return');
  const resumed = resumeSamples.filter((sample) => sample.stage === 'preview');
  assert.ok(targets.length > 3 && resumed.length === 8, '返回末段和恢复预览必须都有实际投影样本');
  /** 以屏幕像素检查同一粒子的衔接，忽略深度值。 */
  const projectionDistance = (a, b) => Math.max(...a.positions.map((value, index) => index % 3 === 2 ? 0 : Math.abs(value - b.positions[index])));
  assert.ok(projectionDistance(targets[0], targets.at(-1)) > .01, '落到弹窗之前点云已接回运动，不能一直停在旧快照');
  assert.ok(projectionDistance(targets.at(-1), resumed[0]) < 1.5, '返回终点与首帧预览应连续，不能落定后再跳位');
  assert.ok(projectionDistance(resumed[0], resumed.at(-1)) > .001, '交接后沿用浮动相位，不能把预览永久冻结');
  console.log('RETURN_MOTION_CONTINUITY', { movingBeforeLanding: projectionDistance(targets[0], targets.at(-1)),
    handoffPixels: projectionDistance(targets.at(-1), resumed[0]), samples: targets.length });
  const returnDraws = await page.evaluate(() => window.__portalReturnDraws);
  console.log('RETURN_DRAW_BOUNDARY', { blendedFrames: blended.length, reusedBufferAllocations: allocationGrowth,
    lastCanvasOpacity: returnDraws.at(-1)?.opacity });
  assert.ok(returnDraws.every((draw) => draw.opacity === 0 || draw.shaderProgress !== null), '弹窗接管前不能提前恢复原生压力材质并闪回系统点图');
  assert.equal(returnDraws.at(-1)?.opacity, 0, '卸载前已交给运动中的预览，不以最后一帧卸载硬切');
  assert.equal(await page.locator('.system-scene-particle-host').evaluate((node) => node.style.opacity + node.style.visibility), '', '完成后必须收回混合样式，后续进入不可残留静态或透明预览');
  await page.screenshot({ path: join(screenshots, 'monitor-return-selector.png') });
  assert.equal(await runtimeCanvas.evaluate((node) => node === document.querySelector('.system-scene-particle-host canvas')), true, '从真实系统单次反向形变回到原列表 Canvas');
  assert.equal(await page.locator('[data-system="hand"]').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(await page.evaluate(() => window.__portalDirect.framings), [], '返回也不能追加预览缩小阶段');
  await page.waitForFunction(() => document.activeElement?.dataset.system === 'hand');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '进入该系统' }).click();
  await page.waitForFunction(() => document.querySelector('.portal-runtime-monitor')?.dataset.handoff === 'complete');
  assert.equal(await page.locator('.portal-runtime-monitor').evaluate((node) => node.inert), false, '减少动画直接交接后导航可用');
  await page.getByRole('button', { name: '返回系统列表', exact: false }).first().click();
  await page.getByRole('heading', { name: '选择你的展示系统' }).waitFor();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: '进入该系统' }).click();
  await page.waitForFunction(() => document.querySelector('.portal-runtime-monitor')?.dataset.handoff === 'entering');
  await page.getByRole('button', { name: '返回系统列表', exact: false }).first().click();
  await page.getByRole('heading', { name: '选择你的展示系统' }).waitFor();
  assert.equal(await page.locator('.portal-runtime-monitor').count(), 0, '形变途中返回也必须清理实际监测层');
  assert.equal(await page.locator('[data-monitor-return]').count(), 0, '重复进入及途中返回后不能残留退场标记');
  assert.equal(await page.locator('.system-selector-backdrop').evaluate((node) => node.style.getPropertyValue('--portal-return-opacity')), '', '退场时间线的临时样式必须清理');
  for (const mode of ['motion-change', 'crossfade']) {
    await page.getByRole('button', { name: '进入该系统' }).click();
    await page.waitForFunction(() => document.querySelector('.portal-runtime-monitor')?.dataset.handoff === 'complete');
    if (mode === 'crossfade') await page.locator('.portal-data-renderer canvas').evaluate((node) => { delete node.shroomParticleEntrance; });
    await page.getByRole('button', { name: '返回系统列表', exact: false }).first().click();
    await page.waitForFunction(() => document.querySelector('.portal-runtime-monitor')?.dataset.handoff === 'leaving');
    if (mode === 'motion-change') await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('heading', { name: '选择你的展示系统' }).waitFor();
    await page.waitForFunction(() => document.activeElement?.dataset.system === 'hand');
    assert.equal(await page.locator('.portal-runtime-monitor, [data-monitor-return]').count(), 0, `${mode} 返回不得残留运行层或锁住弹窗`);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
  assert.deepEqual(await page.evaluate(() => window.__portalDirect.framings), []);
  await page.locator('[data-system="hand0205"]').click();
  await page.locator('.system-scene-particle-root[data-scene="glove"][data-model-status="ready"]').waitFor();
  await page.evaluate(() => { window.__portalGpu.pressureMorph = []; window.__portalDirect.framings = []; });
  await page.evaluate(() => { window.__portalTestTimeline.timeScale(.3); });
  await page.getByRole('button', { name: '进入该系统' }).click();
  await page.locator('.portal-data-renderer canvas[data-model-state="ready"]').waitFor({ timeout: 60000 });
  await page.waitForFunction(() => window.__portalGpu.pressureMorph.some((value) => value > .15 && value < .9));
  await page.screenshot({ path: join(screenshots, 'glove-to-solid-morph.png') });
  await page.waitForFunction(() => Number(document.querySelector('.portal-data-renderer canvas')?.dataset.particleEntrance) > .82);
  await page.evaluate(() => { window.__portalTestTimeline.pause(); });
  await page.screenshot({ path: join(screenshots, 'glove-solid-reveal.png') });
  await page.evaluate(() => { window.__portalTestTimeline.timeScale(1).resume(); });
  await page.waitForFunction(() => document.querySelector('.portal-runtime-monitor')?.dataset.handoff === 'complete');
  assert.deepEqual(await page.evaluate(() => window.__portalDirect.framings), [], '手套也直接进入原生实体，不经过 focused 预览');
  assert.equal(await page.locator('.portal-model-status').isVisible(), false);
  const gloveSize = await page.locator('.portal-data-renderer canvas').boundingBox();
  assert.ok(gloveSize.width >= 1438 && gloveSize.height >= 898, '实体手模型沿用全屏宿主尺寸');
  await page.screenshot({ path: join(screenshots, 'glove-solid-monitor.png') });
  await page.getByRole('button', { name: '返回系统列表', exact: false }).first().click();
  await page.getByRole('heading', { name: '选择你的展示系统' }).waitFor();
  assert.equal(await page.locator('.portal-runtime-monitor').count(), 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '进入该系统' }).click();
  await page.waitForFunction(() => document.querySelector('.portal-runtime-monitor')?.dataset.handoff === 'complete');
  assert.equal(await page.locator('.portal-model-status').isVisible(), false);
  await page.getByRole('button', { name: '返回系统列表', exact: false }).first().click();
  await page.getByRole('heading', { name: '选择你的展示系统' }).waitFor();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: '进入该系统' }).click();
  await page.waitForFunction(() => document.querySelector('.portal-runtime-monitor')?.dataset.handoff === 'entering');
  await page.getByRole('button', { name: '返回系统列表', exact: false }).first().click();
  await page.getByRole('heading', { name: '选择你的展示系统' }).waitFor();
  assert.equal(await page.locator('.portal-runtime-monitor').count(), 0, '手套实体形变中途返回必须取消临时材质并卸载');
  console.log('PORTAL_PACKAGE_AND_GLOVE_PASS');
  assert.deepEqual(errors, []);
  console.log(`PORTAL_LAUNCHER_PASS screenshots=${screenshots}`);
} catch (error) {
  console.error('PORTAL_ASSERTION_FAILURE', error);
  if (page) {
    await page.screenshot({ path: join(screenshots, 'failure.png'), timeout: 5000 }).catch(() => {});
    console.error('PORTAL_FAILURE', screenshots, (await page.locator('body').innerText({ timeout: 3000 }).catch(() => '页面无响应')).slice(0, 1600));
  }
  throw error;
} finally {
  await algorithmService.dispose();
  await browser?.close();
  await server.close();
}
