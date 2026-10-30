import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import translations from '../../client/src/i18n/monitorAuditTranslations.js';

const { createServer } = createRequire(new URL('../../client/package.json', import.meta.url))('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-point-tuning-'));
const errors = [], sockets = new Set();
const copy = translations.monitorUi;
let browser, page, activeSystem = 'smallBedNoAlg', sequence = 0, language = 'zh';
const license = { date: Date.now() + 30 * 86400000, nowDate: Date.now(), valid: true, selectFlag: 'all' };
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, 'vite-cache'), server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'point-tuning-browser', enforce: 'pre',
    /** 只读真实点图上传的几何和颜色，不替代渲染计算或参数入口。 */
    transform(source, id) {
      if (!id.replaceAll('\\', '/').split('?')[0].endsWith('/components/three/smallBed.jsx')) return null;
      const hook = 'particles = new THREE.Points(sitGeometry, material);';
      assert.ok(source.includes(hook));
      return source.replace(hook, `${hook}
        window.__readPointTuning = () => {
          const positions = particles.geometry.attributes.position.array;
          const colors = particles.geometry.attributes.color.array;
          const heights = Array.from(positions).filter((_, i) => i % 3 === 1);
          return { color: valuej1, maxHeight: Math.max(...heights), firstHeight: heights[0], lastHeight: heights.at(-1),
            finite: heights.every(Number.isFinite), colorHead: Array.from(colors.slice(0, 30)),
            pointCount: heights.length, children: particles.children.filter(child => child.isPoints).map(child => {
              const p = child.geometry.attributes.position?.array;
              let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, outerMax = 0;
              if (p) for (let index = 0; index < p.length; index += 3) {
                minX = Math.min(minX, p[index]); maxX = Math.max(maxX, p[index]);
                minZ = Math.min(minZ, p[index + 2]); maxZ = Math.max(maxZ, p[index + 2]);
              }
              if (p) for (let index = 0; index < p.length; index += 3) {
                if (p[index] === minX || p[index] === maxX || p[index + 2] === minZ || p[index + 2] === maxZ)
                  outerMax = Math.max(outerMax, Math.abs(p[index + 1]));
              }
              return { visible: child.visible, count: p?.length / 3, finite: p ? Array.from(p).every(Number.isFinite) : false, outerMax };
            }), camera: camera.position.toArray(), rotation: group.rotation.toArray() };
        };`);
    },
    /** 沿用真实门户入口，后台和串口由脚本隔离。 */
    configureServer(vite) {
      vite.middlewares.use('/__point-tuning', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__point-tuning', '<html><head><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});

/** 读取实际 Home 状态、侧栏和能力，不通过测试私有入口设置参数。 */
async function state() {
  return page.locator('.home').evaluate(element => {
    let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
    while (fiber && typeof fiber.stateNode?.syncDisplayRendererConfig !== 'function') fiber = fiber.return;
    const home = fiber.stateNode;
    return { system: home.state.matrixName, mode: home.state.numMatrixFlag, max: home.state.colorSliderMax,
      color: home.state.valuej1, edge: home.state.edgeBuffer1,
      controls: home.com.current?.getTuningControls?.(), total: Number(document.querySelector('.aside .pressData')?.textContent) };
  });
}

/** 由真实系统卡进入，覆盖组件重新挂载恢复。 */
async function enter(system) {
  activeSystem = system;
  await page.locator(`[data-system="${system}"]`).click();
  await page.getByRole('button', { name: copy.enterSystem[language], exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
}

/** 退出到系统列表，等待真实销毁。 */
async function leave() {
  await closeSettings();
  await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
}

/** 展开真实调节抽屉。 */
async function openSettings() {
  await page.getByRole('button', { name: copy.tuning[language], exact: true }).click();
  await page.locator('.ant-drawer:visible').waitFor();
  await page.waitForFunction(() => {
    const wrapper = document.querySelector('.ant-drawer-open .ant-drawer-content-wrapper');
    const rect = wrapper?.getBoundingClientRect();
    return rect && rect.left >= 0 && rect.right <= innerWidth + 1;
  });
}

/** 收起调节抽屉，让系统切换和显示菜单可点击。 */
async function closeSettings() {
  const close = page.locator('.ant-drawer:visible .ant-drawer-close');
  if (await close.count()) await close.click();
}

/** 通过输入框回车提交颜色范围，保留真实 InputNumber 的清空/失焦行为。 */
async function setMaximum(value) {
  const input = page.getByRole('spinbutton', { name: copy.colorSliderMax[language], exact: true });
  await input.fill(String(value)); await input.press('Enter');
}

/** 通过键盘选择缓冲宽度，不直接调用渲染器 setter。 */
async function setEdge(value) {
  const slider = page.getByRole('slider', { name: copy.edgeBuffer[language], exact: true });
  await slider.focus(); await slider.press('Home');
  for (let index = 0; index < value; index++) await slider.press('ArrowRight');
  assert.equal(Number(await slider.getAttribute('aria-valuenow')), value);
}

/** 发规范压力帧：角落高值用于观测边界处理，原始总和应不受缓冲变化影响。 */
function pressure() {
  // 旧正方形插值把首点放在[1,1]，末点才在[63,63]边界；用末点真实复现边缘重复采样。
  const values = Array(1024).fill(16); values[1023] = 1600;
  const frame = { type: 'sensor.frame', schemaVersion: 1, source: 'realtime', displaySystemId: activeSystem, sensorType: activeSystem,
    sensorId: 'sit', channelId: `${activeSystem}:sit`, outputChannel: 'sit', sequence: ++sequence, timestamp: Date.now(), quality: 'good',
    serial: { role: 'sit', path: 'COM_POINT_TEST', baudRate: 1000000, parserChannel: `${activeSystem}:sit` },
    payload: { value: values, matrix: { rows: 32, cols: 32, total: 1024 } } };
  for (const socket of sockets) socket.send(JSON.stringify(frame));
}

/** 真实显示模式菜单选择，不复用内部状态 setter。 */
async function mode(label) {
  await closeSettings();
  await page.locator('.portal-display-panel .ant-select').last().click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: label }).click();
  await openSettings();
}

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__pointGpuUploads = {};
    for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!Type) continue;
      for (const method of ['bufferData', 'bufferSubData']) {
        const original = Type.prototype[method];
        /** 观察实际 GPU 位置上传，用平面坐标排除颜色数组。 */
        Type.prototype[method] = function (...args) {
          const positions = args.find(value => value instanceof Float32Array && value.length > 1000
            && Math.abs(value[0]) > 5 && Math.abs(value[2]) > 5);
          if (positions) {
            let maxHeight = 0;
            for (let index = 1; index < positions.length; index += 3) maxHeight = Math.max(maxHeight, positions[index]);
            window.__pointGpuUploads[positions.length / 3] = { maxHeight, finite: positions.every(Number.isFinite) };
          }
          return original.apply(this, args);
        };
      }
    }
  });
  await page.routeWebSocket(/:19999/, socket => {
    sockets.add(socket); socket.onClose(() => sockets.delete(socket));
    socket.send(JSON.stringify({ licenseKey: 'fixture-key', ...license, currentSensorType: activeSystem }));
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
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__point-tuning?actual-monitor=1`);
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await enter('smallBedNoAlg'); await openSettings();
  await setMaximum(6000);
  assert.equal((await state()).max, 6000);
  assert.equal(Number(await page.getByRole('slider', { name: '颜色', exact: true }).getAttribute('aria-valuemax')), 6000);
  const maxInput = page.getByRole('spinbutton', { name: copy.colorSliderMax.zh, exact: true });
  await maxInput.fill(''); await maxInput.press('Tab');
  assert.equal((await state()).max, 6000, 'clearing the field must not save zero');
  assert.equal(await maxInput.inputValue(), '6000');
  const colorSlider = page.getByRole('slider', { name: '颜色', exact: true });
  await colorSlider.focus(); await colorSlider.press('End');
  assert.equal((await state()).color, 6000);
  await setMaximum(500);
  assert.equal((await state()).color, 500);
  await page.waitForFunction(() => window.__readPointTuning?.().color === 500);
  console.log('COLOR_INPUT_PASS', JSON.stringify(await state()));

  if (process.env.POINT_TUNING_COLOR_ONLY === '1') {
    await page.screenshot({ path: join(artifacts, 'color-controls.png') });
    console.log('POINT_TUNING_COLOR_PASS', JSON.stringify({ artifacts }));
  } else {
    const edge = page.getByRole('slider', { name: copy.edgeBuffer.zh, exact: true });
    await edge.waitFor(); assert.equal(Number(await edge.getAttribute('aria-valuenow')), 2);
    await setEdge(0); await closeSettings();
    for (let i = 0; i < 8; i++) { pressure(); await page.waitForTimeout(120); }
    await page.waitForFunction(() => window.__readPointTuning?.().maxHeight > 0);
    const without = await page.evaluate(() => window.__readPointTuning());
    const original = await state();
    await openSettings(); await setEdge(8); await closeSettings();
    await page.waitForTimeout(900);
    const buffered = await page.evaluate(() => window.__readPointTuning());
    assert.equal((await state()).total, original.total, 'visual edge treatment must not alter sidebar totals');
    assert.ok(buffered.finite && buffered.children.every(child => child.finite));
    assert.ok(buffered.lastHeight < without.lastHeight * 0.8, 'zero extension must remove corner amplification beyond temporal smoothing drift');
    assert.equal(buffered.pointCount, without.pointCount, 'sensor geometry and selection indexing must stay stable');
    assert.deepEqual(buffered.camera, without.camera); assert.deepEqual(buffered.rotation, without.rotation);
    assert.ok(buffered.children.some(child => child.visible && child.count > 0), 'a visible external buffer must be added');
    assert.ok(buffered.children.every(child => child.outerMax === 0), 'the outermost added layer must end at zero height');
    const uploads = await page.evaluate(() => window.__pointGpuUploads);
    assert.ok(uploads[buffered.pointCount]?.finite && uploads[buffered.pointCount].maxHeight > 0);
    assert.ok(buffered.children.some(child => child.count > 0 && uploads[child.count]?.finite), 'outer buffer positions must reach the GPU');
    console.log('EDGE_RENDER_PASS', JSON.stringify({ without, buffered, total: original.total }));
    await openSettings();
    await page.screenshot({ path: join(artifacts, 'point-buffer-controls.png') });

    await mode('原始数据');
    assert.equal(await page.getByRole('slider', { name: copy.edgeBuffer.zh, exact: true }).count(), 0);
    assert.equal((await state()).max, undefined);
    await setMaximum(300);
    await mode('3D 模型');
    assert.equal((await state()).max, 500); assert.equal((await state()).edge, 8);
    await leave(); await enter('hand'); await openSettings();
    assert.equal((await state()).max, undefined);
    assert.equal(Number(await page.getByRole('slider', { name: copy.edgeBuffer.zh, exact: true }).getAttribute('aria-valuenow')), 4);
    await leave(); await enter('smallBedNoAlg'); await openSettings();
    assert.equal((await state()).max, 500); assert.equal((await state()).edge, 8);
    await closeSettings(); await page.reload(); await enter('smallBedNoAlg'); await openSettings();
    assert.equal((await state()).max, 500); assert.equal((await state()).edge, 8);
    await page.waitForFunction(() => window.__readPointTuning?.().color === 500);

    for (const [nextLanguage, option, documentLanguage] of [['en', '英文', 'en-US'], ['ja', 'Japanese', 'ja-JP']]) {
      await closeSettings();
      await page.locator('.portal-display-language .ant-select').click();
      await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: option }).click();
      language = nextLanguage;
      await page.waitForFunction(expected => document.documentElement.lang === expected, documentLanguage);
      await openSettings();
      assert.equal(await page.getByRole('spinbutton', { name: copy.colorSliderMax[language], exact: true }).count(), 1);
      assert.equal(await page.getByRole('slider', { name: copy.edgeBuffer[language], exact: true }).count(), 1);
      const overflow = await page.locator('.ant-drawer:visible .tuning-range-setting').evaluateAll(elements => elements
        .filter(element => element.scrollWidth > element.clientWidth + 2).map(element => element.innerText));
      assert.deepEqual(overflow, [], 'translated labels and helper text must fit the drawer');
      await page.screenshot({ path: join(artifacts, `point-buffer-${language}.png`) });
    }
    assert.deepEqual(errors, []);
    console.log('POINT_TUNING_HOME_PASS', JSON.stringify({ artifacts, state: await state() }));
  }
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('POINT_TUNING_HOME_FAILED', JSON.stringify({ artifacts, errors, state: await state().catch(() => null) })); throw error;
} finally { await browser?.close(); await server.close(); }
