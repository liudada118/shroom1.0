import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-small-bed-orbit-'));
const baseline = process.argv.includes('--before-fix');
const immediateOnly = process.argv.includes('--immediate-only');
const originals = baseline ? new Map(['client/src/components/three/smallBed.jsx', 'client/src/components/three/pointViewTools.js']
  .map((path) => [path, execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8' })])) : null;
const server = await createServer({
  root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, 'vite-cache'),
  server: { host: '127.0.0.1', port: 0, open: false },
  plugins: [{
    name: 'small-bed-orbit-test',
    enforce: 'pre',
    /** 基线只在内存中读取 HEAD 源码，不覆盖工作区的修复。 */
    transform(source, id) {
      if (!originals) return null;
      const normalized = id.replaceAll('\\', '/').split('?')[0];
      for (const [path, original] of originals) if (normalized.endsWith(`/${path}`)) return original;
      return null;
    },
    /** 隔离挂载真实点图，不连接客户设备与算法服务。 */
    configureServer(vite) {
      vite.middlewares.use('/__small-bed-orbit', async (req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.end(await vite.transformIndexHtml('/__small-bed-orbit', '<html><head><style>body{margin:0;background:#020a12}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/nativePointViews.jsx"></script></body></html>'));
      });
    },
  }],
});

/** 从实际点绘制的模型视图矩阵和透视矩阵计算底面中心的屏幕位置。 */
async function centerProjection(page) {
  return page.evaluate(() => {
    const { matrix, projection, draws } = window.__smallBedGpu;
    /** Three.js 和 WebGL 使用列优先齐次坐标。 */
    const multiply = (m, v) => [0, 1, 2, 3].map((row) => m[row] * v[0] + m[row + 4] * v[1] + m[row + 8] * v[2] + m[row + 12] * v[3]);
    const view = multiply(matrix, [-50, 0, -50, 1]);
    const clip = multiply(projection, view);
    return { x: (clip[0] / clip[3] + 1) * innerWidth / 2, y: (1 - clip[1] / clip[3]) * innerHeight / 2,
      depth: Math.hypot(...view.slice(0, 3)), matrix, draws };
  });
}

/** 等控制器的阻尼收敛后再读矩阵，避免把余动当成下一次操作。 */
async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    /** 真实渲染帧会继续上传点图矩阵。 */
    const next = () => (++frames >= 60 ? resolve() : requestAnimationFrame(next));
    requestAnimationFrame(next);
  }));
}

/** 右键真实拖动必须改变视角，同时让底面中心固定在同一像素。 */
async function orbit(page, label) {
  await settle(page);
  const before = await centerProjection(page);
  await page.mouse.move(720, 450);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(875, 505, { steps: 12 });
  await page.mouse.up({ button: 'right' });
  await settle(page);
  const after = await centerProjection(page);
  const drift = Math.hypot(after.x - before.x, after.y - before.y);
  const matrixChange = Math.max(...after.matrix.map((value, index) => Math.abs(value - before.matrix[index])));
  console.log('SMALL_BED_ORBIT_MEASURE', label, JSON.stringify({ drift, matrixChange, center: [before.x, before.y] }));
  assert.ok(matrixChange > 0.0001, `${label}: right drag did not rotate the actual points`);
  assert.ok(drift < 0.05, `${label}: center moved ${drift.toFixed(3)} pixels during rotation`);
  assert.ok(Math.abs(after.depth - before.depth) < 0.001, `${label}: orbit changed distance to footprint center`);
  return after;
}

/** 记录复位后的连续实际绘制帧，捕获延迟发生的平移、缩放或旋转惯性。 */
async function frameMatrices(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const frames = [];
    let previousDraws = window.__smallBedGpu.draws;
    /** 每个样本必须来自新上传的点图矩阵。 */
    const next = () => {
      if (window.__smallBedGpu.draws > previousDraws) {
        previousDraws = window.__smallBedGpu.draws;
        frames.push([...window.__smallBedGpu.matrix]);
      }
      if (frames.length === 24) resolve(frames);
      else requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  }));
}

/** 在真实输入事件结束的同一轮事件处理中复位，不等待任何阻尼收敛。 */
async function immediateResetChecks(page) {
  assert.equal(await page.evaluate(() => window.__pointViews.command('reset')), true);
  await settle(page);
  const baselineMatrix = (await centerProjection(page)).matrix;
  for (const legacy of [false, true]) {
    for (const input of ['pan', 'wheel', 'rotate']) {
      await page.mouse.move(720, 450);
      await page.evaluate(({ eventName, legacy }) => {
        window.__immediateResetDone = false;
        /** 窗口冒泡阶段晚于 Trackball 本轮输入处理，复位直接走真实公开 API。 */
        window.addEventListener(eventName, () => {
          if (legacy) window.__pointViews.rendererCommand('reset');
          else window.__pointViews.command('reset');
          window.__immediateResetDone = true;
        }, { once: true });
      }, { eventName: input === 'wheel' ? 'wheel' : 'pointerup', legacy });
      if (input === 'wheel') {
        await page.mouse.wheel(0, 180);
      } else {
        const button = input === 'pan' ? 'left' : 'right';
        await page.mouse.down({ button });
        await page.mouse.move(850, 515, { steps: 5 });
        await page.mouse.up({ button });
      }
      await page.waitForFunction(() => window.__immediateResetDone);
      const frames = await frameMatrices(page);
      const difference = Math.max(...frames.flatMap((matrix) => matrix.map((value, index) => Math.abs(value - baselineMatrix[index]))));
      const center = await centerProjection(page);
      const drift = Math.hypot(center.x - 720, center.y - 450);
      const label = `${legacy ? 'panel' : 'tools'} reset immediately after ${input}`;
      console.log('SMALL_BED_IMMEDIATE_RESET_MEASURE', label, JSON.stringify({ matrixDifference: difference, centerDrift: drift, frames: frames.length }));
      assert.ok(difference < 0.00001, `${label}: residual input moved a restored frame by ${difference}`);
      assert.ok(drift < 0.05, `${label}: restored footprint center drifted ${drift} pixels`);
    }
  }
  console.log('SMALL_BED_IMMEDIATE_RESET_PASS');
}

let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const address = server.httpServer.address();
  const scenarios = [{ name: 'smallBed', label: '32x32' }, { name: 'smallBed12B', label: '12B-16x64' },
    { name: 'smallBed', label: 'saved-tilt', tilt: true }];
  for (const scenario of immediateOnly ? scenarios.slice(0, 1) : scenarios) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(({ tilt }) => {
      if (tilt) { localStorage.setItem('bedx', '0.6'); localStorage.setItem('bedz', '-0.4'); }
      window.__smallBedGpu = { matrix: null, projection: null, draws: 0, invalid: 0 };
      for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!Type) continue;
        const locations = new WeakMap();
        const matrices = new WeakMap();
        const getUniform = Type.prototype.getUniformLocation;
        /** 标记实际点图使用的相机矩阵。 */
        Type.prototype.getUniformLocation = function (...args) {
          const location = getUniform.apply(this, args);
          if (location && ['modelViewMatrix', 'projectionMatrix'].includes(args[1])) locations.set(location, args[1]);
          return location;
        };
        const uniformMatrix = Type.prototype.uniformMatrix4fv;
        /** 每个 WebGL 上下文分别保留最新矩阵。 */
        Type.prototype.uniformMatrix4fv = function (...args) {
          const name = locations.get(args[0]);
          if (name) { const current = matrices.get(this) || {}; current[name] = Array.from(args[2]); matrices.set(this, current); }
          return uniformMatrix.apply(this, args);
        };
        const draw = Type.prototype.drawArrays;
        /** 仅点图可以提供中心证据，网格和中心贴图不参与测量。 */
        Type.prototype.drawArrays = function (...args) {
          if (args[0] === this.POINTS) {
            const current = matrices.get(this);
            if (current?.modelViewMatrix && current?.projectionMatrix) {
              window.__smallBedGpu.matrix = current.modelViewMatrix;
              window.__smallBedGpu.projection = current.projectionMatrix;
              window.__smallBedGpu.draws++;
            }
          }
          return draw.apply(this, args);
        };
        for (const name of ['bufferData', 'bufferSubData']) {
          const original = Type.prototype[name];
          /** 旋转、复位和数据输入都不能上传无效压力顶点。 */
          Type.prototype[name] = function (...args) {
            if (args.some((value) => value instanceof Float32Array && !value.every(Number.isFinite))) window.__smallBedGpu.invalid++;
            return original.apply(this, args);
          };
        }
      }
    }, scenario);
    await page.goto(`http://127.0.0.1:${address.port}/__small-bed-orbit`);
    await page.waitForFunction(() => window.__pointViews?.snapshot().available && window.__smallBedGpu.draws > 0);
    if (scenario.name !== 'smallBed') {
      const draws = await page.evaluate(() => window.__smallBedGpu.draws);
      await page.evaluate((name) => window.__pointViews.mount(name), scenario.name);
      await page.waitForFunction((name) => window.__pointViews.snapshot().name === name && window.__pointViews.snapshot().available, scenario.name);
      await page.waitForFunction((previous) => window.__smallBedGpu.draws > previous, draws);
    }
    if (scenario.label === '32x32' && !baseline) await immediateResetChecks(page);
    if (immediateOnly) {
      assert.deepEqual(errors, [], 'browser runtime errors');
      assert.equal(await page.evaluate(() => window.__smallBedGpu.invalid), 0, 'invalid vertex upload');
      await page.close();
      continue;
    }
    const first = await orbit(page, `${scenario.label}: initial`);
    assert.ok(Math.hypot(first.x - 720, first.y - 450) < 0.05, `${scenario.label}: initial footprint center is not camera target`);
    await page.evaluate(() => {
      window.__orbitPressure = Array.from({ length: 1024 }, (_, index) => index % 11 + 30);
      window.__orbitPressureBefore = JSON.stringify(window.__orbitPressure);
      window.__pointViews.rendererCommand('sitData', { wsPointData: window.__orbitPressure });
    });
    await orbit(page, `${scenario.label}: live pressure`);
    await page.mouse.move(720, 450);
    await page.mouse.down({ button: 'left' });
    await page.mouse.move(800, 500, { steps: 8 });
    await page.mouse.up({ button: 'left' });
    await settle(page);
    const panned = await centerProjection(page);
    assert.ok(Math.hypot(panned.x - 720, panned.y - 450) > 10, `${scenario.label}: panning was overridden`);
    for (const method of ['top', 'zoom', 'rotate', 'flip', 'reset']) {
      const arg = method === 'zoom' ? 1 : ['rotate', 'flip'].includes(method) ? 'x' : undefined;
      assert.equal(await page.evaluate(([action, value]) => window.__pointViews.command(action, value), [method, arg]), true);
      await orbit(page, `${scenario.label}: after ${method}`);
    }
    await page.evaluate(() => window.__pointViews.rendererCommand('changeGroupRotate', { x: 0.8, z: -0.5 }));
    await orbit(page, `${scenario.label}: panel tilt`);
    await page.evaluate(() => window.__pointViews.rendererCommand('reset'));
    const reset = await orbit(page, `${scenario.label}: panel reset`);
    assert.ok(Math.hypot(reset.x - 720, reset.y - 450) < 0.05, `${scenario.label}: panel reset lost footprint center`);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__orbitPressure) === window.__orbitPressureBefore), true, 'view tools mutated source pressure array');
    assert.equal(await page.evaluate(() => window.__smallBedGpu.invalid), 0, 'invalid vertex upload');
    assert.deepEqual(errors, [], 'browser runtime errors');
    await page.screenshot({ path: join(artifacts, `${scenario.label}.png`) });
    await page.close();
    console.log('SMALL_BED_ORBIT_PASS', scenario.label);
  }
  console.log('SMALL_BED_ORBIT_CENTER_PASS', artifacts);
} finally {
  await browser?.close();
  await server.close();
}
