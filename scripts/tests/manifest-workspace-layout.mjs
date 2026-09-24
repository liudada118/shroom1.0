import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const clientRoot = fileURLToPath(new URL('../../client/', import.meta.url));
const clientRequire = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = clientRequire('vite');
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
    await page.getByText('渲染设置', { exact: true }).click();
    await page.getByRole('combobox', { name: '选择渲染器' }).press('ArrowDown');
    await page.locator('.ant-select-item-option-content').getByText('2D 数字', { exact: true }).click();
    await page.locator('.manifest-matrix-widget').waitFor();
    await page.getByRole('combobox', { name: '选择渲染器' }).press('ArrowDown');
    await page.locator('.ant-select-item-option-content').getByText('3D 点图', { exact: true }).click();
    await canvas.waitFor();
    assert.equal(await input.inputValue(), '仍然保留', '换渲染器不能丢失图表状态');
    assert.deepEqual(errors, []);
    console.log(`workspace layout passed: DPR ${deviceScaleFactor}, cold empty -> single valid frame without remount, invalid frames, 5 viewport sizes, native pointGrid, collapse/restore, mode switches`);
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
  await portalPage.getByText('渲染设置', { exact: true }).click();
  assert.equal(await portalPage.getByRole('combobox', { name: '选择渲染器' }).isVisible(), true);
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
