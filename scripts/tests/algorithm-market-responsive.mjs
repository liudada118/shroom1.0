import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-algorithm-market-fit-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, '.vite'), logLevel: 'error', server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'algorithm-market-responsive-test',
    /** 真实门户和Home加载，网络及硬件仅在浏览器内隔离。 */
    configureServer(vite) {
      vite.middlewares.use('/__algorithm-market-fit', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__algorithm-market-fit', '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});
const packageNames = ['床垫生命体征', 'Pressure distribution analysis', '呼吸と心拍のリアルタイム解析'];
const packages = packageNames.map((name, index) => ({ id: `fit-package-${index}`, name,
  description: index === 1 ? 'Calculate pressure distribution and show live measurements from the selected sensor.'
    : '显示当前传感器的实时算法结果，支持连续趋势观察和启用停用操作。',
  sampleRateHz: 8, metricDefinitions: [{ id: 'value', label: '算法值', unit: '' }] }));
let sensorType = 'jqbed', instances = [];
const mutations = [], evidence = [], errors = [];

/** 返回隔离的真实接口形状，启用状态只跟随收到的POST请求。 */
function snapshot() {
  return { sensorType, allowed: true, packages, instances,
    channels: [{ channelId: `${sensorType}:sit`, label: '当前小床传感器', live: true, matrix: { rows: 32, cols: 32, total: 1024 } }] };
}

/** 等待布局和滚动后的浏览器帧，不强制覆盖CSS。 */
async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/** 检查固定标题与关闭入口、内部滚动轨道和当前可见操作。 */
async function inspect(page) {
  return page.evaluate(() => {
    /** 读取可序列化边界。 */
    const rect = node => {
      const value = node.getBoundingClientRect();
      return { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom };
    };
    const market = document.querySelector('.portal-algorithm-market');
    const track = market.querySelector('.portal-algorithm-market-track');
    return { viewport: { width: innerWidth, height: innerHeight }, market: rect(market),
      header: rect(market.querySelector('header')), close: rect(market.querySelector('[aria-label="收起算法超市"]')),
      categories: rect(market.querySelector('.portal-algorithm-categories')), track: rect(track),
      scrollWidth: track.scrollWidth, clientWidth: track.clientWidth, scrollHeight: track.scrollHeight, clientHeight: track.clientHeight,
      bodyWidth: document.documentElement.scrollWidth,
      cards: [...track.querySelectorAll('.portal-algorithm-card')].map(card => ({ rect: rect(card),
        title: rect(card.querySelector('strong')), footer: rect(card.querySelector('.portal-algorithm-card-output')) })) };
  });
}

/** 容器留在视口内，标题关闭固定可达，卡片操作通过内容滚动访问。 */
function assertFit(state, label) {
  const { market, viewport } = state;
  assert.ok(market.x >= 0 && market.y >= 0 && market.right <= viewport.width + 1 && market.bottom <= viewport.height + 1, `${label}: 面板完整留在视口内`);
  assert.ok(market.width <= 1001 && market.height <= (viewport.width <= 560 ? 341 : 321), `${label}: 限制超市占位`);
  assert.ok(state.close.x >= market.x && state.close.right <= market.right + 1 && state.close.bottom <= state.header.bottom + 1, `${label}: 关闭入口可见`);
  assert.ok(state.categories.bottom <= state.track.y + 1, `${label}: 分类不压住卡片`);
  assert.ok(state.track.height > 45 && state.track.bottom <= market.bottom + 1, `${label}: 卡片轨道有可滚动空间`);
  assert.equal(state.bodyWidth, viewport.width, `${label}: 只允许超市内部横向滚动`);
  for (const card of state.cards) {
    assert.ok(card.footer.bottom <= card.rect.bottom + 1, `${label}: 操作行留在卡片内`);
    assert.ok(card.title.right <= card.rect.right + 1 && card.title.x >= card.rect.x, `${label}: 长标题不撑宽卡片`);
  }
}

let browser, page;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1470, height: 820 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  const license = { date: Date.now() + 30 * 86400000, nowDate: Date.now(), selectFlag: 'all', valid: true };
  await page.routeWebSocket(/:19999/, socket => {
    socket.send(JSON.stringify({ licenseKey: 'fixture-key' })); socket.send(JSON.stringify(license));
  });
  await page.route('http://127.0.0.1:19245/**', route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    const request = route.request(), url = request.url();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.endsWith('/api/collection/status')) return route.fulfill({ headers, json: { current: null, collectionSummary: null, recent: [] } });
    if (url.endsWith('/api/display-systems')) return route.fulfill({ headers, json: { displaySystems: { runtimeDefinitions: [] } } });
    if (url.endsWith('/api/algorithm-market')) {
      if (request.method() === 'POST') {
        const body = request.postDataJSON(); mutations.push(body);
        instances = body.enabled ? [{ id: body.packageId, token: `fit-${mutations.length}`, channelId: body.channelId, history: [], status: 'running' }] : [];
      }
      return route.fulfill({ headers, json: snapshot() });
    }
    if (url.endsWith('/api/commands')) {
      const command = request.postDataJSON();
      if (command.type === 'sensor.switch') sensorType = command.payload.sensorType;
      const results = command.type === 'license.activate' ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [];
      return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { results } } } });
    }
    return route.fulfill({ headers, json: {} });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__algorithm-market-fit?actual-monitor=1`);
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.locator('[data-system="jqbed"]').click();
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: '算法', exact: true }).click();
  const market = page.getByRole('complementary', { name: '算法超市', exact: true });
  await market.waitFor();
  for (const viewport of [{ width: 1470, height: 820 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 900, height: 600 }, { width: 390, height: 844 }, { width: 1280, height: 480 }]) {
    await page.setViewportSize(viewport); await settle(page);
    await market.getByRole('button', { name: /指标图表/ }).click();
    const chartState = await inspect(page); assertFit(chartState, `${viewport.width} charts`);
    evidence.push({ category: 'charts', ...chartState });
    await page.screenshot({ path: join(artifacts, `charts-${viewport.width}-${viewport.height}.png`) });
    const chart = market.locator('.portal-algorithm-card').last();
    await chart.scrollIntoViewIfNeeded();
    const headerBefore = await market.locator('header').boundingBox();
    await chart.focus(); await page.keyboard.press('Enter');
    assert.equal(await chart.getAttribute('aria-pressed'), 'true', '滚动后指标图表仍可添加');
    assert.deepEqual(await market.locator('header').boundingBox(), headerBefore, '轨道滚动不带走标题和关闭入口');
    await market.getByRole('button', { name: /Python 算法包/ }).click();
    await market.getByRole('button', { name: `启用${packageNames[2]}`, exact: true }).waitFor();
    const packageState = await inspect(page); assertFit(packageState, `${viewport.width} packages`);
    evidence.push({ category: 'packages', ...packageState });
    const card = market.getByRole('button', { name: `启用${packageNames[2]}`, exact: true });
    await card.locator('.portal-algorithm-card-output').scrollIntoViewIfNeeded();
    const footer = await card.locator('.portal-algorithm-card-output').boundingBox();
    const track = await market.locator('.portal-algorithm-market-track').boundingBox();
    assert.ok(footer.y >= track.y - 1 && footer.y + footer.height <= track.y + track.height + 1, '最矮窗口也能滚动到完整启用操作');
    assert.deepEqual(await market.locator('header').boundingBox(), headerBefore, '垂直滚动不带走标题关闭入口');
    await card.click();
    await market.getByRole('button', { name: `停用${packageNames[2]}`, exact: true }).click();
    await market.getByRole('button', { name: `启用${packageNames[2]}`, exact: true }).waitFor();
    await card.locator('.portal-algorithm-card-output').scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(artifacts, `packages-${viewport.width}-${viewport.height}.png`) });
  }
  await market.getByRole('button', { name: '收起算法超市', exact: true }).click();
  await market.waitFor({ state: 'hidden' });
  assert.equal(mutations.length, 12, '每种尺寸的启用/停用都发送一次真实接口请求');
  assert.deepEqual(errors, [], '无页面运行异常');
  await writeFile(join(artifacts, 'layout-evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(`algorithm market responsive PASSED: ${evidence.length} layouts, ${mutations.length} toggles; artifacts: ${artifacts}`);
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  if (page) await inspect(page).then(state => writeFile(join(artifacts, 'failure-layout.json'), JSON.stringify(state, null, 2))).catch(() => {});
  console.error('algorithm market responsive FAILED; artifacts:', artifacts);
  throw error;
} finally {
  await browser?.close(); await server.close();
}
