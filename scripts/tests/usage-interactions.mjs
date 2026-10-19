import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const artifacts = await mkdtemp(join(tmpdir(), 'shroom-usage-interactions-'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)), cacheDir: join(artifacts, '.vite'),
  logLevel: 'error', optimizeDeps: { entries: ['src/components/appTools/__fixtures__/usage.html'] }, server: { host: '127.0.0.1', port: 0, open: false } });
let browser, page;
const errors = [];
try {
  await server.listen(); browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/components/appTools/__fixtures__/usage.html`);
  await page.waitForFunction(() => window.usageFixtureEvents?.some(event => event.properties.action === 'view_create_system'));
  assert(!(await page.evaluate(() => window.usageFixtureEvents)).some(event => event.properties.action === 'view_algorithm_package'));
  const rail = await page.locator('.ant-slider-rail').boundingBox();
  await page.mouse.move(rail.x + rail.width * 0.3, rail.y + rail.height / 2); await page.mouse.down();
  await page.mouse.move(rail.x + rail.width * 0.8, rail.y + rail.height / 2, { steps: 40 });
  assert.equal((await page.evaluate(() => window.usageFixtureEvents)).filter(event => event.properties.featureId === 'tuning_gaussian').length, 0);
  await page.mouse.up();
  await page.waitForFunction(() => window.usageFixtureEvents.filter(event => event.properties.featureId === 'tuning_gaussian').length === 1);
  await page.getByRole('slider').focus(); await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => window.usageFixtureEvents.filter(event => event.properties.featureId === 'tuning_gaussian').length === 2);
  await page.locator('#history > summary').click();
  await page.waitForFunction(() => window.usageFixtureEvents.some(event => event.properties.action === 'view_algorithm_package'));
  await page.locator('#history > summary').click(); await page.locator('#history > summary').click();
  await page.getByRole('button', { name: '打开工具', exact: true }).click();
  await page.getByRole('button', { name: '查看顶部', exact: true }).click();
  await page.getByRole('button', { name: '框选失败', exact: true }).click();
  await page.waitForFunction(() => window.usageFixtureEvents.some(event => event.properties.featureId === 'region_selection' && event.properties.result === 'failure'));
  const events = await page.evaluate(() => window.usageFixtureEvents);
  assert.equal(events.filter(event => event.properties.action === 'view_algorithm_package').length, 1);
  assert.equal(events.filter(event => event.properties.featureId === 'sensor_ruler').length, 0, 'disabled tools are not counted');
  assert(events.some(event => event.eventName === 'analysis_tool_used' && event.properties.featureId === 'view_tools' && event.properties.result === 'success'));
  assert(events.every(event => !Object.hasOwn(event.properties, 'value') && !Object.hasOwn(event.properties, 'source')));
  assert.deepEqual(errors, []);
  console.log(`Usage interaction checks passed: mouse/keyboard completion, hidden history, exposures, async outcomes (${events.length} metadata events).`);
} catch (error) {
  console.error({ errors, fixture: await page?.evaluate(() => ({ events: window.usageFixtureEvents, text: document.body.innerText.slice(0, 1200) })) });
  throw error;
} finally { await browser?.close(); await server.close(); }
