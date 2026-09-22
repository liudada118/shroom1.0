import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const rootRequire = createRequire(new URL('../../package.json', import.meta.url));
const clientRequire = createRequire(new URL('../../client/package.json', import.meta.url));
const { createAppRuntime } = rootRequire('./backend/extension-host/appRuntimeFactory');
const { createRealtimeTelemetryGateway } = rootRequire('./backend/kernel/realtime/realtimeTelemetryGateway');
const { createChannelBus } = rootRequire('@shroom/backend/telemetry/channelBus.js');
const { createAlgorithmMarketService } = rootRequire('./backend/extension-host/runtime/algorithmMarketService');
const root = await mkdtemp(join(tmpdir(), 'shroom-builtin-browser-'));
const runtime = createAppRuntime({ runtimeResourceRoot: fileURLToPath(new URL('../../', import.meta.url)), runtimeWritableRoot: root });
let current = 'normal', frameTimer;
const bus = createChannelBus();
const algorithms = createAlgorithmMarketService({ channelBus: bus, packages: runtime.getAlgorithmMarketPackages(),
  listUserPackages: runtime.getUserAlgorithmPackages,
  getContext: () => ({ sensorType: current, nativeSensorType: runtime.builtinTemplates.get(current)?.builtinTemplate.sourceType || current, allowed: true, playback: false,
    systemConfiguration: runtime.builtinTemplates.getRuntimeConfiguration(current), reservedPackageIds: [] }),
  /** 模拟算法只用于浏览器夹具；生产数据路径仍经过真实标准帧与实例管理。 */
  createRunner() { const run = async () => ({ metrics: { respirationRate: 18.5, onbedFilterHealthy: 1 } }); run.dispose = async () => {}; return run; },
});
const { createServer } = clientRequire('vite');
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)), cacheDir: join(root, 'node_modules', '.vite'), logLevel: 'error',
  optimizeDeps: { entries: ['tests/fixtures/builtinTemplates.jsx', 'src/features/agent/__fixtures__/workspace.html'] },
  server: { host: '127.0.0.1', port: 0, open: false }, plugins: [{ name: 'builtin-template-fixture',
    /** 提供独立夹具入口，不进入生产路由。 */
    configureServer(vite) { vite.middlewares.use('/__builtin-test', async (req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(await vite.transformIndexHtml('/__builtin-test', '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/builtinTemplates.jsx"></script></body></html>'));
    }); },
  }] });
let browser, page;
const errors = [];
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(25000);
  const commands = [], sockets = new Set();
  page.on('crash', () => { errors.push('Browser page crashed'); console.error('Browser fixture page crashed'); });
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  await page.routeWebSocket(/:19999/, (socket) => {
    sockets.add(socket); socket.onClose(() => sockets.delete(socket));
    socket.send(JSON.stringify({ currentSensorType: current, selectFlag: 'all', date: Date.now() + 86400000 * 365, nowDate: Date.now() }));
  });
  await page.route('http://127.0.0.1:19245/**', async (route) => {
    const url = new URL(route.request().url());
    const body = ['POST', 'PATCH', 'DELETE'].includes(route.request().method()) ? route.request().postDataJSON() : null;
    let value = {};
    try {
    if (url.pathname === '/api/display-systems/catalog') value = { catalog: runtime.displaySystems.getBuilderCatalog() };
    else if (url.pathname === '/api/display-systems' && body) value = { result: runtime.displaySystems.save(body) };
    else if (url.pathname === '/api/display-systems') value = { displaySystems: runtime.displaySystems.getStatus() };
    else if (url.pathname.endsWith('/editor')) value = { editor: runtime.displaySystems.getEditorById(url.pathname.split('/')[3]) };
    else if (url.pathname === '/api/agent-apps') value = { code: 0, data: { apps: [] } };
    else if (url.pathname === '/api/serial/ports') value = { code: 0, data: { ports: [] } };
    else if (url.pathname === '/api/serial/status') value = { code: 0, data: { serial: [] } };
    else if (url.pathname.endsWith('/native')) {
      const id = url.pathname.split('/')[3];
      value = { result: route.request().method() === 'DELETE' ? runtime.builtinTemplates.remove(id, body.expectedRevision) : runtime.builtinTemplates.update(id, body) };
      for (const socket of sockets) socket.send(JSON.stringify({ displaySystemsUpdated: { id } }));
    }
    else if (url.pathname === '/api/algorithm-market') value = algorithms.snapshot();
    else if (url.pathname === '/api/commands') {
      commands.push(body);
      if (body.type === 'sensor.switch') {
        const selection = runtime.builtinTemplates.resolve(body.payload.sensorType, 'all');
        runtime.builtinTemplates.activate(selection); current = selection.id;
        for (const socket of sockets) socket.send(JSON.stringify({ currentSensorType: current }));
      }
      value = { code: 0, data: { ok: true, handled: true } };
    }
    await route.fulfill({ headers: { 'Access-Control-Allow-Origin': '*' }, json: value });
    } catch (error) { await route.fulfill({ status: 409, headers: { 'Access-Control-Allow-Origin': '*' }, json: { error: error.message, code: error.code } }); }
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__builtin-test`);
  await page.getByRole('button', { name: '以内置系统为模板创建', exact: true }).click();
  await page.getByLabel('内置系统模板').click();
  await page.getByLabel('内置系统模板').fill('hand');
  await page.getByTitle('手部检测（hand）', { exact: true }).click();
  await page.getByLabel('新系统名称').fill('手部副本浏览器测试');
  await page.getByLabel('新系统 ID').fill('browser-hand-copy');
  await page.getByRole('button', { name: '创建系统', exact: true }).click();
  await page.getByText('已保存：手部副本浏览器测试', { exact: true }).waitFor();
  assert.equal(runtime.displaySystems.getEditorById('browser-hand-copy').builtinTemplate.sourceType, 'hand');
  assert.equal(commands.length, 0, '仅保存模板不能打开设备或切换系统');
  await page.screenshot({ path: join(root, 'template-created.png') });
  await page.getByRole('button', { name: '编辑系统', exact: true }).click();
  await page.getByLabel('系统名称', { exact: true }).fill('可编辑手部浏览器测试');
  await page.getByRole('button', { name: '添加兼容算法', exact: true }).click();
  await page.getByRole('button', { name: '添加算法图表', exact: true }).click();
  await page.locator('.native-system-chart-editor input').first().fill('呼吸率趋势（次/分）');
  await page.getByRole('button', { name: '保存更改', exact: true }).click();
  await page.getByText('已保存，当前系统会更新算法和图表配置。', { exact: true }).waitFor();
  assert.equal(runtime.builtinTemplates.editor('browser-hand-copy').configuration.charts[0].metricId, 'respirationRate');
  assert.equal(commands.length, 0, '保存算法配置不能自动连接硬件');
  await page.screenshot({ path: join(root, 'native-system-editor.png') });
  await page.getByRole('button', { name: '进入系统', exact: true }).click();
  await page.locator('.portal-data-renderer canvas').first().waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('file')), 'browser-hand-copy');
  const gateway = createRealtimeTelemetryGateway({ channelBus: bus, wsSubscriptions: { publish(channel, frame) { for (const socket of sockets) socket.send(JSON.stringify(frame)); return sockets.size; } }, getSensorType: () => current });
  const published = gateway.publishRealtimeFrame('sit', { sitData: Array(1024).fill(8), totalPres: 8192, meanPres: 8, maxPres: 8, point: 1024, area: 1024 }).frame;
  frameTimer = setInterval(() => gateway.publishRealtimeFrame('sit', { sitData: Array(1024).fill(8), totalPres: 8192, meanPres: 8, maxPres: 8, point: 1024, area: 1024 }), 100);
  await page.getByRole('region', { name: '呼吸率趋势（次/分）输出', exact: true }).getByText('18.5', { exact: false }).first().waitFor();
  await page.locator('.portal-observatory').getByText('8192', { exact: true }).first().waitFor();
  clearInterval(frameTimer);
  const originalGateway = createRealtimeTelemetryGateway({ channelBus: { publish() {} }, wsSubscriptions: { publish(channel, frame) { for (const socket of sockets) socket.send(JSON.stringify(frame)); return sockets.size; } }, getSensorType: () => 'hand' });
  originalGateway.publishRealtimeFrame('sit', { sitData: Array(1024).fill(1), totalPres: 1024, meanPres: 1, maxPres: 1, point: 1024, area: 1024 });
  await page.waitForTimeout(300);
  assert.ok(await page.locator('.portal-observatory').getByText('8192', { exact: true }).first().isVisible(), '原系统帧不能覆盖副本');
  await page.screenshot({ path: join(root, 'native-hand-copy.png') });
  assert.ok(commands.some((command) => command.type === 'sensor.switch' && command.payload.sensorType === 'browser-hand-copy'));
  assert.ok(!commands.some((command) => command.type === 'sensor.switch' && command.payload.sensorType === 'hand'), '原生页面不能将副本切回原系统');
  frameTimer = setInterval(() => gateway.publishRealtimeFrame('sit', { sitData: Array(1024).fill(8), totalPres: 8192, meanPres: 8, maxPres: 8, point: 1024, area: 1024 }), 100);
  await page.reload();
  await page.locator('.portal-data-renderer canvas').first().waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('file')), 'browser-hand-copy', '重载后保持副本身份');
  for (const socket of sockets) socket.send(JSON.stringify(published));
  await page.locator('.portal-observatory').getByText('8192', { exact: true }).first().waitFor();
  await page.getByRole('region', { name: '呼吸率趋势（次/分）输出', exact: true }).getByText('18.5', { exact: false }).first().waitFor();
  await page.getByRole('region', { name: '呼吸率趋势（次/分）输出', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(root, 'native-respiration-chart.png') });
  // 合成测试数据经过真实评价、目录发现及分类 worker，再进入当前原生页面。
  const { prepareWindows, evaluate } = rootRequire('./backend/agent-runtime/algorithm-lab/evaluate');
  const { digest } = rootRequire('./backend/agent-runtime/algorithm-lab/service');
  const classifierSource = 'def predict(f):\n    return 1';
  const records = ['抚摸', '拍打'].map((label, index) => ({ id: `example-${index}`, label, split: 'development', startFrame: 0,
    frames: Array.from({ length: 16 }, (_, i) => ({ values: Array(1024).fill(8), timestamp: 1000 + i * 100, stage: 'stored-array' })) }));
  const report = evaluate(prepareWindows(records, 16), classifierSource, ['抚摸', '拍打'], 'development');
  const installedPath = join(root, 'agent', 'algorithm-lab', 'installed'); await mkdir(installedPath, { recursive: true });
  await writeFile(join(installedPath, 'browser-classifier.json'), JSON.stringify({ id: 'browser-classifier', systemId: 'browser-hand-copy', name: '动作识别测试',
    language: 'restricted-python-v1', source: classifierSource, labels: ['抚摸', '拍打'], windowFrames: 16, report: { ...report, sourceDigest: digest(classifierSource) } }));
  const beforeClassifier = runtime.builtinTemplates.editor('browser-hand-copy');
  const classifierConfiguration = { ...beforeClassifier.configuration,
    algorithms: [...beforeClassifier.configuration.algorithms, { packageId: 'user-browser-classifier', sensorId: 'sit', enabled: true }],
    charts: [...beforeClassifier.configuration.charts, { id: 'gesture', name: '实时动作识别', packageId: 'user-browser-classifier', metricId: 'classIndex', color: '#20B486', decimals: 0 }] };
  runtime.builtinTemplates.update('browser-hand-copy', { name: beforeClassifier.builtinTemplate.name, configuration: classifierConfiguration, expectedRevision: beforeClassifier.revision });
  await page.reload();
  await page.getByRole('region', { name: '实时动作识别输出', exact: true }).locator('.portal-package-value').filter({ hasText: '拍打' }).waitFor();
  await page.getByRole('region', { name: '实时动作识别输出', exact: true }).scrollIntoViewIfNeeded();
  assert.equal(algorithms.snapshot().instances.find((item) => item.id === 'user-browser-classifier').history.at(-1).metrics.classIndex, 1);
  await page.screenshot({ path: join(root, 'native-realtime-classifier.png') });
  const afterClassifier = runtime.builtinTemplates.editor('browser-hand-copy');
  runtime.builtinTemplates.update('browser-hand-copy', { name: beforeClassifier.builtinTemplate.name, configuration: beforeClassifier.configuration, expectedRevision: afterClassifier.revision });
  algorithms.snapshot();
  await page.reload();
  await page.getByRole('region', { name: '呼吸率趋势（次/分）输出', exact: true }).getByText('18.5', { exact: false }).first().waitFor();
  await page.getByRole('button', { name: '删除呼吸率趋势（次/分）', exact: true }).click();
  await page.getByRole('region', { name: '呼吸率趋势（次/分）输出', exact: true }).waitFor({ state: 'detached' });
  assert.equal(runtime.builtinTemplates.editor('browser-hand-copy').configuration.charts.length, 0);
  assert.equal(algorithms.snapshot().instances.length, 1, '删除图表保留算法');
  clearInterval(frameTimer);
  console.log('PASS: saved chart output and reload; checking removal controls.');
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__builtin-test?view=builder#/`);
  await page.getByRole('button', { name: /可编辑手部浏览器测试.*独立系统/ }).click();
  await page.getByRole('button', { name: '删除算法', exact: true }).click();
  await page.getByRole('button', { name: '保存更改', exact: true }).click();
  await page.getByText('已保存，当前系统会更新算法和图表配置。', { exact: true }).waitFor();
  assert.equal(runtime.builtinTemplates.editor('browser-hand-copy').configuration.algorithms.length, 0);
  assert.equal(algorithms.snapshot().instances.length, 0, '删除已保存算法后释放实例');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(root, 'native-editor-before-delete.png') });
  await page.locator('.native-system-editor').getByRole('button', { name: '删除系统', exact: true }).click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: '删除系统', exact: true }).click();
  await page.getByText('请先切换到其他系统，再删除此系统。', { exact: true }).waitFor();
  assert.ok(runtime.builtinTemplates.get('browser-hand-copy'), '正在使用的系统禁止删除');
  await page.screenshot({ path: join(root, 'native-editor-narrow.png') });
  runtime.builtinTemplates.activate({ id: 'hand', sourceType: 'hand', template: false }); current = 'hand';
  await page.locator('.ant-popconfirm').waitFor({ state: 'hidden' });
  await page.locator('.native-system-editor').getByRole('button', { name: '删除系统', exact: true }).click();
  await page.locator('.ant-popconfirm').getByRole('button', { name: '删除系统', exact: true }).click();
  await page.locator('.native-system-editor').waitFor({ state: 'detached' });
  assert.equal(runtime.builtinTemplates.get('browser-hand-copy'), null);
  assert.equal(await page.getByRole('button', { name: /可编辑手部浏览器测试.*独立系统/ }).count(), 0);
  await page.setViewportSize({ width: 1440, height: 960 });
  assert.deepEqual(errors, []);
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/features/agent/__fixtures__/workspace.html`);
  await page.getByRole('button', { name: '模型设置', exact: true }).click();
  await page.locator('#shroom-agent-model').selectOption('gpt-6-astra');
  await page.locator('input[type="password"]').fill('fixture-only-not-a-key');
  await page.locator('.shroom-agent-settings form > button').click();
  for (const text of ['第一次任务', '第二次任务']) {
    await page.locator('#shroom-agent-prompt').fill(text);
    await page.getByRole('button', { name: '发送', exact: true }).click();
    await page.locator('.shroom-agent-caret').waitFor();
    await page.getByRole('button', { name: '测试：完成方案生成', exact: true }).evaluate((button) => button.click());
    await page.locator('.shroom-agent-caret').waitFor({ state: 'hidden' });
  }
  const turns = page.locator('.shroom-agent-turn');
  assert.equal(await turns.count(), 2);
  for (const turn of await turns.all()) {
    assert.equal(await turn.locator('.shroom-agent-message').count(), 2);
    assert.equal(await turn.locator('.shroom-agent-task-history').count(), 1);
    assert.equal(await turn.evaluate((node) => node.lastElementChild.className), 'shroom-agent-task-history');
  }
  await page.screenshot({ path: join(root, 'agent-turns.png') });
  assert.deepEqual(errors, []);
  console.log(`PASS: editable template creation, algorithm/chart persistence and rendering with synthetic outputs, frame isolation, chart/algorithm removal, active-delete guard and narrow-screen deletion; Agent two-turn message/result placement. Artifacts: ${root}`);
} catch (error) {
  console.error(`Browser fixture failed; artifacts: ${root}; page errors: ${JSON.stringify(errors)}`, error);
  await page?.screenshot({ path: join(root, 'failure.png'), timeout: 5000 }).catch((cause) => console.error(cause.message));
  throw error;
} finally { clearInterval(frameTimer); await algorithms.dispose(); await browser?.close(); await server.close(); }
