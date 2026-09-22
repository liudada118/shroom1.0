import assert from 'node:assert/strict';
import { join } from 'node:path';
import { verifyPortalRulerControls, verifyRawMatrixTools } from './portal-ruler-controls.mjs';

/** 在隔离 Home 上验证新工具、回放与下载交互；设备和导出事件均来自测试桩。 */
export async function verifyPortalWorkspaceControls({ page, commands, sockets, screenshots }) {
  const tools = page.locator('.portal-quick-tools');
  const before = await tools.boundingBox();
  await page.getByRole('button', { name: '收起快捷工具', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '工具', exact: true }).isVisible(), false);
  const handle = page.getByRole('button', { name: '展开快捷工具', exact: true });
  await handle.waitFor();
  const grip = await handle.boundingBox();
  assert.ok(grip.x >= 0 && grip.x + grip.width <= 1441, '抽屉收起后左侧拉手仍在窗口内');
  await page.screenshot({ path: join(screenshots, 'workspace-drawer-closed.png') });
  await page.getByRole('button', { name: '展开快捷工具', exact: true }).click();
  assert.ok(Math.abs((await tools.boundingBox()).y - before.y) < 1, '工具收起/展开不能改变垂直锚点');
  await page.getByRole('button', { name: '工具', exact: true }).click();
  const utility = page.locator('.portal-utility-panel');
  await utility.filter({ visible: true }).waitFor();
  assert.ok((await utility.boundingBox()).height <= 180, '工具箱保持低矮，不占据大块渲染空间');
  await page.waitForFunction(() => document.querySelector('.portal-workspace-tools')?.dataset.nativeView === 'true');
  const matrix = await page.evaluate(() => window.__portalToolViewMatrix);
  const commandCount = commands.length;
  await utility.getByRole('button', { name: 'X 轴 +30°', exact: true }).click();
  await page.waitForFunction((before) => window.__portalToolViewMatrix?.some((value, index) => Math.abs(value - before[index]) > 1e-5), matrix);
  assert.equal(commands.length, commandCount, '旋转只改变渲染矩阵，不向设备发命令');
  await utility.getByRole('button', { name: '恢复视角', exact: true }).click();
  await utility.getByRole('tab', { name: '数据处理', exact: true }).click();
  await utility.getByRole('button', { name: '水平翻转', exact: true }).click();
  assert.equal(await utility.getByRole('button', { name: '水平翻转', exact: true }).getAttribute('aria-pressed'), 'true');
  await utility.getByRole('tab', { name: '数据分析', exact: true }).click();
  assert.equal(await utility.getByRole('button', { name: '框选分析', exact: true }).isDisabled(), true, '不对镜像视图输出错误的旧式框选统计');
  await utility.getByRole('tab', { name: '视角调节', exact: true }).click();
  await utility.getByRole('button', { name: '恢复视角', exact: true }).click();
  await utility.getByRole('tab', { name: '数据分析', exact: true }).click();
  await utility.getByRole('button', { name: '框选分析', exact: true }).click();
  assert.equal(await utility.getByRole('button', { name: '框选分析', exact: true }).getAttribute('aria-pressed'), 'true');
  const selections = page.getByRole('complementary', { name: '框选区域管理', exact: true });
  await selections.waitFor();
  // 高压夹具的峰值在画布上方，先验证空白命中不能制造全零选区，再用原始坐标精确定位。
  await page.mouse.move(610, 410); await page.mouse.down(); await page.mouse.move(740, 510, { steps: 5 }); await page.mouse.up();
  await selections.getByRole('alert').waitFor();
  assert.equal(await page.locator('.brushSelectBox').count(), 0);
  assert.equal(Number(await page.locator('.aside .pressData').first().textContent()), 131072);
  await selections.getByText('输入坐标添加', { exact: true }).click();
  await selections.getByRole('spinbutton', { name: '新选区X', exact: true }).fill('3');
  await selections.getByRole('spinbutton', { name: '新选区Y', exact: true }).fill('8');
  await selections.getByRole('spinbutton', { name: '新选区列数', exact: true }).fill('2');
  await selections.getByRole('spinbutton', { name: '新选区行数', exact: true }).fill('3');
  await selections.getByRole('button', { name: '添加选区', exact: true }).click();
  await selections.getByText('768.00', { exact: true }).waitFor();
  await page.waitForFunction(() => Number(document.querySelector('.aside .pressData')?.textContent) === 768);
  assert.equal(commands.length, commandCount, '框选只影响展示统计，不下发裁剪或采集命令');
  await page.screenshot({ path: join(screenshots, 'workspace-selection-stats.png') });
  const selectionSocket = [...sockets].at(-1);
  selectionSocket.send(JSON.stringify({ type: 'sensor.frame', schemaVersion: 1, channelId: 'hand:sit', displaySystemId: 'hand',
    sensorId: 'sit', sensorLabel: '测试手垫', outputChannel: 'sit', sensorType: 'hand', source: 'realtime', sequence: 3,
    timestamp: Date.now(), quality: 'good', payload: { value: Array(1024).fill(20), matrix: { rows: 32, cols: 32, total: 1024 } } }));
  await selections.getByText('120.00', { exact: true }).waitFor();
  await selections.getByRole('button', { name: '移除框选 1', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('.aside .pressData')?.textContent) === 20480);
  await page.mouse.move(610, 410); await page.mouse.down(); await page.mouse.move(740, 510, { steps: 5 }); await page.mouse.up();
  await page.locator('.brushSelectBox').waitFor();
  await page.waitForFunction(() => {
    const value = Number(document.querySelector('.aside .pressData')?.textContent);
    return value > 0 && value < 20480;
  });
  const selectedBox = page.getByRole('group', { name: '框选 2选区', exact: true });
  await selectedBox.focus();
  await page.keyboard.press('ArrowRight');
  const moved = await selectedBox.boundingBox();
  await page.mouse.move(moved.x + moved.width / 2, moved.y + moved.height / 2); await page.mouse.down();
  await page.mouse.move(moved.x + moved.width / 2 + 12, moved.y + moved.height / 2, { steps: 4 }); await page.mouse.up();
  const handleBox = await selectedBox.locator('.portal-selection-handle.se').boundingBox();
  await page.mouse.move(handleBox.x + 7, handleBox.y + 7); await page.mouse.down();
  await page.mouse.move(handleBox.x + 25, handleBox.y + 20, { steps: 4 }); await page.mouse.up();
  assert.ok(Number(await page.locator('.aside .pressData').first().textContent()) > 0, '拖动、缩放后仍保留有效统计');
  await page.screenshot({ path: join(screenshots, 'workspace-selection-drag.png') });
  await utility.getByRole('button', { name: '传感点量尺', exact: true }).click();
  assert.equal(await utility.getByRole('button', { name: '框选分析', exact: true }).getAttribute('aria-pressed'), 'false');
  await page.locator('.brushSelectBox').waitFor({ state: 'hidden' });
  await verifyPortalRulerControls({ page, screenshots });
  await page.getByRole('group', { name: '传感点量尺画布', exact: true }).focus();
  await page.keyboard.press('Escape');
  await page.locator('.portal-screen-ruler').waitFor({ state: 'hidden' });
  await utility.getByRole('tab', { name: '数据处理', exact: true }).click();
  const zero = utility.getByRole('button', { name: '压力清零', exact: true });
  await zero.hover();
  const tip = page.getByRole('tooltip').filter({ hasText: '以当前压力作为零点基准' });
  await tip.waitFor();
  await page.waitForFunction(() => {
    const hint = document.querySelector('.portal-utility-tooltip [role="tooltip"]');
    return hint && hint.getBoundingClientRect().bottom <= document.querySelector('.portal-utility-panel').getBoundingClientRect().top + 2;
  });
  const tipBox = await tip.boundingBox(), panelBox = await utility.boundingBox();
  assert.ok(tipBox.y + tipBox.height <= panelBox.y + 2, '工具说明显示在整个面板上方，不能挡住分类标签');
  await zero.focus();
  await page.keyboard.press('Escape');
  await tip.waitFor({ state: 'hidden' });
  assert.equal(await utility.isVisible(), true, 'Escape 先收起说明，不同时关闭工具箱');
  await page.mouse.move(950, 370);
  await page.evaluate(() => {
    window.__toolCanvasPointer = false;
    document.querySelector('.portal-data-renderer canvas').addEventListener('pointerdown', () => {
      window.__toolCanvasPointer = true;
    }, { once: true });
  });
  await page.mouse.down();
  await page.mouse.move(970, 380, { steps: 5 });
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.__toolCanvasPointer), true, '工具箱打开时画布仍接收旋转操作');
  assert.equal(await utility.isVisible(), true, '操作渲染不会强制关闭工具箱');
  await page.setViewportSize({ width: 375, height: 812 });
  const compact = await utility.boundingBox();
  assert.ok(compact.height <= 180 && compact.x >= 0 && compact.x + compact.width <= 375, '小屏工具箱保持低矮且不撑出页面');
  await page.screenshot({ path: join(screenshots, 'workspace-tools-375.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await utility.getByRole('tab', { name: '显示与语言', exact: true }).click();
  const display = utility.getByRole('tabpanel', { name: '显示与语言', exact: true });
  await display.waitFor();
  assert.equal(await display.getByRole('combobox').count(), 2, '保留原生显示模式与语言功能');
  assert.equal(await page.getByRole('dialog', { name: '显示与语言', exact: true }).count(), 0, '显示设置直接在工具栏中操作');
  await page.screenshot({ path: join(screenshots, 'workspace-display-tab.png') });
  await verifyRawMatrixTools({ page, sockets, screenshots });
  await page.setViewportSize({ width: 375, height: 812 });
  assert.ok((await display.boundingBox()).width <= 375, '显示分栏在小屏内横向滚动');
  await page.screenshot({ path: join(screenshots, 'workspace-display-tab-375.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await utility.getByRole('tab', { name: '显示与语言', exact: true }).focus();
  await page.keyboard.press('Home');
  assert.equal(await utility.getByRole('tab', { name: '视角调节', exact: true }).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('End');
  assert.equal(await utility.getByRole('tab', { name: '显示与语言', exact: true }).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Escape');
  await utility.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '工具', exact: true }).click();
  await page.getByRole('button', { name: '算法', exact: true }).click();
  await utility.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '收起算法超市', exact: true }).click();
  await page.getByRole('button', { name: '工具', exact: true }).click();
  await utility.getByRole('tab', { name: '视角调节', exact: true }).click();
  await page.screenshot({ path: join(screenshots, 'workspace-tools.png') });
  await utility.getByRole('button', { name: '收起实用工具', exact: true }).click();

  const loadsBefore = commands.filter((command) => command.type === 'history.load').length;
  await page.getByRole('button', { name: '回放', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '回放与下载', exact: true });
  await dialog.waitFor();
  await dialog.getByRole('radio', { name: '回放：测试采集一', exact: true }).check();
  assert.equal(await dialog.locator('.portal-playback-record strong').first().evaluate((node) => getComputedStyle(node).color),
    'rgb(229, 240, 248)', '历史记录名称不能继承旧表格的黑字');
  await dialog.getByRole('checkbox', { name: '下载：测试采集二', exact: true }).check();
  await dialog.getByRole('checkbox', { name: '下载：测试采集三', exact: true }).check();
  assert.equal(await dialog.getByRole('radio', { name: '回放：测试采集一', exact: true }).isChecked(), true);
  assert.equal(commands.filter((command) => command.type === 'history.load').length, loadsBefore, '单选只选择，不提前发出载入');
  await page.screenshot({ path: join(screenshots, 'workspace-playback.png') });
  await page.setViewportSize({ width: 375, height: 812 });
  const modalBounds = await dialog.boundingBox();
  assert.ok(modalBounds.x >= 0 && modalBounds.x + modalBounds.width <= 376 && modalBounds.y + modalBounds.height <= 813, '回放弹窗不能撑出窄屏');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '弹窗不撑大页面');
  await page.screenshot({ path: join(screenshots, 'workspace-playback-375.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await dialog.getByRole('button', { name: '载入回放', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(commands.filter((command) => command.type === 'history.load').at(-1).payload.date, 'session-one');
  assert.deepEqual(commands.filter((command) => command.type === 'playback.control').at(-1).payload,
    { value: 0, play: true }, '载入后必须请求首帧并启动回放');
  const pause = page.locator('.progressContent img[src*="pause"]');
  await pause.waitFor({ state: 'visible' });
  const chartCursor = page.locator('.playbackChartCursor[data-chart="pressure"]');
  await chartCursor.waitFor({ state: 'visible' });
  const fullCurve = await page.locator('#myChart1').evaluate((canvas) => canvas.toDataURL());
  assert.equal(await chartCursor.evaluate((node) => node.style.left), '20%', '载入完整曲线后帧线从第一个点开始');
  assert.ok(await page.locator('#myChart1').evaluate((canvas) =>
    canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((value) => value !== 0)), '播放前就已经画出完整曲线');
  for (const index of [1, 2]) {
    for (const peer of sockets) peer.send(JSON.stringify({
      type: 'sensor.frame', schemaVersion: 1, channelId: 'hand:sit', displaySystemId: 'hand',
      sensorId: 'sit', sensorLabel: '测试手垫', outputChannel: 'sit', sensorType: 'hand',
      source: 'playback', sequence: index, timestamp: 1000 + index * 100, quality: 'good',
      payload: { value: Array(1024).fill(index * 2), history: { index }, matrix: { rows: 32, cols: 32, total: 1024 } },
    }));
    await page.waitForFunction((expected) => Number(document.querySelector('.aside .pressData')?.textContent) === expected, index * 2048);
    await page.waitForFunction((expected) => Math.abs(parseFloat(document.querySelector('.progressLine')?.style.left) - expected) < 1,
      20 + index * 560 / 3);
    assert.equal(await chartCursor.evaluate((node) => node.style.left), `${20 * (index + 1)}%`);
    assert.equal(await page.locator('#myChart1').evaluate((canvas) => canvas.toDataURL()), fullCurve, '播放时曲线像素保持不变，只移动独立帧线');
  }
  await pause.click();
  await page.locator('.progressContent img[src*="play"]').waitFor({ state: 'visible' });
  assert.equal(commands.filter((command) => command.type === 'playback.control').at(-1).payload.play, false, '回放仍可暂停');
  const progressBounds = await page.locator('.progress').boundingBox();
  await page.locator('.progress').click({ position: { x: 20, y: progressBounds.height / 2 } });
  assert.equal(await chartCursor.evaluate((node) => node.style.left), '20%', '暂停后点击进度可把当前帧线移回起点');
  assert.equal(await page.locator('#myChart1').evaluate((canvas) => canvas.toDataURL()), fullCurve);
  await page.screenshot({ path: join(screenshots, 'workspace-playback-full-curve.png') });

  const speedSelect = page.locator('.progressContent .ant-select');
  await speedSelect.click();
  await page.getByText('2.0X', { exact: true }).last().click();
  assert.equal(commands.filter((command) => command.type === 'playback.control').at(-1).payload.speed, 2);
  await page.getByRole('button', { name: '回放', exact: true }).click();
  await dialog.waitFor();
  await dialog.getByRole('button', { name: '载入回放', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  assert.equal(await speedSelect.locator('.ant-select-selection-item').textContent(), '1.0X', '重载同一记录也要同步后端恢复的 1X');

  await page.getByRole('button', { name: '回放', exact: true }).click();
  await dialog.waitFor();
  await dialog.getByRole('button', { name: '下载已勾选 (2)', exact: true }).click();
  const csv = page.getByRole('dialog').filter({ has: page.locator('.portal-batch-summary') });
  await csv.waitFor();
  const exportsBefore = commands.filter((command) => command.type === 'export.csv').length;
  const firstExport = page.waitForResponse((response) => response.url().endsWith('/api/commands') && response.request().postDataJSON()?.type === 'export.csv');
  await csv.locator('.ant-modal-footer .ant-btn-primary').click();
  await page.waitForFunction(() => document.querySelector('.portal-batch-summary')?.textContent.includes('已完成 0 条'));
  // 等待HTTP请求进入拦截器，不以模态打开代表请求已经送达。
  await firstExport;
  assert.equal(commands.filter((command) => command.type === 'export.csv').length, exportsBefore + 1, 'ACK后仍等待第一条导出终态');
  assert.equal(commands.filter((command) => command.type === 'export.csv').at(-1).payload.date, 'session-two');
  const secondExport = page.waitForResponse((response) => response.url().endsWith('/api/commands') && response.request().postDataJSON()?.type === 'export.csv');
  for (const peer of sockets) peer.send(JSON.stringify({ download: 'export csv success', downloadFiles: ['fixture-two.csv'], downloadDir: 'fixture-only' }));
  await page.waitForFunction(() => document.querySelector('.portal-batch-summary')?.textContent.includes('已完成 1 条'));
  await secondExport;
  assert.equal(commands.filter((command) => command.type === 'export.csv').at(-1).payload.date, 'session-three');
  for (const peer of sockets) peer.send(JSON.stringify({ download: 'export csv failed', downloadError: '测试：第三条无数据', downloadDir: 'fixture-only' }));
  await csv.getByText('测试：第三条无数据', { exact: false }).first().waitFor();
  await csv.getByText('fixture-two.csv', { exact: false }).first().waitFor();
  await page.screenshot({ path: join(screenshots, 'workspace-download-result.png') });
  await csv.locator('.ant-modal-footer .ant-btn-primary').click();
  await csv.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: '实时', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.portal-session-modes button')?.getAttribute('aria-pressed') === 'true');
  await chartCursor.waitFor({ state: 'hidden' });
  console.log('PORTAL_WORKSPACE_CONTROLS_PASS');
}
