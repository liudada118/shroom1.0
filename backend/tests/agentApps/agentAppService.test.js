const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  AGENT_APP_MAX_FILE_BYTES,
  AGENT_APP_MAX_FILES,
  AGENT_APP_MAX_CHARTS,
  createAgentAppService,
  normalizeAgentAppManifest,
} = require('../../extension-host/agent-apps/agentAppService');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-agent-apps-'));
const writableRoot = path.join(temporaryRoot, 'writable');
const resourceRoot = path.join(temporaryRoot, 'resources');
const policyDirectory = path.join(resourceRoot, 'agent');
fs.mkdirSync(policyDirectory, { recursive: true });
fs.writeFileSync(
  path.join(policyDirectory, 'policy.json'),
  JSON.stringify({ schemaVersion: 1, policyVersion: '1.0.0' }),
);

function manifest(overrides = {}) {
  const { renderer: rendererOverrides = {}, ...manifestOverrides } = overrides;
  return {
    schemaVersion: 1,
    id: 'pressure-grid-demo',
    name: 'Pressure Grid Demo',
    version: '1.0.0',
    renderer: {
      entry: 'frontend/index.html',
      ...rendererOverrides,
    },
    charts: [{ id: 'cop-track', label: '重心轨迹', entry: 'charts/cop.html', height: 260 }],
    ...manifestOverrides,
  };
}

function files(html = '<!doctype html><title>Agent App</title>') {
  return [
    { path: 'frontend/index.html', encoding: 'utf8', content: html },
    { path: 'charts/cop.html', encoding: 'utf8', content: '<!doctype html><title>COP</title>' },
    { path: 'frontend/data.bin', encoding: 'base64', content: 'AAEC/w==' },
  ];
}

function hasCode(code) {
  return (error) => error?.code === code;
}

try {
  const service = createAgentAppService({
    runtimeWritableRoot: writableRoot,
    runtimeResourceRoot: resourceRoot,
    logger: { error: () => {}, warn: () => {} },
  });

  assert.deepStrictEqual(service.getStatus(), { apps: [], errors: [] });
  assert.deepStrictEqual(service.readPolicy(), { schemaVersion: 1, policyVersion: '1.0.0' });

  const installed = service.install({ manifest: manifest(), files: files() });
  assert.strictEqual(installed.app.id, 'pressure-grid-demo');
  assert.strictEqual(installed.app.rendererId, 'agent:pressure-grid-demo');
  assert.strictEqual(installed.app.renderer.id, 'main');
  assert.strictEqual(installed.app.renderer.label, 'Pressure Grid Demo');
  assert.strictEqual(installed.app.renderer.height, 480);
  assert.deepStrictEqual(installed.app.charts, [{
    id: 'cop-track',
    label: '重心轨迹',
    entry: 'charts/cop.html',
    height: 260,
    chartId: 'agent-chart:pressure-grid-demo:cop-track',
    entryUrl: '/api/agent-apps/pressure-grid-demo/files/charts/cop.html',
  }]);
  assert.deepStrictEqual(installed.app.permissions, ['sensor.read']);
  assert.strictEqual(
    installed.app.entryUrl,
    '/api/agent-apps/pressure-grid-demo/files/frontend/index.html',
  );
  assert.strictEqual(installed.app.editable, true);

  const appDirectory = path.join(writableRoot, 'agent-apps', 'pressure-grid-demo');
  const storedManifest = JSON.parse(fs.readFileSync(path.join(appDirectory, 'app.json'), 'utf8'));
  assert.deepStrictEqual(storedManifest.permissions, ['sensor.read']);
  assert.strictEqual(storedManifest.renderer.entry, 'frontend/index.html');
  assert.strictEqual(storedManifest.charts[0].entry, 'charts/cop.html');
  assert.deepStrictEqual(
    [...fs.readFileSync(path.join(appDirectory, 'frontend/data.bin'))],
    [0, 1, 2, 255],
  );
  assert.strictEqual(
    service.resolveStaticFile('pressure-grid-demo', 'frontend/index.html'),
    fs.realpathSync(path.join(appDirectory, 'frontend/index.html')),
  );

  assert.throws(
    () => service.install({ manifest: manifest(), files: files() }),
    hasCode('AGENT_APP_EXISTS'),
  );

  const overwritten = service.install({
    manifest: manifest({ version: '1.1.0' }),
    files: files('<!doctype html><title>Updated</title>'),
    overwrite: true,
  });
  assert.strictEqual(overwritten.app.version, '1.1.0');
  assert.match(fs.readFileSync(path.join(appDirectory, 'frontend/index.html'), 'utf8'), /Updated/);
  assert.deepStrictEqual(
    fs.readdirSync(path.join(writableRoot, 'agent-apps')).filter((name) => name.startsWith('.')),
    [],
  );

  assert.throws(
    () => service.install({
      manifest: manifest({ permissions: [] }),
      files: files('should not replace'),
      overwrite: true,
    }),
    hasCode('AGENT_APP_INVALID'),
  );
  assert.match(fs.readFileSync(path.join(appDirectory, 'frontend/index.html'), 'utf8'), /Updated/);

  [
    { manifest: manifest({ id: '../escape' }), files: files() },
    { manifest: manifest({ id: 123 }), files: files() },
    { manifest: manifest({ name: 123 }), files: files() },
    { manifest: manifest({ version: 'latest' }), files: files() },
    { manifest: manifest({ renderer: { entry: 'frontend/index.html', height: '520' } }), files: files() },
    { manifest: manifest({ charts: {} }), files: files() },
    { manifest: manifest({ charts: [{ id: 'same', entry: 'charts/cop.html' }, { id: 'same', entry: 'charts/cop.html' }] }), files: files() },
    { manifest: manifest({ charts: [{ id: 'missing', entry: 'charts/missing.html' }] }), files: files() },
    { manifest: manifest({ permissions: ['sensor.read', 'filesystem.write'] }), files: files() },
    { manifest: manifest(), files: [{ path: '../escape.html', encoding: 'utf8', content: '' }] },
    { manifest: manifest(), files: [{ path: 'C:/escape.html', encoding: 'utf8', content: '' }] },
    { manifest: manifest(), files: [{ path: 'frontend\\index.html', encoding: 'utf8', content: '' }] },
    { manifest: manifest(), files: [{ path: 'app.json', encoding: 'utf8', content: '{}' }] },
    { manifest: manifest(), files: [{ path: 'frontend/index.html', encoding: 'base64', content: '!bad!' }] },
    { manifest: manifest(), files: [{ path: 'frontend/other.html', encoding: 'utf8', content: '' }] },
  ].forEach((bundle) => assert.throws(
    () => service.install({ ...bundle, overwrite: true }),
    (error) => error?.code === 'AGENT_APP_INVALID' || error?.code === 'AGENT_APP_FILE_INVALID',
  ));
  assert.throws(
    () => service.install({ manifest: manifest(), files: files(), overwrite: 'true' }),
    hasCode('AGENT_APP_INVALID'),
  );

  assert.strictEqual(normalizeAgentAppManifest({
    schemaVersion: 1,
    id: 'chart-only',
    name: 'Chart Only',
    version: '1.0.0',
    charts: [{ id: 'trend', entry: 'charts/trend.html' }],
  }).renderer, null);
  assert.throws(
    () => normalizeAgentAppManifest({
      schemaVersion: 1,
      id: 'empty-app',
      name: 'Empty App',
      version: '1.0.0',
    }),
    hasCode('AGENT_APP_INVALID'),
  );
  assert.throws(
    () => normalizeAgentAppManifest({
      schemaVersion: 1,
      id: 'too-many-charts',
      name: 'Too Many Charts',
      version: '1.0.0',
      charts: Array.from({ length: AGENT_APP_MAX_CHARTS + 1 }, (_, index) => ({
        id: `chart-${index}`,
        entry: `charts/${index}.html`,
      })),
    }),
    hasCode('AGENT_APP_LIMIT_EXCEEDED'),
  );

  assert.throws(
    () => service.install({
      manifest: manifest({ id: 'too-many-files' }),
      files: Array.from({ length: AGENT_APP_MAX_FILES + 1 }, (_, index) => ({
        path: `file-${index}.txt`,
        encoding: 'utf8',
        content: '',
      })),
    }),
    hasCode('AGENT_APP_LIMIT_EXCEEDED'),
  );

  assert.throws(
    () => service.resolveStaticFile('pressure-grid-demo', '../app.json'),
    hasCode('AGENT_APP_FILE_INVALID'),
  );
  assert.throws(
    () => service.resolveStaticFile('pressure-grid-demo', 'frontend/missing.js'),
    hasCode('AGENT_APP_FILE_NOT_FOUND'),
  );
  const oversizedManualFile = path.join(appDirectory, 'frontend', 'oversized.bin');
  fs.writeFileSync(oversizedManualFile, '');
  fs.truncateSync(oversizedManualFile, AGENT_APP_MAX_FILE_BYTES + 1);
  assert.throws(
    () => service.resolveStaticFile('pressure-grid-demo', 'frontend/oversized.bin'),
    hasCode('AGENT_APP_LIMIT_EXCEEDED'),
  );
  fs.rmSync(oversizedManualFile, { force: true });

  // 手工写入坏目录时不影响有效 app，错误进入可观测的 errors 列表。
  const brokenDirectory = path.join(writableRoot, 'agent-apps', 'broken-app');
  fs.mkdirSync(brokenDirectory, { recursive: true });
  fs.writeFileSync(path.join(brokenDirectory, 'app.json'), '{broken');
  const status = service.reload();
  assert.deepStrictEqual(status.apps.map((app) => app.id), ['pressure-grid-demo']);
  assert.strictEqual(status.errors.length, 1);
  assert.strictEqual(status.errors[0].directory, 'broken-app');
  assert.strictEqual(status.errors[0].code, 'AGENT_APP_INVALID');

  // 重启式重建 service 后仍能发现磁盘上的有效包。
  const reloadedService = createAgentAppService({
    runtimeWritableRoot: writableRoot,
    runtimeResourceRoot: resourceRoot,
    logger: { error: () => {}, warn: () => {} },
  });
  assert.strictEqual(reloadedService.getById('pressure-grid-demo').version, '1.1.0');

  const missingPolicyService = createAgentAppService({
    runtimeWritableRoot: path.join(temporaryRoot, 'missing-policy-writable'),
    runtimeResourceRoot: path.join(temporaryRoot, 'missing-policy-resources'),
    developmentPolicyPath: path.join(temporaryRoot, 'missing-policy.json'),
    logger: { error: () => {}, warn: () => {} },
  });
  assert.throws(() => missingPolicyService.readPolicy(), hasCode('AGENT_APP_POLICY_NOT_FOUND'));

  // 首次发现目录不可用时只降级 Agent 扩展，不阻止稳定后端创建。
  const unavailableWritableRoot = path.join(temporaryRoot, 'unavailable-writable');
  const unavailableAppsRoot = path.resolve(unavailableWritableRoot, 'agent-apps');
  const originalMkdirSync = fs.mkdirSync;
  fs.mkdirSync = (directoryPath, options) => {
    if (path.resolve(directoryPath) === unavailableAppsRoot) {
      const error = new Error('simulated EACCES');
      error.code = 'EACCES';
      throw error;
    }
    return originalMkdirSync(directoryPath, options);
  };
  try {
    const degradedService = createAgentAppService({
      runtimeWritableRoot: unavailableWritableRoot,
      runtimeResourceRoot: resourceRoot,
      logger: { error: () => {}, warn: () => {} },
    });
    assert.deepStrictEqual(degradedService.getStatus().apps, []);
    assert.strictEqual(degradedService.getStatus().errors[0].code, 'AGENT_APP_DISCOVERY_FAILED');
  } finally {
    fs.mkdirSync = originalMkdirSync;
  }

  console.log('agentAppService.test.js passed');
} finally {
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir()))) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
