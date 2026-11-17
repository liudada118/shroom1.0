import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { assertMirrorAcrossScreen, assertQuarterTurn, assertSamePicture, capturePointPicture, captureSettledPointPicture, installPointPictureProbe } from './point-picture-probe.mjs';

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
  await page.addInitScript(installPointPictureProbe);
  const address = server.httpServer.address();
  await page.goto(`http://127.0.0.1:${address.port}/__point-views`);
  await page.waitForFunction(() => window.__pointViews?.snapshot().available && window.__pointViewGpu.draws > 0);
  /** 调用真实工具并确认它接受了这次操作。 */
  const command = async (label, method, ...args) => assert.equal(await page.evaluate(([action, values]) => window.__pointViews.command(action, ...values), [method, args]), true, `${label}: ${method}`);
  /** 读回真实工具当前报告的状态。 */
  const viewState = async () => (await page.evaluate(() => window.__pointViews.snapshot())).state;
  /**
   * 在真实点图上走一遍展示旋转：顺时针、逆时针、转满四圈、转过之后镜像、俯视保持方向、恢复视角。
   * 每一步都拿显卡实际收到的矩阵和顶点缓冲核对，不读工具内部状态冒充画面。
   */
  const verifyQuarterTurn = async (name, initialState) => {
    const base = await captureSettledPointPicture(page, name);
    await command(name, 'rotateQuarter', 1);
    const once = await capturePointPicture(page);
    const plane = assertQuarterTurn(`${name} 顺时针一次`, base, once, 1);
    assert.deepEqual(await viewState(), { ...initialState, quarterTurns: 1, selectionSafe: false });
    // 转过之后水平镜像：翻的是当前看到的左右；圈数记成 3 是同一幅画面的另一种写法。
    await command(name, 'flip', 'x');
    assertMirrorAcrossScreen(name, plane, once, await capturePointPicture(page));
    assert.deepEqual(await viewState(), { ...initialState, flipX: true, quarterTurns: 3, selectionSafe: false });
    await command(name, 'flip', 'x');
    assertSamePicture(`${name} 镜像两次`, once, await capturePointPicture(page));
    assert.deepEqual(await viewState(), { ...initialState, quarterTurns: 1, selectionSafe: false });
    await command(name, 'rotateQuarter', -1);
    assertSamePicture(`${name} 逆时针转回`, base, await capturePointPicture(page));
    assert.deepEqual(await viewState(), initialState);
    await command(name, 'rotateQuarter', 1); await command(name, 'rotateQuarter', 1);
    assertQuarterTurn(`${name} 两次`, base, await capturePointPicture(page), 2);
    await command(name, 'rotateQuarter', 1);
    assertQuarterTurn(`${name} 三次`, base, await capturePointPicture(page), 3);
    await command(name, 'rotateQuarter', 1);
    assertSamePicture(`${name} 转满四圈`, base, await capturePointPicture(page));
    assert.deepEqual(await viewState(), initialState);
    // 俯视：转之前、转之后、转之后再点一次俯视，画面都保持转过的方向，镜头落点不跳。
    await command(name, 'top');
    const top = await capturePointPicture(page, 30);
    await command(name, 'rotateQuarter', 1);
    const topTurned = await capturePointPicture(page);
    const topPlane = assertQuarterTurn(`${name} 俯视下顺时针`, top, topTurned, 1);
    await command(name, 'top');
    assertSamePicture(`${name} 转过之后再点俯视`, topTurned, await capturePointPicture(page, 30));
    await command(name, 'zoom', 1); await command(name, 'zoom', -1);
    assertSamePicture(`${name} 转过之后缩放一进一出`, topTurned, await capturePointPicture(page, 30));
    await command(name, 'reset');
    assertSamePicture(`${name} 恢复视角`, base, await capturePointPicture(page, 30));
    assert.deepEqual(await viewState(), initialState);
    console.log('NATIVE_POINT_QUARTER_TURN_PASS', name, JSON.stringify({ layers: base.length, points: base.map((record) => record.count),
      centerError: Number(plane.error.toFixed(5)), topNormal: topPlane.normal.map((value) => Number(value.toFixed(3))) }));
  };
  const turned = [];
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
    const initialState = { available: true, flipX: false, flipY: false, quarterTurns: 0, selectionSafe: true };
    assert.deepEqual((await page.evaluate(() => window.__pointViews.snapshot())).state, initialState);
    if (state.turnable) {
      await verifyQuarterTurn(name, initialState);
      turned.push(name);
    } else {
      // 座椅和仓储只传了整组对象，没有单独的点图平面，不提供旋转 90°。
      assert.ok(['ware', 'sit100'].includes(name), `${name}: 点图场景应该提供旋转 90°`);
    }
    if (name === 'smallBed') await page.screenshot({ path: join(screenshots, 'small-bed-view-tools.png') });
    console.log('NATIVE_POINT_VIEW_PASS', name);
  }
  assert.equal(await page.evaluate(() => window.__pointViewGpu.invalid), 0, 'invalid vertex upload');
  assert.deepEqual(errors, [], 'browser runtime errors');
  if (!selectedName) assert.equal(turned.length, names.length - 2, '除座椅和仓储外的点图都要验证旋转 90°');
  console.log('NATIVE_POINT_VIEW_TOOLS_PASS', names.length, `quarterTurn=${turned.length}`, screenshots);
} finally {
  await browser?.close();
  await server.close();
}
