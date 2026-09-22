import assert from 'node:assert/strict';
import { join } from 'node:path';
import { verifySelectionReferenceControls } from './portal-selection-controls.mjs';

/** 验证点距设置、物理距离、键盘多量尺与缩放后端点保持。 */
export async function verifyPortalRulerControls({ page, screenshots }) {
  const ruler = page.locator('.portal-screen-ruler'), surface = page.getByRole('group', { name: '传感点量尺画布', exact: true });
  const lines = ruler.locator('.portal-ruler-saved');
  await ruler.getByText('传感点量尺 · 请设置点距', { exact: true }).waitFor();
  await ruler.getByRole('spinbutton', { name: '横向点距（mm）', exact: true }).fill('6');
  await ruler.getByRole('spinbutton', { name: '纵向点距（mm）', exact: true }).fill('8');
  await ruler.getByRole('button', { name: '应用点距', exact: true }).click();
  await surface.focus(); await page.keyboard.press('Enter');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await ruler.getByText(`1 · ${Math.hypot(18, 32).toFixed(2)} mm`, { exact: true }).waitFor();
  await ruler.getByText('横跨 3 格 · 纵跨 4 格', { exact: true }).waitFor();
  await ruler.getByRole('button', { name: '量尺 1终点', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await ruler.getByText('1 · 40.00 mm', { exact: true }).waitFor();
  await ruler.getByRole('group', { name: '量尺 1', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await ruler.getByText('1 · 40.00 mm', { exact: true }).waitFor();
  await page.screenshot({ path: join(screenshots, 'workspace-ruler-physical.png') });
  await page.keyboard.press('Delete'); assert.equal(await lines.count(), 0);
  await surface.focus(); await page.keyboard.press('Enter');
  await surface.click({ position: { x: 1000, y: 600 }, button: 'right' });
  assert.equal(await ruler.locator('.portal-ruler-line').count(), 0, '右键取消未完成测量');
  for (let index = 0; index < 8; index++) {
    await surface.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  }
  assert.equal(await lines.count(), 8);
  await page.keyboard.press('Enter'); await ruler.getByRole('alert').filter({ hasText: '最多保留 8 条' }).waitFor();
  await ruler.getByRole('button', { name: '删除选中', exact: true }).click(); assert.equal(await lines.count(), 7);
  await page.setViewportSize({ width: 375, height: 812 });
  await ruler.getByText('2 · 8.00 mm', { exact: true }).waitFor();
  assert.equal(await lines.count(), 7, '改变窗口尺寸保留物理传感点和测量距离');
  const readout = await ruler.locator('.portal-ruler-readout').boundingBox();
  assert.ok(readout.x >= 0 && readout.x + readout.width <= 375, '窄屏操作条仍在视口内');
  await page.screenshot({ path: join(screenshots, 'workspace-ruler-375.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
}

/** 在真实原始数字矩阵中验证鼠标框选、两点量距、拖动以及点距复用。 */
export async function verifyRawMatrixTools({ page, sockets, screenshots }) {
  const utility = page.locator('.portal-utility-panel');
  await utility.getByRole('tab', { name: '显示与语言', exact: true }).click();
  const mode = utility.getByRole('tabpanel', { name: '显示与语言', exact: true }).locator('.ant-select-selector').first();
  await mode.click(); await page.getByText('原始数据', { exact: true }).last().click();
  const canvas = page.locator('.portal-data-renderer .canvasNum canvas'); await canvas.waitFor();
  // 新挂载的原始矩阵接收独立的新帧，框选不得靠上一渲染器的缓存制造读数。
  for (const peer of sockets) peer.send(JSON.stringify({ type: 'sensor.frame', schemaVersion: 1, channelId: 'hand:sit', displaySystemId: 'hand',
    sensorId: 'sit', sensorLabel: '测试手垫', outputChannel: 'sit', sensorType: 'hand', source: 'realtime', sequence: 4,
    timestamp: Date.now(), quality: 'good', payload: { value: Array.from({ length: 1024 }, (_, i) => i % 32 + 1), matrix: { rows: 32, cols: 32, total: 1024 } } }));
  await utility.getByRole('tab', { name: '数据分析', exact: true }).click();
  await utility.getByRole('button', { name: '框选分析', exact: true }).click();
  const box = await canvas.boundingBox();
  // 第 5、6 列与第 12、13、14 行，共六个不同于对称转置区域的点。
  await page.mouse.move(box.x + 4 * box.width / 32 + 1, box.y + 11 * box.height / 32 + 1); await page.mouse.down();
  await page.mouse.move(box.x + 6 * box.width / 32 - 1, box.y + 14 * box.height / 32 - 1, { steps: 4 }); await page.mouse.up();
  const selections = page.getByRole('complementary', { name: '框选区域管理', exact: true });
  await selections.getByText('33.00', { exact: true }).waitFor();
  await page.waitForFunction(() => Number(document.querySelector('.aside .pressData')?.textContent) === 33);
  await page.screenshot({ path: join(screenshots, 'workspace-raw-selection.png') });
  await verifySelectionReferenceControls({ page, box, screenshots });
  await utility.getByRole('button', { name: '传感点量尺', exact: true }).click();
  const ruler = page.locator('.portal-screen-ruler');
  assert.equal(await ruler.getByRole('spinbutton', { name: '横向点距（mm）', exact: true }).inputValue(), '6');
  assert.equal(await ruler.getByRole('spinbutton', { name: '纵向点距（mm）', exact: true }).inputValue(), '8');
  const a = { x: box.x + 10.5 * box.width / 32, y: box.y + 16.5 * box.height / 32 };
  const b = { x: box.x + 13.5 * box.width / 32, y: box.y + 20.5 * box.height / 32 };
  // 故意点在格中心附近；显示端点必须吸附到中心，而不是保留点击像素。
  await page.mouse.click(a.x + 3, a.y + 2); await page.mouse.click(b.x - 3, b.y + 2);
  await ruler.getByText(`1 · ${Math.hypot(18, 32).toFixed(2)} mm`, { exact: true }).waitFor();
  await ruler.getByText('横跨 3 格 · 纵跨 4 格', { exact: true }).waitFor();
  const line = ruler.locator('.portal-ruler-stroke');
  const origin = await ruler.locator('svg').boundingBox();
  assert.ok(Math.abs(Number(await line.getAttribute('x1')) + origin.x - a.x) < .1);
  assert.ok(Math.abs(Number(await line.getAttribute('y1')) + origin.y - a.y) < .1);
  await page.mouse.move(b.x, b.y); await page.mouse.down(); await page.mouse.move(b.x + 3, b.y + 2, { steps: 3 }); await page.mouse.up();
  await ruler.getByText(`1 · ${Math.hypot(18, 32).toFixed(2)} mm`, { exact: true }).waitFor();
  assert.ok(Math.abs(Number(await line.getAttribute('x2')) + origin.x - b.x) < .1, '格内小幅拖动不产生任意像素端点');
  await page.mouse.move(b.x, b.y); await page.mouse.down(); await page.mouse.move(b.x + box.width / 32, b.y, { steps: 5 }); await page.mouse.up();
  await ruler.getByText('1 · 40.00 mm', { exact: true }).waitFor();
  await page.screenshot({ path: join(screenshots, 'workspace-raw-ruler.png') });
  await ruler.getByRole('button', { name: '退出量尺', exact: true }).click();
  await utility.getByRole('tab', { name: '显示与语言', exact: true }).click();
  await mode.click(); await page.getByText('3D 模型', { exact: true }).last().click();
  await page.waitForFunction(() => !document.querySelector('.portal-data-renderer .canvasNum'));
}
