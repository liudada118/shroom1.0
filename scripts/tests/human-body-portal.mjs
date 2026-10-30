import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-human-body-portal-'));
const baseline = process.argv.includes('--baseline');
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false }, plugins: [{ name: 'human-body-portal-test',
    /** 记录真实 Home 实例，仅供确认状态广播和首帧的实际消费结果。 */
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/src/page/home/Home.jsx')) return undefined;
      return `${code}\nconst bodyPortalMount = Home.prototype.componentDidMount;
        Home.prototype.componentDidMount = function (...args) {
          window.bodyPortalHome = this;
          return bodyPortalMount.apply(this, args);
        };`;
    },
    /** 复用正式门户夹具，保留系统预览、入场遮罩与真实Home装配。 */
    configureServer(vite) {
      vite.middlewares.use('/__human-body-portal', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__human-body-portal', `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><div id="app-tools-fixture"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script>
          <script type="module">
            import React from 'react';
            import { createRoot } from 'react-dom/client';
            import AppTools from '/src/components/appTools/AppTools.jsx';
            createRoot(document.getElementById('app-tools-fixture')).render(React.createElement(AppTools));
          </script></body></html>`));
      });
    },
  }],
});

/** 读取实际人体画布的宿主和遮挡关系，不能把资源请求成功当成页面可见。 */
async function inspectViewport(page) {
  return page.evaluate(() => {
    const viewport = document.querySelector('[data-human-body-viewport="true"]');
    const canvas = viewport?.querySelector('canvas');
    const monitor = document.querySelector('.portal-runtime-monitor');
    const bounds = canvas?.getBoundingClientRect();
    const point = bounds ? { x: bounds.x + bounds.width * .5, y: bounds.y + bounds.height * .45 } : { x: 720, y: 405 };
    const covering = document.elementFromPoint(point.x, point.y);
    return { inMonitor: Boolean(viewport?.closest('.portal-runtime-monitor')), inDataRenderer: Boolean(viewport?.closest('.portal-data-renderer')),
      parent: viewport?.parentElement?.className || viewport?.parentElement?.tagName, handoff: monitor?.dataset.handoff,
      monitorCanvases: monitor?.querySelectorAll('.portal-data-renderer canvas').length || 0,
      covering: { tag: covering?.tagName, className: covering?.className }, viewportCoversPoint: Boolean(viewport?.contains(covering)),
      width: bounds?.width, height: bounds?.height, text: viewport?.textContent?.slice(0, 180) };
  });
}

/** 切换正式显示选择器，确保原始网格与三维模型可往返。 */
async function chooseMode(page, label) {
  const input = page.getByRole('combobox', { name: '显示方式', exact: true });
  await input.locator('xpath=ancestor::div[contains(@class,"ant-select")]').first().locator('.ant-select-selector').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText(label, { exact: true }).click();
}

/** 比较真实画布中心像素与背景色，防止空画布和完成标记造成假通过。 */
async function readModelPixels(page) {
  const image = await page.locator('[data-human-body-viewport="true"] canvas').first().screenshot();
  return page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let different = 0, warm = 0;
    for (let y = Math.floor(canvas.height * .12); y < canvas.height * .88; y += 3) {
      for (let x = Math.floor(canvas.width * .25); x < canvas.width * .75; x += 3) {
        const offset = (y * canvas.width + x) * 4;
        if (Math.abs(pixels[offset] - pixels[0]) + Math.abs(pixels[offset + 1] - pixels[1]) + Math.abs(pixels[offset + 2] - pixels[2]) > 50) different++;
        if (pixels[offset] > pixels[offset + 1] + 35 && pixels[offset] > pixels[offset + 2] + 35) warm++;
      }
    }
    return { different, warm, width: canvas.width, height: canvas.height };
  }, image.toString('base64'));
}

/** 核对全身与背心共用右下三列视角面板，并验证背心各部位仍能驱动真实镜头。 */
async function verifyBodyRegionControls(page, system, verifyInteractions = false) {
  const viewport = page.locator('[data-human-body-viewport="true"]');
  assert.equal(await viewport.getByText('2D 数字 · 全身', { exact: true }).count(), 0);
  assert.equal(await page.locator('[data-human-body-settings="true"]:visible').count(), 0,
    '默认画布不能继续显示左上渲染设置');
  const regions = page.locator('[data-human-body-region-views="true"]');
  await regions.waitFor();
  const expectedLabels = system === 'pressureVest'
    ? ['全身', '前胸', '后背', '左肩', '右肩']
    : ['全身', '前胸', '后背', '左臂', '右臂', '前腿', '后腿'];
  assert.deepEqual(await regions.locator('button[aria-pressed]').allTextContents(), expectedLabels);
  const columns = await regions.locator('button[aria-pressed]').first().evaluate(button =>
    getComputedStyle(button.parentElement).gridTemplateColumns.split(' ').length);
  assert.equal(columns, 3, '门户部位视角使用三列布局');
  await page.locator('.shroom-app-tools').waitFor();
  const layouts = [];
  for (const viewportSize of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize(viewportSize);
    await page.waitForFunction(() => {
      const bounds = document.querySelector('[data-human-body-region-views="true"]')?.getBoundingClientRect();
      return bounds && bounds.right <= innerWidth && bounds.bottom <= innerHeight;
    });
    const layout = await regions.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: innerWidth, height: innerHeight,
        overlaps: [...document.querySelectorAll('.portal-monitor-tools-rail, .shroom-app-tools')].flatMap((tool) => {
          const other = tool.getBoundingClientRect();
          if (!(other.width > 0 && other.height > 0) || getComputedStyle(tool).visibility === 'hidden') return [];
          return box.x < other.right && box.right > other.x && box.y < other.bottom && box.bottom > other.y
            ? [tool.className] : [];
        }) };
    });
    assert.ok(layout.x > layout.width * .5 && layout.y > layout.height * .5,
      `部位视角应位于右下: ${JSON.stringify(layout)}`);
    assert.ok(layout.right <= layout.width && layout.bottom <= layout.height, JSON.stringify(layout));
    assert.deepEqual(layout.overlaps, [], '部位视角不能遮挡右侧工具或应用工具');
    layouts.push(layout);
    await page.screenshot({ path: join(artifacts, `${system}-layout-${viewportSize.width}-${viewportSize.height}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  if (verifyInteractions) {
    await page.evaluate(() => { window.bodyPortalRegionCanvas = document.querySelector('[data-human-body-viewport="true"] canvas'); });
    const wasRotating = await regions.getByRole('button', { name: '暂停旋转', exact: true }).count() > 0;
    if (wasRotating) await regions.getByRole('button', { name: '暂停旋转', exact: true }).click();
    await regions.getByRole('button', { name: '自动旋转', exact: true }).waitFor();
    const canvas = viewport.locator('canvas').first();
    let previousImage = await canvas.screenshot();
    for (const label of ['前胸', '后背', '左肩', '右肩']) {
      const button = regions.getByRole('button', { name: label, exact: true });
      await button.click();
      await page.waitForTimeout(1200);
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await regions.locator('button[aria-pressed="true"]').count(), 1);
      const currentImage = await canvas.screenshot();
      assert.equal(currentImage.equals(previousImage), false, `${label} 应改变真实模型视角`);
      previousImage = currentImage;
    }
    await regions.getByRole('button', { name: '重置视角', exact: true }).click();
    await page.waitForTimeout(1200);
    assert.equal(await regions.getByRole('button', { name: '全身', exact: true }).getAttribute('aria-pressed'), 'true');
    await regions.getByRole('button', { name: '自动旋转', exact: true }).waitFor();
    if (wasRotating) {
      await regions.getByRole('button', { name: '自动旋转', exact: true }).click();
      await regions.getByRole('button', { name: '暂停旋转', exact: true }).waitFor();
    }
    assert.equal(await page.evaluate(() => window.bodyPortalRegionCanvas === document.querySelector('[data-human-body-viewport="true"] canvas')), true,
      '切换部位、重置视角或旋转不能重建模型画布');
    await page.screenshot({ path: join(artifacts, `${system}-region-interactions.png`) });
  }
  console.log('HUMAN_BODY_REGION_LAYOUT_PASS', JSON.stringify({ system, columns, labels: expectedLabels, layouts, verifyInteractions }));
}

/** 检查人体与背心调节归入抽屉、色块正圆，以及各自设置在重新进入后独立保留。 */
async function verifyBodySettings(page, system) {
  const settingsKey = `${system}.renderSettings.v1`;
  const otherKey = `${system === 'pressureVest' ? 'humanBodyOptimized' : 'pressureVest'}.renderSettings.v1`;
  const stored = await page.evaluate(([key, other]) => ({
    current: JSON.parse(localStorage.getItem(key) || 'null'), other: localStorage.getItem(other),
  }), [settingsKey, otherKey]);
  assert.equal(await page.locator('[data-human-body-settings="true"]:visible').count(), 0,
    `${system} 默认画布不能显示左上渲染设置`);
  await page.evaluate(() => { window.bodyPortalOriginalCanvas = document.querySelector('[data-human-body-viewport="true"] canvas'); });
  await page.getByRole('button', { name: '调节', exact: true }).click();
  const settings = page.locator('[data-human-body-settings="true"]:visible');
  await settings.waitFor();
  assert.equal(await settings.count(), 1, '只能显示一份渲染设置');
  assert.equal(await settings.evaluate(element => Boolean(element.closest('.ant-drawer'))), true);
  assert.equal(await settings.evaluate(element => Boolean(element.closest('[data-human-body-viewport]'))), false,
    '渲染设置不能留在画布浮层中');
  await settings.getByText('热力计算', { exact: true }).waitFor();
  const swatches = settings.locator('.human-body-color-swatch');
  assert.equal(await swatches.count(), 8);
  if (stored.current) {
    assert.equal(await settings.getByRole('button', { name: `背景 ${stored.current.bgColor}`, exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await settings.getByRole('button', { name: `模型 ${stored.current.modelColor}`, exact: true }).getAttribute('aria-pressed'), 'true');
  }
  const swatchLayouts = [];
  for (const viewportSize of [{ width: 1440, height: 900 }, { width: 420, height: 900 }]) {
    await page.setViewportSize(viewportSize);
    await page.waitForFunction(() => {
      const wrapper = document.querySelector('.ant-drawer-open .ant-drawer-content-wrapper');
      const box = wrapper?.getBoundingClientRect();
      return box && box.left >= 0 && box.right <= innerWidth + 0.5;
    });
    const sizes = await swatches.evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      return { width: box.width, height: box.height, radius: style.borderRadius, flexShrink: style.flexShrink,
        inViewport: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight };
    }));
    for (const size of sizes) {
      assert.ok(size.width >= 31.5 && Math.abs(size.width - size.height) < 0.5,
        `${system} 色块必须为等宽高正圆: ${JSON.stringify(size)}`);
      assert.equal(size.radius, '50%');
      assert.equal(size.inViewport, true, `${system} 色块必须完整显示在视口中`);
    }
    swatchLayouts.push({ ...viewportSize, sizes });
    await page.screenshot({ path: join(artifacts, `${system}-settings-${viewportSize.width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const colors = system === 'pressureVest'
    ? { bgColor: '#10152b', modelColor: '#4fd1c5', background: 'rgb(16, 21, 43)' }
    : { bgColor: '#0f2027', modelColor: '#d2d6dc', background: 'rgb(15, 32, 39)' };
  await settings.getByRole('button', { name: `背景 ${colors.bgColor}`, exact: true }).click();
  const modelPreset = settings.getByRole('button', { name: `模型 ${colors.modelColor}`, exact: true });
  await modelPreset.focus();
  await modelPreset.press('Space');
  await page.waitForFunction(({ key, colors }) => {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    return saved?.bgColor === colors.bgColor && saved?.modelColor === colors.modelColor
      && getComputedStyle(document.querySelector('[data-human-body-viewport="true"]')).backgroundColor === colors.background;
  }, { key: settingsKey, colors });
  assert.equal(await page.evaluate(key => localStorage.getItem(key), otherKey), stored.other,
    '修改当前系统颜色不能覆盖另一个系统的设置');
  const radius = settings.locator('input[type="range"]').first();
  await radius.focus();
  await radius.press('ArrowRight');
  await page.locator('.ant-drawer:visible .ant-drawer-close').click();
  await settings.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => window.bodyPortalOriginalCanvas === document.querySelector('[data-human-body-viewport="true"] canvas')), true,
    '开关调节或修改参数不能重建模型画布');
  await page.getByRole('button', { name: '调节', exact: true }).click();
  await settings.waitFor();
  assert.equal(await settings.getByRole('button', { name: `背景 ${colors.bgColor}`, exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await settings.getByRole('button', { name: `模型 ${colors.modelColor}`, exact: true }).getAttribute('aria-pressed'), 'true');
  await page.locator('.ant-drawer:visible .ant-drawer-close').click();
  await settings.waitFor({ state: 'hidden' });
  const pixels = await readModelPixels(page);
  assert.ok(pixels.different > 100 && pixels.warm > 40, '关闭调节后首帧热力仍应可见');
  await page.screenshot({ path: join(artifacts, `${system}-controls.png`) });
  console.log('HUMAN_BODY_CONTROLS_PASS', JSON.stringify({ system, swatchLayouts, colors, pixels }));
}

let browser, page;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(30000);
  const errors = [], responses = [];
  const sockets = new Set(), serialCommands = [];
  let activeSystem = '', serialRevision = 0;
  /** 广播合成状态或规范数据帧，所有网络接口均由当前浏览器夹具接管。 */
  const publish = (payload) => { for (const socket of sockets) socket.send(JSON.stringify(payload)); };
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().includes('/model/')) responses.push({ url: new URL(response.url()).pathname, status: response.status() }); });
  const license = { date: Date.now() + 30 * 86400000, nowDate: Date.now(), selectFlag: 'all', valid: true };
  await page.routeWebSocket(/:19999/, socket => {
    sockets.add(socket);
    socket.onClose(() => sockets.delete(socket));
    socket.send(JSON.stringify({ licenseKey: 'fixture-key' })); socket.send(JSON.stringify(license));
    socket.send(JSON.stringify({ port: [{ path: 'COM_BODY_TEST' }] }));
  });
  await page.route('http://127.0.0.1:19245/**', route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (route.request().method() === 'GET' && route.request().url().endsWith('/api/collection/status')) return route.fulfill({ headers, json: { current: null, collectionSummary: null, recent: [] } });
    if (route.request().url().endsWith('/api/display-systems')) return route.fulfill({ headers, json: { displaySystems: { runtimeDefinitions: [] } } });
    if (route.request().url().endsWith('/api/algorithm-market')) return route.fulfill({ headers, json: { packages: [], instances: [] } });
    if (route.request().url().endsWith('/api/commands')) {
      const request = route.request().postDataJSON();
      if (request.type === 'serial.refresh') publish({ port: [{ path: 'COM_BODY_TEST' }] });
      if (request.type === 'serial.open') {
        serialCommands.push(request);
        const status = { role: 'sit', path: 'COM_BODY_TEST', connectionId: ++serialRevision,
          revision: serialRevision, updatedAt: Date.now(), status: 'open', isOpen: true, reconnect: false };
        publish({ currentSensorType: activeSystem, activeSensorType: activeSystem, serialStatus: status });
        return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { serial: [status] } } } });
      }
      const results = request.type === 'license.activate' ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [];
      return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { results } } } });
    }
    return route.fulfill({ headers, json: {} });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__human-body-portal?actual-monitor=1`);
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  for (const [index, system] of ['pressureVest', 'humanBodyOptimized', 'pressureVest'].entries()) {
    activeSystem = system;
    await page.locator(`[data-system="${system}"]`).click();
    await page.locator('.system-scene-particle-root[data-scene="humanBody"][data-model-status="ready"]').waitFor({ timeout: 60000 });
    if (!baseline && index === 0) await page.route('**/model/human3-low.glb', async route => {
      await new Promise(resolve => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.getByRole('button', { name: '进入该系统', exact: true }).click();
    if (!baseline && index === 0) {
      await page.locator('.portal-data-renderer canvas[data-model-state="loading"]').waitFor({ state: 'attached' });
      assert.notEqual(await page.locator('.portal-runtime-monitor').getAttribute('data-handoff'), 'complete', '模型仍在加载时不能交接空画布');
    }
    await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
    if (!baseline && index === 0) await page.unroute('**/model/human3-low.glb');
    await page.locator('[data-human-body-viewport="true"] canvas').first().waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-human-body-viewport="true"]')?.textContent.includes('加载'));
    const state = await inspectViewport(page);
    await page.screenshot({ path: join(artifacts, `${index}-${system}-${baseline ? 'baseline' : 'loaded'}.png`) });
    console.log('HUMAN_BODY_PORTAL_STATE', JSON.stringify({ system, state, errors, responses, artifacts }));
    if (baseline) {
      assert.equal(state.inMonitor, false); assert.equal(state.monitorCanvases, 0); assert.equal(state.viewportCoversPoint, false);
    } else {
      assert.equal(state.inMonitor, true); assert.equal(state.inDataRenderer, true); assert.equal(state.viewportCoversPoint, true);
      assert.ok(state.width > 1000 && state.height > 700);
      const pixels = await readModelPixels(page);
      assert.ok(pixels.different > 100, `${system} 必须绘制真实人体而非纯背景: ${JSON.stringify(pixels)}`);
      const device = page.getByRole('group', { name: '连接设备', exact: true });
      await device.locator('.ant-select-selector').click();
      await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText('COM_BODY_TEST', { exact: true }).click();
      await device.locator('.ant-select-selection-item').filter({ hasText: 'COM_BODY_TEST' }).waitFor();
      const connected = await page.evaluate(() => ({ matrixName: window.bodyPortalHome.state.matrixName,
        mode: window.bodyPortalHome.state.numMatrixFlag, port: window.bodyPortalHome.state.portname }));
      assert.deepEqual(connected, { matrixName: system, mode: 'skin', port: 'COM_BODY_TEST' });
      assert.equal(serialCommands.at(-1).type, 'serial.open');
      assert.deepEqual(serialCommands.at(-1).payload, { role: 'sit', path: 'COM_BODY_TEST' });
      await page.locator('[data-human-body-viewport="true"] canvas[data-model-state="ready"]').waitFor();
      await page.evaluate(() => {
        window.bodyPortalFirstFrame = null;
        const renderer = window.bodyPortalHome.com.current, original = renderer.sitData;
        /** 记录真实渲染器收到的数组后继续执行原方法，不模拟最终渲染结果。 */
        renderer.sitData = function (frame) {
          window.bodyPortalFirstFrame = { length: frame.wsPointData?.length,
            total: frame.wsPointData?.reduce((sum, value) => sum + value, 0) };
          return original.call(this, frame);
        };
      });
      publish({ type: 'sensor.frame', schemaVersion: 1, displaySystemId: system, sensorType: system,
        sensorId: 'sit', channelId: `${system}:sit`, outputChannel: 'sit', source: 'realtime',
        sequence: 1, timestamp: Date.now(), quality: 'good',
        serial: { role: 'sit', path: 'COM_BODY_TEST', baudRate: 1000000, parserChannel: `${system}:sit` },
        payload: { value: Array(1024).fill(1555), matrix: { rows: 32, cols: 32, total: 1024 } } });
      await page.waitForFunction(() => window.bodyPortalFirstFrame?.total === 1024 * 1555);
      assert.equal(await page.evaluate(() => window.bodyPortalFirstFrame.length), 1024);
      await page.waitForFunction(() => Number(document.querySelector('.pressData')?.textContent) > 0);
      const statistics = await page.locator('.dataItem').evaluateAll((items) => items.map((item) => ({
        label: item.querySelector('.dataItemCircle')?.textContent.trim(),
        value: item.querySelector('.dataIteminfo')?.lastElementChild?.textContent.trim(),
      })));
      if (system === 'humanBodyOptimized') {
        assert.equal(await page.locator('.pressData').first().textContent(), String(1024 * 1555));
        assert.equal(Number(statistics.find(item => item.label === '平均压力')?.value), 1555);
        assert.equal(Number(statistics.find(item => item.label === '最大压力')?.value), 1555);
        assert.equal(Number(statistics.find(item => item.label === '压力总和')?.value), 1024 * 1555);
        assert.ok(parseInt(statistics.find(item => item.label === '点数')?.value, 10) > 0);
      }
      await page.waitForTimeout(350);
      const pressured = await readModelPixels(page);
      assert.ok(pressured.different > 100 && pressured.warm > 40,
        `${system} 串口首帧必须改变真实模型热力颜色: ${JSON.stringify(pressured)}`);
      await page.screenshot({ path: join(artifacts, `${index}-${system}-serial-first-frame.png`) });
      console.log('HUMAN_BODY_SERIAL_FRAME_PASS', JSON.stringify({ system, connected, statistics, pixels: pressured }));
      await verifyBodyRegionControls(page, system, index === 0);
      await verifyBodySettings(page, system);
      await chooseMode(page, '原始数据');
      await page.locator('.human-body-raw__atlas').waitFor();
      assert.equal(await page.locator('[data-human-body-viewport="true"]').count(), 0);
      await chooseMode(page, '3D 皮肤');
      await page.locator('[data-human-body-viewport="true"] canvas').first().waitFor();
      await page.waitForFunction(() => !document.querySelector('[data-human-body-viewport="true"]')?.textContent.includes('加载'));
      const returned = await inspectViewport(page);
      assert.equal(returned.inDataRenderer, true); assert.equal(returned.viewportCoversPoint, true);
    }
    assert.deepEqual(errors, []);
    await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
    await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-human-body-viewport="true"]').count(), 0, '退出系统不能留下body孤立画布');
  }
  console.log('HUMAN_BODY_PORTAL_PASS', artifacts);
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('HUMAN_BODY_PORTAL_FAILED', JSON.stringify({ state: await inspectViewport(page).catch(() => null), artifacts }));
  throw error;
} finally { await browser?.close(); await server.close(); }
