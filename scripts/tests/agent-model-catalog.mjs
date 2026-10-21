import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const requireClient = createRequire(new URL('../../client/package.json', import.meta.url));
const { createServer } = requireClient('vite');
const root = await mkdtemp(join(tmpdir(), 'shroom-model-catalog-browser-'));
const defaults = JSON.parse(await readFile(new URL('../../shared/agent-model-catalog.json', import.meta.url), 'utf8'));
const server = await createServer({ root: fileURLToPath(new URL('../../client/', import.meta.url)), cacheDir: join(root, 'node_modules', '.vite'), logLevel: 'error',
  optimizeDeps: { entries: ['src/features/agent/__fixtures__/model-catalog.html'] }, server: { host: '127.0.0.1', port: 0, open: false } });
const addedProvider = { id: 'new-provider', label: '新增模型服务', baseUrl: 'https://new-model.example/v1', defaultModel: 'new-model-v2',
  models: [{ id: 'new-model-v2', label: '新增模型 V2' }, { id: 'new-model-v3', label: '新增模型 V3' }] };
const remote = { ...defaults, version: 'fixture-remote', providers: [...defaults.providers, addedProvider], source: 'remote', updatedAt: 2 };
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // 所有 HTTP 均由隔离夹具响应，禁止误读真实员工凭据接口。
  await page.route('**/api/**', (route) => route.fulfill({ json: { configured: false } }));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/src/features/agent/__fixtures__/model-catalog.html`);
  await page.evaluate((result) => window.__modelCatalogControl({ result, delay: 600 }), remote);
  await page.getByRole('button', { name: '模型设置', exact: true }).click();
  const panel = page.locator('.shroom-agent-settings').first();
  const provider = page.getByLabel('模型服务商');
  const address = page.getByLabel('服务地址');
  const model = page.getByLabel('模型名称', { exact: true });
  const key = page.locator('#shroom-agent-api-key');
  const save = page.getByRole('button', { name: '保存连接设置' });
  await page.getByRole('button', { name: '正在刷新…' }).waitFor();
  assert.equal(await provider.isDisabled(), false);
  await key.fill('synthetic-unsaved-key');
  await panel.getByRole('status').filter({ hasText: '从服务器更新' }).waitFor();
  assert.equal(await address.inputValue(), 'https://api.openai.com/v1');
  assert.equal(await model.inputValue(), 'gpt-5-mini');
  assert.equal(await key.inputValue(), 'synthetic-unsaved-key');
  assert.equal(await provider.locator('option[value="new-provider"]').count(), 1);
  await provider.selectOption('new-provider');
  assert.equal(await address.inputValue(), addedProvider.baseUrl);
  assert.equal(await model.inputValue(), 'new-model-v2');
  assert.equal(await key.inputValue(), '');
  await save.click();
  await panel.getByRole('alert').filter({ hasText: '请填写该服务商的 API 密钥' }).waitFor();
  assert.equal((await page.evaluate(() => window.__modelCatalogState())).calls.filter((call) => call.action === 'saveSettings').length, 0);
  await model.selectOption('new-model-v3');
  await key.fill('synthetic-new-provider-key');
  await save.click();
  await page.getByLabel('任务内容').waitFor();
  const saved = (await page.evaluate(() => window.__modelCatalogState())).calls.find((call) => call.action === 'saveSettings');
  assert.deepEqual(saved.payload, { baseUrl: addedProvider.baseUrl, model: 'new-model-v3', apiKey: 'synthetic-new-provider-key' });
  console.log('Remote providers/models load without changing an existing connection; explicit provider changes isolate credentials.');

  await page.getByRole('button', { name: '模型设置', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '从服务器更新' }).waitFor();
  await key.fill('synthetic-pending-key');
  const changed = { ...remote, providers: remote.providers.map((item) => item.id === addedProvider.id
    ? { ...item, baseUrl: 'https://changed-model.example/v1', models: [{ id: 'replacement-model', label: '替换模型' }], defaultModel: 'replacement-model' } : item) };
  await page.evaluate((result) => window.__modelCatalogControl({ result, delay: 600 }), changed);
  await page.getByRole('button', { name: '刷新模型列表' }).click();
  await page.getByRole('button', { name: '正在刷新…' }).waitFor();
  assert.equal(await page.getByRole('button', { name: '正在刷新…' }).isDisabled(), true);
  await panel.getByRole('status').filter({ hasText: '从服务器更新' }).waitFor();
  assert.equal(await provider.inputValue(), 'custom');
  assert.equal(await address.inputValue(), addedProvider.baseUrl);
  assert.equal(await page.getByLabel('自定义模型 ID').inputValue(), 'new-model-v3');
  assert.equal(await key.inputValue(), 'synthetic-pending-key');
  assert.equal(await key.getAttribute('placeholder'), '留空以保留当前密钥');

  await page.evaluate((result) => window.__modelCatalogControl({ result, delay: 0 }), { ...remote, providers: defaults.providers });
  await page.getByRole('button', { name: '刷新模型列表' }).click();
  await panel.getByRole('status').filter({ hasText: '从服务器更新' }).waitFor();
  assert.equal(await provider.inputValue(), 'custom');
  assert.equal(await address.inputValue(), addedProvider.baseUrl);
  assert.equal(await page.getByLabel('自定义模型 ID').inputValue(), 'new-model-v3');
  assert.equal(await key.inputValue(), 'synthetic-pending-key');

  await page.evaluate((result) => window.__modelCatalogControl({ result: { ...result, source: 'cache', warning: '离线，继续使用已缓存目录。' }, delay: 0 }), remote);
  await page.getByRole('button', { name: '刷新模型列表' }).click();
  await panel.getByRole('status').filter({ hasText: '本机缓存' }).waitFor();
  assert.equal(await address.inputValue(), addedProvider.baseUrl);
  assert.equal(await model.inputValue(), 'new-model-v3');
  assert.equal(await key.inputValue(), 'synthetic-pending-key');
  await page.evaluate(() => window.__modelCatalogControl({ fail: true }));
  await page.getByRole('button', { name: '刷新模型列表' }).click();
  await panel.getByRole('status').filter({ hasText: '仍可使用现有选项' }).waitFor();
  assert.equal(await address.inputValue(), addedProvider.baseUrl);
  assert.equal(await key.inputValue(), 'synthetic-pending-key');
  assert.equal(await page.locator('.shroom-agent-error[role="alert"]').count(), 0);
  assert.equal((await page.evaluate(() => window.__modelCatalogState())).calls.filter((call) => call.action === 'saveSettings').length, 1);
  await key.fill('');
  await save.click();
  await page.getByLabel('任务内容').waitFor();
  const retained = (await page.evaluate(() => window.__modelCatalogState())).calls.filter((call) => call.action === 'saveSettings').at(-1);
  assert.deepEqual(retained.payload, { baseUrl: addedProvider.baseUrl, model: 'new-model-v3' });
  console.log('Changed directory addresses preserve the saved endpoint and model; cached/offline refresh never saves or forwards credentials.');

  await page.getByRole('button', { name: '模型设置', exact: true }).click();
  await panel.getByRole('status').filter({ hasText: '内置模型目录' }).waitFor();
  await panel.getByRole('status').filter({ hasText: '仍可使用现有选项' }).waitFor();
  assert.equal(await provider.inputValue(), 'custom');
  assert.equal(await address.inputValue(), addedProvider.baseUrl);
  assert.equal(await page.getByLabel('自定义模型 ID').inputValue(), 'new-model-v3');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await panel.evaluate((node) => node.scrollWidth <= node.clientWidth), true);
  assert.equal(await provider.locator('option[value="deepseek"]').count(), 1);
  assert.equal(await provider.locator('option[value="custom"]').count(), 1);
  await address.fill('https://api.deepseek.com');
  assert.equal(await provider.inputValue(), 'custom');
  assert.equal(await address.getAttribute('readonly'), null);
  await address.fill('https://api.deepseek.com/custom-route');
  assert.equal(await address.inputValue(), 'https://api.deepseek.com/custom-route');
  await page.screenshot({ path: join(root, 'catalog-mobile.png') });
  assert.deepEqual(errors, []);
  console.log(`Model catalog browser regressions passed; artifacts: ${root}`);
} finally {
  await browser?.close();
  await server.close();
}
