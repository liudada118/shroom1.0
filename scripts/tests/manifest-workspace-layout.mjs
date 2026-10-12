import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const clientRoot = fileURLToPath(new URL('../../client/', import.meta.url));
const clientRequire = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = clientRequire('vite');

/** 观察原生数字矩阵的真实 GPU 数值、平面位置与绘制像素。 */
function installNumericProbe() {
  window.numericProbe = { uv: [], positions: [], pixel: [], captureColor: false };
  for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Context) continue;
    for (const name of ['bufferData', 'bufferSubData']) {
      const upload = Context.prototype[name];
      Context.prototype[name] = function (...args) {
        const values = args[name === 'bufferData' ? 1 : 2];
        if (values instanceof Float32Array && this.canvas.closest('[data-renderer-id="numMatrix"]')) {
          if (values.length === 1024 * 2) window.numericProbe.uv = Array.from(values);
          if (values.length === 1024 * 16) window.numericProbe.positions = Array.from(values);
        }
        return upload.apply(this, args);
      };
    }
    for (const name of ['drawElements', 'drawElementsInstanced']) {
      const draw = Context.prototype[name];
      if (!draw) continue;
      Context.prototype[name] = function (...args) {
        const result = draw.apply(this, args);
        if (window.numericProbe.captureColor && this.canvas.closest('[data-renderer-id="numMatrix"]')) {
          const pixel = new Uint8Array(4);
          this.readPixels(2, 2, 1, 1, this.RGBA, this.UNSIGNED_BYTE, pixel);
          window.numericProbe.pixel = Array.from(pixel);
        }
        return result;
      };
    }
  }
}

/** 检查合法零帧显示原生蓝色网格，且数字视图只有一个平面画布。 */
async function assertBlueNumericMatrix(page, length) {
  await page.evaluate((count) => {
    window.numericProbe.captureColor = true;
    window.pushWorkspaceFrame(new Array(count).fill(0));
  }, length);
  await page.waitForFunction(() => {
    const { uv, pixel } = window.numericProbe;
    return uv.length === 1024 * 2 && uv.every((value) => value === 0)
      && pixel[2] > 80 && pixel[0] < 50 && pixel[1] < 50 && pixel[3] === 255;
  });
  await page.evaluate(() => { window.numericProbe.captureColor = false; });
  assert.equal(await page.locator('[data-renderer-id="numMatrix"] canvas').count(), 1);
  assert.equal(await page.locator('[data-renderer-id="numMatrix"] .threeBoxF').count(), 0);
}

const server = await createServer({
  root: clientRoot,
  server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [{
    name: 'workspace-test-page',
    /** 仅为布局回归提供隔离入口，不加载主应用或打开设备连接。 */
    configureServer(vite) {
      vite.middlewares.use('/__workspace-test', async (req, res) => {
        const fixture = req.url.includes('retry') ? 'agentSurfaceRetry' : 'manifestWorkspace';
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml('/__workspace-test', '<html><head><style>html,body,#root{margin:0;width:100%;height:100%;position:relative}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/' + fixture + '.jsx"></script></body></html>'));
      });
    },
  }],
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: process.env.SHROOM_TEST_BROWSER || 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  for (const deviceScaleFactor of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor });
    await context.addInitScript(installNumericProbe);
    await context.addInitScript(() => {
      // 观察真实 GPU 上传；DOM 中存在 canvas 并不能证明点阵已画出。
      window.pointGridProbe = { invalid: 0, maxHeight: 0, pointDraws: 0 };
      for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!Context) continue;
        const upload = Context.prototype.bufferData;
        Context.prototype.bufferData = function (...args) {
          const values = args[1];
          if (values instanceof Float32Array && values.length === 1024 * 3) {
            for (let i = 0; i < values.length; i += 1) {
              if (!Number.isFinite(values[i])) window.pointGridProbe.invalid += 1;
              if (i % 3 === 1 && Number.isFinite(values[i])) {
                window.pointGridProbe.maxHeight = Math.max(window.pointGridProbe.maxHeight, values[i]);
              }
            }
          }
          return upload.apply(this, args);
        };
        const draw = Context.prototype.drawArrays;
        Context.prototype.drawArrays = function (...args) {
          if (args[0] === this.POINTS) window.pointGridProbe.pointDraws += 1;
          return draw.apply(this, args);
        };
      }
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.route('http://127.0.0.1:19245/**', (route) => route.fulfill({
      json: { code: 0, data: { apps: [] } }, headers: { 'Access-Control-Allow-Origin': '*' },
    }));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__workspace-test`);
    const canvas = page.locator('[data-renderer-id="pointGrid"] canvas');
    await canvas.waitFor({ timeout: 30000 });
    const originalCanvas = await canvas.elementHandle();
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => window.pointGridProbe.invalid), 0, '冷启动空帧不能污染 GPU 顶点');
    await page.evaluate(() => window.pushWorkspaceFrame(Array.from({ length: 1024 }, (_, i) => i > 400 && i < 500 ? 30 : 0)));
    await page.waitForFunction(() => window.pointGridProbe.maxHeight > 5 && window.pointGridProbe.pointDraws > 2);
    assert.equal(await canvas.evaluate((node, original) => node === original, originalCanvas), true, '首帧必须原地显示，不能靠重新挂载');
    for (const length of [0, 10, 1028]) {
      await page.evaluate((count) => window.pushWorkspaceFrame(new Array(count).fill(30)), length);
      await page.waitForTimeout(100);
    }
    await page.evaluate(() => window.pushWorkspaceFrame(new Array(1024).fill(0)));
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.pointGridProbe.invalid), 0, '短帧/超长帧后合法零帧仍应正常');
    await page.evaluate(() => window.pushWorkspaceFrame(Array.from({ length: 1024 }, (_, i) => i > 400 && i < 500 ? 30 : 0)));
    for (const [width, height] of [[1440, 900], [900, 600], [1920, 1080], [1280, 720], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(250);
      const size = await canvas.evaluate((node) => ({
        cssWidth: node.getBoundingClientRect().width,
        cssHeight: node.getBoundingClientRect().height,
        width: node.width, height: node.height,
        bottom: node.getBoundingClientRect().bottom,
        overflow: document.querySelector('.manifest-display').scrollHeight - document.querySelector('.manifest-display').clientHeight,
      }));
      assert.ok(Math.abs(size.cssWidth - width) < 2, JSON.stringify(size));
      assert.ok(Math.abs(size.cssHeight - (height - 60)) < 2, JSON.stringify(size));
      assert.ok(size.bottom <= height + 1 && size.overflow <= 1, JSON.stringify(size));
      assert.ok(Math.abs(size.height - size.cssHeight * deviceScaleFactor) < 3, JSON.stringify(size));
    }
    const before = await canvas.getAttribute('height');
    await page.waitForTimeout(2000);
    assert.equal(await canvas.getAttribute('height'), before, '持续渲染期间高度不应增长');
    const input = page.getByRole('textbox', { name: '图表状态保留测试' });
    await input.fill('仍然保留');
    await page.getByRole('button', { name: '收起图表' }).click();
    assert.equal(await input.isVisible(), false);
    await page.getByRole('button', { name: '展开图表' }).press('Enter');
    assert.equal(await input.inputValue(), '仍然保留');
    assert.equal(await input.isVisible(), true);
    if (deviceScaleFactor === 1 && process.env.SHROOM_TEST_SCREENSHOT) {
      await page.screenshot({ path: process.env.SHROOM_TEST_SCREENSHOT });
    }
    assert.equal(await canvas.evaluate((node) => {
      const r = node.getBoundingClientRect();
      return document.elementFromPoint(r.right - 150, r.top + 150) === node;
    }), true, '图表浮层外不能拦截画布交互');
    await page.getByLabel('布局', { exact: true }).selectOption('standard');
    await page.waitForTimeout(250);
    assert.equal(await page.getByRole('button', { name: '收起图表' }).count(), 1);
    assert.equal(await canvas.getAttribute('height'), before, '旧 standard 同样铺满工作区');
    await page.getByLabel('布局', { exact: true }).selectOption('workspace');
    await page.waitForTimeout(250);
    assert.equal(await canvas.getAttribute('height'), before);
    assert.equal(await page.locator('.manifest-renderer-picker').count(), 0, '画布不再保留第二套设置浮层');
    await page.getByRole('button', { name: '工具区', exact: true }).click();
    await page.getByRole('tab', { name: '显示与语言' }).click();
    const picker = page.getByRole('combobox', { name: '选择渲染器' });
    await picker.waitFor();
    assert.deepEqual(await picker.locator('option').evaluateAll((nodes) => nodes.map((node) => node.value)),
      ['pointGrid', 'numMatrix', 'webglHeatmap', 'blobHeatmap']);
    assert.equal(await picker.getByRole('option', { name: '2D 数字', exact: true }).count(), 1);
    assert.equal(await picker.getByRole('option', { name: '3D 数字', exact: true }).count(), 0);
    await picker.selectOption('numMatrix');
    await page.locator('[data-renderer-id="numMatrix"] canvas').waitFor();
    await page.evaluate(() => {
      window.numericProbe.uv = [];
      window.pushWorkspaceFrame(Array.from({ length: 1024 }, (_, index) => index % 251));
    });
    await page.waitForFunction(() => window.numericProbe.uv.length === 1024 * 2
      && window.numericProbe.uv.every((value, index, uv) => index % 2 !== 0
        || Math.round(value * 16) + Math.round(uv[index + 1] * 16) * 16 === (index / 2) % 251));
    const numbers = await page.evaluate(() => window.numericProbe.uv.filter((_, index) => index % 2 === 0)
      .map((value, index) => Math.round(value * 16) + Math.round(window.numericProbe.uv[index * 2 + 1] * 16) * 16));
    assert.deepEqual(numbers, Array.from({ length: 1024 }, (_, index) => index % 251),
      '2D 数字必须逐点显示当前帧，不能模糊、转置或重排线序');
    const positions = await page.evaluate(() => window.numericProbe.positions);
    assert.equal(positions.length, 1024 * 16);
    assert.equal(positions[13], positions[31 * 16 + 13], '首行的 32 格保持同一纵坐标');
    assert.equal(positions[12], positions[32 * 16 + 12], '下一行从同一横坐标开始');
    assert.ok(positions.filter((_, index) => index % 16 === 14).every((z) => z === 0), '数字格始终在同一个平面');
    await assertBlueNumericMatrix(page, 1024);
    if (deviceScaleFactor === 1 && process.env.SHROOM_TEST_NUMERIC_SCREENSHOT) {
      await page.locator('[data-renderer-id="numMatrix"] canvas').screenshot({ path: process.env.SHROOM_TEST_NUMERIC_SCREENSHOT });
    }
    await picker.selectOption('webglHeatmap');
    await page.locator('[data-renderer-id="webglHeatmap"] canvas').first().waitFor();
    await page.evaluate(() => window.pushWorkspaceFrame(new Array(1024).fill(200)));
    await page.waitForFunction(() => {
      const heatmap = document.querySelector('[data-renderer-id="webglHeatmap"] canvas');
      const pixels = heatmap?.getContext('2d')?.getImageData(0, 0, heatmap.width, heatmap.height).data;
      return pixels && pixels.some((value, index) => index % 4 === 0 && value > 80);
    }, null, { timeout: 5000 });
    const heatSidebar = await page.evaluate(() => window.workspaceSidebarData);
    await picker.selectOption('pointGrid');
    await canvas.waitFor();
    assert.equal(await input.inputValue(), '仍然保留', '换渲染器不能丢失图表状态');
    assert.deepEqual(await page.evaluate(() => window.workspaceSidebarData), heatSidebar,
      '热力图切回点图后，同一帧的统计保持不变');
    await page.getByRole('button', { name: '收起实用工具' }).click();
    assert.deepEqual(errors, []);
    console.log(`workspace layout passed: DPR ${deviceScaleFactor}, cold empty -> single valid frame without remount, invalid frames, 5 viewport sizes, native pointGrid, collapse/restore, mode switches`);
    await context.close();
  }
  const viewContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await viewContext.addInitScript(installNumericProbe);
  const viewPage = await viewContext.newPage();
  const viewErrors = [];
  viewPage.on('pageerror', (error) => viewErrors.push(error.message));
  await viewPage.route('http://127.0.0.1:19245/**', (route) => route.fulfill({ json: { code: 0, data: { apps: [] } } }));
  await viewPage.goto(`http://127.0.0.1:${server.httpServer.address().port}/__workspace-test?portal&multi&legacy2dStyle`);
  const views = viewPage.getByRole('navigation', { name: '视图切换' });
  await views.waitFor();
  assert.deepEqual(await views.getByRole('button').allTextContents(), ['3D 点图', '热力图', '2D 数字']);
  for (const [width, height] of [[1440, 900], [900, 600], [768, 600], [375, 740]]) {
    await viewPage.setViewportSize({ width, height });
    const hitTargets = await views.getByRole('button').evaluateAll((buttons) => buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.left >= 0 && rect.right <= window.innerWidth
        && button.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
    }));
    assert.deepEqual(hitTargets, [true, true, true], `视图条不能被图表、工具或画布遮挡：${width}×${height}`);
  }
  await viewPage.setViewportSize({ width: 1440, height: 900 });
  const viewChartInput = viewPage.getByRole('textbox', { name: '图表状态保留测试' });
  await viewChartInput.fill('视图切换保留图表');
  await views.getByRole('button', { name: '热力图', exact: true }).click();
  await viewPage.evaluate(() => window.pushWorkspaceFrame(new Array(1024).fill(200)));
  await viewPage.waitForFunction(() => {
    const canvas = document.querySelector('[data-renderer-id="webglHeatmap"] canvas');
    const pixels = canvas?.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels && pixels.some((value, index) => index % 4 === 0 && value > 80);
  });
  const viewStats = await viewPage.evaluate(() => window.workspaceSidebarData);
  await views.getByRole('button', { name: '2D 数字', exact: true }).press('Enter');
  await viewPage.locator('[data-renderer-id="numMatrix"] canvas').waitFor();
  assert.equal(await views.getByRole('button', { name: '2D 数字', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await viewPage.locator('.manifest-widget-slot').count(), 1, '三种模式共用一个 main 画布');
  assert.deepEqual(await viewPage.evaluate(() => window.workspaceSidebarData), viewStats, '切换保持同一帧与统计');
  assert.equal(await viewChartInput.inputValue(), '视图切换保留图表');
  await assertBlueNumericMatrix(viewPage, 1024);
  await viewPage.getByRole('button', { name: '工具区', exact: true }).click();
  await viewPage.getByRole('tab', { name: '显示与语言' }).click();
  const viewPicker = viewPage.getByRole('combobox', { name: '选择渲染器' });
  assert.equal(await viewPicker.inputValue(), 'numMatrix', '旧重复数字别名在常驻入口和工具区统一为原生数字');
  await viewPicker.selectOption('pointGrid');
  await viewPage.locator('[data-renderer-id="pointGrid"] canvas').waitFor();
  assert.equal(await views.getByRole('button', { name: '3D 点图', exact: true }).getAttribute('aria-pressed'), 'true');
  await viewPage.getByRole('button', { name: '收起实用工具' }).click();
  await views.getByRole('button', { name: '2D 数字', exact: true }).click();
  await viewPage.evaluate(() => {
    const key = Object.keys(localStorage).find((item) => item.includes('layout-fixture') && item.includes('display-profile'));
    if (!key) throw new Error('未找到已保存视图选择');
    const selection = JSON.parse(localStorage.getItem(key));
    localStorage.setItem(key, JSON.stringify({ ...selection, rendererId: 'numMatrix2d' }));
  });
  await viewPage.reload();
  await viewPage.waitForFunction(() => document.querySelector('.manifest-view-switcher button[aria-pressed="true"]')?.textContent === '2D 数字');
  await viewPage.locator('[data-renderer-id="numMatrix"] canvas').waitFor();
  assert.deepEqual(viewErrors, []);
  if (process.env.SHROOM_TEST_VIEW_SCREENSHOT) await views.screenshot({ path: process.env.SHROOM_TEST_VIEW_SCREENSHOT });
  await viewContext.close();
  console.log('Visible view switcher passed: three modes, responsive hit targets, keyboard, shared chart/data, toolbox sync and reload');
  for (const side of [32, 23, 3]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('http://127.0.0.1:19245/**', (route) => route.fulfill({ json: { code: 0, data: { apps: [] } } }));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__workspace-test?renderer=webglHeatmap&side=${side}`);
    await page.getByRole('status').filter({ hasText: '等待传感器数据' }).waitFor();
    await page.evaluate((length) => window.pushWorkspaceFrame(new Array(length).fill(200)), side * side);
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[data-renderer-id="webglHeatmap"] canvas');
      const pixels = canvas?.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
      return pixels && pixels.some((value, index) => index % 4 === 0 && value > 80);
    }, null, { timeout: 5000 });
    assert.equal(await page.getByRole('status').count(), 0, '单帧成功出图后隐藏等待提示');
    await page.evaluate((length) => window.pushWorkspaceFrame(new Array(length).fill(0)), side * side);
    await page.waitForFunction(() => {
      const canvas = document.querySelector('[data-renderer-id="webglHeatmap"] canvas');
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return !pixels.some((value, index) => index % 4 === 0 && value > 80);
    }, null, { timeout: 5000 });
    assert.deepEqual(errors, []);
    console.log(`heatmap pixels passed: ${side}x${side}, waiting -> single pressure frame -> zero frame`);
    await context.close();
  }
  const portalContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const portalPage = await portalContext.newPage();
  await portalPage.route('http://127.0.0.1:19245/**', (route) => route.fulfill({ json: { code: 0, data: { apps: [] } } }));
  await portalPage.goto(`http://127.0.0.1:${server.httpServer.address().port}/__workspace-test?portal`);
  await portalPage.locator('.manifest-display').waitFor();
  const panels = await portalPage.evaluate(() => ['.portal-observatory', '.portal-quick-tools'].map((selector) => {
    const node = document.querySelector(selector);
    const rect = node.getBoundingClientRect();
    return { visible: rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility === 'visible',
      front: node.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)) };
  }));
  assert.deepEqual(panels, [{ visible: true, front: true }, { visible: true, front: true }], '矩阵画布不能盖住图表和工具区');
  await portalPage.getByRole('button', { name: '工具区', exact: true }).click();
  await portalPage.getByRole('tab', { name: '显示与语言' }).click();
  await portalPage.getByRole('combobox', { name: '选择渲染器' }).waitFor();
  assert.equal(await portalPage.getByRole('combobox', { name: '选择渲染器' }).isVisible(), true);
  for (const legacy of ['heatmap', 'matrix']) {
    await portalPage.goto(`http://127.0.0.1:${server.httpServer.address().port}/__workspace-test?portal&legacy=${legacy}`);
    const nativeCanvas = portalPage.locator('[data-renderer-id="pointGrid"] canvas');
    await nativeCanvas.waitFor();
    await portalPage.evaluate(() => window.pushWorkspaceFrame(Array.from({ length: 529 }, (_, index) => index + 1)));
    await portalPage.waitForFunction(() => window.workspaceSidebarData?.values?.length === 529);
    assert.equal(await portalPage.locator('.manifest-matrix-widget').count(), 0, '旧二维系统自动显示原生点图');
    assert.equal(await portalPage.locator('.manifest-renderer-picker').count(), 0);
    const bounds = await nativeCanvas.evaluate((node) => {
      const canvas = node.getBoundingClientRect();
      const surface = document.querySelector('.manifest-display').getBoundingClientRect();
      return { canvasHeight: canvas.height, surfaceHeight: surface.height, bottom: canvas.bottom };
    });
    assert.ok(Math.abs(bounds.canvasHeight - bounds.surfaceHeight) < 2 && bounds.bottom <= 901, JSON.stringify(bounds));
  }
  await portalContext.close();
  console.log('Manifest portal shell passed: charts, tools and renderer picker remain accessible above matrix canvas');
  const context = await browser.newContext();
  let breathLoads = 0;
  await context.route('http://127.0.0.1:19245/**', async (route) => {
    const isBreath = route.request().url().endsWith('/breath.html');
    const fail = isBreath && ++breathLoads === 1;
    await route.fulfill({ contentType: 'text/html', body: `<html><body><output></output><script>
      const send = (type,payload={}) => parent.postMessage({type:'shroom.renderer.'+type,schemaVersion:1,payload},'*');
      addEventListener('message', event => {
        if(event.source !== parent) return;
        const m=event.data;
        if(m.type==='shroom.renderer.init') send(${fail ? "'error', {message:'模拟旧模块校验失败'}" : "'ready'"});
        if(m.type==='shroom.renderer.frame') document.querySelector('output').textContent=JSON.stringify(m.payload.algorithmMetrics);
      });
      send('ready');
    </script></body></html>` });
  });
  const retryPage = await context.newPage();
  await retryPage.goto(`http://127.0.0.1:${server.httpServer.address().port}/__workspace-test?retry`);
  const breath = retryPage.locator('[data-test-surface="breath"]');
  const cop = retryPage.locator('[data-test-surface="cop"]');
  await breath.getByRole('button', { name: '重新加载模块' }).waitFor();
  await cop.frameLocator('iframe').getByText('"copX":4', { exact: false }).waitFor();
  await breath.getByRole('button', { name: '重新加载模块' }).click();
  await breath.frameLocator('iframe').getByText('"respirationSignal":-0.3', { exact: false }).waitFor();
  assert.equal(await breath.getByRole('alert').count(), 0);
  assert.equal(await cop.getByRole('alert').count(), 0);
  assert.equal(breathLoads, 2, '只重载故障图表，不重载其他模块');
  await context.close();
  console.log('Agent chart retry passed: handshake, latest metrics, independent CoP, rawValues 1028 vs matrix 1024');
} finally {
  await browser?.close();
  await server.close();
}
