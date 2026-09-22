import assert from 'node:assert/strict';
import { join } from 'node:path';

/** 在原始矩阵中验证参考项目的吸附、八向手柄、保尺寸移动及拖动键盘衔接。 */
export async function verifySelectionReferenceControls({ page, box, screenshots }) {
  const region = page.locator('.portal-selection-box:not(.is-draft)').first();
  const panel = page.getByRole('complementary', { name: '框选区域管理', exact: true });
  const cell = box.width / 32;
  /** 对照贴格后的坐标和宽高徽标，不通过内部 React 状态断言。 */
  const expectRegion = async (x, y, width, height) => {
    await region.locator('.portal-selection-measure').filter({ hasText: `X ${x}–${x + width} / Y ${y}–${y + height} · ${width} × ${height}` }).waitFor();
    const actual = await region.boundingBox();
    assert.ok(Math.abs(actual.x - (box.x + x * cell)) < .1);
    assert.ok(Math.abs(actual.width - width * cell) < .1);
    assert.ok(Math.abs(actual.height - height * box.height / 32) < .1);
  };
  /** 从框内无控件处拖动，保持鼠标按下以观察实时吸附预览。 */
  const beginMove = async () => {
    const actual = await region.boundingBox(), point = { x: actual.x + actual.width / 2, y: actual.y + actual.height / 2 };
    await page.mouse.move(point.x, point.y); await page.mouse.down(); return point;
  };
  assert.equal(await region.locator('.portal-selection-handle').count(), 8);
  await expectRegion(4, 11, 2, 3);
  // 无需先聚焦选框，箭头默认操作最后一框。
  await page.mouse.click(box.x + cell * 15.5, box.y + cell * 16.5);
  await page.keyboard.press('ArrowRight'); await expectRegion(5, 11, 2, 3);
  await panel.getByText('39.00', { exact: true }).waitFor();
  await page.keyboard.press('ArrowLeft'); await expectRegion(4, 11, 2, 3);
  let start = await beginMove();
  await page.mouse.move(start.x + cell + 3, start.y + 2, { steps: 4 });
  await expectRegion(5, 11, 2, 3);
  await panel.getByText('33.00', { exact: true }).waitFor();
  await page.mouse.up(); await panel.getByText('39.00', { exact: true }).waitFor();
  start = await beginMove();
  await page.mouse.move(box.x - 250, start.y, { steps: 4 });
  await expectRegion(0, 11, 2, 3); await page.mouse.up();
  await page.keyboard.press('ArrowLeft'); await expectRegion(0, 11, 2, 3);
  assert.equal(await panel.getByRole('alert').count(), 0, '边缘微调只停住，不报越界或缩小选框');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expectRegion(4, 11, 2, 3);
  const handle = await region.locator('.portal-selection-handle.e').boundingBox();
  await page.mouse.move(handle.x + 7, handle.y + 7); await page.mouse.down();
  await page.mouse.move(handle.x + 7 + cell, handle.y + 60, { steps: 4 });
  await expectRegion(4, 11, 3, 3); await page.mouse.up();
  start = await beginMove();
  await page.mouse.move(start.x + cell, start.y, { steps: 4 });
  await expectRegion(5, 11, 3, 3);
  await page.keyboard.press('ArrowRight'); await expectRegion(6, 11, 3, 3);
  await page.mouse.move(start.x + 2 * cell, start.y, { steps: 4 });
  await expectRegion(7, 11, 3, 3); await page.mouse.up();
  await panel.getByText('81.00', { exact: true }).waitFor();
  await page.screenshot({ path: join(screenshots, 'workspace-selection-reference.png') });
  await page.keyboard.press('Delete');
  await region.waitFor({ state: 'hidden' });
  // 重新创建用于后续框选/量尺互斥验证，创建预览也是完整的 2×3 格。
  await page.mouse.move(box.x + 4 * cell + 2, box.y + 11 * cell + 2); await page.mouse.down();
  await page.mouse.move(box.x + 6 * cell - 2, box.y + 14 * cell - 2, { steps: 4 });
  await page.locator('.portal-selection-box.is-draft .portal-selection-measure').filter({ hasText: '2 × 3' }).waitFor();
  await page.mouse.up(); await panel.getByText('33.00', { exact: true }).waitFor();
}
