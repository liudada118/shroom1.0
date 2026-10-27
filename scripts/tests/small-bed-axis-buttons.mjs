import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const { Quaternion, Vector3 } = requireClient('three');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-small-bed-axis-buttons-'));
const baselineDir = process.argv.find((value) => value.startsWith('--baseline-dir='))?.slice(15);
const baselineSources = baselineDir ? new Map(await Promise.all(['smallBed.jsx', 'pointViewTools.js']
  .map(async (name) => [name, await readFile(join(baselineDir, name), 'utf8')]))) : null;
const server = await createServer({
  root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, 'vite-cache'),
  server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [{
    name: 'small-bed-axis-buttons-test', enforce: 'pre',
    /** 只在测试内提供不可变诊断快照，不给生产渲染器添加调试接口。 */
    transform(source, id) {
      const path = id.replaceAll('\\', '/').split('?')[0];
      const name = path.endsWith('/components/three/smallBed.jsx') ? 'smallBed.jsx'
        : path.endsWith('/components/three/pointViewTools.js') ? 'pointViewTools.js' : null;
      if (!name) return null;
      let current = baselineSources?.get(name) || source;
      if (name === 'smallBed.jsx') {
        const hook = 'workspaceViewRef.current = createPointViewTools(';
        assert.ok(current.includes(hook), 'SmallBed test hook must match the real renderer');
        current = current.replace(hook, `window.__readSmallBedAxisScene = () => {
          group.updateWorldMatrix(true, true);
          return {
            center: new THREE.Vector3(-SEPARATION / 2, 0, -SEPARATION / 2).applyMatrix4(particles.matrixWorld).toArray(),
            planeNormal: new THREE.Vector3(0, 1, 0).transformDirection(particles.matrixWorld).toArray(),
            planeUp: new THREE.Vector3(0, 0, -1).transformDirection(particles.matrixWorld).toArray(),
            quaternion: group.quaternion.toArray(), position: group.position.toArray(),
            cameraPosition: camera.position.toArray(), cameraQuaternion: camera.quaternion.toArray(),
            cameraUp: camera.up.toArray(), target: controls.target.toArray()
          };
        };
        ${hook}`);
      }
      return current;
    },
    /** 与产品使用同一工具组件，仅用固定样式把按钮放在测试视口右侧。 */
    configureServer(vite) {
      vite.middlewares.use('/__small-bed-axis-buttons', async (req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml('/__small-bed-axis-buttons', `<html><head><style>
          body{margin:0;background:#020a12} .fiber-portal{--portal-text:#e2edf5;--portal-secondary:#a9c5d8;--portal-muted:#7395ac;--system-accent:#65e1d0}
          .fiber-portal .portal-utility-panel.is-categorized{left:auto;right:20px;top:20px;bottom:auto;width:330px;height:550px;grid-template-rows:48px 38px minmax(0,1fr)}
          .fiber-portal .portal-utility-grid{grid-auto-flow:row;grid-auto-columns:auto;grid-template-columns:1fr;grid-template-rows:none;overflow-y:auto}
          .fiber-portal .portal-utility-card{min-height:44px}
        </style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/smallBedAxisButtons.jsx"></script></body></html>`));
      });
    },
  }],
});

/** 等待新点绘制完成，再读取实际上传给 GPU 的矩阵。 */
async function renderFrames(page, count = 4) {
  await page.evaluate((count) => new Promise((resolve) => {
    let frames = 0;
    /** 请求帧晚于常驻渲染循环，避免读到按钮前一帧。 */
    const next = () => (++frames >= count ? resolve() : requestAnimationFrame(next));
    requestAnimationFrame(next);
  }), count);
}

/** 用点图实际模型视图/透视矩阵计算底面中心和 X 方向的投影。 */
async function snapshot(page) {
  return page.evaluate(() => {
    const { modelViewMatrix, projectionMatrix } = window.__smallBedAxisGpu;
    /** Three.js 的矩阵是列优先，齐次除法必须保留深度分量。 */
    const multiply = (m, v) => [0, 1, 2, 3].map((row) => m[row] * v[0] + m[row + 4] * v[1] + m[row + 8] * v[2] + m[row + 12] * v[3]);
    /** 将固定底面局部点转成真实屏幕像素。 */
    const project = (point) => {
      const clip = multiply(projectionMatrix, multiply(modelViewMatrix, [...point, 1]));
      return [(clip[0] / clip[3] + 1) * innerWidth / 2, (1 - clip[1] / clip[3]) * innerHeight / 2];
    };
    return { ...window.__smallBedAxisButtons.snapshot(), pixel: project([-50, 0, -50]),
      xStart: project([-250, 0, -50]), xEnd: project([150, 0, -50]), modelViewMatrix };
  });
}

/** 读取向量或矩阵的最大分量误差。 */
function maximumDifference(a, b) {
  return Math.max(...a.map((value, index) => Math.abs(value - b[index])));
}

let browser;
const failures = [];
/** 收集所有关键异常，基线一次运行即可给出方向和中心的决定性证据。 */
function check(condition, message) {
  if (!condition) failures.push(message);
}

/** 检查镜头沿实际垫面法线俯视，顶部方向跟随垫面局部负 Z 轴。 */
function checkTopView(state, label) {
  const eye = new Vector3().fromArray(state.cameraPosition).sub(new Vector3().fromArray(state.target));
  check(maximumDifference(eye.normalize().toArray(), state.planeNormal) < .0000001, `${label}: camera is not above the actual point plane`);
  check(maximumDifference(state.cameraUp, state.planeUp) < .0000001, `${label}: camera up is not the plane local negative Z axis`);
}

/** 复位和重新挂载必须恢复同一对象、镜头及实际 GPU 点图矩阵。 */
function checkRestored(state, initial, label) {
  check(maximumDifference(state.modelViewMatrix, initial.modelViewMatrix) < .000001, `${label}: GPU point transform changed`);
  for (const key of ['center', 'position', 'quaternion', 'cameraPosition', 'cameraQuaternion', 'cameraUp', 'target']) {
    check(maximumDifference(state[key], initial[key]) < .0000001, `${label}: did not restore ${key}`);
  }
  checkTopView(state, label);
}
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const address = server.httpServer.address();
  const scenarios = ['32x32', '12B'].flatMap((layout) => [
    { layout, tilt: false }, { layout, tilt: true },
  ]);
  for (const { layout, tilt } of scenarios) {
    const scenario = `${layout}-${tilt ? 'saved-tilt' : 'flat'}`;
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript((tilt) => {
      localStorage.setItem('bedx', tilt ? '0.7' : '0');
      localStorage.setItem('bedz', tilt ? '-0.4' : '0');
      window.__smallBedAxisGpu = { modelViewMatrix: null, projectionMatrix: null, draws: 0 };
      for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!Type) continue;
        const locations = new WeakMap(), matrices = new WeakMap();
        const getUniform = Type.prototype.getUniformLocation;
        /** 标记真实点图的模型视图和投影矩阵。 */
        Type.prototype.getUniformLocation = function (...args) {
          const location = getUniform.apply(this, args);
          if (location && ['modelViewMatrix', 'projectionMatrix'].includes(args[1])) locations.set(location, args[1]);
          return location;
        };
        const uniformMatrix = Type.prototype.uniformMatrix4fv;
        /** 分别记录每个上下文，避免其他 Three.js 物体覆盖点图证据。 */
        Type.prototype.uniformMatrix4fv = function (...args) {
          const name = locations.get(args[0]);
          if (name) { const current = matrices.get(this) || {}; current[name] = Array.from(args[2]); matrices.set(this, current); }
          return uniformMatrix.apply(this, args);
        };
        const draw = Type.prototype.drawArrays;
        /** 只有 POINTS 实际绘制后才发布矩阵。 */
        Type.prototype.drawArrays = function (...args) {
          const current = matrices.get(this);
          if (args[0] === this.POINTS && current?.modelViewMatrix && current?.projectionMatrix) {
            Object.assign(window.__smallBedAxisGpu, current);
            window.__smallBedAxisGpu.draws++;
          }
          return draw.apply(this, args);
        };
      }
    }, tilt);
    await page.goto(`http://127.0.0.1:${address.port}/__small-bed-axis-buttons?layout=${layout}`);
    await page.waitForFunction(() => window.__smallBedAxisButtons?.snapshot().available && window.__smallBedAxisGpu.draws > 0);
    await page.getByRole('button', { name: 'X 轴 +30°', exact: true }).waitFor({ state: 'visible' });
    await renderFrames(page, 30);
    const initial = await snapshot(page);
    checkTopView(initial, `${scenario}: initial view`);
    const baselineAngle = Math.atan2(Math.abs(initial.xEnd[1] - initial.xStart[1]), Math.abs(initial.xEnd[0] - initial.xStart[0])) * 180 / Math.PI;
    check(baselineAngle < .25, `${scenario}: initial X baseline tilted ${baselineAngle.toFixed(6)}°`);
    await page.screenshot({ path: join(artifacts, `${scenario}-initial.png`) });
    console.log('SMALL_BED_AXIS_INITIAL', scenario, JSON.stringify({ baselineAngle, center: initial.center, pixel: initial.pixel,
      planeNormal: initial.planeNormal, cameraPosition: initial.cameraPosition, cameraUp: initial.cameraUp }));
    await page.getByRole('button', { name: '俯视', exact: true }).click();
    await renderFrames(page);
    checkRestored(await snapshot(page), initial, `${scenario}: explicit top matches first render`);
    const controlsInitial = Object.fromEntries(['cameraPosition', 'cameraQuaternion', 'cameraUp', 'target'].map((key) => [key, initial[key]]));
    check(await page.getByRole('button', { name: /^Y 轴/ }).count() === 0, `${layout}: Y rotation buttons must be removed`);
    const labels = { x: 'X 轴 +30°', back: 'X 轴 −30°' };
    const patterns = [{ name: 'X正反交替', sequence: ['x', 'back', 'x', 'back'] },
      { name: 'X正向连续12次', sequence: Array(12).fill('x') }, { name: 'X反向连续12次', sequence: Array(12).fill('back') },
      { name: 'X反向再正向', sequence: ['back', 'x'] }];
    for (const pattern of patterns) {
      await page.getByRole('button', { name: '恢复视角', exact: true }).click();
      await renderFrames(page);
      const expected = new Quaternion().fromArray(initial.quaternion);
      for (const [index, action] of pattern.sequence.entries()) {
        await page.getByRole('button', { name: labels[action], exact: true }).click();
        await renderFrames(page);
        expected.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (action === 'back' ? -1 : 1) * Math.PI / 6));
        const current = await snapshot(page);
        const directionError = expected.angleTo(new Quaternion().fromArray(current.quaternion)) * 180 / Math.PI;
        const centerDrift = maximumDifference(current.center, initial.center);
        const pixelDrift = Math.hypot(current.pixel[0] - initial.pixel[0], current.pixel[1] - initial.pixel[1]);
        const cameraDrift = Math.max(...Object.keys(controlsInitial).map((key) => maximumDifference(current[key], controlsInitial[key])));
        const label = `${scenario}: ${pattern.name} #${index + 1}`;
        console.log('SMALL_BED_AXIS_MEASURE', label, JSON.stringify({ directionError, centerDrift, pixelDrift, cameraDrift }));
        check(directionError < .00001, `${label}: local axis direction error ${directionError}°`);
        check(centerDrift < .0000001, `${label}: world footprint center moved ${centerDrift}`);
        check(pixelDrift < .005, `${label}: GPU center moved ${pixelDrift}px`);
        check(cameraDrift < .0000001, `${label}: model button moved camera/target ${cameraDrift}`);
      }
      if (pattern.name === 'X正反交替') await page.screenshot({ path: join(artifacts, `${scenario}-x-directions.png`) });
    }
    for (const action of ['x', 'back']) {
      await page.getByRole('button', { name: labels[action], exact: true }).click();
      await renderFrames(page);
      check(maximumDifference((await snapshot(page)).quaternion, initial.quaternion) > .01, `${scenario}: ${action} must change pose before reset`);
      await page.getByRole('button', { name: '恢复视角', exact: true }).click();
      await renderFrames(page);
      checkRestored(await snapshot(page), initial, `${scenario}: reset after ${labels[action]}`);
    }
    await page.screenshot({ path: join(artifacts, `${scenario}-reset.png`) });
    await page.reload();
    await page.waitForFunction(() => window.__smallBedAxisButtons?.snapshot().available && window.__smallBedAxisGpu.draws > 0);
    await renderFrames(page, 30);
    checkRestored(await snapshot(page), initial, `${scenario}: refreshed mount`);
    check(errors.length === 0, `${scenario}: browser errors ${errors.join('; ')}`);
    await page.close();
  }
  console.log('SMALL_BED_AXIS_BUTTONS_ARTIFACTS', artifacts);
  assert.deepEqual(failures, [], 'real X positive/negative button rotation regression');
  console.log('SMALL_BED_AXIS_BUTTONS_PASS');
} finally {
  await browser?.close();
  await server.close();
}
