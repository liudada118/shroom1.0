import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const requireRoot = createRequire(new URL('../../package.json', import.meta.url));
const { chromium } = requireRoot('playwright');
const buildFlag = process.argv.indexOf('--build-dir');
const buildDir = resolve(buildFlag < 0 ? join(tmpdir(), 'shroom-mobile-display') : process.argv[buildFlag + 1]);
const htmlFlag = process.argv.indexOf('--generated-html');
const bridgeOnly = process.argv.includes('--bridge-only');
const screenshots = await mkdtemp(join(tmpdir(), 'shroom-mobile-browser-'));
let html;
if (htmlFlag >= 0) {
  const generated = await readFile(resolve(process.argv[htmlFlag + 1]), 'utf8');
  const literal = generated.match(/export const displayHtml\s*=\s*("[\s\S]*");\s*$/)?.[1];
  assert.ok(literal, 'RN 生成模块必须导出离线 HTML 字符串');
  html = JSON.parse(literal);
} else {
  const script = (await readFile(join(buildDir, 'display.js'), 'utf8')).replace(/<\/script/gi, '<\\/script');
  const style = await readFile(join(buildDir, 'style.css'), 'utf8');
  html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${style}</style></head><body><div id="root"></div><script>${script}</script></body></html>`;
}
const browser = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errors = [];
const requests = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => { if (!/^(data|blob):/.test(request.url())) requests.push(request.url()); });

/** 通过实际文本输入和失焦提交参数，小数另逐字键入以覆盖编辑中间态。 */
async function setParameter(name, value, typeSequentially = false) {
  const input = page.getByRole('textbox', { name, exact: true });
  if (typeSequentially) {
    await input.fill('');
    await input.pressSequentially(value);
  } else await input.fill(value);
  await input.press('Tab');
  assert.equal(await input.inputValue(), value, '参数输入必须保留完整小数并在失焦后提交');
}

try {
  await page.setContent(html.replace('</head>', `<script>
    window.messages=[];
    window.ReactNativeWebView={postMessage:function(message){messages.push(JSON.parse(message));}};
    window.drawnLabels=[];
    const nativeFillText=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){drawnLabels.push(String(text));return nativeFillText.call(this,text,...args);};
  </script></head>`));
  await page.waitForFunction(() => window.ShroomMobile && window.messages.some((message) => message.type === 'web.ready'));
  await page.getByRole('heading', { name: 'Shroom Vision', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('.system-scene-particle-root')?.dataset.modelStatus === 'ready');
  await page.screenshot({ path: join(screenshots, 'home.png') });
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(screenshots, 'home-portrait.png') });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '选择系统', exact: true }).click();
  await page.getByRole('heading', { name: '选择你的展示系统' }).waitFor();
  await page.screenshot({ path: join(screenshots, 'systems.png') });
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '进入该系统', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(screenshots, 'systems-portrait.png') });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(300);
  await page.locator('[data-system="hand0205"]').click();
  assert.equal(await page.getByRole('button', { name: '暂未适配', exact: true }).isDisabled(), true, '未适配协议不能把同一USB帧套给其他模型');
  await page.getByRole('textbox', { name: '搜索系统' }).fill('手部检测');
  await page.locator('[data-system="hand"]').click();
  assert.equal(await page.locator('.system-option').count(), 1);
  await page.getByRole('button', { name: '进入该系统', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: '开始采集', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: '回放', exact: true }).isDisabled(), true);
  await page.locator('#canvas canvas').waitFor();
  await page.screenshot({ path: join(screenshots, 'monitor-points.png') });
  for (const viewport of [{ width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(300);
    const bar = await page.locator('.home > .title').boundingBox();
    const tools = await page.locator('.portal-quick-tools-anchor').boundingBox();
    assert.ok(tools.y >= bar.y + bar.height, '横竖屏的工具栏不能遮挡顶部设备控制');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: join(screenshots, `monitor-${viewport.width}.png`) });
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '热力图', exact: true }).click();
  await page.locator('.mobile-waiting').waitFor();
  const firstFrame = { type: 'pressure.frame', version: 1,
    source: 'usb', sequence: 0, timestamp: Date.now(), rows: 32, columns: 32,
    values: Array.from({ length: 1024 }, (_, index) => {
      const row = Math.floor(index / 32);
      return row >= 15 && row < 19 && index % 32 < 16 ? 200 : 0;
    }) };
  await page.evaluate(`window.ShroomMobile.receive(${JSON.stringify(JSON.stringify(firstFrame))})`);
  await page.waitForFunction(() => document.querySelector('.mobile-stream-status')?.textContent.includes('USB 数据'));
  assert.deepEqual(await page.evaluate(() => window.messages.filter((message) => message.type === 'web.frame')),
    [{ type: 'web.frame', sequence: 0 }], 'JSON 字符串注入必须正确回报帧序号');
  if (!bridgeOnly) {
  await page.getByRole('button', { name: '三维点图', exact: true }).click();
  await page.locator('#canvas canvas').waitFor();
  await page.screenshot({ path: join(screenshots, 'monitor-live-points.png') });
  await page.getByRole('button', { name: '工具', exact: true }).click();
  await page.getByRole('tab', { name: '数据分析', exact: true }).click();
  await page.getByRole('button', { name: '框选分析', exact: true }).click();
  await page.locator('.portal-selection-panel summary').click();
  await page.getByRole('button', { name: '添加选区', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.portal-region-stats')?.textContent.includes('200.00'));
  await page.evaluate(() => window.ShroomMobile.receive({ type: 'pressure.frame', version: 1,
    source: 'usb', sequence: 1, timestamp: Date.now(), rows: 32, columns: 32, values: Array(1024).fill(100) }));
  await page.waitForFunction(() => document.querySelector('.portal-region-stats')?.textContent.includes('最大 100.00'));
  await page.getByRole('button', { name: '退出框选', exact: true }).click();
  await page.getByRole('button', { name: '收起实用工具', exact: true }).click();
  await page.getByRole('button', { name: '调节', exact: true }).click();
  assert.equal(await page.getByRole('slider').count(), 6, '三维调节应显示实际参数，不再切换视图');
  assert.equal(await page.getByRole('dialog').getByRole('button', { name: '热力图', exact: true }).count(), 0);
  await setParameter('时间平滑数值', '1');
  await setParameter('单点过滤数值', '150');
  await page.screenshot({ path: join(screenshots, 'point-parameters.png') });
  await page.getByRole('button', { name: '关闭显示调节', exact: true }).click();
  await page.waitForTimeout(600);
  const filteredPoints = await page.locator('#canvas canvas').screenshot();
  await page.getByRole('button', { name: '调节', exact: true }).click();
  await setParameter('单点过滤数值', '0');
  await setParameter('高度倍率数值', '0.2', true);
  await page.getByRole('button', { name: '关闭显示调节', exact: true }).click();
  await page.waitForTimeout(600);
  assert.notDeepEqual(await page.locator('#canvas canvas').screenshot(), filteredPoints, '断流最后一帧降低过滤阈值后恢复热点');
  await page.getByRole('button', { name: '热力图', exact: true }).click();
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.mobile-renderer canvas');
    const context = canvas?.getContext('2d');
    return context && Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data)
      .some((value, index) => index % 4 !== 3 && value > 0);
  });
  await page.screenshot({ path: join(screenshots, 'heatmap.png') });
  const heatBefore = await page.locator('.mobile-renderer canvas').evaluate((canvas) => canvas.toDataURL());
  await page.getByRole('button', { name: '调节', exact: true }).click();
  assert.equal(await page.getByRole('slider').count(), 3);
  await setParameter('单点过滤数值', '150');
  await page.waitForFunction((previous) => document.querySelector('.mobile-renderer canvas').toDataURL() !== previous, heatBefore);
  const heatFiltered = await page.locator('.mobile-renderer canvas').evaluate((canvas) => canvas.toDataURL());
  await setParameter('单点过滤数值', '0');
  await page.waitForFunction((previous) => document.querySelector('.mobile-renderer canvas').toDataURL() !== previous, heatFiltered);
  assert.equal(await page.locator('.mobile-renderer canvas').evaluate((canvas) => canvas.toDataURL()), heatBefore, '热力图从缓存原始帧恢复，零过滤不能失效');
  await setParameter('色带上限数值', '120');
  await setParameter('热力点半径数值', '12');
  await page.screenshot({ path: join(screenshots, 'heatmap-parameters.png') });
  await page.getByRole('button', { name: '关闭显示调节', exact: true }).click();
  await page.getByRole('button', { name: '原始数字', exact: true }).click();
  await page.waitForFunction(() => window.drawnLabels.includes('100'));
  await page.screenshot({ path: join(screenshots, 'numbers.png') });
  assert.equal(await page.getByRole('button', { name: '原始数字', exact: true }).getAttribute('aria-pressed'), 'true');
  const numbersBefore = await page.locator('.mobile-renderer').screenshot();
  await page.getByRole('button', { name: '调节', exact: true }).click();
  assert.equal(await page.getByRole('slider').count(), 1, '原始数字只调颜色，读数不允许被过滤');
  await setParameter('色带上限数值', '100');
  await page.getByRole('button', { name: '关闭显示调节', exact: true }).click();
  await page.waitForTimeout(300);
  assert.notDeepEqual(await page.locator('.mobile-renderer').screenshot(), numbersBefore, '数字最后一帧色带应即时重绘');
  await page.getByRole('button', { name: '三维点图', exact: true }).click();
  await page.getByRole('button', { name: '调节', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: '高度倍率数值', exact: true }).inputValue(), '0.2', '切换视图保留各自参数');
  await page.getByRole('button', { name: '恢复默认参数', exact: true }).click();
  assert.equal(await page.getByRole('textbox', { name: '高度倍率数值', exact: true }).inputValue(), '0.1');
  await page.getByRole('button', { name: '关闭显示调节', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.messages.filter((message) => message.type === 'usb.command')), [], '调参与切图不得发送USB命令');
  assert.ok((await page.locator('.mobile-metrics').textContent()).includes('100'), '显示过滤不能改写原始统计');
  }
  await page.evaluate(() => window.ShroomMobile.receive({ type: 'pressure.frame', version: 1,
    source: 'usb', sequence: 2, timestamp: Date.now(), rows: 32, columns: 32,
    values: [12.5, ...Array(1023).fill(0)] }));
  await page.getByRole('alert').waitFor();
  assert.ok((await page.getByRole('alert').textContent()).includes('整数'), '生成网页拒绝小数压力值');
  assert.ok((await page.locator('.mobile-metrics').textContent()).includes(bridgeOnly ? '200' : '100'), '错误帧保留上轮合法统计');
  await page.evaluate(() => window.ShroomMobile.receive({ type: 'stream.reset', version: 1, source: 'demo' }));
  await page.locator('.mobile-waiting').waitFor();
  assert.ok(!(await page.locator('.mobile-metrics').textContent()).includes(bridgeOnly ? '200' : '100'), '切源重置不能残留旧值');
  await page.getByRole('button', { name: '热力图', exact: true }).click();
  await page.evaluate(() => window.ShroomMobile.receive({ type: 'pressure.frame', version: 1,
    source: 'demo', sequence: 0, timestamp: Date.now(), rows: 32, columns: 32, values: Array(1024).fill(60) }));
  await page.waitForFunction(() => document.querySelector('.mobile-stream-status')?.textContent.includes('演示数据'));
  assert.deepEqual(await page.evaluate(() => window.messages.filter((message) => message.type === 'web.frame')),
    [...(bridgeOnly ? [{ type: 'web.frame', sequence: 0 }] : [{ type: 'web.frame', sequence: 0 }, { type: 'web.frame', sequence: 1 }]),
      { type: 'web.frame', sequence: 0 }], '重置后允许新来源从零计数');
  if (!bridgeOnly) {
  await page.waitForFunction(() => document.querySelector('.mobile-stream-status')?.textContent.includes('数据已暂停'));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const buttons = await page.getByRole('button').all();
  for (const button of buttons) assert.ok((await button.boundingBox()).height >= 44, '触摸按钮至少 44px');
  await page.screenshot({ path: join(screenshots, 'narrow.png') });
  }
  assert.deepEqual(errors, [], '离线生产入口无未捕获错误');
  assert.deepEqual(requests, [], '展示入口不能依赖网络资源');
  console.log(JSON.stringify({ passed: true, screenshots, networkRequests: requests.length, errors }));
} catch (error) {
  console.error(JSON.stringify({ errors, requests, screenshots }));
  await page.screenshot({ path: join(screenshots, 'failure.png') });
  throw error;
} finally {
  await page.close();
  await browser.close();
}
