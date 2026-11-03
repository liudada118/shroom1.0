import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const outputDir = await mkdtemp(join(tmpdir(), 'shroom-serial-detection-portal-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, open: false, hmr: false } });
const events = [], pageErrors = [], screenshots = [], cancelledRequests = [];
let browser, page, activeConnection = null, connectionSequence = 0, frameSequence = 0;
let delayNextStatus = false, delayedStatusRoute;
let initialSerialStatusDelivered = false;
let includeSerialDefaults = false;
let activeSystem = 'fast256';
const defaultBaudRates = { fast256: 921600, bed4096: 3000000, bed4096num: 3000000, smallBed12B: 1500000 };
const pendingProbes = new Map(), frameTimers = new Set();
const ports = Array.from({ length: 10 }, (_, index) => `COM${81 + index}`);
const sockets = new Set();
const license = { valid: true, selectFlag: 'all', date: Date.now() + 30 * 86400000, nowDate: Date.now() };
const readingNoticeText = '串口已连接，正在等待有效数据…';
const openingNoticeText = '正在连接…';

/** 返回仅供界面验收的已识别结果；真实硬件字节识别另由后端测试覆盖。 */
function detection(path) {
  if (path === 'COM83') return { status: 'unknown', reason: 'insufficient-data', compatible: false, diagnostics: { attemptedBaudRates: [921600, 1000000, 1500000, 3000000, 6000000] } };
  if (path === 'COM86') return { status: 'ambiguous', compatible: false, candidates: [
    { id: 'matrix-256', label: '256点', protocol: { baudRate: 921600 } },
    { id: 'glove-segmented', label: '手套分包', protocol: { baudRate: 921600 } },
  ] };
  return { status: 'matched', compatible: path !== 'COM84', defaultBaudRate: 921600,
    match: { id: path === 'COM84' ? 'standard-1024' : 'glove-segmented', protocol: { baudRate: path === 'COM82' ? 1000000 : 921600 } },
    diagnostics: { attemptedBaudRates: path === 'COM82' ? [921600, 1000000] : [921600] } };
}

/** 广播实际页面能够消费的状态与规范帧，不调用组件内部方法。 */
function publish(payload) { for (const socket of sockets) socket.send(JSON.stringify(payload)); }

/** 模拟宿主按当前物理连接统计的有效帧；打开串口本身不意味着已经读到数据。 */
function collectionStatus() {
  return { current: null, collectionSummary: null, recent: [],
    collectionSourceStatus: { systemId: activeSystem, connected: activeConnection?.isOpen === true,
      ready: activeConnection?.ready === true, timeoutMs: 5000 },
    serialDataStatus: activeConnection ? [{ ...activeConnection, detectionSupported: true,
      lastFrameAgeMs: activeConnection.ready ? 0 : null }] : [] };
}

/** 发送256点真实规范压力帧，并把有效帧证据归属到同一个连接代次。 */
function sendValidFrame(connection, value = 17) {
  if (activeConnection !== connection || !connection.isOpen) return;
  connection.ready = true;
  const values = new Array(256).fill(value);
  publish({ type: 'sensor.frame', schemaVersion: 1, displaySystemId: 'fast256', sensorType: 'fast256',
    sensorId: 'sit', channelId: 'fast256:sit', outputChannel: 'sit', source: 'realtime',
    sequence: ++frameSequence, timestamp: Date.now(), quality: 'good',
    serial: { role: 'sit', path: connection.path, connectionId: connection.connectionId, baudRate: connection.baudRate },
    payload: { value: values, stages: { decoded: values, normalized: values, processed: values },
      matrix: { rows: 16, cols: 16, total: 256 } } });
  publish({ collectionSourceStatus: collectionStatus().collectionSourceStatus });
  events.push({ type: 'valid-frame', path: connection.path, connectionId: connection.connectionId, total: value * 256 });
}

/** 成功连接稍后才产生数据，避免把打开ACK当作有效传感器帧。 */
function scheduleFrame(connection, value) {
  const timer = setTimeout(() => { frameTimers.delete(timer); sendValidFrame(connection, value); }, 60);
  frameTimers.add(timer);
}

/** 只读侧栏结果，确认规范帧经过真实Home统计链路。 */
async function expectPressure(total) {
  await page.waitForFunction(expected => Number(document.querySelector('.aside .pressData')?.textContent) === expected, total);
}

/** 读取当前通道的已确认连接状态，供页面初始化与轮询共用。 */
function serialStatus() {
  return activeConnection ? [{ ...activeConnection, status: activeConnection.isOpen ? 'open' : 'closed', updatedAt: Date.now() }] : [];
}

/** 模拟宿主按真实当前系统返回默认参数，不能沿用上一系统的输入草稿。 */
function serialDefaults() {
  return { systemId: activeSystem, sensorType: activeSystem, baudRate: defaultBaudRates[activeSystem] };
}

/** 等待真正输入框展示宿主默认值或已提交草稿。 */
async function expectBaudRate(value) {
  await page.waitForFunction(expected => document.querySelector('input[aria-label="波特率"]')?.value === String(expected), value);
}

/** 清空并提交输入，显式恢复当前系统默认后再开始独立连接场景。 */
async function restoreDefaultBaudRate() {
  const input = page.getByRole('textbox', { name: '波特率', exact: true });
  await input.fill(''); await input.press('Enter'); await input.press('Tab');
  await expectBaudRate(defaultBaudRates[activeSystem]);
}

/** 统计单端口业务打开请求，与临时识别明确分开。 */
function opens(path) { return events.filter(event => event.type === 'serial.open' && event.payload.path === path); }

/** 在进入下一个场景前等待选择器恢复，保证前一次读取观察已经结束。 */
async function waitSelectionReady() {
  await page.waitForFunction(() => !document.querySelector('.portal-device-port-fields .ant-select')?.classList.contains('ant-select-disabled'));
}

/** 按测试场景标记DOM观察窗口，捕获短暂提示而不修改生产组件状态。 */
async function watchReadingNotice(phase, text = readingNoticeText) {
  await page.evaluate(value => {
    window.__serialNoticeWatch.phase = value.phase;
    window.__serialNoticeWatch.text = value.text;
    window.__serialNoticeWatch.startedAt = performance.now();
  }, { phase, text });
}

/** 读取当前场景曾实际显示的等待提示，不能仅用最终截图判断是否闪过。 */
async function readingNoticeObservations(phase) {
  return page.evaluate(value => window.__serialNoticeWatch.observations.filter(item => item.phase === value), phase);
}

/** 经真正的下拉控件选择端口，禁止调用 React 内部方法。 */
async function choosePort(path) {
  await page.getByRole('combobox', { name: '请选择传感器', exact: true })
    .locator('xpath=ancestor::div[contains(@class,"ant-select-selector")]').click();
  await page.locator('.ant-select-item-option').filter({ hasText: path }).click();
}

/** 等待夹具观察到指定命令，失败时带上已经发出的请求序列。 */
async function waitEvent(predicate, description) {
  const deadline = Date.now() + 10000;
  while (!events.some(predicate)) {
    if (Date.now() > deadline) throw new Error(`${description}: ${JSON.stringify(events)}`);
    await page.waitForTimeout(50);
  }
}

/** 保存各结果弹窗，便于人工核对读数、按钮和布局。 */
async function screenshot(name) {
  const filename = join(outputDir, `${name}.png`);
  if (await page.getByRole('dialog').count()) {
    await page.waitForFunction(() => {
      const dialog = [...document.querySelectorAll('[role="dialog"]')].find(element => element.getBoundingClientRect().width > 0);
      if (!dialog || dialog.getBoundingClientRect().width < 480) return false;
      for (let node = dialog; node; node = node.parentElement) {
        if (Number.parseFloat(getComputedStyle(node).opacity) < 0.99) return false;
      }
      return true;
    });
  }
  await page.screenshot({ path: filename, animations: 'disabled' }); screenshots.push(filename);
}

try {
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(25000);
  await page.addInitScript(text => {
    window.__serialNoticeWatch = { phase: 'first-entry-fast-opening', text: '正在连接…', startedAt: performance.now(), observations: [] };
    /** 父节点的入场透明度也参与判断，避免将尚未交接的隐藏页面计为闪现。 */
    const visible = node => {
      if (!node.getClientRects().length) return false;
      for (let element = node; element; element = element.parentElement) {
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none' || Number.parseFloat(style.opacity) < .05) return false;
      }
      return true;
    };
    /** 观察真实DOM出现及可见性；快速完成后已消失的提示仍会被保留。 */
    const observeNotice = () => {
      const watch = window.__serialNoticeWatch;
      if (!watch.phase || watch.observations.some(item => item.phase === watch.phase)) return;
      const node = [...document.querySelectorAll('.serial-connection-status *')]
        .find(element => element.textContent.includes(watch.text || text) && visible(element));
      if (node) watch.observations.push({ phase: watch.phase, elapsedMs: performance.now() - watch.startedAt, text: watch.text || text });
    };
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(observeNotice).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
      observeNotice();
    }, { once: true });
  }, readingNoticeText);
  page.on('request', request => {
    if (request.url().includes('/src/page/home/Home.jsx')) events.push({ type: 'home-module-request', at: Date.now() });
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => {
    if (request.url().endsWith('/api/serial/protocol-detect')) cancelledRequests.push(request.postDataJSON()?.path);
  });
  await page.routeWebSocket('**/*', socket => {
    const url = new URL(socket.url());
    if (url.hostname !== '127.0.0.1' || url.port !== '19999') { socket.close({ code: 1008, reason: 'isolated fixture' }); return; }
    sockets.add(socket); socket.onClose(() => sockets.delete(socket));
    socket.send(JSON.stringify({ licenseKey: 'acceptance-fixture', ...license, currentSensorType: activeSystem, port: ports.map(path => ({ path })) }));
  });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    if (url.origin !== 'http://127.0.0.1:19245') return route.abort('blockedbyclient');
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    let json = {};
    if (url.pathname === '/api/collection/status') {
      json = collectionStatus();
      events.push({ type: 'read-status', path: activeConnection?.path, connectionId: activeConnection?.connectionId,
        ready: activeConnection?.ready === true, at: Date.now() });
      if (delayNextStatus && activeConnection?.path === 'COM85') {
        delayNextStatus = false;
        delayedStatusRoute = route;
        events.push({ type: 'delayed-status', path: activeConnection.path });
        return;
      }
    }
    else if (url.pathname === '/api/serial/status') {
      if (!initialSerialStatusDelivered) {
        initialSerialStatusDelivered = true;
        const opening = { role: 'sit', path: 'COM_ENTRY', status: 'opening', isOpen: false, connectionId: 'entry-initial', updatedAt: Date.now() };
        json = { code: 0, data: { serial: [opening] } };
        events.push({ type: 'initial-opening-status' });
        const timer = setTimeout(() => {
          frameTimers.delete(timer);
          if (!activeConnection) publish({ serialStatus: { ...opening, status: 'closed', updatedAt: Date.now() } });
        }, 80);
        frameTimers.add(timer);
      } else json = { code: 0, data: { serial: serialStatus(),
        ...(includeSerialDefaults ? { defaults: serialDefaults() } : {}) } };
    }
    else if (url.pathname === '/api/display-systems') json = { displaySystems: { runtimeDefinitions: [] } };
    else if (url.pathname === '/api/algorithm-market') json = { packages: [], instances: [] };
    else if (url.pathname === '/api/serial/protocol-detect') {
      const input = route.request().postDataJSON(); events.push({ type: 'probe', ...input });
      assert.deepEqual(input.connection, { sensorType: 'fast256', role: 'sit', connectionId: activeConnection?.connectionId });
      assert.equal(activeConnection?.path, input.path);
      assert.equal(activeConnection?.isOpen, true, '探测应由后台接管仍然打开的默认连接');
      assert.ok(Date.now() - activeConnection.openedAt >= 1900, '必须先给默认连接完整的数据观察窗口');
      if (input.path === 'COM89') {
        sendValidFrame(activeConnection, 29);
        json = { code: 0, data: { status: 'reading' } };
        await route.fulfill({ headers, json });
        return;
      }
      activeConnection.isOpen = false;
      events.push({ type: 'fallback-close', path: input.path, connectionId: input.connection.connectionId });
      publish({ serialStatus: serialStatus()[0] });
      if (['COM87', 'COM88'].includes(input.path)) {
        pendingProbes.set(input.path, route);
        return;
      }
      json = { code: 0, data: detection(input.path) };
    } else if (url.pathname === '/api/commands') {
      const command = route.request().postDataJSON(); events.push(command);
      let data = { results: command.type === 'license.activate' ? [{ name: 'license-activation', activationCode: 'OK', payload: license }] : [] };
      if (command.type === 'sensor.switch') {
        activeSystem = command.payload.sensorType;
        activeConnection = null;
        publish({ currentSensorType: activeSystem });
      }
      if (command.type === 'serial.refresh') {
        for (const socket of sockets) socket.send(JSON.stringify({ port: ports.map(path => ({ path })) }));
      }
      if (command.type === 'serial.open') {
        activeConnection = { ...command.payload, baudRate: command.payload.baudRate ?? defaultBaudRates[activeSystem],
          isOpen: true, ready: false, connectionId: ++connectionSequence, openedAt: Date.now() };
        data.serial = serialStatus();
        publish({ serialStatus: data.serial[0], collectionSourceStatus: collectionStatus().collectionSourceStatus });
        if (command.payload.path === 'COM81' || (command.payload.path === 'COM82' && command.payload.baudRate === 1000000)) {
          scheduleFrame(activeConnection, command.payload.path === 'COM81' ? 17 : 23);
        }
      }
      if (command.type === 'serial.close') {
        if (activeConnection) { activeConnection.isOpen = false; activeConnection.ready = false; }
        data.serial = (command.payload.roles || []).map(role => ({ role, status: 'closed', isOpen: false, updatedAt: Date.now() }));
      }
      json = { code: 0, data: { ok: true, data } };
    }
    await route.fulfill({ headers, json });
  });
  await page.goto(origin);
  await page.getByRole('button', { name: /定制系统/ }).click();
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.locator('[data-system="fast256"]').click();
  await waitEvent(event => event.type === 'home-module-request', '打开系统列表应提前加载Home模块');
  assert.equal(events.some(event => ['sensor.switch', 'serial.open', 'collection.control'].includes(event.type)), false,
    '预加载模块不能提前切系统、连接设备或采集');
  events.push({ type: 'enter-click', at: Date.now() });
  await page.getByRole('button', { name: /^进入(?:该)?系统$/, exact: true }).click();
  await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
  await expectBaudRate(921600);
  assert.equal(await page.getByRole('textbox', { name: '波特率', exact: true }).getAttribute('placeholder'), null,
    '旧宿主缺少defaults时默认数字也应写入input.value，不使用占位文字');
  assert.equal(events.some(event => event.type === 'serial.open'), false, '显示默认数字不能自行连接设备');
  events.push({ type: 'checked-legacy-host-default-value', system: 'fast256', baudRate: 921600 });
  includeSerialDefaults = true;
  assert.equal(await page.getByText(/默认连接，无数据时识别[·：:]|921600\s*\/\s*1000000\s*\/\s*1500000/).count(), 0,
    '右侧不再显示冗长的固定波特率说明');
  await waitEvent(event => event.type === 'initial-opening-status', '首次进入应读取宿主串口状态');
  assert.deepEqual(await readingNoticeObservations('first-entry-fast-opening'), [], '首次进入的短暂opening状态不应闪现');

  await watchReadingNotice('short-opening-visible-page', openingNoticeText);
  publish({ serialStatus: { role: 'sit', path: 'COM_ENTRY', status: 'opening', isOpen: false, connectionId: 'entry-short', updatedAt: Date.now() } });
  await page.waitForTimeout(150);
  assert.deepEqual(await readingNoticeObservations('short-opening-visible-page'), [], '已进入页面的短暂连接状态也不能立即显示');
  publish({ serialStatus: { role: 'sit', path: 'COM_ENTRY', status: 'closed', isOpen: false, connectionId: 'entry-short', updatedAt: Date.now() } });
  await page.waitForTimeout(2200);
  assert.deepEqual(await readingNoticeObservations('short-opening-visible-page'), [], 'opening结束后不得迟到显示');

  await watchReadingNotice('long-opening', openingNoticeText);
  publish({ serialStatus: { role: 'sit', path: 'COM_ENTRY', status: 'opening', isOpen: false, connectionId: 'entry-long', updatedAt: Date.now() } });
  await page.waitForTimeout(1100);
  assert.deepEqual(await readingNoticeObservations('long-opening'), [], '持续opening未满两秒仍应隐藏');
  await page.locator('.serial-connection-status').getByText(/COM_ENTRY.*正在连接/).waitFor();
  const openingObservations = await readingNoticeObservations('long-opening');
  assert.equal(openingObservations.length, 1);
  assert.ok(openingObservations[0].elapsedMs >= 1900, '持续opening超过两秒才显示');
  const normalBorder = await page.locator('.serial-connection-status').evaluate(node => getComputedStyle(node).borderTopColor);
  assert.notEqual(normalBorder, 'rgb(115, 84, 81)', '正常连接提示不应使用原先偏红的边框');
  publish({ serialStatus: { role: 'sit', path: 'COM_ENTRY', status: 'closed', isOpen: false, connectionId: 'entry-long', updatedAt: Date.now() } });
  await page.locator('.serial-connection-status').getByText(/COM_ENTRY.*正在连接/).waitFor({ state: 'hidden' });

  await watchReadingNotice('real-error-immediate', '测试串口故障');
  publish({ serialStatus: { role: 'sit', path: 'COM_ENTRY', status: 'error', isOpen: false,
    connectionId: 'entry-error', updatedAt: Date.now(), error: { code: 'TEST_SERIAL_ERROR', message: '测试串口故障', stage: 'open' } } });
  await page.locator('.serial-connection-status').getByText(/测试串口故障/).waitFor();
  const errorObservations = await readingNoticeObservations('real-error-immediate');
  assert.equal(errorObservations.length, 1);
  assert.ok(errorObservations[0].elapsedMs < 1500, '真实错误不得应用两秒等待延迟');
  const errorBorder = await page.locator('.serial-connection-status').evaluate(node => getComputedStyle(node).borderTopColor);
  assert.notEqual(errorBorder, normalBorder, '真实故障应有独立错误边框');
  await screenshot('serial-error-immediate');
  publish({ serialStatus: { role: 'sit', path: 'COM_ENTRY', status: 'closed', isOpen: false, connectionId: 'entry-error', updatedAt: Date.now() } });
  await page.locator('.serial-connection-status').getByText(/测试串口故障/).waitFor({ state: 'hidden' });
  await watchReadingNotice('fast-default');
  await choosePort('COM81');
  await waitEvent(event => event.type === 'serial.open' && event.payload.path === 'COM81', 'Default must open before identification');
  assert.equal(opens('COM81')[0].payload.baudRate, undefined, '默认连接沿用宿主配置');
  await expectPressure(17 * 256);
  await waitSelectionReady();
  sendValidFrame(activeConnection, 0);
  await expectPressure(0);
  await page.waitForTimeout(2200);
  assert.equal(events.some(event => event.type === 'probe' && event.path === 'COM81'), false, '有效零压力帧也不能触发探测');
  assert.equal(opens('COM81').length, 1);
  assert.deepEqual(await readingNoticeObservations('fast-default'), [], '快速收到有效数据时等待提示不能闪现');
  await screenshot('default-reading-without-probe');
  await watchReadingNotice('');

  const baudInput = page.getByRole('textbox', { name: '波特率', exact: true });
  const beforeBaudEdit = events.filter(event => ['serial.open', 'probe', 'runtime.configure'].includes(event.type)).length;
  await baudInput.fill('1000000'); await baudInput.press('Enter'); await baudInput.press('Tab');
  await expectBaudRate(1000000);
  await page.waitForTimeout(250);
  assert.equal(events.filter(event => ['serial.open', 'probe', 'runtime.configure'].includes(event.type)).length, beforeBaudEdit,
    '编辑波特率只更新下一次连接的输入，不立即操作串口');
  await choosePort('COM81');
  await waitEvent(() => opens('COM81').length === 2, '同一串口选择新波特率应重新连接');
  assert.equal(opens('COM81')[1].payload.baudRate, 1000000);
  await waitSelectionReady();
  await expectPressure(17 * 256);
  await restoreDefaultBaudRate();
  const beforeInvalidBaud = events.filter(event => ['serial.open', 'probe', 'runtime.configure'].includes(event.type)).length;
  await baudInput.fill('12345'); await baudInput.press('Enter'); await baudInput.press('Tab');
  await expectBaudRate(921600);
  assert.equal(events.filter(event => ['serial.open', 'probe', 'runtime.configure'].includes(event.type)).length, beforeInvalidBaud,
    '非法波特率不能发送设备命令');
  assert.equal(events.some(event => event.type === 'serial.open' && event.payload.baudRate === 12345), false);
  await screenshot('editable-baud-default-restored');

  await choosePort('COM82');
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  assert.match(await dialog.textContent(), /1000000/);
  assert.equal(opens('COM82').length, 1, '结果确认前只允许默认连接');
  assert.equal(opens('COM82')[0].payload.baudRate, undefined);
  assert.equal(events.some(event => event.type === 'fallback-close' && event.path === 'COM82'), true);
  assert.equal(events.some(event => event.type === 'serial.close'), false, '前端不抢先关闭，交由后台核对连接后释放');
  await screenshot('different-baud-confirmation');
  await dialog.getByRole('button', { name: '使用识别结果连接', exact: true }).click();
  await waitEvent(event => event.type === 'serial.open' && event.payload.path === 'COM82' && event.payload.baudRate === 1000000, 'Confirmed detection must reconnect');
  assert.equal(opens('COM82').length, 2);
  await expectPressure(23 * 256);
  await waitSelectionReady();
  await expectBaudRate(1000000);
  await restoreDefaultBaudRate();

  for (const [path, expected] of [['COM83', /有效|识别/], ['COM84', /不兼容/], ['COM86', /多个|唯一|多种/]]) {
    await choosePort(path);
    await dialog.waitFor();
    assert.match(await dialog.textContent(), expected);
    assert.equal(await dialog.getByRole('button', { name: '使用识别结果连接', exact: true }).count(), 0);
    assert.equal(opens(path).length, 1, '未知/不兼容/歧义只能有此前的默认连接，不能再次打开');
    assert.equal(opens(path)[0].payload.baudRate, 921600, '独立场景显式恢复默认后连接');
    await screenshot(`refused-${path}`);
    await dialog.getByRole('button', { name: /取\s*消/ }).click();
    await dialog.waitFor({ state: 'hidden' });
    await waitSelectionReady();
  }

  await watchReadingNotice('closed-before-delay');
  await choosePort('COM85');
  await waitEvent(event => event.type === 'read-status' && event.path === 'COM85', '默认连接先观察数据');
  await page.waitForTimeout(1100);
  assert.deepEqual(await readingNoticeObservations('closed-before-delay'), [], '等待不足两秒不能显示读取提示');
  await page.getByRole('button', { name: '关闭串口', exact: true }).click();
  await waitEvent(event => event.type === 'serial.close', 'Close must issue serial.close');
  await waitSelectionReady();
  await page.waitForTimeout(2200);
  assert.equal(events.some(event => event.type === 'probe' && event.path === 'COM85'), false, '等数据时关闭不能在两秒后继续探测');
  assert.equal(opens('COM85').length, 1);
  assert.deepEqual(await readingNoticeObservations('closed-before-delay'), [], '关闭后不能出现迟到的读取提示');

  await watchReadingNotice('slow-status-response');
  delayNextStatus = true;
  await choosePort('COM85');
  await waitEvent(event => event.type === 'delayed-status', '延迟状态回执保留实际等待阶段');
  await page.locator('.serial-connection-status').getByText(readingNoticeText).waitFor();
  const slowNotice = await readingNoticeObservations('slow-status-response');
  assert.equal(slowNotice.length, 1, '超过两秒的持续等待应该显示提示');
  assert.ok(slowNotice[0].elapsedMs >= 1900, '读取提示必须延迟，不能立即显示');
  sendValidFrame(activeConnection, 31);
  await delayedStatusRoute.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: collectionStatus() });
  delayedStatusRoute = null;
  await waitSelectionReady();
  await expectPressure(31 * 256);
  await page.locator('.serial-connection-status').getByText(readingNoticeText).waitFor({ state: 'hidden' });
  assert.equal(events.some(event => event.type === 'probe' && event.path === 'COM85'), false, '提示延迟不能改变读取成功后的识别行为');
  await watchReadingNotice('');

  for (const [path, action] of [['COM87', 'close'], ['COM88', 'playback']]) {
    await choosePort(path);
    await waitEvent(event => event.type === 'probe' && event.path === path, '无有效数据后开始识别');
    if (action === 'close') await page.getByRole('button', { name: '关闭串口', exact: true }).click();
    else await page.locator('.portal-session-bar').getByRole('button', { name: '回放', exact: true }).click();
    await pendingProbes.get(path).fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: { code: 0, data: detection(path) } }).catch(() => {});
    await page.waitForTimeout(300);
    assert.equal(opens(path).length, 1, '取消后的迟到探测结果不能重新开串口');
    assert.ok(cancelledRequests.includes(path), '离开实时读取应取消在途识别HTTP');
    if (action === 'playback') {
      await dialog.locator('.ant-modal-close').click();
      await dialog.waitFor({ state: 'hidden' });
      await page.locator('.portal-session-bar').getByRole('button', { name: '实时', exact: true }).click();
    }
    await waitSelectionReady();
  }

  await choosePort('COM89');
  await waitEvent(event => event.type === 'probe' && event.path === 'COM89', '缺数据时发出回退请求');
  await expectPressure(29 * 256);
  await waitSelectionReady();
  assert.equal(opens('COM89').length, 1, '宿主已确认数据恢复就保留当前连接');
  assert.equal(events.some(event => event.type === 'fallback-close' && event.path === 'COM89'), false);

  await choosePort('COM90');
  await waitEvent(() => opens('COM90').length === 2,
    '默认参数识别成功后允许重新连接一次');
  await waitSelectionReady();
  await page.getByText('已按识别结果连接，但尚未收到有效数据。请检查设备是否持续发送数据。', { exact: true }).waitFor();
  await page.waitForTimeout(2200);
  assert.equal(opens('COM90').length, 2, '重新连接仍没有效帧只能提示，不能循环开关');
  assert.equal(events.filter(event => event.type === 'probe' && event.path === 'COM90').length, 1);
  assert.equal(await dialog.count(), 0);
  await screenshot('no-repeated-detection');

  for (const system of ['bed4096', 'bed4096num', 'smallBed12B', 'fast256']) {
    await baudInput.fill('1000000'); await baudInput.press('Enter'); await baudInput.press('Tab');
    await page.getByRole('button', { name: '← 返回系统列表', exact: true }).click();
    await page.locator('.portal-runtime-monitor').waitFor({ state: 'detached' });
    await page.locator(`[data-system="${system}"]`).click();
    await page.getByRole('button', { name: /^进入(?:该)?系统$/, exact: true }).click();
    await page.locator('.portal-runtime-monitor[data-handoff="complete"]').waitFor();
    await expectBaudRate(defaultBaudRates[system]);
    assert.equal(activeSystem, system, '默认值必须来自已切换的真实系统');
    events.push({ type: 'checked-system-default', system, baudRate: await baudInput.inputValue() });
    const bounds = await baudInput.evaluate(input => {
      const panel = input.closest('.portal-display-panel');
      const field = input.getBoundingClientRect(), box = panel.getBoundingClientRect();
      return { input: { top: field.top, bottom: field.bottom, left: field.left, right: field.right },
        panel: { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
        scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight, overflowY: getComputedStyle(panel).overflowY };
    });
    events.push({ type: 'checked-baud-input-bounds', system, ...bounds });
    await screenshot(`baud-input-${system}`);
    assert.ok(bounds.input.top >= bounds.panel.top && bounds.input.bottom <= bounds.panel.bottom
      && bounds.input.left >= bounds.panel.left && bounds.input.right <= bounds.panel.right,
    `${system}波特率输入不能被面板裁剪：${JSON.stringify(bounds)}`);
  }
  await screenshot('system-specific-default-baud');
  assert.deepEqual(pageErrors, []);
  const noticeObservations = await page.evaluate(() => window.__serialNoticeWatch.observations);
  const report = { ok: true, scope: 'actual-vite-portal-with-isolated-http-ws-fixtures', outputDir, events, pageErrors, screenshots, cancelledRequests, noticeObservations,
    checked: ['default-open-read-no-probe', 'zero-frame-is-valid', 'no-data-host-close-probe-confirm-reopen-read',
      'unknown-no-reopen', 'incompatible-no-reopen', 'ambiguous-no-reopen', 'close-cancels-data-wait',
      'close-cancels-late-probe', 'playback-cancels-late-probe', 'recovered-data-keeps-connection', 'no-repeated-fallback',
      'fast-data-no-reading-notice-flash', 'reading-notice-hidden-before-two-seconds', 'cancelled-reading-notice-never-appears',
      'slow-status-shows-delayed-reading-notice', 'first-entry-opening-no-flash', 'short-opening-no-late-notice',
      'long-opening-delayed-neutral-notice', 'real-error-immediate-distinct-style', 'home-preload-before-enter-without-business-commands',
      'baud-input-prefilled-without-long-hint', 'baud-edit-only-applies-on-next-open', 'baud-clear-restores-default',
      'invalid-baud-never-sent', 'detected-baud-updates-input', 'system-specific-baud-defaults-reset',
      'legacy-host-default-is-input-value-without-opening-port'],
    notCovered: ['physical serial driver', 'real firmware byte stream', 'installer', 'production Electron IPC'] };
  await writeFile(join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, report: join(outputDir, 'report.json') }));
} catch (error) {
  await page?.screenshot({ path: join(outputDir, 'failure.png') }).catch(() => {});
  const noticeObservations = await page?.evaluate(() => window.__serialNoticeWatch?.observations).catch(() => null);
  await writeFile(join(outputDir, 'report.json'), JSON.stringify({ ok: false, error: error.stack, events, pageErrors, noticeObservations }, null, 2));
  console.error(JSON.stringify({ ok: false, report: join(outputDir, 'report.json'), error: error.message }));
  process.exitCode = 1;
} finally {
  for (const timer of frameTimers) clearTimeout(timer);
  await browser?.close(); await server.close();
}
