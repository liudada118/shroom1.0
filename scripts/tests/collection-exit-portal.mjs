import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-collection-exit-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, 'vite-cache'),
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false },
  plugins: [{ name: 'collection-exit-regression',
    /** 保留真实门户和Home，设备与授权请求全部由浏览器夹具接管。 */
    configureServer(vite) {
      vite.middlewares.use('/__collection-exit', async (_request, response) => {
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__collection-exit', '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}</style></head><body><div id="root"></div><script type="module" src="/tests/fixtures/portalLauncher.jsx"></script></body></html>'));
      });
    },
  }],
});

let browser, page, current = null, recent = null, revision = 0, failNextStop = false;
let serialConnected = false, sourceReady = false, failNextStart = false;
let playing = false, failNextPlaybackStop = false, holdNextPlaybackStop = false, pendingPlaybackStop;
let holdNextHistoryLoad = false, pendingHistoryLoad;
const sockets = new Set(), commands = [], errors = [];
const system = 'smallBedNoAlg';
const license = { date: Date.now() + 30 * 86400000, nowDate: Date.now(), selectFlag: 'all', valid: true };
const recordId = '1793085727651.0';
recent = { id: 'previous-day', phase: 'interrupted', reason: 'SERIAL_DISCONNECTED', result: 'saved',
  startedAt: Date.now() - 90000000, stoppedAt: Date.now() - 86400000, completedAt: Date.now() - 86400000,
  channels: { sit: { queued: 30732, committed: 30732, pending: 0, failed: 0 } } };

/** 广播低频采集回执，不连接真实后台或向真实串口发送命令。 */
function publish(payload) { for (const socket of sockets) socket.send(JSON.stringify(payload)); }

/** 模拟宿主对本次真实连接与有效帧的低频判定，前端不可根据串口名称推断就绪。 */
function sourceStatus() {
  return { systemId: system, connected: serialConnected, ready: serialConnected && sourceReady,
    code: !serialConnected ? 'COLLECTION_DEVICE_NOT_CONNECTED' : !sourceReady ? 'COLLECTION_DATA_NOT_READY' : null, timeoutMs: 5000 };
}

/** 保留独立的端口生命周期，使页面重进后能恢复真实连接状态。 */
function serialStatus() {
  return { role: 'sit', path: 'COM_COLLECTION_TEST', connectionId: 1, updatedAt: Date.now(),
    status: serialConnected ? 'open' : 'closed', isOpen: serialConnected };
}

/** 标记当前会话已经保存完成，模拟后台尾部写入结束的实际回执。 */
function finish(phase = 'completed', reason = 'USER_STOPPED') {
  recent = { ...current, phase, reason, result: 'saved', completedAt: Date.now(), stoppedAt: current.stoppedAt || Date.now(),
    channels: { sit: { queued: 12, committed: 12, pending: 0, failed: 0 } } };
  current = null; publish({ collectionSummary: recent });
}

/** 通过实际采集配置弹窗启动，不能直接改Home状态冒充采集成功。 */
async function startCollection() {
  await page.locator('.portal-session-bar [aria-label="开始采集"]').click();
  await page.getByRole('dialog').getByRole('button', { name: '开始采集', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="结束采集"]')?.textContent.includes('停止'));
}

/** 读取真实Home的计时展示，验证终态到达后秒表不会继续增加。 */
async function readElapsed() {
  return page.locator('.home').evaluate(element => {
    let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
    while (fiber && typeof fiber.stateNode?.preparePortalExit !== 'function') fiber = fiber.return;
    return fiber?.stateNode?.title.current?.state?.num;
  });
}

/** 等待夹具收到真实页面请求，超时保留命令序列供诊断。 */
async function waitUntil(predicate, description) {
  const deadline = Date.now() + 10000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`${description}: ${JSON.stringify(commands)}`);
    await page.waitForTimeout(25);
  }
}

/** 从真实回放弹窗选取记录；历史列表由隔离宿主广播。 */
async function selectPlayback() {
  publish({ timeArr: [{ date: recordId, info: recordId, name: recordId }] });
  await page.locator('.portal-session-bar').getByRole('button', { name: '回放', exact: true }).click();
  await page.getByRole('dialog').getByRole('radio').check();
  await page.getByRole('dialog').getByRole('button', { name: '载入回放', exact: true }).click();
}

/** 从系统列表重进，确认用户可见模式与播放器都回到实时初态。 */
async function reenterRealtime() {
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  assert.equal(await page.locator('.portal-session-bar').getByRole('button', { name: '实时', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.portal-session-bar').getByRole('button', { name: '回放', exact: true }).getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('.progressContent').isVisible(), false, '重进实时页不能保留播放进度条');
}

/** 返回正式命令的成功 ACK，仅模拟控制面，不冒充后端协议测试。 */
function acknowledge(route) {
  return route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' },
    json: { code: 0, data: { ok: true, data: { results: [] } } } });
}

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  await page.routeWebSocket(/:19999/, socket => {
    sockets.add(socket); socket.onClose(() => sockets.delete(socket));
    socket.send(JSON.stringify({ licenseKey: 'fixture-key' })); socket.send(JSON.stringify(license));
    socket.send(JSON.stringify({ currentSensorType: system, port: [{ path: 'COM_COLLECTION_TEST' }], collectionSummary: current || recent,
      collectionSourceStatus: sourceStatus() }));
  });
  await page.route('http://127.0.0.1:19245/**', route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/collection/status') return route.fulfill({ headers, json: { collectionSummary: current || recent, current, recent: recent ? [recent] : [], collectionSourceStatus: sourceStatus() } });
    if (path === '/api/serial/status') return route.fulfill({ headers, json: { serial: [serialStatus()] } });
    if (path === '/api/display-systems') return route.fulfill({ headers, json: { displaySystems: { runtimeDefinitions: [] } } });
    if (path === '/api/algorithm-market') return route.fulfill({ headers, json: { packages: [], instances: [] } });
    if (path === '/api/serial/protocol-detect') return route.fulfill({ headers, json: { code: 0, data: {
      status: 'matched', compatible: true, defaultBaudRate: 1000000,
      match: { id: 'standard-1024', protocol: { baudRate: 1000000 } },
      diagnostics: { attemptedBaudRates: [1000000] },
    } } });
    if (path !== '/api/commands') return route.fulfill({ headers, json: {} });
    const command = route.request().postDataJSON(); commands.push(command);
    if (command.type === 'serial.open') {
      serialConnected = true;
      publish({ serialStatus: serialStatus(), collectionSourceStatus: sourceStatus() });
      return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { serial: [serialStatus()] } } } });
    }
    if (command.type === 'sensor.switch' && current) return route.fulfill({ status: 409, headers,
      json: { code: 409, message: '请先停止采集，再切换系统。' } });
    if (command.type === 'sensor.switch') playing = false;
    if (command.type === 'history.load') {
      if (holdNextHistoryLoad) { holdNextHistoryLoad = false; pendingHistoryLoad = route; return; }
      publish({ length: 9, historyTimeArr: Array.from({ length: 10 }, (_, index) => Number(recordId) + index * 100) });
    }
    if (command.type === 'playback.control') {
      if (command.payload.play === false && command.payload.history === false) {
        if (failNextPlaybackStop) {
          failNextPlaybackStop = false;
          return route.fulfill({ status: 503, headers, json: { code: 503, message: '测试回放停止失败，请重试' } });
        }
        if (holdNextPlaybackStop) { holdNextPlaybackStop = false; pendingPlaybackStop = route; return; }
      }
      if (command.payload.play != null) playing = command.payload.play;
    }
    if (command.type === 'collection.control') {
      if (command.payload.active) {
        if (failNextStart) {
          failNextStart = false;
          return route.fulfill({ status: 409, headers, json: { code: 409, data: { ok: false,
            code: 'COLLECTION_DATA_NOT_READY', message: '尚未收到有效传感器数据，请等待数据后再开始采集。' } } });
        }
        current = { id: `collection-${++revision}`, phase: 'collecting', result: 'pending', startedAt: Date.now(), stoppedAt: null,
          channels: { sit: { queued: 12, committed: 10, pending: 2, failed: 0 } } };
      } else if (failNextStop) {
        failNextStop = false;
        return route.fulfill({ status: 503, headers, json: { code: 503, message: '测试停止失败，请重试' } });
      } else if (current) current = { ...current, phase: 'finalizing', stoppedAt: Date.now() };
      if (current) publish({ collectionSummary: current });
    }
    const results = command.type === 'license.activate' ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [];
    return route.fulfill({ headers, json: { code: 0, data: { ok: true, data: { results } } } });
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__collection-exit?actual-monitor=1`);
  await page.getByRole('button', { name: /康养监测/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.locator(`[data-system="${system}"]`).click();
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  const notice = page.getByRole('alert').filter({ hasText: '采集已中断，已接收的数据保存完成' });
  assert.equal(await notice.count(), 0, '昨天已保存的回执不能在进入页面时重弹');
  const startButton = page.getByRole('button', { name: '开始采集', exact: true });
  assert.equal(await startButton.isDisabled(), true, '未连接设备不能开始');
  assert.match(await startButton.getAttribute('title'), /先连接传感器/);
  await page.locator('.portal-device-port-fields .ant-select').first().click();
  await page.locator('.ant-select-item-option').filter({ hasText: 'COM_COLLECTION_TEST' }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="开始采集"]')?.title.includes('有效传感器数据'));
  assert.equal(await startButton.isDisabled(), true, '端口已打开但没有有效帧仍不能开始');
  sourceReady = true; publish({ collectionSourceStatus: sourceStatus() });
  await page.waitForFunction(() => !document.querySelector('[aria-label="开始采集"]')?.disabled);
  const elapsedBeforeRejectedStart = await readElapsed();
  failNextStart = true;
  await startButton.click();
  await page.getByRole('dialog').getByRole('button', { name: '开始采集', exact: true }).click();
  await page.getByText('尚未收到有效传感器数据，请等待数据后再开始采集。', { exact: true }).waitFor();
  assert.equal(current, null, '后台拒绝不能创建采集');
  assert.equal(await readElapsed(), elapsedBeforeRejectedStart, '后台拒绝不能开始计时');
  await page.getByRole('dialog').getByRole('button', { name: /取\s*消/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await startCollection();
  await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.portal-monitor-navigation button')?.textContent.includes('正在结束采集'));
  await page.waitForTimeout(6500);
  assert.equal(current?.phase, 'finalizing');
  await page.getByRole('alert').filter({ hasText: '正在保存尾部数据' }).waitFor();
  assert.equal(await page.locator('.portal-runtime-monitor').count(), 1, '尾部未保存时不能先卸载监测页');
  assert.equal(commands.filter(command => command.type === 'collection.control' && !command.payload.active).length, 1);
  await page.screenshot({ path: join(artifacts, 'waiting-for-storage.png') });
  finish();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  assert.equal(commands.filter(command => command.type === 'serial.close').length, 0, '重进页面不能主动断开串口');

  await startCollection();
  failNextStop = true;
  await page.getByRole('button', { name: '退出监测返回系统列表', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '测试停止失败' }).waitFor();
  assert.equal(await page.locator('#portal-monitor-content').evaluate(element => element.inert), false);
  await page.getByRole('button', { name: '关闭退出错误提示', exact: true }).click();
  serialConnected = false; sourceReady = false;
  publish({ serialStatus: serialStatus(), collectionSourceStatus: sourceStatus() });
  finish('interrupted', 'SERIAL_DISCONNECTED');
  await page.waitForFunction(() => document.querySelector('[aria-label="结束采集"]')?.disabled);
  const stoppedAt = await readElapsed();
  assert.equal(typeof stoppedAt, 'number');
  await page.waitForTimeout(1150);
  assert.equal(await readElapsed(), stoppedAt, '串口中断回执必须冻结计时');
  await page.screenshot({ path: join(artifacts, 'serial-disconnected.png') });
  await notice.locator('.ant-alert-close-icon').click();
  await notice.waitFor({ state: 'hidden' });
  publish({ collectionSummary: recent });
  await page.waitForTimeout(100);
  assert.equal(await notice.count(), 0, '关闭后相同回执不得重新弹出');
  await page.getByRole('button', { name: '退出监测返回系统列表', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  assert.equal(await notice.count(), 0, '手动关闭的回执重新进入后不能重弹');
  assert.equal(await page.getByRole('button', { name: '开始采集', exact: true }).isDisabled(), true);
  serialConnected = true; sourceReady = true;
  publish({ serialStatus: serialStatus(), collectionSourceStatus: sourceStatus() });
  await startCollection();
  sourceReady = false; publish({ collectionSourceStatus: sourceStatus() });
  finish('interrupted', 'DATA_STREAM_TIMEOUT');
  await page.getByRole('alert').filter({ hasText: '数据中断，采集已停止，已收到的数据保存完成' }).waitFor();
  assert.equal(await page.getByRole('button', { name: '开始采集', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: '结束采集', exact: true }).isDisabled(), true);
  sourceReady = true; publish({ collectionSourceStatus: sourceStatus() });
  await page.waitForFunction(() => !document.querySelector('[aria-label="开始采集"]')?.disabled);
  assert.equal(current, null, '数据恢复后不自动重开采集');
  const timeoutNotice = page.getByRole('alert').filter({ hasText: '数据中断，采集已停止，已收到的数据保存完成' });
  await timeoutNotice.waitFor({ state: 'hidden', timeout: 8000 });
  publish({ collectionSummary: recent });
  await page.waitForTimeout(100);
  assert.equal(await timeoutNotice.count(), 0, '保存完成提示自动收起后重复广播不能重新展示');

  recent = { ...recent, id: 'partial-result', phase: 'save_error', result: 'partial', completedAt: Date.now(),
    channels: { sit: { queued: 12, committed: 10, pending: 0, failed: 2 } } };
  publish({ collectionSummary: recent });
  const failureNotice = page.getByRole('alert').filter({ hasText: '仅部分保存' });
  await failureNotice.waitFor();
  await page.waitForTimeout(6500);
  assert.equal(await failureNotice.count(), 1, '保存失败不能按成功提示的期限自动消失');
  await failureNotice.locator('.ant-alert-close-icon').click();
  await failureNotice.waitFor({ state: 'hidden' });
  await page.reload();
  await page.getByRole('button', { name: /康养监测/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.locator(`[data-system="${system}"]`).click();
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  assert.equal(await failureNotice.count(), 0, '刷新页面后也保留手动关闭状态');

  publish({ timeArr: [{ date: recordId, info: recordId, name: recordId }] });
  await page.locator('.portal-session-bar').getByRole('button', { name: '回放', exact: true }).click();
  const playbackDialog = page.getByRole('dialog');
  await playbackDialog.locator('.portal-playback-record strong').waitFor();
  const recordLabel = await playbackDialog.locator('.portal-playback-record strong').innerText();
  assert.match(recordLabel, /^2026-10-27 \d{2}:\d{2}:\d{2}$/);
  assert.equal(await playbackDialog.locator('.portal-playback-record small').count(), 0, '日期下方不再重复显示裸时间戳');
  await playbackDialog.getByRole('radio').check();
  await playbackDialog.getByRole('checkbox').check();
  await page.screenshot({ path: join(artifacts, 'playback-readable-date.png') });
  const loadRequest = page.waitForRequest(request => request.url().endsWith('/api/commands')
    && request.method() === 'POST' && request.postDataJSON()?.type === 'history.load');
  await playbackDialog.getByRole('button', { name: '载入回放', exact: true }).click();
  assert.equal((await loadRequest).postDataJSON().payload.date, recordId, '日期标签格式化后回放仍发送原始记录ID');
  await waitUntil(() => playing, '载入记录必须明确发出播放命令');
  await playbackDialog.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.portal-session-bar').getByRole('button', { name: '回放', exact: true }).getAttribute('aria-pressed'), 'true');
  holdNextPlaybackStop = true;
  await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
  await waitUntil(() => pendingPlaybackStop, '返回按钮必须停止回放并等待 ACK');
  assert.equal(await page.locator('.portal-runtime-monitor').count(), 1, '停止回放尚未确认时不可先离开页面');
  playing = false;
  await acknowledge(pendingPlaybackStop); pendingPlaybackStop = null;
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await reenterRealtime();
  await page.screenshot({ path: join(artifacts, 'playback-return-realtime.png') });

  await selectPlayback();
  await waitUntil(() => playing, '第二次显式载入仍可播放');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.locator('.playContent img:visible').click();
  await waitUntil(() => !playing, '播放器暂停应停止后台播放');
  failNextPlaybackStop = true;
  await page.getByRole('button', { name: '退出监测返回系统列表', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '测试回放停止失败' }).waitFor();
  assert.equal(await page.locator('#portal-monitor-content').evaluate(element => element.inert), false, '退出失败应恢复页面交互');
  assert.equal(await page.locator('.portal-session-bar').getByRole('button', { name: '回放', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '退出监测返回系统列表', exact: true }).click();
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await reenterRealtime();

  holdNextHistoryLoad = true;
  await selectPlayback();
  await waitUntil(() => pendingHistoryLoad, '应停在历史载入 ACK 前');
  const lateStartIndex = commands.length;
  // 弹窗遮罩下无法鼠标点导航；派发真实按钮事件验证已发请求与退出竞争，不直接修改React状态。
  await page.getByRole('button', { name: '← 返回系统列表', exact: true }).evaluate(button => button.click());
  await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
  await acknowledge(pendingHistoryLoad); pendingHistoryLoad = null;
  await page.waitForTimeout(250);
  assert.equal(commands.slice(lateStartIndex).some(command => command.type === 'playback.control' && command.payload.play === true), false,
    '退出后的迟到载入 ACK 不能重新启动回放');
  await reenterRealtime();
  assert.deepEqual(errors, []);
  const report = { artifacts, commands: commands.map(command => ({ type: command.type, payload: command.payload })), stoppedAt,
    receipts: ['stale-hidden', 'finalizing-retained', 'dismiss-remount', 'saved-auto-hide', 'partial-retained', 'dismiss-reload'],
    playbackExit: ['playing-back-waits-ack', 'same-system-reenter-realtime', 'paused-close-failure-retry', 'late-load-no-restart'], recordId, recordLabel };
  await writeFile(join(artifacts, 'report.json'), JSON.stringify(report, null, 2));
  console.log('COLLECTION_EXIT_PORTAL_PASS', JSON.stringify({ artifacts, commands: commands.map(command => command.type), stoppedAt,
    receipts: report.receipts, playbackExit: report.playbackExit, recordId, recordLabel }));
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  await writeFile(join(artifacts, 'failure.json'), JSON.stringify({ error: error.message, errors,
    commands: commands.map(command => ({ type: command.type, payload: command.payload })), playing,
    pendingHistoryLoad: Boolean(pendingHistoryLoad), pendingPlaybackStop: Boolean(pendingPlaybackStop) }, null, 2));
  console.error('COLLECTION_EXIT_PORTAL_FAILED', JSON.stringify({ artifacts, errors })); throw error;
} finally { await browser?.close(); await server.close(); }
