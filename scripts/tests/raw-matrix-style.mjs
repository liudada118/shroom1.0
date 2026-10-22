import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const sdkRoot = fileURLToPath(new URL('../../sdk/frontend/', import.meta.url)).replaceAll('\\', '/');
const server = await createServer({
  root: fileURLToPath(new URL('../../client/', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [{
    name: 'raw-matrix-style-test',
    /** 隔离页面只运行共享数字矩阵，不连接后端、设备或本机采集数据。 */
    configureServer(vite) {
      vite.middlewares.use('/__raw-matrix-test', async (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml('/__raw-matrix-test', `<!doctype html><html><head>
          <meta name="viewport" content="width=device-width, initial-scale=1"><style>
          html,body,#matrix{margin:0;width:100%;height:100%;background:#000;overflow:hidden}
          </style></head><body><main id="matrix"></main><script type="module">
          import { createWebglMatrixBackend } from '/@fs/${sdkRoot}renderers/numMatrix/react/backends/webgl.js';
          import { deriveGrid, LEGACY_PRESETS, normalizeNumMatrixParams } from '/@fs/${sdkRoot}renderers/numMatrix/core/params.js';
          const fillText = CanvasRenderingContext2D.prototype.fillText;
          CanvasRenderingContext2D.prototype.fillText = function(...args) {
            (this.canvas.paintCalls ||= []).push(args);
            return fillText.apply(this, args);
          };
          let backend;
          /** 用可辨认的非对称点验证原始帧方向及行列号。 */
          window.mountMatrix = (preset, columns = 32, rows = 32) => {
            backend?.dispose();
            const params = normalizeNumMatrixParams({ ...LEGACY_PRESETS[preset], gridWidth: columns, gridHeight: rows });
            window.matrixStats = [];
            backend = createWebglMatrixBackend({ container: document.querySelector('#matrix'), config: params,
              grid: deriveGrid(params), tuning: {valuej1:200, valuef1:0, valuelInit1:0},
              reportStats: (values) => window.matrixStats.push([...values]) });
            const input = new Array(columns * rows).fill(0);
            input[0] = 11; input[1] = 23; input[columns + 2] = 97;
            backend.setRawFrame(input); backend.start();
            window.matrixState = () => {
              const canvases = [...document.querySelectorAll('canvas')];
              const gl = canvases[0].getContext('webgl'), pixel = new Uint8Array(4);
              gl.readPixels(Math.floor(canvases[0].width * .75), Math.floor(canvases[0].height * .75), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
              return { calls: canvases[1].paintCalls || [], width: canvases[0].width, height: canvases[0].height,
                pixels: [...pixel], stats: window.matrixStats.at(-1), sensorCount: backend.sensorGrid.projectSensors().length,
                grid: backend.sensorGrid.getGridBounds(), firstSensor: backend.sensorGrid.projectSensors()[0],
                canvas: canvases[0].getBoundingClientRect().toJSON(), overlay: canvases[1].getBoundingClientRect().toJSON() };
            };
          };
          window.mountMatrix('webglNumDefault');
          </script></body></html>`));
      });
    },
  }],
});
const screenshots = await mkdtemp(join(tmpdir(), 'shroom-raw-matrix-'));
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__raw-matrix-test`);
  for (const [preset, columns, rows] of [
    ['webglNumDefault', 32, 32], ['webglRawTransposed', 32, 32], ['webglRawDefault', 23, 16],
  ]) {
    await page.evaluate(([name, w, h]) => window.mountMatrix(name, w, h), [preset, columns, rows]);
    await page.waitForFunction((size) => window.matrixState?.().calls.length >= size, columns * rows + columns + rows);
    const state = await page.evaluate(() => window.matrixState());
    assert.equal(state.calls.length, columns * rows + columns + rows);
    assert.deepEqual(state.calls.slice(columns * rows, columns * rows + rows).map(([label]) => label),
      Array.from({ length: rows }, (_, i) => String(i + 1)), '左侧完整1基行号');
    assert.deepEqual(state.calls.slice(-columns).map(([label]) => label),
      Array.from({ length: columns }, (_, i) => String(i + 1)), '底部完整1基列号');
    assert.ok(state.pixels[2] > state.pixels[0] + 80 && state.pixels[2] > state.pixels[1] + 80, '零值格蓝底');
    assert.equal(state.sensorCount, columns * rows);
    assert.equal(state.stats.length, columns * rows, '辅助索引不能增加统计点数');
    const offset = preset === 'webglRawTransposed' ? rows : 1;
    assert.equal(state.stats[0], 11);
    assert.equal(state.stats[offset], 23, '保留原先显示转置契约');
    assert.ok(state.overlay.x < state.canvas.x, '行索引位于真实数据格左侧');
    assert.ok(state.overlay.y + state.overlay.height > state.canvas.y + state.canvas.height, '列索引位于真实数据格下侧');
    assert.equal(state.grid.x1, state.canvas.x, '框选边界排除行索引');
    assert.ok(state.firstSensor.x > state.canvas.x && state.firstSensor.y > state.canvas.y);
    await page.screenshot({ path: join(screenshots, `${preset}-${columns}x${rows}.png`) });
  }
  const width = (await page.evaluate(() => window.matrixState())).width;
  await page.setViewportSize({ width: 1000, height: 760 });
  await page.waitForFunction((previous) => {
    const state = window.matrixState();
    return state.width < previous && state.calls.length === 23 * 16 + 23 + 16;
  }, width);
  assert.equal((await page.evaluate(() => window.matrixState())).stats.length, 23 * 16);
  await page.screenshot({ path: join(screenshots, 'rectangular-after-resize.png') });
  assert.deepEqual(errors, []);
  console.log(`RAW_MATRIX_STYLE_PASS screenshots=${screenshots}`);
} finally {
  await browser?.close();
  await server.close();
}
