// 使用项目Electron的Node ABI运行：ELECTRON_RUN_AS_NODE=1 electron scripts/tests/playback-restart-portal.mjs。
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const Database = require('better-sqlite3');
const { ensureChannelHistorySchema } = require('../../backend/kernel/storage/dbManager');
const { createServerHistoryLoader } = require('../../backend/tests/fixtures/serverHistoryLoader.cjs');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-playback-restart-'));
const systemId = 'smallBedNoAlg', recordId = '1793932800000';
const sockets = new Set(), commands = [], errors = [];
const db = ensureChannelHistorySchema(new Database(':memory:'));
for (let index = 0; index < 4; index++) db.prepare('INSERT INTO matrix(data,timestamp,date) VALUES (?,?,?)')
  .run(JSON.stringify(Array(1024).fill(20 + index)), Number(recordId) + index * 50, recordId);
let now = 0, timerId = 0, frameSequence = 0;
const timers = new Map();

/** 发布真实后端加载/播放回执，仅传输层替换为浏览器隔离WS。 */
function publish(event) { for (const socket of sockets) socket.send(JSON.stringify(event)); }

const loader = createServerHistoryLoader({ sit: db }, systemId, {
  now: () => now,
  schedule: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, due: now + delay }); return id; },
  cancel: id => timers.delete(id),
}, { event: publish,
  /** 后端真实取帧位置经标准帧送到Home，不直接改变播放器状态。 */
  frame: index => {
    publish({ index });
    publish({ type: 'sensor.frame', schemaVersion: 1, source: 'playback', displaySystemId: systemId, sensorType: systemId,
      channelId: `${systemId}:sit`, sensorId: 'sit', outputChannel: 'sit', sequence: ++frameSequence,
      timestamp: Number(recordId) + index * 50, quality: 'good',
      payload: { value: Array(1024).fill(20 + index), matrix: { rows: 32, cols: 32, total: 1024 } } });
  } });

/** 推进宿主时钟，执行生产定时器而非手工伪造“结束”事件。 */
function advance(milliseconds) {
  now += milliseconds;
  for (const [id, timer] of [...timers]) if (timer.due <= now) { timers.delete(id); timer.callback(); }
}

const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, '.vite'), logLevel: 'error', server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'playback-restart-regression',
    /** 挂载完整门户及Home；不插入任何播放状态修正。 */
    configureServer(vite) {
      vite.middlewares.use('/__playback-restart', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__playback-restart', '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    } }],
});
let browser, page;

/** 断言实际播放/暂停图标，与后台真实运行状态一致。 */
async function expectPlaying(playing) {
  await page.waitForFunction(expected => {
    const images = [...document.querySelectorAll('.playContent > img')];
    return images.length === 2 && getComputedStyle(images[expected ? 1 : 0]).display !== 'none'
      && getComputedStyle(images[expected ? 0 : 1]).display === 'none';
  }, playing);
  assert.equal(loader.timer.isPlaying(), playing);
}

/** 点击真实按钮并等待命令抵达，避免只看到前端乐观更新就继续。 */
async function toggle() {
  const previous = commands.filter(command => command.type === 'playback.control').length;
  await page.locator('.playContent > img:visible').click();
  const deadline = Date.now() + 10000;
  while (commands.filter(command => command.type === 'playback.control').length <= previous) {
    if (Date.now() > deadline) throw new Error('播放按钮没有发出控制命令');
    await page.waitForTimeout(20);
  }
}

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1470, height: 834 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
  const license = { valid: true, selectFlag: 'all', date: Date.now() + 30 * 86400000, nowDate: Date.now() };
  await page.routeWebSocket(/:19999/, socket => {
    sockets.add(socket); socket.onClose(() => sockets.delete(socket));
    socket.send(JSON.stringify({ licenseKey: 'fixture-key', ...license }));
  });
  await page.route('http://127.0.0.1:19245/**', async route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/collection/status') return route.fulfill({ headers, json: { current: null, collectionSummary: null, recent: [] } });
    if (path === '/api/display-systems') return route.fulfill({ headers, json: { displaySystems: { runtimeDefinitions: [] } } });
    if (path === '/api/algorithm-market') return route.fulfill({ headers, json: { packages: [], instances: [] } });
    if (path !== '/api/commands') return route.fulfill({ headers, json: {} });
    const command = route.request().postDataJSON(); commands.push(command);
    if (command.type === 'history.load') loader.load(command.payload.date);
    if (command.type === 'playback.control') {
      const payload = command.payload;
      if (payload.value != null) loader.state.set('nowIndex', payload.value);
      if (payload.play === true) loader.start();
      if (payload.play === false || payload.history === false) loader.stop();
    }
    const results = command.type === 'license.activate' ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [];
    return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { results } } } });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__playback-restart?actual-monitor=1`);
  await page.getByRole('button', { name: /具身触觉/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.locator(`[data-system="${systemId}"]`).click();
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  publish({ timeArr: [{ date: recordId, info: recordId, name: recordId }] });
  await page.locator('.portal-session-bar').getByRole('button', { name: '回放', exact: true }).click();
  await page.getByRole('dialog').getByRole('radio').check();
  await page.getByRole('dialog').getByRole('button', { name: '载入回放', exact: true }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await expectPlaying(true);
  advance(150); await expectPlaying(false);
  assert.equal(loader.state.get('nowIndex'), 3);
  await toggle(); await expectPlaying(true);
  assert.equal(loader.frames.at(-1), 0, '首次播完后点击播放立即回到首帧');
  advance(50); assert.equal(loader.state.get('nowIndex'), 1);
  await toggle(); await expectPlaying(false);
  advance(1000); assert.equal(loader.state.get('nowIndex'), 1);
  await toggle(); await expectPlaying(true);
  advance(50); assert.equal(loader.state.get('nowIndex'), 2);
  advance(50); await expectPlaying(false);
  await toggle(); await expectPlaying(true);
  assert.equal(loader.frames.at(-1), 0, '第二轮播完仍可重新播放');
  const latestStatus = loader.events.filter(event => event.playbackStatus).at(-1).playbackStatus;
  publish({ playbackStatus: { ...latestStatus, playing: false, sequence: latestStatus.sequence - 1 } });
  await page.waitForTimeout(100); await expectPlaying(true);
  await page.screenshot({ path: join(artifacts, 'restarted-playing.png') });
  advance(150); await expectPlaying(false);
  await page.screenshot({ path: join(artifacts, 'completed-ready-to-replay.png') });
  assert.deepEqual(errors, []);
  await writeFile(join(artifacts, 'report.json'), JSON.stringify({ commands, frames: loader.frames, events: loader.events,
    scenarios: ['complete-replay', 'pause-resume', 'complete-again-replay', 'stale-stop-ignored'], actualDevice: false }, null, 2));
  console.log('PLAYBACK_RESTART_PORTAL_PASS', JSON.stringify({ artifacts, frames: loader.frames }));
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('PLAYBACK_RESTART_PORTAL_FAILED', artifacts);
  throw error;
} finally {
  loader.stop(); await browser?.close(); await server.close(); db.close();
}
