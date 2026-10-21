import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const clientRequire = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = clientRequire('vite');
const server = await createServer({
  root: fileURLToPath(new URL('../../client/', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [{
    name: 'manifest-point-padding-test',
    /** 复用真实 Manifest 工作区，只有测试数据，不启动设备采集。 */
    configureServer(vite) {
      vite.middlewares.use('/__point-padding', async (req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml('/__point-padding', '<html><head><style>html,body,#root{margin:0;width:100%;height:100%;position:relative}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/manifestWorkspace.jsx"></script></body></html>'));
      });
    },
  }],
});
const screenshots = await mkdtemp(join(tmpdir(), 'shroom-point-padding-'));
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('http://127.0.0.1:19245/**', (route) => route.fulfill({
    json: { code: 0, data: { apps: [] } }, headers: { 'Access-Control-Allow-Origin': '*' },
  }));
  await page.addInitScript(() => {
    window.__paddingGpu = { positions: [], drawCount: 0, invalid: 0 };
    for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Context) continue;
      for (const name of ['bufferData', 'bufferSubData']) {
        const upload = Context.prototype[name];
        /** 观察真实坐标上传；颜色数组不能冒充 72×72 的点图几何。 */
        Context.prototype[name] = function (...args) {
          const values = args[name === 'bufferData' ? 1 : 2];
          if (this.canvas.closest('[data-renderer-id="pointGrid"]') && values instanceof Float32Array
            && values.length === 72 * 72 * 3 && values.some((value, index) => index % 3 === 0 && value < -10)) {
            window.__paddingGpu.positions = Array.from(values);
            if (!values.every(Number.isFinite)) window.__paddingGpu.invalid++;
          }
          return upload.apply(this, args);
        };
      }
      const draw = Context.prototype.drawArrays;
      /** 确认新增的边缘点实际进入点图绘制。 */
      Context.prototype.drawArrays = function (...args) {
        if (this.canvas.closest('[data-renderer-id="pointGrid"]') && args[0] === this.POINTS) window.__paddingGpu.drawCount = args[2];
        return draw.apply(this, args);
      };
    }
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__point-padding?orientation=1`);
  await page.locator('[data-renderer-id="pointGrid"] canvas').waitFor();
  await page.getByRole('button', { name: '注入方向测试帧（右上亮点）' }).click();
  await page.waitForFunction(() => window.__paddingGpu.drawCount === 5184
    && window.__paddingGpu.positions.some((value, index) => index % 3 === 1 && value > 5));
  const gpu = await page.evaluate(() => window.__paddingGpu);
  assert.equal(gpu.positions.length, 5184 * 3);
  const border = [], interior = [];
  for (let row = 0; row < 72; row++) for (let col = 0; col < 72; col++) {
    const value = gpu.positions[(row * 72 + col) * 3 + 1];
    (row < 4 || col < 4 || row >= 68 || col >= 68 ? border : interior).push(value);
  }
  assert.equal(border.length, 1088);
  // 原生时间平滑保留 +0.5 偏置，乘测试高度0.001；这不是新增传感器读数。
  assert.ok(border.every((height) => Math.abs(height - .0005) < 1e-6), 'four zero-value render rings');
  assert.ok(Math.max(...interior) > 5, 'pressure values remain inside the render border');
  assert.equal(gpu.invalid, 0);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: join(screenshots, 'matrix-four-layer-zero-border.png') });
  console.log('MANIFEST_POINT_PADDING_PASS', { input: 1024, interpolated: 4096, rendered: 5184, border: 1088 }, screenshots);
} finally {
  await browser?.close();
  await server.close();
}
