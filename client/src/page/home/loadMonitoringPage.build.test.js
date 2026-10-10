import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { loadConfigFromFile } from 'vite';
import { expect, it } from 'vitest';

/** 收集实际构建插件输出的动态导入节点，检查路径是否仍可被 Rollup 静态解析。 */
function importSources(node) {
  if (!node || typeof node !== 'object') return [];
  if (node.type === 'ImportExpression') return [node.source];
  return Object.values(node).flatMap((value) => Array.isArray(value)
    ? value.flatMap(importSources) : importSources(value));
}

it('生产混淆保留真实监测页导入字面量，不产生 assets/Home 请求', async () => {
  const modulePath = fileURLToPath(new URL('./loadMonitoringPage.js', import.meta.url));
  const source = await readFile(modulePath, 'utf8');
  const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' },
    fileURLToPath(new URL('../../../vite.config.js', import.meta.url)), undefined, 'silent');
  const plugin = loaded.config.build.rollupOptions.plugins.find((item) => item.name === 'rollup-plugin-obfuscator');
  for (let index = 0; index < 5; index += 1) {
    const transformed = await plugin.transform(source, modulePath);
    const imports = importSources(parse(transformed.code, { ecmaVersion: 'latest', sourceType: 'module' }));
    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({ type: 'Literal', value: './Home' });
  }
});
