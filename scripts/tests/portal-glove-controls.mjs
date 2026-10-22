import assert from 'node:assert/strict';
import { join } from 'node:path';

/** 通过可见 Select 表面选择选项，保留实际焦点与弹层交互。 */
async function choose(page, label, value) {
  const select = page.getByRole('combobox', { name: label, exact: true })
    .locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " ant-select ")]');
  await select.locator('.ant-select-selector').click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option-content').getByText(value, { exact: true }).click();
}

/** 在真实单手 Home 检验工具栏共同折叠、展开后的切手校准和窄屏可达性。 */
export async function verifyPortalGloveControls({ page, screenshots }) {
  const display = page.getByRole('region', { name: '渲染与显示', exact: true });
  const tools = page.getByRole('complementary', { name: '快捷显示工具', exact: true });
  const collapse = page.getByRole('button', { name: '收起快捷工具', exact: true });
  if (await collapse.isVisible()) await collapse.click();
  await display.waitFor({ state: 'hidden' });
  await tools.waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('button', { name: '工具', exact: true }).isVisible(), false);
  assert.equal(await page.getByRole('combobox', { name: '显示手', exact: true }).count(), 0,
    '折叠工具栏时显示面板及其中的切手控件一同收回');
  const expand = page.getByRole('button', { name: '展开快捷工具', exact: true });
  await expand.click();
  await display.waitFor();
  await tools.waitFor();
  assert.equal(await display.getByRole('combobox', { name: '显示手', exact: true }).count(), 1,
    '展开工具栏后恢复单手选择，校准无需另开工具箱');
  const calibrate = display.getByRole('button', { name: /^校\s*准$/ });
  assert.equal(await calibrate.isEnabled(), true);
  await choose(page, '显示手', '右手');
  await calibrate.click();
  const dialog = page.getByRole('dialog', { name: '设备校准', exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.locator('.ant-select-selection-item').first().innerText(), '右手');
  await choose(page, '校准姿态', '手指握拳');
  await dialog.getByRole('button', { name: '采集数据', exact: true }).click();
  const right = await page.evaluate(() => JSON.parse(localStorage.getItem('fingerArrR')));
  assert.equal(right.length, 2); assert.equal(right[1].length, 5);
  await choose(page, '校准手', '左手');
  await choose(page, '校准姿态', '手指平铺');
  await dialog.getByRole('button', { name: '采集数据', exact: true }).click();
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('fingerArrL')));
  assert.equal(left.length, 2); assert.equal(left[0].length, 5);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('fingerArrR'))), right,
    '采集左手不能覆盖右手独立的校准数据');
  await page.screenshot({ path: join(screenshots, 'glove-calibration-dialog.png') });
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await choose(page, '显示方式', '原始数据');
  assert.equal(await calibrate.isDisabled(), true);
  await display.getByText('请切换到 3D遥操 或 炫酷摇操 后校准', { exact: true }).waitFor();
  await choose(page, '显示方式', '3D 皮肤');
  assert.equal(await calibrate.isDisabled(), true);
  assert.equal(await display.getByRole('button', { name: /^固\s*定$/ }).isEnabled(), true);
  await choose(page, '显示方式', '3D 遥操');
  await page.locator('.portal-data-renderer canvas[data-model-state="ready"]').waitFor({ timeout: 60000 });
  assert.equal(await calibrate.isEnabled(), true);
  for (const viewport of [{ width: 900, height: 900 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    await collapse.click();
    await page.locator('.portal-display-panel').waitFor({ state: 'hidden' });
    await page.locator('.portal-quick-tools').waitFor({ state: 'hidden' });
    const grip = await expand.boundingBox();
    assert.ok(grip.x >= 0 && grip.x + grip.width <= viewport.width + 1
      && grip.y >= 0 && grip.y + grip.height <= viewport.height,
    `${viewport.width}px 下两面板共同收回后展开拉手仍在窗口内`);
    assert.equal(await expand.getAttribute('aria-expanded'), 'false');
    await page.screenshot({ path: join(screenshots, `glove-controls-collapsed-${viewport.width}.png`) });
    await expand.click();
    await display.waitFor();
    await tools.waitFor();
    await calibrate.scrollIntoViewIfNeeded();
    const box = await calibrate.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= viewport.width + 1 && box.y >= 0 && box.y + box.height <= viewport.height,
      `${viewport.width}px 下校准按钮可滚动到窗口内`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: join(screenshots, `glove-controls-${viewport.width}.png`) });
    await calibrate.click();
    await dialog.waitFor();
    await dialog.getByRole('button', { name: '关闭', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await choose(page, '显示手', '左手');
  if (await expand.isVisible()) await expand.click();
  await page.screenshot({ path: join(screenshots, 'glove-controls-visible.png') });
  console.log('PORTAL_GLOVE_CONTROLS_PASS');
}
