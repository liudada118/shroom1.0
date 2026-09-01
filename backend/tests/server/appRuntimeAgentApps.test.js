const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAppRuntime } = require('../../extension-host/appRuntimeFactory');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-app-runtime-agent-'));
const resourceRoot = path.join(temporaryRoot, 'resources');
const writableRoot = path.join(temporaryRoot, 'writable');
fs.mkdirSync(path.join(resourceRoot, 'agent'), { recursive: true });
fs.writeFileSync(
  path.join(resourceRoot, 'agent', 'policy.json'),
  JSON.stringify({ schemaVersion: 1, policyVersion: '1.0.0' }),
);

try {
  const appRuntime = createAppRuntime({
    logger: { error: () => {}, warn: () => {} },
    runtimeResourceRoot: resourceRoot,
    runtimeWritableRoot: writableRoot,
  });

  assert.deepStrictEqual(appRuntime.agentApps.getStatus(), { apps: [], errors: [] });
  assert.ok(fs.existsSync(path.join(writableRoot, 'agent-apps')));
  assert.strictEqual(appRuntime.agentApps.readPolicy().policyVersion, '1.0.0');

  const result = appRuntime.agentApps.install({
    manifest: {
      schemaVersion: 1,
      id: 'runtime-agent-demo',
      name: 'Runtime Agent Demo',
      version: '1.0.0',
      renderer: { entry: 'index.html' },
      permissions: ['sensor.read'],
    },
    files: [{ path: 'index.html', encoding: 'utf8', content: '<!doctype html>' }],
  });
  assert.strictEqual(result.app.rendererId, 'agent:runtime-agent-demo');
  assert.deepStrictEqual(
    appRuntime.agentApps.getStatus().apps.map((app) => app.id),
    ['runtime-agent-demo'],
  );

  console.log('appRuntimeAgentApps.test.js passed');
} finally {
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir()))) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
