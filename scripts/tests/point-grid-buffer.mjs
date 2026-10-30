import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const { createServer } = createRequire(new URL('../../client/package.json', import.meta.url))('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-point-grid-buffer-'));
const errors = [];
let browser, page;
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, 'vite-cache'), server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'point-grid-buffer-test', enforce: 'pre',
    /** 只在隔离夹具暴露实际 Manifest 接口和 SDK 场景供断言，不改生产模块。 */
    transform(source, id) {
      const path = id.replaceAll('\\', '/').split('?')[0];
      if (path.endsWith('/tests/fixtures/manifestWorkspace.jsx')) {
        const hook = 'const rendererRef = useRef();';
        assert.ok(source.includes(hook));
        return source.replace(hook, `${hook}\nwindow.__manifestBuffer = () => rendererRef.current;`);
      }
      if (path.endsWith('/pointGrid/react/PointGridRenderer.jsx')) {
        const hook = 'const state = stateRef.current;';
        assert.ok(source.includes(hook));
        return source.replace(hook, `${hook}\nwindow.__pointGridBufferState = () => state;`);
      }
      return null;
    },
    /** 复用已有真实 Manifest 夹具，只进入规则点图分支。 */
    configureServer(vite) {
      vite.middlewares.use('/__point-grid-buffer', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__point-grid-buffer', '<html><head><style>html,body,#root{margin:0;width:100%;height:100%;position:relative}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/manifestWorkspace.jsx"></script></body></html>'));
      });
    },
  }],
});

/** 汇总真实 SDK 几何，记录外沿高度、原网格身份和相机。 */
async function snapshot() {
  return page.evaluate(() => {
    const state = window.__pointGridBufferState();
    const positions = state.particles.geometry.attributes.position.array;
    const border = state.particles.children.find(child => child.name === 'pressure-edge-buffer');
    const ring = border.geometry.attributes.position?.array || [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, outerMax = 0, height = 0;
    for (let i = 0; i < positions.length; i += 3) height = Math.max(height, positions[i + 1]);
    for (let i = 0; i < ring.length; i += 3) {
      minX = Math.min(minX, ring[i]); maxX = Math.max(maxX, ring[i]);
      minZ = Math.min(minZ, ring[i + 2]); maxZ = Math.max(maxZ, ring[i + 2]);
    }
    for (let i = 0; i < ring.length; i += 3) {
      if (ring[i] === minX || ring[i] === maxX || ring[i + 2] === minZ || ring[i + 2] === maxZ)
        outerMax = Math.max(outerMax, Math.abs(ring[i + 1]));
    }
    return { capability: window.__manifestBuffer().getTuningControls(), width: state.tuning.edgeBuffer1,
      geometryId: state.particles.geometry.uuid, mainPoints: positions.length / 3,
      ringPoints: ring.length / 3, borderVisible: border.visible, outerMax, height,
      finite: Array.from(positions).every(Number.isFinite) && Array.from(ring).every(Number.isFinite),
      camera: state.camera.position.toArray(), transform: state.particles.matrix.toArray(),
      raw: state.rawSitFrame?.reduce((sum, value) => sum + value, 0) };
  });
}

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__sdkBufferGpu = {};
    for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Type) continue;
      for (const name of ['bufferData', 'bufferSubData']) {
        const original = Type.prototype[name];
        /** 观察实际 GPU 上传并排除颜色数组，不假定插值后的点数。 */
        Type.prototype[name] = function (...args) {
          const positions = args[name === 'bufferData' ? 1 : 2];
          if (positions instanceof Float32Array && positions.length % 3 === 0 && positions.length > 100
            && Math.abs(positions[0]) > 5 && Math.abs(positions[2]) > 5
            && this.canvas.closest('[data-renderer-id="pointGrid"]')) {
            window.__sdkBufferGpu[positions.length / 3] = { finite: positions.every(Number.isFinite) };
          }
          return original.apply(this, args);
        };
      }
    }
  });
  await page.route('http://127.0.0.1:19245/**', route => route.fulfill({ json: {}, headers: { 'Access-Control-Allow-Origin': '*' } }));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__point-grid-buffer?density=1`);
  await page.locator('[data-renderer-id="pointGrid"] canvas').waitFor();
  await page.waitForFunction(() => window.__pointGridBufferState?.()?.api && window.__manifestBuffer?.()?.getTuningControls?.()?.showEdgeBuffer);
  const initial = await snapshot();
  assert.equal(initial.capability.edgeBufferDefault, 4);
  assert.equal(initial.width, 4);
  assert.equal(initial.mainPoints, 72 * 72);
  await page.getByRole('button', { name: '注入平滑压力帧（合成数据）', exact: true }).click();
  await page.waitForFunction(() => window.__pointGridBufferState().positions.some((value, index) => index % 3 === 1 && value > 0));
  await page.evaluate(() => window.__manifestBuffer().sitValue({ edgeBuffer: 0 }));
  await page.waitForFunction(() => window.__pointGridBufferState().tuning.edgeBuffer1 === 0
    && window.__pointGridBufferState().particles.children.some(child => child.name === 'pressure-edge-buffer' && !child.visible));
  const disabled = await snapshot();
  assert.equal(disabled.borderVisible, false);
  await page.evaluate(() => window.__manifestBuffer().sitValue({ edgeBuffer: 8 }));
  await page.waitForFunction(() => window.__pointGridBufferState().particles.children.some(child =>
    child.name === 'pressure-edge-buffer' && child.visible && child.geometry.attributes.position?.count > 0));
  await page.waitForTimeout(250);
  const buffered = await snapshot();
  assert.equal(buffered.width, 8);
  assert.equal(buffered.geometryId, disabled.geometryId);
  assert.equal(buffered.mainPoints, disabled.mainPoints);
  assert.equal(buffered.raw, disabled.raw);
  assert.deepEqual(buffered.camera, disabled.camera);
  assert.deepEqual(buffered.transform, disabled.transform);
  assert.equal(buffered.ringPoints, 80 * 80 - 72 * 72);
  assert.equal(buffered.outerMax, 0);
  assert.ok(buffered.finite && buffered.height > 0);
  const gpu = await page.evaluate(() => window.__sdkBufferGpu);
  assert.ok(gpu[buffered.mainPoints]?.finite && gpu[buffered.ringPoints]?.finite);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: join(artifacts, 'sdk-buffer.png') });
  console.log('POINT_GRID_BUFFER_PASS', JSON.stringify({ artifacts, initial, disabled, buffered, gpu }));
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('POINT_GRID_BUFFER_FAILED', JSON.stringify({ artifacts, errors, state: await snapshot().catch(() => null) })); throw error;
} finally { await browser?.close(); await server.close(); }
