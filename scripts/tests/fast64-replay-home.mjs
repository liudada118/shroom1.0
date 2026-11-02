import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import translations from '../../client/src/i18n/monitorAuditTranslations.js';

const { createServer } = createRequire(new URL('../../client/package.json', import.meta.url))('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-fast64-replay-'));
const baselinePath = process.env.FAST64_BASELINE_SOURCE;
const baseline = baselinePath ? await readFile(baselinePath, 'utf8') : null;
const errors = [], sockets = new Set();
const license = { valid: true, selectFlag: 'all', date: Date.now() + 30 * 86400000, nowDate: Date.now() };
let browser, page, sequence = 0;
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, 'vite-cache'), server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'fast64-replay-observer', enforce: 'pre',
    /** 只观察真实缓冲区；基线选项运行修复前的完整文件，不替换数学或帧处理。 */
    transform(source, id) {
      const path = id.replaceAll('\\', '/').split('?')[0];
      if (path.endsWith('/components/three/4096.jsx')) {
        source = baseline || source;
        const hook = 'particles = new THREE.Points(sitGeometry, material);';
        assert.ok(source.includes(hook));
        return source.replace(hook, `${hook}
          window.__readFast64 = () => {
            const position = particles.geometry.attributes.position.array;
            const color = particles.geometry.attributes.color.array;
            const heights = Array.from(position).filter((_, index) => index % 3 === 1);
            return { ticks: window.__fast64Ticks || 0, values: Array.from(ndata1),
              points: heights.length, invalidHeights: heights.filter(value => !Number.isFinite(value)).length,
              invalidColors: Array.from(color).filter(value => !Number.isFinite(value)).length,
              quadrantPeaks: [0,1,2,3].map(part => Math.max(...heights.slice(part * heights.length / 4, (part + 1) * heights.length / 4))) };
          };`).replace('function sitRenew() {', 'function sitRenew() { window.__fast64Ticks = (window.__fast64Ticks || 0) + 1;');
      }
      if (path.endsWith('/numMatrix/react/backends/sprite3d.js')) {
        const hook = 'const peak = findPeak(data);';
        assert.ok(source.includes(hook));
        return source.replace(hook, `${hook} window.__fast64Raw = { values: Array.from(data), width: grid.gridWidth, height: grid.gridHeight, count };`);
      }
      return null;
    },
    /** 挂载正式门户和 Home，设备与网络响应由测试隔离。 */
    configureServer(vite) {
      vite.middlewares.use('/__fast64-replay', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__fast64-replay', '<html><head><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});

/** 从真实 WebSocket 发送 canonical 回放帧，不直接调用渲染器。 */
function send(values) {
  const frame = { type: 'sensor.frame', schemaVersion: 1, source: 'playback', displaySystemId: 'bed4096num', sensorType: 'bed4096num',
    sensorId: 'sit', channelId: 'bed4096num:sit', outputChannel: 'sit', sequence: ++sequence, timestamp: Date.now(), quality: 'good',
    serial: { role: 'sit', path: 'COM_FAST64_TEST', baudRate: 3000000, parserChannel: 'bed4096num:sit' },
    payload: { value: values, matrix: { rows: 64, cols: 64, total: 4096 } } };
  for (const socket of sockets) socket.send(JSON.stringify(frame));
}

/** 等待实际点图至少重绘两帧，确保坏清屏不会被紧接着的正常帧掩盖。 */
async function settle() {
  const ticks = await page.evaluate(() => window.__fast64Ticks || 0);
  await page.waitForFunction(previous => (window.__fast64Ticks || 0) >= previous + 2, ticks);
  return page.evaluate(() => window.__readFast64());
}

/** 读取侧栏真实显示总和。 */
async function total() {
  return page.locator('.aside .pressData').evaluate(element => Number(element.textContent));
}

/** 选择正式显示菜单，覆盖模式重挂载与帧再次分派。 */
async function mode(label) {
  await page.locator('.portal-display-panel .ant-select').last().click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: label }).click();
}

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket(/:19999/, socket => {
    sockets.add(socket); socket.onClose(() => sockets.delete(socket));
    socket.send(JSON.stringify({ licenseKey: 'fixture-key', ...license, currentSensorType: 'bed4096num' }));
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
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__fast64-replay?actual-monitor=1`);
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.locator('[data-system="bed4096num"]').click();
  await page.getByRole('button', { name: translations.monitorUi.enterSystem.zh, exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  await page.waitForFunction(() => window.__readFast64);

  const values = Array.from({ length: 4096 }, (_, index) => 20 + Math.floor(index / 1024) * 40 + index % 13);
  const expectedTotal = values.reduce((sum, value) => sum + value, 0);
  send(values); const initial = await settle();
  assert.deepEqual(initial.values, values); assert.equal(initial.invalidHeights, 0);
  assert.equal(initial.points, 136 * 136);
  await page.waitForFunction(expected => Number(document.querySelector('.aside .pressData')?.textContent) === expected, expectedTotal);
  await page.screenshot({ path: join(artifacts, 'before-clear.png') });

  send(Array(1024).fill(0)); const cleared = await settle();
  send(values); const recovered = await settle();
  if (baseline) {
    assert.ok(cleared.invalidHeights > 0, 'baseline short clear must corrupt geometry');
    assert.ok(recovered.invalidHeights > 0, 'baseline geometry remains corrupt after a complete frame');
    await page.screenshot({ path: join(artifacts, 'baseline-missing-points.png') });
    console.log('FAST64_BASELINE_REPRODUCED', JSON.stringify({ artifacts, invalidAfterClear: cleared.invalidHeights, invalidAfterFull: recovered.invalidHeights, points: recovered.points, total: await total() }));
  } else {
    assert.deepEqual(cleared.values, values, 'short clear must leave the last complete matrix intact');
    assert.equal(cleared.invalidHeights, 0); assert.equal(recovered.invalidHeights, 0);
    for (const invalid of [[], Array(4097).fill(0)]) {
      send(invalid); const current = await settle();
      assert.deepEqual(current.values, values); assert.equal(current.invalidHeights, 0);
    }
    for (let turn = 0; turn < 3; turn++) {
      send(Array(4096).fill(0)); const zero = await settle();
      assert.deepEqual(zero.values, Array(4096).fill(0)); assert.equal(zero.invalidHeights, 0);
      send(values); const current = await settle();
      assert.deepEqual(current.values, values); assert.equal(current.invalidHeights, 0); assert.equal(current.invalidColors, 0);
      assert.ok(current.quadrantPeaks.every(value => value > 0), 'all four quarters must contain visible geometry');
    }
    assert.equal(await total(), expectedTotal);
    await page.screenshot({ path: join(artifacts, 'replay-restored.png') });
    await mode('原始数据');
    await page.locator('.canvasNum canvas').first().waitFor();
    send(values);
    await page.waitForFunction(() => window.__fast64Raw?.values[4095] > 0);
    const raw = await page.evaluate(() => window.__fast64Raw);
    assert.equal(raw.width, 64); assert.equal(raw.height, 64); assert.equal(raw.count, 4096); assert.deepEqual(raw.values, values);
    await page.screenshot({ path: join(artifacts, 'raw-full-matrix.png') });
    await mode('3D 模型'); send(values); const restored = await settle();
    assert.deepEqual(restored.values, values); assert.equal(restored.invalidHeights, 0);
    assert.deepEqual(errors, []);
    console.log('FAST64_REPLAY_HOME_PASS', JSON.stringify({ artifacts, points: restored.points, rawPoints: raw.values.length, total: await total(), invalidHeights: restored.invalidHeights, quadrantPeaks: restored.quadrantPeaks }));
  }
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('FAST64_REPLAY_HOME_FAILED', JSON.stringify({ artifacts, errors })); throw error;
} finally { await browser?.close(); await server.close(); }
