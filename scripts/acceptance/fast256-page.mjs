import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/** 将真实串口/SQLite验收产生的帧送入编译门户，核对16×16全部GPU数字及侧栏。 */
export async function runFast256Page({ browser, origin, outputDir, fixturePath }) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  assert.equal(fixture.sensorType, 'fast256');
  assert.equal(fixture.source, 'production-parser-storage-and-playback');
  assert.ok(fixture.frames.some(item => item.frame.source === 'realtime'));
  assert.ok(fixture.frames.some(item => item.frame.source === 'playback'));
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const sockets = new Set(), errors = [], failedResources = [], checked = [];
  const license = { valid: true, selectFlag: 'all', date: Date.now() + 86400000, nowDate: Date.now() };
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(origin) && response.status() >= 400) failedResources.push(response.url().slice(origin.length));
  });
  try {
    await page.addInitScript(() => {
      window.__fast256Gpu = { updates: 0, values: [], invalid: 0 };
      for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!Type) continue;
        for (const method of ['bufferData', 'bufferSubData']) {
          const original = Type.prototype[method];
          /** 只读256实例的UV上传，按16×16数字纹理解码，不替换生产JS或帧处理。 */
          Type.prototype[method] = function (...args) {
            const uv = args.find(value => value instanceof Float32Array && value.length === 256 * 2);
            if (uv) {
              const observed = window.__fast256Gpu;
              observed.updates++;
              observed.invalid += uv.filter(value => !Number.isFinite(value)).length;
              observed.values = Array.from({ length: 256 }, (_, index) => Math.round(uv[index * 2] * 16) + Math.round(uv[index * 2 + 1] * 16) * 16);
            }
            return original.apply(this, args);
          };
        }
      }
    });
    await page.routeWebSocket('**/*', socket => {
      const url = new URL(socket.url());
      if (url.hostname !== '127.0.0.1' || url.port !== '19999') { socket.close({ code: 1008, reason: 'isolated acceptance' }); return; }
      sockets.add(socket); socket.onClose(() => sockets.delete(socket));
      socket.send(JSON.stringify({ licenseKey: 'acceptance-fixture', ...license, currentSensorType: 'fast256' }));
    });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.origin !== 'http://127.0.0.1:19245') return route.abort('blockedbyclient');
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      let json = {};
      if (url.pathname === '/api/collection/status') json = { current: null, collectionSummary: null, recent: [] };
      else if (url.pathname === '/api/display-systems') json = { displaySystems: { runtimeDefinitions: [] } };
      else if (url.pathname === '/api/algorithm-market') json = { packages: [], instances: [] };
      else if (url.pathname === '/api/commands') {
        const command = route.request().postDataJSON();
        json = { code: 0, data: { ok: true, data: { results: command.type === 'license.activate'
          ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [] } } };
      }
      return route.fulfill({ headers, json });
    });
    await page.goto(origin);
    await page.getByRole('button', { name: /定制系统/ }).click();
    await page.getByRole('button', { name: '全部', exact: true }).click();
    await page.locator('[data-system="fast256"]').click();
    await page.getByRole('button', { name: /^进入(?:该)?系统$/, exact: true }).click();
    await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
    assert.ok(sockets.size > 0, 'The actual Home websocket must be connected');
    for (const [index, item] of fixture.frames.entries()) {
      assert.equal(item.expected.length, 256);
      const previous = await page.evaluate(() => window.__fast256Gpu.updates);
      for (const socket of sockets) socket.send(JSON.stringify(item.frame));
      await page.waitForFunction(({ expected, previous }) => {
        const observed = window.__fast256Gpu;
        return observed.updates > previous && observed.values.length === 256
          && expected.every((value, index) => value === observed.values[index]);
      }, { expected: item.expected, previous }, { timeout: 6000 });
      const total = item.expected.reduce((sum, value) => sum + value, 0);
      await page.waitForFunction(expected => Number(document.querySelector('.aside .pressData')?.textContent) === expected, total);
      checked.push({ index, source: item.frame.source, points: 256, total });
    }
    const gpu = await page.evaluate(() => window.__fast256Gpu);
    assert.equal(gpu.invalid, 0);
    assert.deepEqual(errors, []); assert.deepEqual(failedResources, []);
    const screenshot = path.join(outputDir, 'fast256-glove-page.png');
    await page.screenshot({ path: screenshot });
    return { scope: 'compiled-fast256-page-with-production-pipeline-frames', fixturePath, checked, gpu, screenshot };
  } catch (error) {
    const gpu = await page.evaluate(() => window.__fast256Gpu).catch(() => null);
    const total = await page.locator('.aside .pressData').textContent().catch(() => null);
    await page.screenshot({ path: path.join(outputDir, 'fast256-glove-page-failure.png') }).catch(() => {});
    error.details = { fixturePath, checked, gpu, total, errors, failedResources }; throw error;
  } finally { await page.close(); }
}
