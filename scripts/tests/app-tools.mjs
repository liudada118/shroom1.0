import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-app-tools-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)),
  cacheDir: join(artifacts, '.vite'), logLevel: 'error',
  optimizeDeps: { entries: ['src/components/appTools/__fixtures__/tools.html'] },
  server: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/components/appTools/__fixtures__/tools.html`;
  await page.goto(url);
  const dock = page.getByRole('group', { name: '应用工具' });
  const agent = dock.locator('.shroom-agent-entry');
  await dock.getByRole('button', { name: /版本历史 · v1.1.37/ }).waitFor();
  await dock.getByRole('button', { name: '反馈', exact: true }).waitFor();

  /** 实测屏内边界、44px 点击区、间隔与命中元素，覆盖独立 fixed 引起的原始遮挡。 */
  async function checkLayout(expectedCount = 4) {
    const result = await dock.evaluate((element) => {
      const buttons = [...element.querySelectorAll('button')].filter((button) => !button.closest('dialog'));
      return { viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
        buttons: buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom,
            hit: button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
        }) };
    });
    assert.equal(result.buttons.length, expectedCount);
    assert.equal(result.overflow, false);
    for (const [index, box] of result.buttons.entries()) {
      assert.ok(box.width >= 44 && box.height >= 44, JSON.stringify(box));
      assert.ok(box.x >= 0 && box.right <= result.viewport, JSON.stringify(box));
      assert.ok(box.hit, '按钮中心被其他元素遮挡');
      if (index) assert.ok(box.x - result.buttons[index - 1].right >= 7.9, `按钮之间至少间隔 8px: ${JSON.stringify(result)}`);
    }
    const status = await dock.getByRole('status').boundingBox();
    if (status?.height) assert.ok(status.y + status.height < result.buttons[0].y, '更新状态应在工具组上方');
    return result.buttons;
  }

  for (const language of ['zh', 'en', 'ja']) {
    await page.evaluate((value) => window.appToolsFixture.language(value), language);
    for (const width of [1920, 1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await checkLayout();
    }
  }
  await page.evaluate(() => window.appToolsFixture.language('zh'));
  await page.setViewportSize({ width: 1280, height: 900 });
  const beforeBusy = await agent.boundingBox();
  await page.evaluate(() => window.appToolsFixture.busy());
  await dock.getByLabel('任务执行中').waitFor();
  assert.equal((await agent.boundingBox()).width, beforeBusy.width);
  await page.screenshot({ path: join(artifacts, 'desktop.png') });
  await dock.screenshot({ path: join(artifacts, 'toolbar.png') });

  await dock.getByRole('button', { name: /版本历史/ }).click();
  const history = page.getByRole('dialog', { name: '版本历史' });
  await history.waitFor();
  await history.getByRole('button', { name: /^关\s*闭$/ }).click();
  await history.waitFor({ state: 'hidden' });
  await dock.getByRole('button', { name: '软件更新' }).click();
  await page.waitForFunction(() => window.appToolsFixture.calls.some((call) => call.action === 'checkForUpdate'));
  assert.equal(await dock.getByRole('button', { name: '软件更新' }).isDisabled(), true);
  await checkLayout();

  for (const event of [{ type: 'update-available', version: '2.0.0-preview-with-a-very-long-version' },
    { type: 'download-progress', percent: 42.8 }, { type: 'update-downloaded', version: '2.0.0' },
    { type: 'update-error', message: '合成网络异常' }, { type: 'update-not-available', version: '1.1.37' }]) {
    await page.evaluate((data) => window.appToolsFixture.update(data), event);
    await page.setViewportSize({ width: 320, height: 844 });
    await checkLayout();
  }
  await page.evaluate(() => window.appToolsFixture.update({ type: 'download-progress', percent: 42.8 }));
  await dock.getByRole('button', { name: '软件更新' }).click();
  const update = page.getByRole('dialog', { name: '软件更新' });
  await update.waitFor();
  await update.getByRole('button', { name: /^关\s*闭$/ }).click();
  await update.waitFor({ state: 'hidden' });
  await page.screenshot({ path: join(artifacts, 'mobile.png') });

  await agent.click();
  await page.getByRole('dialog', { name: 'Shroom Agent' }).waitFor();
  assert.ok(await page.getByRole('dialog', { name: 'Shroom Agent' }).evaluate((dialog) => dialog.contains(document.activeElement)));
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Shroom Agent' }).waitFor({ state: 'hidden' });
  assert.ok(await agent.evaluate((button) => document.activeElement === button));
  await checkLayout();
  await dock.getByRole('button', { name: '反馈', exact: true }).click();
  await page.getByRole('dialog', { name: '提交反馈' }).waitFor();
  await page.getByRole('button', { name: '关闭反馈' }).click();
  await page.getByRole('button', { name: '切换首页反馈' }).click();
  await checkLayout(3);
  await page.getByRole('button', { name: '切换首页反馈' }).click();
  await checkLayout();

  await page.goto(`${url}?version=2.0.0-preview-with-a-very-long-version`);
  await dock.getByRole('button', { name: /版本历史 · v2.0.0/ }).waitFor();
  await checkLayout();
  assert.deepEqual(errors, []);
  console.log(`App tools passed: 3 languages, 5 widths, update states, dialogs, feedback lifecycle, long versions. Screenshots: ${artifacts}`);
} finally {
  await browser?.close();
  await server.close();
}
