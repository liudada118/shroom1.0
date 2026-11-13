import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-agent-markdown-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)), cacheDir: join(artifacts, 'node_modules', '.vite'), logLevel: 'error',
  optimizeDeps: { entries: ['src/features/agent/__fixtures__/markdown.html'] }, server: { host: '127.0.0.1', port: 0, open: false } });
let browser;

/** 验证容器无横向溢出，宽表和代码块仍能在自己的区域内滚动。 */
async function assertContainedLayout(page, width) {
  const layout = await page.evaluate(() => {
    const containers = ['.shroom-agent-dialog', '.shroom-agent-panel', '.shroom-agent-scroll', '.shroom-agent-messages', '.shroom-agent-turn', '.shroom-agent-message', '.shroom-agent-markdown'];
    const outer = containers.flatMap((selector) => [...document.querySelectorAll(selector)].map((node) => ({ selector, client: node.clientWidth, scroll: node.scrollWidth })));
    const inner = ['.shroom-agent-markdown-table', '.shroom-agent-markdown pre'].map((selector) => {
      const node = document.querySelector(selector);
      return { selector, client: node.clientWidth, scroll: node.scrollWidth, overflow: getComputedStyle(node).overflowX };
    });
    return { outer, inner, documentWidth: document.documentElement.scrollWidth, viewport: innerWidth };
  });
  assert.ok(layout.documentWidth <= layout.viewport + 1, `Document overflow at ${width}px: ${JSON.stringify(layout)}`);
  for (const item of layout.outer) assert.ok(item.scroll <= item.client + 1, `Outer overflow at ${width}px: ${JSON.stringify(item)}`);
  for (const item of layout.inner) {
    assert.ok(item.scroll > item.client, `Missing internal overflow at ${width}px: ${JSON.stringify(item)}`);
    assert.ok(['auto', 'scroll'].includes(item.overflow), `Not scrollable: ${JSON.stringify(item)}`);
  }
  return layout;
}

/** 检查 Markdown 结构及不可信内容不会生成可执行元素或非法链接。 */
async function assertFormattedReply(page) {
  const answer = page.locator('.shroom-agent-message.is-assistant');
  assert.equal(await answer.count(), 1);
  assert.equal(await answer.locator('h1').textContent(), '手套采集说明');
  assert.equal(await answer.locator('h2').textContent(), '核对步骤');
  assert.equal(await answer.locator('strong').textContent(), '重要说明');
  assert.equal(await answer.locator('ol > li').count(), 2);
  assert.equal(await answer.locator('ol ul > li').count(), 2);
  assert.equal(await answer.locator('blockquote').count(), 1);
  assert.equal(await answer.locator('thead th').count(), 28);
  assert.equal(await answer.locator('tbody td').count(), 28);
  assert.equal(await answer.locator('pre code.language-javascript').count(), 1);
  assert.equal(await answer.locator('img, script, iframe, object, embed').count(), 0);
  assert.equal(await page.evaluate(() => Boolean(window.__agentMarkdownUnsafe)), false);
  assert.deepEqual(await answer.locator('a').evaluateAll((nodes) => nodes.map((node) => ({ href: node.getAttribute('href'), target: node.target, rel: node.rel }))), [
    { href: 'https://example.invalid/guide', target: '_blank', rel: 'noopener noreferrer' },
    { href: 'mailto:test@example.invalid', target: '_blank', rel: 'noopener noreferrer' },
  ]);
  const question = page.locator('.shroom-agent-message.is-user');
  assert.equal(await question.locator('h1, strong, script').count(), 0);
  assert.equal(await question.locator('.shroom-agent-message-text').textContent(), '# 用户原始标题\n**这段用户输入保留星号**\n<script>window.__agentMarkdownUnsafe = true</script>');
}

try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [], unexpectedRequests = [];
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin + '/')) return route.continue();
    unexpectedRequests.push(url);
    return route.abort();
  });
  await page.goto(`${origin}/src/features/agent/__fixtures__/markdown.html`);
  await page.locator('.shroom-agent-markdown h1').waitFor();
  await page.evaluate(() => Promise.allSettled(document.getAnimations().map((animation) => animation.finished)));
  await assertFormattedReply(page);
  const layouts = [];
  for (const width of [375, 560, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    layouts.push({ width, ...(await assertContainedLayout(page, width)) });
    await page.screenshot({ path: join(artifacts, `markdown-${width}.png`) });
    const table = page.locator('.shroom-agent-markdown-table');
    await table.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.querySelector('.shroom-agent-markdown-table').scrollLeft > 0, null, { timeout: 5000 });
    assert.ok(await table.evaluate((node) => node.scrollLeft > 0), `Keyboard table scrolling failed at ${width}px`);
    await table.evaluate((node) => { node.scrollLeft = 0; });
  }
  await page.getByRole('button', { name: '流式测试', exact: true }).click();
  await page.getByRole('heading', { name: '正在分析', exact: true }).waitFor();
  assert.equal(await page.locator('.shroom-agent-message.is-assistant').count(), 1);
  assert.equal(await page.locator('.shroom-agent-markdown pre code').textContent(), 'const pending = 1;\n');
  assert.equal(await page.locator('.shroom-agent-caret').count(), 1);
  assert.equal(await page.locator('.shroom-agent-markdown table').count(), 0);
  await page.screenshot({ path: join(artifacts, 'markdown-stream.png') });
  await page.getByRole('button', { name: '完成回复', exact: true }).click();
  await page.getByRole('heading', { name: '手套采集说明', exact: true }).waitFor();
  await assertFormattedReply(page);
  assert.equal(await page.locator('.shroom-agent-caret').count(), 0);
  assert.equal(await page.getByText('const pending = 1;', { exact: true }).count(), 0);
  await page.getByRole('button', { name: '重新载入', exact: true }).click();
  await assertFormattedReply(page);
  assert.deepEqual(unexpectedRequests, [], 'Markdown attempted an automatic external request');
  assert.deepEqual(errors, [], 'Browser errors');
  console.log(JSON.stringify({ ok: true, checks: ['headings-emphasis-lists', '28-column-table', 'code-block-scroll', '375-560-1280-layout', 'keyboard-table-scroll', 'stream-to-final', 'history-remount', 'plain-user-text', 'html-url-image-safety'], artifacts, layouts }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
