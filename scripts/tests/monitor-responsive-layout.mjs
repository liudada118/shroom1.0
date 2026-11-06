import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-monitor-responsive-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, '.vite'), logLevel: 'error', server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'monitor-responsive-layout-test', enforce: 'pre',
    /** 只在测试转换中暴露当前场景，读取真实点位和相机，不改正式组件。 */
    transform(source, id) {
      if (!id.replaceAll('\\', '/').split('?')[0].endsWith('/components/three/smallBed.jsx')) return null;
      const hook = 'disposeParticleEntrance = installParticleEntrance(';
      assert.ok(source.includes(hook), '小床场景观测挂点仍存在');
      return source.replace(hook, `
        /** 延迟读取 controls，避免观测挂点早于控制器初始化。 */
        window.__readResponsivePointScene = () => Object.freeze({ points: particles, camera, controls, renderer });
        ${hook}`);
    },
    /** 使用真实门户与监测页；网络、串口和授权在浏览器上下文内隔离。 */
    configureServer(vite) {
      vite.middlewares.use('/__monitor-responsive-layout', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__monitor-responsive-layout', '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});

/** 等待实际渲染帧，让 ResizeObserver、控制器和投影使用同一布局。 */
async function renderFrames(page, count = 8) {
  await page.evaluate(count => new Promise(resolve => {
    let frames = 0;
    /** 逐帧等待，不修改正式动画或强制指定布局状态。 */
    function next() { if (++frames >= count) resolve(); else requestAnimationFrame(next); }
    requestAnimationFrame(next);
  }), count);
}

/** 使用正式语言选择器，覆盖中文、英文、日文的按钮布局。 */
async function chooseLanguage(page, language) {
  await page.locator('.portal-display-language .ant-select-selector').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').nth(['zh', 'en', 'ja'].indexOf(language)).click();
  await renderFrames(page);
}

/** 读取实际 DOM 边界及全部点位的屏幕投影，不改相机或场景。 */
async function inspectLayout(page) {
  return page.evaluate(() => {
    /** 把 DOMRect 转为可序列化的布局证据。 */
    const rect = element => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, right: bounds.right, bottom: bounds.bottom };
    };
    const root = document.querySelector('.portal-runtime-monitor');
    const canvas = root.querySelector('.portal-fitted-point-scene #canvas canvas');
    const marker = root.querySelector('.portal-point-viewport');
    const { points, camera, controls, renderer } = window.__readResponsivePointScene();
    const bounds = rect(canvas), positions = points.geometry.getAttribute('position');
    const projected = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity, count: positions.count };
    const vector = points.position.clone();
    for (let index = 0; index < positions.count; index++) {
      vector.fromBufferAttribute(positions, index).applyMatrix4(points.matrixWorld).project(camera);
      const x = bounds.x + (vector.x + 1) * bounds.width / 2;
      const y = bounds.y + (1 - vector.y) * bounds.height / 2;
      projected.left = Math.min(projected.left, x); projected.right = Math.max(projected.right, x);
      projected.top = Math.min(projected.top, y); projected.bottom = Math.max(projected.bottom, y);
    }
    const buttons = [...root.querySelectorAll('.portal-session-bar button, .portal-quick-tools-grid > button')].map(button => {
      const texts = [...button.querySelectorAll(':scope > span:not(.anticon), :scope > small')].map(text => {
        const range = document.createRange(); range.selectNodeContents(text);
        return { label: text.textContent.trim(), rect: rect(range) };
      });
      return { label: button.getAttribute('aria-label') || button.textContent.trim(), rect: rect(button), texts,
        clientWidth: button.clientWidth, scrollWidth: button.scrollWidth };
    });
    return { viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, canvas: bounds, marker: rect(marker),
      left: rect(root.querySelector('.portal-observatory')), rail: rect(root.querySelector('.portal-monitor-tools-rail')),
      identity: rect(root.querySelector('.portal-monitor-identity-group')), session: rect(root.querySelector('.home > .title')),
      close: rect(root.querySelector('.portal-monitor-close')), buttons, projected,
      camera: { position: camera.position.toArray(), target: controls.target.toArray(), zoom: camera.zoom },
      pointWorldMatrix: points.matrixWorld.toArray(),
      actualCanvas: renderer.domElement === canvas,
      chartsHidden: root.classList.contains('is-chart-hidden'),
      railCollapsed: root.querySelector('.portal-monitor-tools-rail').classList.contains('is-collapsed'),
      documentWidth: document.documentElement.scrollWidth };
  });
}

/** 验证可视面板、顶部工具、文字和真实点图都留在各自可用区域内。 */
function assertLayout(state, label) {
  const tolerance = 1.5;
  /** 容许亚像素舍入，不容许控件或文字越出所属区域。 */
  const within = (bounds, outer) => bounds.x >= outer.x - tolerance && bounds.y >= outer.y - tolerance
    && bounds.right <= outer.right + tolerance && bounds.bottom <= outer.bottom + tolerance;
  const windowBounds = { x: 0, y: 0, right: state.viewport.width, bottom: state.viewport.height };
  assert.equal(state.actualCanvas, true, `${label}: 使用实际 WebGL 画布`);
  assert.equal(state.documentWidth, state.viewport.width, `${label}: 无水平页面溢出`);
  assert.ok(within(state.canvas, windowBounds), `${label}: 画布不溢出`);
  assert.ok(Math.abs(state.canvas.width - state.viewport.width) <= tolerance && Math.abs(state.canvas.height - state.viewport.height) <= tolerance, `${label}: 画布保持全窗坐标`);
  assert.ok(within(state.marker, windowBounds) && state.marker.width > 300 && state.marker.height > 300, `${label}: 有效点图区域`);
  assert.ok(state.identity.right + 4 <= state.session.x, `${label}: 系统名称不与采集栏重叠`);
  assert.ok(state.session.right + 4 <= state.close.x, `${label}: 采集栏不与关闭按钮重叠`);
  if (!state.chartsHidden) {
    assert.ok(within(state.left, windowBounds), `${label}: 左栏不溢出`);
    assert.ok(state.marker.x >= state.left.right, `${label}: 点图预留左栏`);
  }
  if (!state.railCollapsed) {
    assert.ok(within(state.rail, windowBounds), `${label}: 右栏不溢出`);
    assert.ok(state.marker.right <= state.rail.x, `${label}: 点图预留右栏`);
    for (const button of state.buttons) {
      assert.ok(within(button.rect, windowBounds), `${label}: 按钮可见 ${button.label}`);
      assert.ok(button.scrollWidth <= button.clientWidth + tolerance, `${label}: 按钮无横向裁剪 ${button.label}`);
      for (const text of button.texts) assert.ok(within(text.rect, button.rect), `${label}: 文案完整 ${text.label}`);
    }
  }
  const projection = { x: state.projected.left, y: state.projected.top, right: state.projected.right, bottom: state.projected.bottom };
  assert.ok(state.projected.count >= 1024 && within(projection, state.marker), `${label}: 全部点位落在安全区 ${JSON.stringify({ projection, marker: state.marker })}`);
}

/** 精确验证自适应只改变投影，不覆盖用户的视角位置、旋转目标和缩放。 */
function assertCameraUnchanged(before, after, label) {
  for (const field of ['position', 'target']) before[field].forEach((value, index) => {
    assert.ok(Math.abs(value - after[field][index]) < 1e-7, `${label}: 保留 camera.${field}[${index}]`);
  });
  assert.equal(after.zoom, before.zoom, `${label}: 保留用户缩放`);
}

/** 截断网络依赖，真实页面只接收隔离授权和空采集状态。 */
async function isolateNetwork(page) {
  const license = { date: Date.now() + 30 * 86400000, nowDate: Date.now(), selectFlag: 'all', valid: true };
  await page.routeWebSocket(/:19999/, socket => {
    socket.send(JSON.stringify({ licenseKey: 'fixture-key' })); socket.send(JSON.stringify(license));
  });
  await page.route('http://127.0.0.1:19245/**', route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    const request = route.request(), url = request.url();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.method() === 'GET' && url.endsWith('/api/collection/status')) return route.fulfill({ headers, json: { current: null, collectionSummary: null, recent: [] } });
    if (url.endsWith('/api/display-systems')) return route.fulfill({ headers, json: { displaySystems: { runtimeDefinitions: [] } } });
    if (url.endsWith('/api/algorithm-market')) return route.fulfill({ headers, json: { packages: [], instances: [] } });
    if (url.endsWith('/api/commands')) {
      const results = request.postDataJSON().type === 'license.activate' ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [];
      return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { results } } } });
    }
    return route.fulfill({ headers, json: {} });
  });
}

let browser, page;
const evidence = [];
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  // 目录中的“小床监测”使用 jqbed；其正式渲染器仍是 SmallBed。
  for (const system of ['jqbed', 'smallBedNoAlg']) {
    page = await browser.newPage({ viewport: { width: 1470, height: 834 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await isolateNetwork(page);
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__monitor-responsive-layout?actual-monitor=1`);
    await page.getByRole('button', { name: /具身触觉/ }).click();
    await page.getByRole('button', { name: '全部', exact: true }).click();
    await page.locator(`[data-system="${system}"]`).click();
    await page.getByRole('button', { name: '进入该系统', exact: true }).click();
    await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor({ timeout: 60000 });
    await page.waitForFunction(() => window.__readResponsivePointScene?.().controls);
    await renderFrames(page);
    const canvas = await page.locator('.portal-fitted-point-scene #canvas canvas').elementHandle();
    const initialCamera = (await inspectLayout(page)).camera;
    for (const viewport of [{ width: 1470, height: 834 }, { width: 1280, height: 720 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(viewport); await renderFrames(page);
      for (const language of ['zh', 'en', 'ja']) {
        await chooseLanguage(page, language);
        const state = await inspectLayout(page), label = `${system} ${viewport.width}x${viewport.height} ${language}`;
        assertLayout(state, label); assertCameraUnchanged(initialCamera, state.camera, label);
        assert.equal(await canvas.evaluate(element => element === document.querySelector('.portal-fitted-point-scene #canvas canvas')), true, `${label}: 调整窗口不重建画布`);
        evidence.push({ label, ...state });
        if (language === 'zh' || viewport.width === 1470) await page.screenshot({ path: join(artifacts, `${system}-${viewport.width}-${language}.png`) });
      }
    }
    await page.setViewportSize({ width: 1470, height: 834 }); await renderFrames(page);
    const expanded = await inspectLayout(page);
    await page.locator('.portal-quick-tools-grid > button[aria-pressed]:not(.portal-scene-only-toggle)').click();
    await renderFrames(page);
    const hidden = await inspectLayout(page);
    assertLayout(hidden, `${system} 隐藏图表`); assert.equal(hidden.chartsHidden, true);
    assert.ok(hidden.marker.x < expanded.marker.x - 200 && hidden.marker.width > expanded.marker.width + 200, '隐藏图表释放左侧空间');
    await page.locator('.portal-quick-tools-handle').click(); await renderFrames(page, 24);
    const folded = await inspectLayout(page);
    assertLayout(folded, `${system} 折叠工具`); assert.equal(folded.railCollapsed, true);
    assert.ok(folded.marker.right > hidden.marker.right + 150, '折叠整栏释放右侧空间');
    assertCameraUnchanged(initialCamera, folded.camera, `${system} 折叠后`);
    assert.equal(await canvas.evaluate(element => element === document.querySelector('.portal-fitted-point-scene #canvas canvas')), true, '折叠与隐藏不重建画布');
    await page.locator('.portal-quick-tools-handle').click(); await renderFrames(page, 24);
    await page.locator('.portal-quick-tools-grid > button[aria-pressed]:not(.portal-scene-only-toggle)').click(); await renderFrames(page);
    const restored = await inspectLayout(page);
    assertLayout(restored, `${system} 恢复两栏`);
    assert.deepEqual(restored.marker, expanded.marker, '展开后恢复原可用区域');
    assertCameraUnchanged(initialCamera, restored.camera, `${system} 恢复后`);
    await chooseLanguage(page, 'zh');
    await page.getByRole('button', { name: '工具', exact: true }).click();
    await page.getByRole('button', { name: 'X 轴 +30°', exact: true }).click();
    await page.getByRole('button', { name: '缩小', exact: true }).click();
    await page.getByRole('button', { name: '收起实用工具', exact: true }).click();
    await renderFrames(page, 24);
    const userView = await inspectLayout(page);
    assert.notDeepEqual(userView.camera, initialCamera, '缩小操作确实改变用户镜头');
    await page.setViewportSize({ width: 1280, height: 720 }); await renderFrames(page);
    await page.locator('.portal-quick-tools-handle').click(); await renderFrames(page, 24);
    const retainedView = await inspectLayout(page);
    assertCameraUnchanged(userView.camera, retainedView.camera, `${system} 用户视角自适应后`);
    assert.deepEqual(retainedView.pointWorldMatrix, userView.pointWorldMatrix, '窗口和侧栏变化不重置用户旋转');
    assert.equal(await canvas.evaluate(element => element === document.querySelector('.portal-fitted-point-scene #canvas canvas')), true, '用户旋转缩放后的画布继续保留');
    assert.deepEqual(errors, [], `${system}: 无页面异常`);
    evidence.push({ label: `${system} charts-hidden`, ...hidden }, { label: `${system} rail-folded`, ...folded });
    await page.close(); page = null;
  }
  await writeFile(join(artifacts, 'layout-evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(`monitor responsive layout PASSED: ${evidence.length} layouts, 2 systems, 4 viewports, 3 languages; artifacts: ${artifacts}`);
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  if (page) await inspectLayout(page).then(state => writeFile(join(artifacts, 'failure-layout.json'), JSON.stringify(state, null, 2))).catch(() => {});
  console.error('monitor responsive layout FAILED; artifacts:', artifacts);
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
