import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { runCompanyPage } from './company-page.mjs';
import { runFast256Page } from './fast256-page.mjs';

const require = createRequire(import.meta.url);
const { loadAsar } = require('../pack-runtime-dependencies.js');
const contentTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };

/** 从交付包直接提供页面；不重建、不用 Vite，不允许读取 build 外的文件。 */
function pageServer(resources) {
  const root = path.join(resources, 'build'), archive = path.join(resources, 'app.asar');
  const external = fs.existsSync(path.join(root, 'index.html'));
  return http.createServer((request, response) => {
    try {
      const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
      const filename = path.resolve(root, relative), within = path.relative(root, filename);
      if (within.startsWith('..') || path.isAbsolute(within)) throw new Error('Path outside build');
      const bytes = external ? fs.readFileSync(filename) : loadAsar().extractFile(archive, `build/${within.replaceAll('\\', '/')}`);
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      response.end(bytes);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
}

/** 单独验收公司目录竞态，让权限和点图两组失败都能进入报告。 */
export async function runPackagedCompany({ resources, outputDir }) {
  const server = pageServer(resources);
  let browser;
  try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    return await runCompanyPage({ browser, origin: `http://127.0.0.1:${server.address().port}`, outputDir });
  } finally {
    await browser?.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}

/** 用目标编译页接收真实分包及回放验收产出的帧，补齐跨系统的16×16显示回归。 */
export async function runPackagedFast256({ resources, outputDir, fixturePath }) {
  const server = pageServer(resources);
  let browser;
  try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    return await runFast256Page({ browser, origin: `http://127.0.0.1:${server.address().port}`, outputDir, fixturePath });
  } finally {
    await browser?.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}

/** 用产物网页验证真实渲染；授权/设备只提供本机夹具，不代表正式 Electron 或线上权限已验收。 */
export async function runPackagedPage({ resources, outputDir }) {
  const server = pageServer(resources), errors = [], failedResources = [], sockets = new Set();
  let browser, page, sequence = 0;
  const license = { valid: true, selectFlag: 'all', date: Date.now() + 86400000, nowDate: Date.now() };
  try {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) failedResources.push(response.url().slice(origin.length)); });
    await page.addInitScript(() => {
      window.__acceptanceUploads = { count: 0, nonFinite: 0 };
      for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
        if (!Type) continue;
        for (const method of ['bufferData', 'bufferSubData']) {
          const original = Type.prototype[method];
          /** 只读实际 GPU 上传数据，观察64×64插值后的点位缓冲，不替代渲染数学。 */
          Type.prototype[method] = function (...args) {
            const data = args.find(value => value instanceof Float32Array && value.length === 136 * 136 * 3);
            if (data) {
              window.__acceptanceUploads.count++;
              window.__acceptanceUploads.nonFinite += data.filter(value => !Number.isFinite(value)).length;
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
      socket.send(JSON.stringify({ licenseKey: 'acceptance-fixture', ...license, currentSensorType: 'bed4096num' }));
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
    await page.getByRole('button', { name: /具身触觉/ }).click();
    await page.getByRole('button', { name: '全部', exact: true }).click();
    await page.locator('[data-system="bed4096num"]').click();
    await page.getByRole('button', { name: /^进入(?:该)?系统$/, exact: true }).click();
    await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
    const values = Array.from({ length: 4096 }, (_, index) => 20 + Math.floor(index / 1024) * 40 + index % 13);
    /** 经正式 WS 解码入口喂已知回放矩阵，逐步等待实际 GPU 更新。 */
    async function send(value) {
      const count = await page.evaluate(() => window.__acceptanceUploads.count);
      const frame = { type: 'sensor.frame', schemaVersion: 1, source: 'playback', displaySystemId: 'bed4096num', sensorType: 'bed4096num',
        sensorId: 'sit', channelId: 'bed4096num:sit', outputChannel: 'sit', sequence: ++sequence, timestamp: Date.now(), quality: 'good',
        payload: { value, matrix: { rows: 64, cols: 64, total: 4096 } } };
      for (const socket of sockets) socket.send(JSON.stringify(frame));
      await page.waitForFunction(previous => window.__acceptanceUploads.count >= previous + 4, count);
    }
    await send(values);
    await page.waitForFunction(sum => Number(document.querySelector('.aside .pressData')?.textContent) === sum, values.reduce((a, b) => a + b, 0));
    await send(Array(1024).fill(0)); await send(values);
    await send(Array(4096).fill(0)); await send(values);
    const uploads = await page.evaluate(() => window.__acceptanceUploads);
    await page.screenshot({ path: path.join(outputDir, 'packaged-replay.png') });
    assert.ok(uploads.count > 0, 'Must observe actual 64×64 GPU buffers');
    assert.equal(uploads.nonFinite, 0, 'Packaged renderer loses points after a short clear frame');
    assert.deepEqual(errors, [], 'Packaged page must not raise runtime errors');
    assert.deepEqual(failedResources, [], 'Packaged page assets must exist');
    return { scope: 'packaged-webpage-with-fixture-HTTP-and-WS', system: 'bed4096num', uploads, expectedTotal: values.reduce((a, b) => a + b, 0) };
  } catch (error) {
    await page?.screenshot({ path: path.join(outputDir, 'packaged-page-failure.png') }).catch(() => {});
    error.details = { errors, failedResources }; throw error;
  } finally {
    await browser?.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
