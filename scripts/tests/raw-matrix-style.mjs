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
          import { createSpriteMatrixBackend } from '/@fs/${sdkRoot}renderers/numMatrix/react/backends/sprite3d.js';
          import { buildCoordinateWorldLayout } from '/@fs/${sdkRoot}core/coordinatePointLayout.js';
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
                statsCount: window.matrixStats.length, sensors: backend.sensorGrid.projectSensors(),
                grid: backend.sensorGrid.getGridBounds(), firstSensor: backend.sensorGrid.projectSensors()[0],
                canvas: canvases[0].getBoundingClientRect().toJSON(), overlay: canvases[1].getBoundingClientRect().toJSON() };
            };
            /** 读热场里某一格中心真实上屏的颜色；行列按当前画面数。 */
            window.matrixCellPixel = (row, col, shownColumns, shownRows) => {
              const canvas = document.querySelector('canvas'), gl = canvas.getContext('webgl'), pixel = new Uint8Array(4);
              gl.readPixels(Math.floor((col + .5) * canvas.width / shownColumns), Math.floor(canvas.height - (row + .5) * canvas.height / shownRows), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
              return [...pixel];
            };
            /** 改展示方向；先清掉之前的绘制记录，之后读到的就只有改过之后那一次重画。 */
            window.matrixView = (view) => {
              for (const canvas of document.querySelectorAll('canvas')) canvas.paintCalls = [];
              backend.setViewTransform(view);
            };
          };
          /** 某个预设的后端有没有提供展示方向（旋转、翻转）；用预设自己的版面单独建一次再释放。 */
          window.matrixSupportsView = (preset) => {
            const params = normalizeNumMatrixParams(LEGACY_PRESETS[preset]);
            const container = document.body.appendChild(document.createElement('div'));
            const probe = createWebglMatrixBackend({ container, config: params, grid: deriveGrid(params),
              tuning: {valuej1:200, valuef1:0, valuelInit1:0}, reportStats: () => {} });
            const supported = typeof probe.setViewTransform === 'function';
            probe.dispose(); container.remove();
            return supported;
          };
          /** 坐标表版面的精灵图矩阵（点位不是规则行列）：用来看旋转、翻转把每个点挪到了哪里。 */
          window.mountCoordinateSprites = (coordinates, values) => {
            backend?.dispose();
            const params = normalizeNumMatrixParams(LEGACY_PRESETS.fast1024);
            backend = createSpriteMatrixBackend({ container: document.querySelector('#matrix'), config: params, grid: deriveGrid(params),
              coordinateLayout: buildCoordinateWorldLayout(coordinates), colormap: {},
              tuning: {valuej1:200, valuef1:0, valuelInit1:0, valuep:0, valueprop:1} });
            backend.setFrame(values); backend.start();
            window.spriteView = (view) => backend.setViewTransform(view);
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

  // ---- 展示方向（旋转 90°、水平 / 纵向翻转）：23 列 × 16 行的非方阵，按真实上屏的数字、行列号、热场像素和量尺投影核对 ----
  // 预期位置是手算的（顺时针一次：上边到右边；水平翻转：左边到右边；纵向翻转：上边到下边），不借用被测的换算函数。
  const columns = 23, rows = 16, cells = columns * rows;
  /** 从大到小的 1 起点行列号。 */
  const down = (count) => Array.from({ length: count }, (_, index) => String(count - index));
  /** 从小到大的 1 起点行列号。 */
  const up = (count) => Array.from({ length: count }, (_, index) => String(index + 1));
  // 数据里 11 在第 1 行第 1 列、23 在第 1 行第 2 列、97 在第 2 行第 3 列；marks 是它们在画面上的 [行, 列]（0 起点）。
  const viewsExpected = [
    { name: '转 1 次', view: { quarterTurns: 1 }, width: 16, height: 23, marks: { 11: [0, 15], 23: [1, 15], 97: [2, 14] }, rowLabels: up(23), colLabels: down(16) },
    { name: '转 2 次', view: { quarterTurns: 2 }, width: 23, height: 16, marks: { 11: [15, 22], 23: [15, 21], 97: [14, 20] }, rowLabels: down(16), colLabels: down(23) },
    { name: '转 3 次', view: { quarterTurns: 3 }, width: 16, height: 23, marks: { 11: [22, 0], 23: [21, 0], 97: [20, 1] }, rowLabels: down(23), colLabels: up(16) },
    { name: '转回原位', view: { quarterTurns: 0 }, width: 23, height: 16, marks: { 11: [0, 0], 23: [0, 1], 97: [1, 2] }, rowLabels: up(16), colLabels: up(23) },
    { name: '水平翻转', view: { flipX: true }, width: 23, height: 16, marks: { 11: [0, 22], 23: [0, 21], 97: [1, 20] }, rowLabels: up(16), colLabels: down(23) },
    { name: '纵向翻转', view: { flipY: true }, width: 23, height: 16, marks: { 11: [15, 0], 23: [15, 1], 97: [14, 2] }, rowLabels: down(16), colLabels: up(23) },
    // 两个方向都翻，和转两次是同一幅画面。
    { name: '水平加纵向翻转', view: { flipX: true, flipY: true }, width: 23, height: 16, marks: { 11: [15, 22], 23: [15, 21], 97: [14, 20] }, rowLabels: down(16), colLabels: down(23) },
    // 先水平翻转再顺时针一次：等于「转 1 次」那幅上下颠倒。
    { name: '水平翻转后转 1 次', view: { flipX: true, quarterTurns: 1 }, width: 16, height: 23, marks: { 11: [22, 15], 23: [21, 15], 97: [20, 14] }, rowLabels: down(23), colLabels: down(16) },
    // 工具里「转 1 次之后点水平翻转」记成的写法：等于「转 1 次」那幅左右颠倒，也就是行列互换。
    { name: '转 1 次后水平翻转', view: { flipX: true, quarterTurns: 3 }, width: 16, height: 23, marks: { 11: [0, 0], 23: [1, 0], 97: [2, 1] }, rowLabels: up(23), colLabels: up(16) },
    { name: '回到与数据同向', view: {}, width: 23, height: 16, marks: { 11: [0, 0], 23: [0, 1], 97: [1, 2] }, rowLabels: up(16), colLabels: up(23) },
  ];
  const sourceIndex = { 11: 0, 23: 1, 97: columns + 2 };
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.evaluate(() => window.mountMatrix('webglRawDefault', 23, 16));
  await page.waitForFunction((size) => window.matrixState?.().calls.length >= size, cells + columns + rows);
  const initial = await page.evaluate(() => window.matrixState());
  for (const expected of viewsExpected) {
    await page.evaluate((view) => window.matrixView(view), expected.view);
    await page.waitForFunction((size) => window.matrixState().calls.length >= size, cells + columns + rows);
    const state = await page.evaluate(() => window.matrixState());
    const label = expected.name, upright = !expected.view.flipX && !expected.view.flipY && !expected.view.quarterTurns;
    assert.equal(state.calls.length, cells + columns + rows, `${label}: 只重画一次`);
    assert.equal(state.width * expected.height, state.height * expected.width, `${label}: 画布宽高跟着版面走`);
    const cellSize = state.width / expected.width, numbers = state.calls.slice(0, cells);
    assert.equal(numbers.filter(([text]) => text !== '0').length, 3, `${label}: 画面上仍然只有三个非零数字`);
    for (const [value, [row, col]] of Object.entries(expected.marks)) {
      const call = numbers[row * expected.width + col];
      assert.equal(call[0], value, `${label}: ${value} 应该画在第 ${row + 1} 行第 ${col + 1} 列`);
      assert.ok(Math.abs(call[1] - (col + .5) * cellSize) < .01 && Math.abs(call[2] - (row + .5) * cellSize) < .01, `${label}: ${value} 画在格子正中`);
      // 量尺和坐标换算读的投影点跟着格子走，但索引还是数据里原来的那个。
      const sensor = state.sensors[sourceIndex[value]];
      assert.equal(sensor.index, sourceIndex[value]);
      assert.ok(Math.abs(sensor.x - state.canvas.x - call[1]) < .6 && Math.abs(sensor.y - state.canvas.y - call[2]) < .6, `${label}: ${value} 的投影点和画出来的数字对不上`);
    }
    assert.deepEqual(state.calls.slice(cells, cells + expected.height).map(([text]) => text), expected.rowLabels, `${label}: 左侧标的是原始行列号`);
    assert.deepEqual(state.calls.slice(-expected.width).map(([text]) => text), expected.colLabels, `${label}: 底部标的是原始行列号`);
    // 热场也跟着画面走：97 所在的格不再是零值的蓝底，它原来所在的位置变回蓝底。
    /** 这个像素是不是零值格的蓝底。 */
    const isBlue = (pixel) => pixel[2] > pixel[0] + 80 && pixel[2] > pixel[1] + 80;
    const hot = await page.evaluate(([row, col, w, h]) => window.matrixCellPixel(row, col, w, h), [...expected.marks[97], expected.width, expected.height]);
    assert.equal(isBlue(hot), false, `${label}: 热场没有跟着数字一起走 ${hot}`);
    if (!upright) {
      const vacated = await page.evaluate(([w, h]) => window.matrixCellPixel(1, 2, w, h), [expected.width, expected.height]);
      assert.equal(isBlue(vacated), true, `${label}: 与数据同向时 97 所在的位置应该变回蓝底 ${vacated}`);
    }
    assert.equal(state.statsCount, initial.statsCount, `${label}: 改展示方向不重新上报统计`);
    assert.deepEqual(state.stats, initial.stats, `${label}: 统计读到的帧顺序不变`);
    assert.equal(state.grid === null, !upright, `${label}: 翻过或转过之后不提供按外沿均分的框选边界`);
    if (expected.name === '转 1 次') await page.screenshot({ path: join(screenshots, 'rectangular-rotated-once.png') });
    if (expected.name === '水平翻转') await page.screenshot({ path: join(screenshots, 'rectangular-flipped-horizontally.png') });
  }
  // 转过之后缩小窗口：格子边长按转过之后的版面重算，画面保持转过的方向，不弹回没转的样子。
  await page.evaluate(() => window.matrixView({ quarterTurns: 1 }));
  await page.waitForFunction((size) => window.matrixState().calls.length >= size, cells + columns + rows);
  const wide = await page.evaluate(() => window.matrixState());
  await page.evaluate(() => { for (const canvas of document.querySelectorAll('canvas')) canvas.paintCalls = []; });
  await page.setViewportSize({ width: 1000, height: 760 });
  await page.waitForFunction(([previous, size]) => window.matrixState().width < previous && window.matrixState().calls.length >= size, [wide.width, cells + columns + rows]);
  const narrow = await page.evaluate(() => window.matrixState());
  assert.equal(narrow.width * 23, narrow.height * 16, '缩小窗口后画布仍是转过之后的 16 列 × 23 行');
  const moved = narrow.calls.slice(0, cells)[1 * 16 + 15];
  assert.equal(moved[0], '23', '缩小窗口后 23 仍在转过之后的位置（第 2 行第 16 列）');
  assert.ok(Math.abs(moved[1] - 15.5 * narrow.width / 16) < .01 && Math.abs(moved[2] - 1.5 * narrow.width / 16) < .01, '缩小窗口后数字仍画在格子正中');
  assert.deepEqual(narrow.calls.slice(cells, cells + 23).map(([text]) => text), up(23), '缩小窗口后左侧标的仍是原始行列号');
  assert.deepEqual(narrow.stats, initial.stats, '缩小窗口不改统计读到的帧');
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForFunction((previous) => window.matrixState().width > previous, narrow.width);
  // 分区、双脚和手套版面是多块拼的，不提供旋转和翻转；单块规则矩阵都提供。
  for (const [preset, supported] of [['webglRawDefault', true], ['webglRawTransposed', true], ['webglRawCarCol', true], ['webglNumDefault', true],
    ['webglRawGlove', false], ['webglRawFoot', false], ['webglRawRobotSY', false], ['webglNumGlove', false], ['webglNumFoot', false]]) {
    assert.equal(await page.evaluate((name) => window.matrixSupportsView(name), preset), supported, `${preset} 是否提供旋转和翻转`);
  }

  // ---- 坐标表版面（精灵图后端）：点位不是规则行列，只有一个点有压力，看它在屏幕上被挪到了哪里 ----
  // 6 列 × 4 行的布点，有压力的点不靠边、不在任何对称轴上，所以转了几圈、是转还是翻都分得出来。
  await page.evaluate(() => window.mountCoordinateSprites(
    Array.from({ length: 4 }, (_, row) => Array.from({ length: 6 }, (_, col) => [col * 10, row * 10])),
    Array.from({ length: 24 }, (_, index) => (index === 1 * 6 + 4 ? 200 : 0))));
  /**
   * 截下画布真实上屏的像素，返回红色（有压力）那个点相对画布中心的位置：x 向右、y 向下；没找到返回 null。
   * ⚠️ 取红色区域外接框的中心，不取重心：格子中间的白色数字不算红色，取重心会被它带偏。
   */
  const litOffset = async () => {
    const box = await page.locator('#matrix canvas').first().boundingBox();
    const png = await page.screenshot({ clip: box });
    return page.evaluate(async (source) => {
      const image = new Image(); image.src = source; await image.decode();
      const copy = document.createElement('canvas'); copy.width = image.width; copy.height = image.height;
      const context = copy.getContext('2d'); context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
      let count = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        // 红底连同暗红描边都算这个格子（描边只在两条边上，漏掉它外接框就偏了）；白色数字和蓝色的零值点不算。
        if (pixels[offset] < 90 || pixels[offset + 1] > 90 || pixels[offset + 2] > 90) continue;
        const x = (offset / 4) % copy.width, y = Math.floor(offset / 4 / copy.width);
        count++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      // 外接框碰到画布边缘说明格子被裁掉了一部分，中心不可信。
      if (count < 50 || minX === 0 || minY === 0 || maxX === copy.width - 1 || maxY === copy.height - 1) return null;
      return { x: (minX + maxX + 1) / 2 - copy.width / 2, y: (minY + maxY + 1) / 2 - copy.height / 2 };
    }, `data:image/png;base64,${png.toString('base64')}`);
  };
  /** 等有压力的点落到预期位置（不给预期时等它出现），返回实际位置。 */
  const waitLit = async (label, expected) => {
    let seen = null;
    for (let round = 0; round < 60; round++) {
      seen = await litOffset();
      if (seen && (!expected || Math.hypot(seen.x - expected.x, seen.y - expected.y) < 3)) return seen;
      await page.waitForTimeout(50);
    }
    assert.fail(`${label}: 有压力的点应在 ${JSON.stringify(expected)}，实际 ${JSON.stringify(seen)}`);
  };
  const start = await waitLit('坐标表版面与数据同向');
  assert.ok(Math.abs(start.x) > 40 && Math.abs(start.y) > 40 && Math.abs(Math.abs(start.x) - Math.abs(start.y)) > 40,
    `有压力的点必须偏离中心和对角线，否则分不出方向 ${JSON.stringify(start)}`);
  // 屏幕坐标 x 向右、y 向下（相对版面中心）。顺时针 90° 是 (x, y) → (−y, x)：原来在正上方的点到正右方；
  // 水平翻转是 x 取反，纵向翻转是 y 取反；又翻又转时先翻后转。
  const { x, y } = start;
  for (const [name, view, spot] of [
    ['转 1 次', { quarterTurns: 1 }, { x: -y, y: x }], ['转 2 次', { quarterTurns: 2 }, { x: -x, y: -y }],
    ['转 3 次', { quarterTurns: 3 }, { x: y, y: -x }], ['转回原位', { quarterTurns: 0 }, { x, y }],
    ['水平翻转', { flipX: true }, { x: -x, y }], ['纵向翻转', { flipY: true }, { x, y: -y }],
    ['水平翻转后转 1 次', { flipX: true, quarterTurns: 1 }, { x: -y, y: -x }], ['回到与数据同向', {}, { x, y }],
  ]) {
    await page.evaluate((next) => window.spriteView(next), view);
    await waitLit(`坐标表版面${name}`, spot);
    if (name === '转 1 次') await page.screenshot({ path: join(screenshots, 'coordinate-sprites-rotated-once.png') });
  }
  assert.deepEqual(errors, []);
  console.log(`RAW_MATRIX_STYLE_PASS screenshots=${screenshots} coordinateStart=${JSON.stringify(start)}`);
} finally {
  await browser?.close();
  await server.close();
}
