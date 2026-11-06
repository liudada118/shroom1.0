import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const output = await mkdtemp(join(tmpdir(), 'shroom-bed-sidebar-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(output, 'vite'), logLevel: 'error', server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [{ name: 'bed-sidebar-fixture',
    /** 页面只挂载真实侧栏，不加载设备连接或数据服务。 */
    configureServer(vite) {
      vite.middlewares.use('/__bed-sidebar', async (_request, response) => {
        response.setHeader('content-type', 'text/html');
        response.end(await vite.transformIndexHtml('/__bed-sidebar', '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module" src="/tests/fixtures/bedSidebar.jsx"></script></body></html>'));
      });
    },
  }],
});
let browser;
const layouts = [];
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/**', route => route.fulfill({ json: { code: 0, data: [] } }));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__bed-sidebar`);
  await page.locator('.aside .asideTitle').first().waitFor();
  for (const system of ['smallBed', 'jqbed']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => window.__bedSidebar.setLanguage('zh'));
    await page.evaluate(value => window.__bedSidebar.setSystem(value), system);
    await page.evaluate(() => window.__bedSidebar.setState({ stateInBbed: null, sosflag: false }));
    await page.waitForFunction(() => document.querySelectorAll('.bedStatusCard').length === 0);
    assert.match(await page.locator('.aside').innerText(), /生命体征/);
    await page.screenshot({ path: join(output, `${system}-no-empty-card.png`) });
    await page.evaluate(() => window.__bedSidebar.setState({ stateInBbed: 1, onBedTime: 65 }));
    const card = page.locator('.bedStatusCard');
    await card.waitFor();
    assert.match(await card.innerText(), /00:01:05/);
    assert.equal(await card.evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
    assert((await card.boundingBox()).height < 200, 'status is content-sized, not a fixed empty panel');
    await page.evaluate(() => window.__bedSidebar.setState({ stateInBbed: 3 }));
    await page.locator('.bedStatusCard--warning').waitFor();
    assert.match(await card.innerText(), /坠床风险/);
    assert.equal(await card.locator('.bedStatusDuration').count(), 0);
    await page.screenshot({ path: join(output, `${system}-warning.png`) });

    for (const viewport of [{ width: 1470, height: 820 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport);
      for (const language of ['zh', 'en', 'ja']) {
        await page.evaluate(value => window.__bedSidebar.setLanguage(value), language);
        await page.evaluate(() => window.__bedSidebar.setState({ stateInBbed: 0, onBedTime: 2, rate: 18, heart_rate: 72.4, sosflag: true }));
        await page.locator('.bedAlertCard').waitFor();
        assert.deepEqual(await page.locator('.bedVitalValue').allTextContents().then(values => values.map(value => value.trim())), ['18', '72']);
        const layout = await page.evaluate(() => {
          const aside = document.querySelector('.aside'), vitals = document.querySelector('.bedVitalsCard');
          const alert = document.querySelector('.bedAlertCard');
          return { vitalsHeight: vitals.getBoundingClientRect().height, alertHeight: alert.getBoundingClientRect().height,
            overflow: aside.scrollWidth > aside.clientWidth,
            alertVisible: alert.getBoundingClientRect().bottom <= aside.getBoundingClientRect().bottom + 1 };
        });
        assert.ok(layout.vitalsHeight < 140, `${system}/${language}: 生命体征仅占读数实际所需高度 ${layout.vitalsHeight}`);
        assert.ok(layout.alertHeight < 120 && !layout.overflow, `${system}/${language}: 告警不继承220px高度且不横向裁剪`);
        if (viewport.height >= 820 || language === 'zh') assert.equal(layout.alertVisible, true, `${system}/${language}: 常见桌面窗口完整显示床状态和告警`);
        await page.locator('.bedAlertCard').scrollIntoViewIfNeeded();
        const alertBounds = await page.locator('.bedAlertCard').evaluate(node => {
          const bounds = node.getBoundingClientRect(), outer = node.closest('.aside').getBoundingClientRect();
          return { top: bounds.top, bottom: bounds.bottom, outerTop: outer.top, outerBottom: outer.bottom };
        });
        assert.ok(alertBounds.top >= alertBounds.outerTop - 2 && alertBounds.bottom <= alertBounds.outerBottom + 2,
          `${system}/${language}/${viewport.height}: 较矮窗口中的告警仍可完整滚动查看 ${JSON.stringify(alertBounds)}`);
        await page.locator('.aside').evaluate(node => { node.scrollTop = 0; });
        layouts.push({ system, language, ...viewport, ...layout });
        if (viewport.width === 1470 && language === 'zh') await page.screenshot({ path: join(output, `${system}-compact-vitals.png`) });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.locator('.aside').evaluate(node => node.scrollWidth <= node.clientWidth));
  assert.deepEqual(errors, []);
  await writeFile(join(output, 'layouts.json'), JSON.stringify(layouts, null, 2));
  console.log(`Bed sidebar browser checks passed; synthetic states only; screenshots: ${output}`);
} finally { await browser?.close(); await server.close(); }
