import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-heatmap-canvas-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, '.vite'), logLevel: 'error', server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'heatmap-canvas-equivalence',
    /** 同一页同时加载正式实现与逐字保留的旧实现，不经过任何渲染器。 */
    configureServer(vite) {
      vite.middlewares.use('/__heatmap-canvas', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__heatmap-canvas', `<html><body><script type="module">
          import { HeatmapCanvas } from '/src/assets/util/heatmap.js';
          import { HeatmapCanvas as LegacyHeatmapCanvas } from '/tests/fixtures/legacyHeatmap.js';
          window.heatmaps = { HeatmapCanvas, LegacyHeatmapCanvas };
        </script></body></html>`));
      });
    },
  }],
});

let browser, page;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__heatmap-canvas`);
  await page.waitForFunction(() => window.heatmaps);

  const result = await page.evaluate(() => {
    const { HeatmapCanvas, LegacyHeatmapCanvas } = window.heatmaps;
    /** 固定种子的伪随机数。 */
    const createRandom = (seed) => { let state = seed >>> 0; return () => {
      state = (state + 0x6D2B79F5) >>> 0; let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const random = createRandom(20261116);
    const frame = (fill) => Array.from({ length: 1024 }, (_, index) => fill(index));
    const blob = frame((index) => { const d = Math.hypot((index % 32) - 12, Math.floor(index / 32) - 18); return d < 6 ? Math.round(1800 * (1 - d / 6)) : 0; });
    const datasets = {
      zeros: frame(() => 0),
      single: frame((index) => (index === 500 ? 900 : 0)),
      blob,
      sparse: frame(() => (random() < 0.08 ? Math.floor(random() * 2000) : 0)),
      dense: frame(() => Math.floor(random() * 2600)),
      // 负值的透明度非法，会沿用上一档；超量程夹到 1。
      signed: frame((index) => (index % 7 === 0 ? -300 : index % 11 === 0 ? 5000 : index % 5 === 0 ? 40 : 0)),
      corners: frame((index) => ([0, 31, 992, 1023].includes(index) ? 2000 : 0)),
    };
    const variants = [
      { name: 'robot', scale: 1, options: { min: 0, max: 2000, size: 36 }, order: 0 },
      { name: 'default-body', scale: 0.5, options: undefined, order: 0 },
      { name: 'padded', scale: 0.5, options: { min: 0, max: 2000, size: 20 }, order: 2 },
      { name: 'filtered', scale: 0.25, options: { min: 0, max: 1500, size: 12, fliter: 300 }, order: 0 },
      { name: 'ranged', scale: 0.25, options: { min: 0, max: 2000, size: 9, range: [200, 1600] }, order: 0 },
    ];
    const pixels = (canvas) => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    /** 返回第一个不同的字节位置；完全相同返回 -1。 */
    const firstDifference = (a, b) => { if (a.length !== b.length) return 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i; return -1; };
    const mismatches = [];
    let compared = 0, painted = 0;
    for (const variant of variants) {
      const clone = () => (variant.options ? JSON.parse(JSON.stringify(variant.options)) : undefined);
      const current = new HeatmapCanvas(30, 30, variant.scale, variant.scale, 'body', clone());
      const legacy = new LegacyHeatmapCanvas(30, 30, variant.scale, variant.scale, 'body', clone());
      for (const [name, data] of Object.entries(datasets)) {
        // 两边都在同一张画布上连续重画，前一帧残留的状态也在比较范围内。
        const redrawn = current.changeHeatmap(data, 1, 1, variant.order);
        legacy.changeHeatmap(data, 1, 1, variant.order);
        const actual = pixels(current.canvas), expected = pixels(legacy.canvas);
        const at = firstDifference(actual, expected);
        compared += 1;
        if (expected.some((value, index) => index % 4 === 3 && value > 0)) painted += 1;
        if (at >= 0 || redrawn !== true) mismatches.push(`${variant.name}/${name}: redrawn=${redrawn} first difference at byte ${at}`);
      }
    }

    // 同样的输入第二次不重画，画布保持原样；改数据、改参数或作废后必须重画并仍与旧实现一致。
    const current = new HeatmapCanvas(30, 30, 0.5, 0.5, 'body', { min: 0, max: 2000, size: 20 });
    const legacy = new LegacyHeatmapCanvas(30, 30, 0.5, 0.5, 'body', { min: 0, max: 2000, size: 20 });
    const same = () => firstDifference(pixels(current.canvas), pixels(legacy.canvas)) === -1;
    const working = blob.slice();
    const skip = { first: current.changeHeatmap(working, 1, 1, 0) };
    legacy.changeHeatmap(working, 1, 1, 0);
    skip.repeat = current.changeHeatmap(working.slice(), 1, 1, 0);
    skip.repeatSame = same();
    working[40] = 777;
    skip.edited = current.changeHeatmap(working, 1, 1, 0); legacy.changeHeatmap(working, 1, 1, 0);
    skip.editedSame = same();
    current.options.max = 900; legacy.options.max = 900;
    skip.option = current.changeHeatmap(working, 1, 1, 0); legacy.changeHeatmap(working, 1, 1, 0);
    skip.optionSame = same();
    skip.order = current.changeHeatmap(working, 1, 1, 2); legacy.changeHeatmap(working, 1, 1, 2);
    skip.orderSame = same();
    skip.idle = current.changeHeatmap(working, 1, 1, 2);
    current.invalidate();
    skip.invalidated = current.changeHeatmap(working, 1, 1, 2);
    skip.invalidatedSame = same();
    current.width = 16; legacy.width = 16;
    skip.grid = current.changeHeatmap(working, 1, 1, 2); legacy.changeHeatmap(working, 1, 1, 2);
    skip.gridSame = same();

    // 负值的透明度非法，画圆会沿用上一次绘制留下的透明度：同一份数据连画两次，旧实现的画面可能不同。
    // 这种数据不能跳过重画，每次都要与旧实现逐位一致。
    const inherited = { redrawn: [], same: [], legacyChanged: false };
    const currentSigned = new HeatmapCanvas(30, 30, 0.5, 0.5, 'body', { min: 0, max: 2000, size: 20 });
    const legacySigned = new LegacyHeatmapCanvas(30, 30, 0.5, 0.5, 'body', { min: 0, max: 2000, size: 20 });
    let previousLegacy = null;
    for (const data of [datasets.dense, datasets.signed, datasets.signed, datasets.signed, datasets.blob, datasets.blob]) {
      inherited.redrawn.push(currentSigned.changeHeatmap(data, 1, 1, 0));
      legacySigned.changeHeatmap(data, 1, 1, 0);
      const expected = pixels(legacySigned.canvas);
      inherited.same.push(firstDifference(pixels(currentSigned.canvas), expected) === -1);
      if (data === datasets.signed && previousLegacy && firstDifference(previousLegacy, expected) !== -1) inherited.legacyChanged = true;
      previousLegacy = data === datasets.signed ? expected : null;
    }
    return { compared, painted, mismatches, skip, inherited };
  });

  assert.deepEqual(result.mismatches, [], '正式实现画出的像素必须与旧流程逐位相同');
  assert.ok(result.compared >= 35 && result.painted >= 20, `对拍必须覆盖真正画出内容的画布：${JSON.stringify(result)}`);
  assert.deepEqual(result.skip, { first: true, repeat: false, repeatSame: true, edited: true, editedSame: true,
    option: true, optionSame: true, order: true, orderSame: true, idle: false, invalidated: true, invalidatedSame: true,
    grid: true, gridSame: true });
  assert.equal(result.inherited.legacyChanged, true, '夹具必须真的让旧实现在重复绘制时画出不同画面，否则这组断言没有意义');
  assert.deepEqual(result.inherited.same, [true, true, true, true, true, true], '含非法透明度的数据重复绘制也必须与旧实现逐位一致');
  assert.deepEqual(result.inherited.redrawn, [true, true, true, true, true, false], '含非法透明度的数据不能跳过重画；之后的正常数据仍可跳过');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', compared: result.compared, painted: result.painted, artifacts }));
} catch (error) {
  console.error('HEATMAP_CANVAS_EQUIVALENCE_FAILED', artifacts);
  throw error;
} finally { await browser?.close(); await server.close(); }
