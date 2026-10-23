import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-human-body-entry-'));
const baseline = process.argv.includes('--baseline');
const server = await createServer({
  root: fileURLToPath(new URL('../../client/', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{
    name: 'human-body-entry-test', enforce: 'pre',
    /** 只额外导出真实Home类，保留原构造器、生命周期及渲染分派。 */
    transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/page/home/Home.jsx')) return `${code}\nexport { Home as BodyEntryHomeTest };`;
    },
    /** 测试页直接挂载正式Home及工具栏，不依赖真实授权或设备服务。 */
    configureServer(vite) {
      vite.middlewares.use('/__human-body-entry', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__human-body-entry', `<!doctype html><html><head>
          <meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style>
          </head><body><div id="root"></div><script type="module">
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import { HashRouter } from 'react-router-dom';
          import '@ant-design/v5-patch-for-react-19';
          import i18next from '/src/i18n';
          import '/src/App.css';
          import '/src/page/licensePortal/FiberPortal.css';
          import '/src/page/licensePortal/PortalLauncher.css';
          import '/src/page/licensePortal/PortalMonitoring.css';
          import { BodyEntryHomeTest } from '/src/page/home/Home.jsx';
          await i18next.changeLanguage('zh');
          /** 使用真实Portal工具宿主并记录首次挂载模式。 */
          function Fixture() {
            const [host,setHost]=React.useState(null);
            return React.createElement(HashRouter,null,React.createElement('div',{className:'fiber-portal'},
              React.createElement('div',{className:'portal-runtime-monitor'},React.createElement('div',{className:'portal-monitor-content'},React.createElement('div',{ref:setHost}),
                host&&React.createElement(BodyEntryHomeTest,{ref:(value)=>{window.bodyHome=value;
                  if(value && window.initialBodyMode===undefined) window.initialBodyMode=value.state.numMatrixFlag;},
                  t:i18next.t.bind(i18next),i18n:i18next,portalEmbedded:true,portalToolsHost:host})))));
          }
          const root=createRoot(document.getElementById('root'));
          window.unmountBodyEntry=()=>root.unmount();
          root.render(React.createElement(Fixture));
          </script></body></html>`));
      });
    },
  }],
});

/** 通过正式选择器切换人体显示形式。 */
async function chooseMode(page, label) {
  const input = page.getByRole('combobox', { name: '显示方式', exact: true });
  await input.locator('xpath=ancestor::div[contains(@class,"ant-select")]').first().locator('.ant-select-selector').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText(label, { exact: true }).click();
}

/** 从实际画布截图统计亮度差异，确认模型已经绘制而非仅挂载空canvas。 */
async function visiblePixels(page) {
  const image = await page.locator('[data-human-body-viewport="true"] canvas').first().screenshot();
  return page.evaluate(async (base64) => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let bright = 0, dark = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      const maximum = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
      if (maximum > 70) bright++; else if (maximum < 40) dark++;
    }
    return { bright, dark };
  }, image.toString('base64'));
}

/** 等待实际人体画布加载完成并留下可见像素证据。 */
async function waitBody(page, system, suffix) {
  await page.locator('[data-human-body-viewport="true"] canvas').first().waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-human-body-viewport="true"]')?.textContent.includes('加载'));
  await page.waitForTimeout(350);
  const pixels = await visiblePixels(page);
  assert.ok(pixels.bright > 100 && pixels.dark > 100, `${system} 人体模型应实际可见: ${JSON.stringify(pixels)}`);
  await page.screenshot({ path: join(artifacts, `${system}-${suffix}.png`) });
  return pixels;
}

let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const system of ['pressureVest', 'humanBodyOptimized']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], models = [];
    page.setDefaultTimeout(30000);
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (/\/model\/.+\.(glb|gltf|fbx)(?:\?|$)/.test(request.url())) models.push(new URL(request.url()).pathname); });
    await page.addInitScript((system) => {
      localStorage.clear(); localStorage.setItem('file', system); localStorage.setItem('language', 'zh');
      localStorage.setItem('allowedTypes', JSON.stringify(['pressureVest', 'humanBodyOptimized']));
    }, system);
    await page.routeWebSocket(/:19999/, (socket) => {
      socket.send(JSON.stringify({ selectFlag: 'all', licenseKey: 'fixture-key', date: Date.now() + 30 * 86400000, nowDate: Date.now() }));
    });
    await page.route('http://127.0.0.1:19245/**', (route) => {
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      if (route.request().url().endsWith('/api/display-systems')) return route.fulfill({ status: 503, headers, json: { error: 'fixture catalog unavailable' } });
      return route.fulfill({ headers, json: route.request().url().endsWith('/api/algorithm-market')
        ? { packages: [], instances: [], channels: [], configuredAlgorithms: [], allowed: true, reason: '' }
        : { code: 0, data: { ok: true, data: {} }, displaySystems: { runtimeDefinitions: [] } } });
    });
    try {
      await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__human-body-entry`);
      await page.waitForFunction(() => Boolean(window.bodyHome?.com.current));
      const initialMode = await page.evaluate(() => window.initialBodyMode);
      if (baseline) {
        await page.waitForFunction(() => Boolean(document.querySelector('canvas')));
        await page.waitForTimeout(700);
        await page.screenshot({ path: join(artifacts, `${system}-baseline.png`) });
        assert.equal(initialMode, 'normal');
        assert.ok(models.includes('/model/chair3.glb'), `${system} baseline must reproduce seat loading`);
        console.log('HUMAN_BODY_ENTRY_BASELINE', JSON.stringify({ system, initialMode, models, artifacts }));
        continue;
      }
      assert.equal(initialMode, 'skin', '人体首次渲染应选择自己的模型模式，不等待接口或WS修正');
      const pixels = await waitBody(page, system, 'initial');
      assert.ok(models.includes('/model/human3-low.glb'));
      assert.ok(!models.includes('/model/chair3.glb'), '首次挂载也不应请求汽车座椅');
      await chooseMode(page, '原始数据');
      await page.locator('.human-body-raw__atlas').waitFor();
      await chooseMode(page, '3D 皮肤');
      await waitBody(page, system, 'model-return');
      await page.evaluate(() => new Promise(resolve => window.bodyHome.setState({ numMatrixFlag: 'normal' }, resolve)));
      await waitBody(page, system, 'stale-mode');
      assert.ok(!models.includes('/model/chair3.glb'), '旧normal模式也不能落回汽车座椅');
      await page.reload();
      await page.waitForFunction(() => window.bodyHome?.com.current);
      assert.equal(await page.evaluate(() => window.initialBodyMode), 'skin');
      await waitBody(page, system, 'reload');
      assert.ok(!models.includes('/model/chair3.glb'));
      assert.deepEqual(errors, []);
      console.log('HUMAN_BODY_ENTRY_PASS', JSON.stringify({ system, pixels, models, artifacts }));
    } catch (error) {
      await page.screenshot({ path: join(artifacts, `${system}-failure.png`) }).catch(() => {});
      const state = await page.evaluate(() => ({ system: window.bodyHome?.state?.matrixName,
        mode: window.bodyHome?.state?.numMatrixFlag, initial: window.initialBodyMode })).catch(() => null);
      console.error('HUMAN_BODY_ENTRY_STATE', JSON.stringify({ state, errors, models, artifacts }));
      throw error;
    } finally {
      await page.evaluate(() => window.unmountBodyEntry?.()).catch(() => {});
      await page.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
