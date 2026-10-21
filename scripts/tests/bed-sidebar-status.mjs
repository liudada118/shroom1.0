import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
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
    await page.evaluate(value => window.__bedSidebar.setSystem(value), system);
    await page.evaluate(() => window.__bedSidebar.setState({ stateInBbed: null }));
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
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.locator('.aside').evaluate(node => node.scrollWidth <= node.clientWidth));
  assert.deepEqual(errors, []);
  console.log(`Bed sidebar browser checks passed; synthetic states only; screenshots: ${output}`);
} finally { await browser?.close(); await server.close(); }
