const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAppRuntime } = require('../../server/appRuntimeFactory');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-app-runtime-'));
const resourceRoot = path.join(temporaryRoot, 'resources');
const writableRoot = path.join(temporaryRoot, 'writable');
fs.mkdirSync(resourceRoot, { recursive: true });
fs.mkdirSync(writableRoot, { recursive: true });

try {
  const listeners = new Map();
  const appRuntime = createAppRuntime({
    logger: { warn: () => {} },
    runtimeResourceRoot: resourceRoot,
    runtimeWritableRoot: writableRoot,
  });
  appRuntime.displaySystems.bindRuntimeChannels({
    serialManager: { getStatus: () => ({ status: 'registered' }) },
    serialParserManager: {
      channels: {},
      registerChannel: (id) => id,
      onData: (id, handler) => listeners.set(id, handler),
      offData: (id) => listeners.delete(id),
    },
    frameOutputPipeline: { publishSit: () => ({ sent: 1 }) },
    getSensorType: () => 'runtimeCreated',
  });

  const result = appRuntime.displaySystems.save({
    manifest: {
      id: 'runtime-created',
      name: 'Runtime Created',
      sensor: {
        type: 'runtimeCreated',
        matrix: { rows: 2, cols: 2 },
        ports: ['sit'],
      },
      protocol: {
        baudRate: 115200,
        framing: { type: 'fixedLength', frameLength: 4 },
        decoding: { valueType: 'uint8', valueCount: 4 },
      },
      algorithm: { type: 'none' },
      display: {
        views: [{ id: 'heatmap', type: 'heatmap' }],
        widgets: [{ id: 'main', type: 'heatmap' }],
        renderers: [{ id: 'heatmap', type: 'heatmap' }],
        visualizationAlgorithms: [{ id: 'identity', type: 'identity' }],
        profiles: [{
          id: 'default',
          renderer: 'heatmap',
          visualizationAlgorithm: 'identity',
          widgets: ['main'],
        }],
        defaultView: 'heatmap',
        defaultProfile: 'default',
      },
      metadata: { runtimeMode: 'parallel' },
    },
  });

  assert.strictEqual(result.displaySystem.id, 'runtime-created');
  assert.strictEqual(appRuntime.displaySystems.getStatus().count, 1);
  assert.strictEqual(appRuntime.displaySystems.getStatus().runtimeBindings.bindings[0].status, 'bound');
  assert.ok(listeners.has('runtime-created:sit'));

  console.log('appRuntimeDisplaySystems.test.js passed');
} finally {
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir()))) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
