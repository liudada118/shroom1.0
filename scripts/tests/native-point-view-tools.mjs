import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const server = await createServer({
  root: fileURLToPath(new URL('../../client/', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [{
    name: 'native-point-view-test',
    /** 隔离挂载真实点图，构建资源与截图只放临时目录。 */
    configureServer(vite) {
      vite.middlewares.use('/__point-views', async (req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml('/__point-views', '<html><head><style>body{margin:0;background:#020a12}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/nativePointViews.jsx"></script></body></html>'));
      });
    },
  }],
});
const screenshots = await mkdtemp(join(tmpdir(), 'shroom-point-views-'));
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => { errors.push(error.message); console.error('NATIVE_POINT_ERROR', error.message); });
  await page.addInitScript(() => {
    window.__pointViewGpu = { matrix: null, draws: 0, invalid: 0 };
    for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Type) continue;
      const locations = new WeakSet();
      const matrices = new WeakMap();
      const getUniform = Type.prototype.getUniformLocation;
      /** 标记真实 Three.js 模型视图矩阵。 */
      Type.prototype.getUniformLocation = function (...args) {
        const location = getUniform.apply(this, args);
        if (location && args[1] === 'modelViewMatrix') locations.add(location);
        return location;
      };
      const uniformMatrix = Type.prototype.uniformMatrix4fv;
      /** 保留当前绘制的真实视角，而不是仅检查按钮状态。 */
      Type.prototype.uniformMatrix4fv = function (...args) {
        if (locations.has(args[0])) matrices.set(this, Array.from(args[2]));
        return uniformMatrix.apply(this, args);
      };
      const draw = Type.prototype.drawArrays;
      /** 只观察点图绘制，坐标轴和贴图不会冒充点图。 */
      Type.prototype.drawArrays = function (...args) {
        if (args[0] === this.POINTS) {
          window.__pointViewGpu.draws++;
          window.__pointViewGpu.matrix = matrices.get(this);
        }
        return draw.apply(this, args);
      };
      for (const name of ['bufferData', 'bufferSubData']) {
        const original = Type.prototype[name];
        /** 工具操作不得产生 NaN 或无穷顶点。 */
        Type.prototype[name] = function (...args) {
          if (args.some((value) => value instanceof Float32Array && !value.every(Number.isFinite))) window.__pointViewGpu.invalid++;
          return original.apply(this, args);
        };
      }
    }
  });
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/__point-views`);
  await page.waitForFunction(() => window.__pointViews?.snapshot().available && window.__pointViewGpu.draws > 0);
  const selectedName = process.argv.find((value) => value.startsWith('--only='))?.slice(7);
  const names = (await page.evaluate(() => window.__pointViews.names)).filter((name) => !selectedName || name === selectedName);
  for (const [index, name] of names.entries()) {
    if (name !== await page.evaluate(() => window.__pointViews.snapshot().name)) {
      const previousDraws = await page.evaluate(() => window.__pointViewGpu.draws);
      await page.evaluate((next) => window.__pointViews.mount(next), name);
      await page.waitForFunction((next) => window.__pointViews.snapshot().name === next && window.__pointViews.snapshot().available, name);
      await page.waitForFunction((draws) => window.__pointViewGpu.draws > draws, previousDraws);
    }
    const state = await page.evaluate(() => window.__pointViews.snapshot());
    assert.equal(state.state.available, true, `${name}: missing view tools`);
    assert.ok(state.disposed.every((value) => value === false), `${name}: old view remains active`);
    if (index) assert.equal(state.oldAction, false, `${name}: old action accepted`);
    assert.equal(state.state.selectionSafe, true, `${name}: initial selection unsafe`);
    const before = await page.evaluate(() => window.__pointViewGpu.matrix);
    assert.equal(await page.evaluate(() => window.__pointViews.command('rotate', 'x')), true);
    try {
      await page.waitForFunction((previous) => JSON.stringify(window.__pointViewGpu.matrix) !== JSON.stringify(previous), before);
    } catch (error) {
      console.error('NATIVE_POINT_GPU_STATE', name, await page.evaluate(() => window.__pointViewGpu));
      await page.screenshot({ path: join(screenshots, `${name}-view-failure.png`) });
      throw error;
    }
    assert.equal((await page.evaluate(() => window.__pointViews.snapshot())).state.selectionSafe, false);
    assert.equal(await page.evaluate(() => window.__pointViews.command('flip', 'x')), true);
    assert.equal(await page.evaluate(() => window.__pointViews.command('flip', 'y')), true);
    assert.equal((await page.evaluate(() => window.__pointViews.snapshot())).state.flipX, true);
    for (const [method, arg] of [['top'], ['zoom', 1], ['zoom', -1], ['reset']]) {
      const previous = await page.evaluate(() => window.__pointViewGpu.matrix);
      assert.equal(await page.evaluate(([action, value]) => window.__pointViews.command(action, value), [method, arg]), true, `${name}: ${method}`);
      await page.waitForFunction((matrix) => JSON.stringify(window.__pointViewGpu.matrix) !== JSON.stringify(matrix), previous);
    }
    assert.deepEqual((await page.evaluate(() => window.__pointViews.snapshot())).state,
      { available: true, flipX: false, flipY: false, selectionSafe: true });
    if (name === 'smallBed') await page.screenshot({ path: join(screenshots, 'small-bed-view-tools.png') });
    console.log('NATIVE_POINT_VIEW_PASS', name);
  }
  assert.equal(await page.evaluate(() => window.__pointViewGpu.invalid), 0, 'invalid vertex upload');
  assert.deepEqual(errors, [], 'browser runtime errors');
  console.log('NATIVE_POINT_VIEW_TOOLS_PASS', names.length, screenshots);
} finally {
  await browser?.close();
  await server.close();
}
