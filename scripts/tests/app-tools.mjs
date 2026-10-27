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
let browser, page;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const url = `http://127.0.0.1:${server.httpServer.address().port}/src/components/appTools/__fixtures__/tools.html`;
  await page.goto(url);
  const dock = page.getByRole('group', { name: '应用工具' });
  const agent = dock.locator('.shroom-agent-entry');
  const trigger = dock.locator('.shroom-app-tools-toggle');
  const banner = dock.locator('.shroom-app-tools-banner');
  await trigger.waitFor();
  await dock.getByRole('button', { name: /版本历史 · v1.1.37/, includeHidden: true }).waitFor({ state: 'attached' });
  await dock.getByRole('button', { name: '反馈', exact: true, includeHidden: true }).waitFor({ state: 'attached' });

  /** 等待横幅进入指定状态及动画终点，避免把过渡帧误判为最终布局。 */
  async function settleExpanded(expected) {
    await page.waitForFunction((expanded) => document.querySelector('.shroom-app-tools')?.dataset.expanded === String(expanded), expected);
    await page.waitForFunction((expanded) => {
      const element = document.querySelector('.shroom-app-tools-banner');
      const style = getComputedStyle(element);
      return expanded ? Number(style.opacity) === 1 : style.visibility === 'hidden';
    }, expected);
  }

  /** 用真实鼠标进入入口展开工具，不依赖实现内部的状态 setter。 */
  async function expand() {
    await trigger.hover();
    await settleExpanded(true);
  }

  /** 移到页面空白处收回横幅，保留更新、反馈与设置组件的实例。 */
  async function collapse() {
    await page.mouse.move(16, 400);
    if (await dock.getAttribute('data-expanded') === 'true') {
      await trigger.focus();
      await page.keyboard.press('Escape');
    }
    await settleExpanded(false);
  }

  /** 实测屏内边界、44px 点击区、间隔与命中元素，覆盖独立 fixed 引起的原始遮挡。 */
  async function checkLayout(expectedCount = 5) {
    await expand();
    const result = await dock.evaluate((element) => {
      const buttons = [...element.querySelectorAll('button')].filter((button) => !button.closest('dialog')
        && !button.classList.contains('shroom-app-tools-toggle'));
      return { viewport: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth,
        rootTransform: getComputedStyle(element).transform,
        buttons: buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom,
            hit: button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) };
        }) };
    });
    assert.equal(result.buttons.length, expectedCount);
    assert.equal(result.overflow, false);
    assert.equal(result.rootTransform, 'none', '根容器不能产生会挪动 fixed 弹窗的 transform');
    const rows = new Map();
    for (const box of result.buttons) {
      assert.ok(box.width >= 43.99 && box.height >= 43.99, JSON.stringify(box));
      assert.ok(box.x >= 0 && box.right <= result.viewport, JSON.stringify(box));
      assert.ok(box.hit, '按钮中心被其他元素遮挡');
      const key = Math.round(box.y);
      rows.set(key, [...(rows.get(key) || []), box]);
    }
    for (const row of rows.values()) {
      row.sort((a, b) => a.x - b.x);
      for (let index = 1; index < row.length; index += 1) {
        assert.ok(row[index].x - row[index - 1].right >= 7.9, `同行按钮至少间隔 8px: ${JSON.stringify(result)}`);
      }
    }
    const status = await dock.getByRole('status').boundingBox();
    if (status?.height) assert.ok(status.y + status.height < Math.min(...result.buttons.map((box) => box.y)), '更新状态应在工具组上方');
    return result.buttons;
  }

  /** 核对折叠后仅保留提示入口与 Agent，隐藏按钮不能命中或进入 Tab 顺序。 */
  async function checkCollapsed() {
    await collapse();
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(await trigger.getAttribute('aria-controls'), 'shroom-app-tools-banner');
    assert.ok(await trigger.innerText(), '折叠入口必须保留文字提示');
    assert.equal(await banner.evaluate((element) => element.inert), true);
    const compact = await dock.boundingBox();
    const compactButtons = await dock.evaluate((element) => [...element.querySelectorAll('button')]
      .filter((button) => !button.closest('dialog, [inert]') && button.getBoundingClientRect().height > 0)
      .map((button) => ({ width: button.getBoundingClientRect().width, className: button.className })));
    assert.equal(compactButtons.length, 2, '折叠时只有文字入口和 Agent 可以点击');
    assert.ok(compact.width <= compactButtons.reduce((sum, button) => sum + button.width, 0) + 36,
      '折叠横幅不占用常驻按钮行宽');
    assert.equal(await banner.evaluate((element) => getComputedStyle(element).visibility), 'hidden');
    assert.ok(await agent.isVisible(), 'Agent 常驻');
    await trigger.focus();
    await page.keyboard.press('Escape');
    await settleExpanded(false);
    await page.keyboard.press('Tab');
    assert.ok(await agent.evaluate((button) => document.activeElement === button), '折叠后 Tab 跳过横幅按钮直达 Agent');
    return compact;
  }

  const initialCompact = await checkCollapsed();
  assert.match(await trigger.innerText(), /应用工具\s*悬停展开/);
  await page.mouse.move(16, 400);
  const triggerBox = await trigger.boundingBox();
  await page.mouse.move(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2);
  await page.waitForFunction(() => document.querySelector('.shroom-app-tools')?.dataset.expanded === 'true');
  const opening = await banner.evaluate(async (element) => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const style = getComputedStyle(element);
    return { opacity: Number(style.opacity), translateX: new DOMMatrix(style.transform).m41 };
  });
  assert.ok(opening.opacity > 0 && opening.opacity < 1, `展开应有过渡中间帧: ${JSON.stringify(opening)}`);
  assert.ok(opening.translateX > 0 && opening.translateX < 24, '横幅应从右向左滑入');
  await settleExpanded(true);
  const firstButton = dock.getByRole('button', { name: /版本历史/ });
  const firstBox = await firstButton.boundingBox();
  const agentBefore = await agent.boundingBox();
  await dock.evaluate((element) => {
    window.appToolsHoverStates = [];
    window.appToolsHoverMoves = [];
    window.appToolsHoverMove = (event) => window.appToolsHoverMoves.push({ x: event.clientX, y: event.clientY,
      target: event.target.className?.baseVal || event.target.className, expanded: element.dataset.expanded });
    document.addEventListener('pointermove', window.appToolsHoverMove);
    window.appToolsHoverObserver = new MutationObserver(() => window.appToolsHoverStates.push(element.dataset.expanded));
    window.appToolsHoverObserver.observe(element, { attributes: true, attributeFilter: ['data-expanded'] });
  });
  await page.mouse.move(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2, { steps: 30 });
  assert.equal(await dock.getAttribute('data-expanded'), 'true', `从入口移动到横幅时不能闪退: ${JSON.stringify(await page.evaluate(() => window.appToolsHoverMoves))}`);
  assert.equal(await page.evaluate(() => window.appToolsHoverStates.includes('false')), false);
  await page.evaluate(() => { window.appToolsHoverObserver.disconnect(); document.removeEventListener('pointermove', window.appToolsHoverMove); });
  assert.deepEqual(await agent.boundingBox(), agentBefore, '展开时 Agent 位置固定');
  const expandedBox = await banner.boundingBox();
  assert.ok(expandedBox.width > initialCompact.width, '完整工具横幅应明显宽于折叠入口');
  await page.screenshot({ path: join(artifacts, 'desktop-expanded.png') });
  await page.mouse.move(16, 400);
  await page.waitForFunction(() => document.querySelector('.shroom-app-tools')?.dataset.expanded === 'false');
  const closing = await banner.evaluate(async (element) => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return Number(getComputedStyle(element).opacity);
  });
  assert.ok(closing > 0 && closing < 1, `收起应有过渡中间帧: ${closing}`);
  await settleExpanded(false);
  await page.screenshot({ path: join(artifacts, 'desktop-collapsed.png') });

  await page.getByRole('button', { name: '切换首页反馈' }).focus();
  await page.keyboard.press('Tab');
  assert.ok(await trigger.evaluate((element) => document.activeElement === element));
  await settleExpanded(true);
  await page.keyboard.press('Tab');
  assert.ok(await firstButton.evaluate((element) => document.activeElement === element), '键盘展开后可以进入横幅按钮');
  await page.keyboard.press('Escape');
  await settleExpanded(false);
  assert.ok(await trigger.evaluate((element) => document.activeElement === element), 'Esc 收回并恢复到入口');

  for (const language of ['zh', 'en', 'ja']) {
    await page.evaluate((value) => window.appToolsFixture.language(value), language);
    for (const width of [1920, 1280, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await checkLayout();
    }
  }
  await page.evaluate(() => window.appToolsFixture.language('zh'));
  await page.setViewportSize({ width: 1280, height: 900 });
  await expand();
  const beforeBusy = await agent.boundingBox();
  await page.evaluate(() => window.appToolsFixture.busy());
  await dock.getByLabel('任务执行中').waitFor();
  assert.equal((await agent.boundingBox()).width, beforeBusy.width);
  await page.screenshot({ path: join(artifacts, 'desktop.png') });

  await dock.getByRole('button', { name: /版本历史/ }).click();
  const history = page.getByRole('dialog', { name: '版本历史' });
  await history.waitFor();
  await page.mouse.move(16, 400);
  await settleExpanded(false);
  assert.ok(await history.isVisible(), '悬停退出后 Portal 对话框仍可使用');
  await history.getByRole('button', { name: /^关\s*闭$/ }).click();
  await history.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.activeElement?.classList.contains('shroom-app-tools-toggle'));
  await expand();
  await dock.getByRole('button', { name: '应用更新与使用统计设置' }).click();
  const services = page.getByRole('dialog', { name: '应用设置' });
  assert.equal(await services.getByRole('checkbox').isChecked(), true);
  await services.getByText(/首次使用默认开启，可随时关闭/).waitFor();
  await services.getByRole('checkbox').uncheck();
  await page.waitForFunction(() => window.appToolsFixture.calls.some(call => call.serviceAction === 'setUsageEnabled' && call.enabled === false));
  await services.getByRole('checkbox').check();
  await page.waitForFunction(() => window.appToolsFixture.calls.some(call => call.serviceAction === 'setUsageEnabled' && call.enabled));
  await services.getByRole('button', { name: '检查网页更新' }).click();
  await services.getByText('新版页面已缓存，下次启动生效。').waitFor();
  await services.getByRole('checkbox').uncheck();
  await services.getByRole('button', { name: 'Close', exact: true }).click();
  await services.waitFor({ state: 'hidden' });
  await expand();
  await dock.getByRole('button', { name: /安装包更新|软件更新/ }).click();
  await page.waitForFunction(() => window.appToolsFixture.calls.some((call) => call.action === 'checkForUpdate'));
  assert.equal(await dock.getByRole('button', { name: /安装包更新|软件更新/ }).isDisabled(), true);
  await checkLayout();

  for (const event of [{ type: 'update-available', version: '2.0.0-preview-with-a-very-long-version' },
    { type: 'download-progress', percent: 42.8 }, { type: 'update-downloaded', version: '2.0.0' },
    { type: 'update-error', message: '合成网络异常' }, { type: 'update-not-available', version: '1.1.37' }]) {
    await collapse();
    await page.evaluate((data) => window.appToolsFixture.update(data), event);
    await page.waitForFunction(() => document.querySelector('.shroom-app-update-status .ant-tag')?.textContent.length > 0);
    assert.equal(await dock.getAttribute('data-expanded'), 'false', '更新事件不会强制展开横幅');
    assert.ok(await dock.getByRole('status').isVisible(), '折叠后仍可收到并显示更新状态');
    await page.setViewportSize({ width: 320, height: 844 });
    await checkLayout();
  }
  await page.evaluate(() => window.appToolsFixture.update({ type: 'download-progress', percent: 42.8 }));
  await dock.getByRole('button', { name: /安装包更新|软件更新/ }).click();
  const update = page.getByRole('dialog', { name: /安装包更新|软件更新/ });
  await update.waitFor();
  await update.getByRole('button', { name: /^关\s*闭$/ }).click();
  await update.waitFor({ state: 'hidden' });
  await expand();
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
  await checkLayout(4);
  await page.getByRole('button', { name: '切换首页反馈' }).click();
  await dock.getByRole('button', { name: '反馈', exact: true, includeHidden: true }).waitFor({ state: 'attached' });
  await checkLayout();

  await page.goto(`${url}?version=2.0.0-preview-with-a-very-long-version`);
  await dock.getByRole('button', { name: /版本历史 · v2.0.0/, includeHidden: true }).waitFor({ state: 'attached' });
  await checkLayout();
  await collapse();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expand();
  assert.equal(await banner.evaluate((element) => getComputedStyle(element).transitionDuration), '0s');
  await checkCollapsed();
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.evaluate(() => window.appToolsFixture.notice());
  const notice = page.getByRole('dialog', { name: '使用统计与错误上报说明' });
  await notice.waitFor();
  await notice.getByRole('button', { name: '查看设置' }).click();
  await notice.waitFor({ state: 'hidden' });
  await services.waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"]')]
    .some((element) => element.textContent.includes('检查网页更新') && element.getClientRects().length
      && element.contains(document.activeElement)), undefined, { timeout: 2000 });
  await services.evaluate(async () => {
    for (let frame = 0; frame < 8; frame += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  assert.ok(await services.evaluate((element) => element.contains(document.activeElement)),
    '上报提示关闭后不能把新设置弹窗的焦点抢回工具入口');
  await services.getByRole('checkbox').check();
  await services.getByRole('button', { name: 'Close', exact: true }).click();
  await services.waitFor({ state: 'hidden' });
  await checkCollapsed();

  const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  touch.on('pageerror', (error) => errors.push(error.message));
  await touch.goto(url);
  const touchDock = touch.getByRole('group', { name: '应用工具' });
  const touchTrigger = touchDock.locator('.shroom-app-tools-toggle');
  await touchTrigger.waitFor();
  assert.match(await touchTrigger.innerText(), /应用工具\s*点击展开/);
  await touchTrigger.tap();
  await touch.waitForFunction(() => document.querySelector('.shroom-app-tools')?.dataset.expanded === 'true');
  await touchDock.getByRole('button', { name: /版本历史/ }).waitFor();
  await touch.screenshot({ path: join(artifacts, 'touch-expanded.png') });
  await touch.getByRole('button', { name: '切换首页反馈' }).tap();
  await touch.waitForFunction(() => document.querySelector('.shroom-app-tools')?.dataset.expanded === 'false');
  assert.equal(await touchDock.locator('.shroom-app-tools-banner').evaluate((element) => element.inert), true);
  await touchTrigger.tap();
  await touchDock.getByRole('button', { name: '应用更新与使用统计设置' }).tap();
  const touchServices = touch.getByRole('dialog', { name: '应用设置' });
  await touchServices.waitFor();
  await touchServices.getByRole('checkbox').uncheck();
  await touchServices.getByRole('button', { name: 'Close', exact: true }).tap();
  await touchServices.waitFor({ state: 'hidden' });
  await touch.waitForFunction(() => document.activeElement?.classList.contains('shroom-app-tools-toggle'));
  assert.ok(await touchDock.locator('.shroom-agent-entry').isVisible());
  await touch.screenshot({ path: join(artifacts, 'touch-collapsed.png') });
  await touch.close();
  assert.deepEqual(errors, []);
  console.log(`App tools passed: hover animation and continuous traversal, compact/keyboard/touch interactions, reduced motion, 3 languages, 5 widths, update states, dialogs, feedback lifecycle, long versions. Screenshots: ${artifacts}`);
} catch (error) {
  await page?.screenshot({ path: join(artifacts, 'failure.png') }).catch(() => {});
  console.error('App tools failure diagnostics:', await page?.evaluate(() => ({ expanded: document.querySelector('.shroom-app-tools')?.dataset.expanded,
    active: document.activeElement?.outerHTML.slice(0, 350), banners: [...document.querySelectorAll('.shroom-app-tools-banner')].map((element) => ({ inert: element.inert, opacity: getComputedStyle(element).opacity })),
    dialogs: [...document.querySelectorAll('[role="dialog"], dialog')].map((element) => ({ title: element.getAttribute('aria-label') || element.textContent.slice(0, 60), visible: Boolean(element.getClientRects().length) })) })).catch(() => null), `Screenshots: ${artifacts}`);
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
