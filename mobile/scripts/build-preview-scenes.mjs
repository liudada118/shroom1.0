import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientRoot = path.resolve(mobileRoot, '../client');
const clientRequire = createRequire(path.join(clientRoot, 'package.json'));
const require = createRequire(path.join(mobileRoot, '../package.json'));
const runtimePath = '/__shroom-preview-sampler.js';
const runtime = `
import { samplePreviewScene } from '/src/page/licensePortal/scene/SystemScenePreview.jsx';
import { SCENE_MODELS } from '/src/page/licensePortal/scene/sceneCatalog.js';
window.previewKeys = [...SCENE_MODELS.map(({ key }) => key), 'foot'];
/** 固定采样随机序列，使相同原资源生成相同离线数据。 */
window.sampleOfflinePreview = async (key) => {
  let seed = [...key].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 20261013);
  /** 随机源只供表面采样使用，不受异步纹理解码顺序影响。 */
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const target = await samplePreviewScene(key, random);
  return { positions: Array.from(target.positions, value => Number(value.toFixed(4))),
    colors: Array.from(target.colors, value => Number(value.toFixed(4))) };
};
`;

/** 从桌面原资源生成紧凑离线粒子；运行后关闭临时浏览器和本机服务。 */
export async function buildPreviewScenes() {
  const vitePackage = clientRequire.resolve('vite/package.json');
  const { createServer } = await import(pathToFileURL(path.join(path.dirname(vitePackage), 'dist/node/index.js')).href);
  const { chromium } = require('playwright');
  const server = await createServer({ root: clientRoot, configFile: false, logLevel: 'error',
    server: { host: '127.0.0.1', port: 0, open: false },
    plugins: [{ name: 'shroom-offline-preview-sampler',
      /** 仅提供本次构建所用的采样模块。 */
      resolveId(id) { if (id === runtimePath) return id; },
      /** 复用桌面采样实现，不维护第二套模型归一或点位算法。 */
      load(id) { if (id === runtimePath) return runtime; },
      /** 采样页面没有应用入口，不会连接任何后端。 */
      configureServer(vite) {
        vite.middlewares.use('/__shroom-preview-builder', (_request, response) => {
          response.setHeader('Content-Type', 'text/html');
          response.end(`<html><head></head><body><script type="module" src="${runtimePath}"></script></body></html>`);
        });
      },
    }],
  });
  let browser;
  try {
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(90000);
    const sourcePaths = new Set();
    const externalRequests = new Set();
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        if (url.origin !== origin) { externalRequests.add(url.href); return route.abort(); }
        if (url.pathname.startsWith('/model/') || /^\/foot(left)?\.png$/.test(url.pathname)) {
          sourcePaths.add(decodeURIComponent(url.pathname).slice(1));
        }
      }
      return route.continue();
    });
    await page.goto(`${origin}/__shroom-preview-builder`);
    await page.waitForFunction(() => typeof window.sampleOfflinePreview === 'function');
    const keys = await page.evaluate(() => window.previewKeys);
    const output = { version: 1, particleCount: 3600, scenes: {} };
    for (const key of keys) {
      sourcePaths.clear();
      const sample = await page.evaluate((sceneKey) => window.sampleOfflinePreview(sceneKey), key);
      for (const [name, values] of Object.entries(sample)) {
        if (values.length !== output.particleCount * 3 || !values.every(Number.isFinite)) {
          throw new Error(`${key}.${name} must contain exactly ${output.particleCount * 3} finite coordinates`);
        }
      }
      if (!sourcePaths.size) throw new Error(`${key} did not load its original model or foot image`);
      const sources = [];
      for (const relativePath of [...sourcePaths].sort()) {
        const filename = path.resolve(clientRoot, 'public', relativePath);
        if (!filename.startsWith(path.resolve(clientRoot, 'public') + path.sep)) throw new Error('Preview source is outside public/');
        sources.push({ path: relativePath, sha256: createHash('sha256').update(await fs.readFile(filename)).digest('hex') });
      }
      output.scenes[key] = { ...sample, sources };
      console.log(`PREVIEW_SAMPLED ${key}: ${output.particleCount} points from ${sources.map(({ path: sourcePath }) => sourcePath).join(', ')}`);
    }
    if (externalRequests.size) throw new Error(`Preview generation requested external resources: ${[...externalRequests].join(', ')}`);
    const destination = path.join(clientRoot, 'src/mobile/previewScenes.json');
    const serialized = JSON.stringify(output) + '\n';
    await fs.writeFile(destination, serialized, 'utf8');
    console.log(`Offline preview data ready: ${keys.length} scenes, ${Math.round(Buffer.byteLength(serialized) / 1024)} KiB`);
    return output;
  } finally {
    try { await browser?.close(); } finally { await server.close(); }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildPreviewScenes();
