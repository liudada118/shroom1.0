import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/**
 * 保存过调节值的电脑进入热力贴图类渲染器（触觉手套「3D 皮肤」、robot1、robotSY、robotLCF）：
 * 页面不能报错白屏，保存的颜色、大小、过滤要在渲染器初始化之后生效。
 * 监测页在渲染器挂载的同一刻就回放保存的调节值，这时渲染器还没初始化。真实 Home、Title 和渲染器，设备与后端由测试隔离。
 * `--only=<系统>` 只跑一个。
 */
const CASES = [
  // 手套默认进 3D 遥操，再从显示方式切到 3D 皮肤；保存的值记在这个模式名下。
  { system: 'hand0205', storageKey: 'hand0205__skin', switchTo: '3D 皮肤', mode: 'skin', source: '/src/components/video/hand.jsx' },
  // 机器人系统一进入就是热力贴图渲染器。
  { system: 'robot1', storageKey: 'robot1', source: '/src/components/video/robot copyblue.jsx' },
  { system: 'robotSY', storageKey: 'robotSY', source: '/src/components/video/robotSY.jsx' },
  { system: 'robotLCF', storageKey: 'robotLCF', source: '/src/components/video/robotLCF.jsx' },
];
// 这台电脑上保存过的调节值：颜色上限、热点大小、过滤。
const SAVED = { valuej1: 1234, sizeValue: 57, valuef1: 7 };
const EXPECTED = { max: SAVED.valuej1, size: SAVED.sizeValue, filter: SAVED.valuef1 };

const { createServer } = createRequire(new URL('../../client/package.json', import.meta.url))('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-saved-tuning-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, 'vite-cache'), server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'saved-tuning-before-init-test', enforce: 'pre',
    /** 只额外导出真实 Home 类、读出渲染器当前的热力图参数并记下每次调节，不替换任何生产逻辑。 */
    transform(code, id) {
      const path = decodeURIComponent(id.replaceAll('\\', '/').split('?')[0]);
      if (path.endsWith('/src/page/home/Home.jsx')) return `${code}\nexport { Home as SavedTuningHomeTest };`;
      if (!CASES.some((item) => path.endsWith(item.source))) return null;
      const state = 'const handHeatmapRef = useRef()', entry = 'function changeColor({ max, size, filter, light, speedValue }) {';
      assert.ok(code.includes(state) && code.includes(entry), `渲染器源码与测试钩子对不上: ${path}`);
      return code
        .replace(state, `${state}; window.__savedTuningHeatmap = () => (handHeatmapRef.current ? { max: handHeatmapRef.current.options.max, size: handHeatmapRef.current.options.size, filter: handHeatmapRef.current.options.filter } : null);`)
        .replace(entry, `${entry} (window.__savedTuningCalls ||= []).push({ max, size, filter, ready: Boolean(handHeatmapRef.current) });`);
    },
    /** 真实 Home 挂在门户工具宿主里，走正式的常驻工具栏分支；系统和保存的调节值由地址参数给出。 */
    configureServer(vite) {
      vite.middlewares.use('/__saved-tuning', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__saved-tuning', `<!doctype html><html><head>
          <meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style>
          </head><body><div id="root"></div><script type="module">
          import React from 'react';
          import { createRoot } from 'react-dom/client';
          import { HashRouter } from 'react-router-dom';
          import '@ant-design/v5-patch-for-react-19';
          import i18next from '/src/i18n';
          import '/src/App.css';
          import '/src/page/licensePortal/FiberPortal.css';
          import '/src/page/licensePortal/PortalMonitoring.css';
          import { SavedTuningHomeTest } from '/src/page/home/Home.jsx';
          const query = new URLSearchParams(location.search), saved = ${JSON.stringify(SAVED)};
          localStorage.clear(); localStorage.setItem('file', query.get('system')); localStorage.setItem('language', 'zh');
          localStorage.setItem('allowedTypes', JSON.stringify(${JSON.stringify(CASES.map((item) => item.system))}));
          localStorage.setItem('valueConfig', JSON.stringify({ [query.get('key')]: { ...saved, __explicitTuningFields: Object.keys(saved) } }));
          await i18next.changeLanguage('zh');
          /** 持有稳定的工具宿主，Title 走实际的常驻工具栏分支。 */
          function Fixture() {
            const [host, setHost] = React.useState(null);
            return React.createElement(HashRouter, null, React.createElement('div', { className: 'fiber-portal' },
              React.createElement('div', { className: 'portal-runtime-monitor' }, React.createElement('div', { ref: setHost }),
                host && React.createElement(SavedTuningHomeTest, { ref: (value) => { window.savedTuningHome = value; },
                  t: i18next.t.bind(i18next), i18n: i18next, portalEmbedded: true, portalToolsHost: host }))));
          }
          createRoot(document.getElementById('root')).render(React.createElement(Fixture));
          </script></body></html>`));
      });
    },
  }],
});

let browser, page, errors = [], current = null;
/** 点击真实的显示方式选择器，走正式的 Title 事件，不直接改 Home 的状态。 */
async function chooseDisplay(value) {
  const input = page.getByRole('combobox', { name: '显示方式', exact: true });
  await input.locator('xpath=ancestor::div[contains(@class,"ant-select")]').first().locator('.ant-select-selector').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText(value, { exact: true }).click();
}
/** 等渲染器初始化完；页面报错的话整棵会卸载，这里等不到，由后面的断言给出原因。 */
const ready = () => page.waitForFunction(() => window.__savedTuningHeatmap?.() !== null, null, { timeout: 20000 }).catch(() => {});
/** 当前渲染器热力图的颜色上限、热点大小、过滤。 */
const heatmap = () => page.evaluate(() => window.__savedTuningHeatmap?.() ?? null);

/** 走完一个系统：带着保存的调节值进入，核对不报错、值生效、之后调节照常。 */
async function verify(item) {
  current = item.system; errors = [];
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(30000);
  page.on('pageerror', (error) => { errors.push(error.message); console.error('PAGE_ERROR', item.system, error.message); });
  await page.routeWebSocket(/:19999/, (socket) => {
    socket.send(JSON.stringify({ selectFlag: 'all', licenseKey: 'fixture-key', date: Date.now() + 86400000 * 30, nowDate: Date.now() }));
  });
  await page.route('http://127.0.0.1:19245/**', (route) => route.fulfill({
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' },
    json: route.request().url().endsWith('/api/algorithm-market')
      ? { packages: [], instances: [], channels: [], configuredAlgorithms: [], allowed: true, reason: '' }
      : { code: 0, data: { ok: true, data: {} }, displaySystems: { runtimeDefinitions: [] } },
  }));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__saved-tuning?system=${item.system}&key=${item.storageKey}`);
  await page.waitForFunction(() => window.savedTuningHome?.state, null, { timeout: 30000 }).catch(() => {});
  if (item.switchTo) {
    assert.deepEqual(errors, [], `${item.system}: 进入默认显示方式不报错`);
    await chooseDisplay(item.switchTo);
    await page.waitForFunction((mode) => window.savedTuningHome?.state.numMatrixFlag === mode, item.mode, { timeout: 15000 }).catch(() => {});
  }
  await ready();
  await page.screenshot({ path: join(artifacts, `${item.system}-entered.png`) });
  assert.deepEqual(errors, [], `${item.system}: 带着保存的调节值进入不能报错`);
  assert.equal(await page.evaluate(() => Boolean(window.savedTuningHome?.com.current)), true, `${item.system}: 监测页和渲染器仍然挂着`);
  // 确认这次确实走到了出问题的时序：监测页的第一次回放早于渲染器初始化，带的是保存的值。
  const calls = await page.evaluate(() => window.__savedTuningCalls || []);
  assert.deepEqual(calls[0], { ...EXPECTED, ready: false }, `${item.system}: 监测页在渲染器初始化之前回放保存的调节值`);
  assert.deepEqual(await heatmap(), EXPECTED, `${item.system}: 保存过的颜色、大小、过滤在渲染器初始化后生效`);

  // 初始化之后再调节，照常直接生效。
  await page.evaluate(() => window.savedTuningHome.com.current.changeColor({ max: 2222, size: 33, filter: 9 }));
  assert.deepEqual(await heatmap(), { max: 2222, size: 33, filter: 9 }, `${item.system}: 初始化之后的调节直接生效`);

  if (item.switchTo) {
    // 切走再切回来：新的渲染器实例同样拿到保存的值，不带上一个实例里临时调过的值。
    await chooseDisplay('3D 遥操');
    await page.waitForFunction(() => window.savedTuningHome?.state.numMatrixFlag === 'normal');
    await chooseDisplay(item.switchTo);
    await page.waitForFunction((max) => window.savedTuningHome?.state.numMatrixFlag === 'skin' && window.__savedTuningHeatmap?.()?.max === max, EXPECTED.max);
    assert.deepEqual(await heatmap(), EXPECTED, `${item.system}: 切走再切回来仍然是保存的值`);
    assert.deepEqual(errors, [], `${item.system}: 来回切换不报错`);
  }
  console.log('SAVED_TUNING_CASE_PASS', item.system, JSON.stringify({ calls: calls.length, applied: EXPECTED }));
  await page.close();
}

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const only = process.argv.find((value) => value.startsWith('--only='))?.slice(7);
  const cases = CASES.filter((item) => !only || item.system === only);
  assert.ok(cases.length > 0, `没有名为 ${only} 的系统`);
  for (const item of cases) await verify(item);
  console.log('SAVED_TUNING_BEFORE_INIT_PASS', JSON.stringify({ artifacts, systems: cases.map((item) => item.system) }));
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('SAVED_TUNING_BEFORE_INIT_FAILED', JSON.stringify({ artifacts, system: current, errors })); throw error;
} finally { await browser?.close(); await server.close(); }
