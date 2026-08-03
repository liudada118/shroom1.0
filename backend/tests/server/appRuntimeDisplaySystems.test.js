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

const builtInDirectory = path.join(resourceRoot, 'display-systems', 'built-in-demo');
fs.mkdirSync(builtInDirectory, { recursive: true });
fs.writeFileSync(
  path.join(builtInDirectory, 'line-order.json'),
  JSON.stringify({ order: [1] }),
);
fs.writeFileSync(
  path.join(builtInDirectory, 'point-order.json'),
  JSON.stringify({ matrix: { rows: 1, cols: 1 }, points: [[0, 0]] }),
);
fs.writeFileSync(
  path.join(builtInDirectory, 'display-system.json'),
  JSON.stringify({
    schemaVersion: 2,
    id: 'built-in-demo',
    name: 'Built-in Demo',
    sensor: {
      type: 'builtInDemo',
      matrix: { rows: 1, cols: 1 },
      ports: ['sit'],
    },
    files: {
      lineOrder: 'line-order.json',
      pointOrder: 'point-order.json',
    },
    protocol: {
      baudRate: 115200,
      framing: { type: 'fixedLength', frameLength: 1 },
      decoding: { valueType: 'uint8', valueCount: 1 },
    },
    algorithm: { type: 'none' },
    display: {
      widgets: [{ id: 'main', type: 'heatmap' }],
    },
    metadata: { origin: 'system', runtimeMode: 'disabled' },
  }),
);

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
  assert.strictEqual(appRuntime.displaySystems.getStatus().count, 2);
  assert.strictEqual(
    appRuntime.displaySystems.getStatus().systems
      .find((system) => system.id === 'built-in-demo').editable,
    false,
  );
  assert.strictEqual(
    appRuntime.displaySystems.getStatus().runtimeBindings.bindings
      .find((binding) => binding.displaySystemId === 'runtime-created').status,
    'bound',
  );
  assert.ok(listeners.has('runtime-created:sit'));
  assert.throws(() => appRuntime.displaySystems.save({
    manifest: {
      id: 'built-in-demo',
      name: 'Illegal Override',
    },
    overwrite: true,
  }), (error) => error.code === 'DISPLAY_SYSTEM_READ_ONLY');

  // ──────────────────────────────────────────────────────────────────────
  // 草稿层的两个出路：保存（写自己）与另存为（复制自带的那份）
  // ──────────────────────────────────────────────────────────────────────

  const builtInManifestPath = path.join(builtInDirectory, 'display-system.json');
  const builtInBefore = fs.readFileSync(builtInManifestPath, 'utf8');
  // 自带展示系统的目录在只读资源目录里，保存必须被挡在写盘之前。
  assert.throws(
    () => appRuntime.displaySystems.saveDisplaySection('built-in-demo', {
      canvas: { colormap: 'thermal' },
    }),
    (error) => error.code === 'DISPLAY_SYSTEM_READ_ONLY',
  );
  assert.strictEqual(fs.readFileSync(builtInManifestPath, 'utf8'), builtInBefore);
  assert.strictEqual(appRuntime.displaySystems.saveDisplaySection('no-such-system', {}), null);

  // 自建的那份可以直接保存，写完立刻重载，前端下一次取到的就是新基线。
  const sectionSaved = appRuntime.displaySystems.saveDisplaySection('runtime-created', {
    canvas: { colormap: 'viridis' },
    chartCards: [{ templateId: 'raw-total', name: '总和', formula: 'sum()' }],
  });
  assert.strictEqual(sectionSaved.displaySystem.id, 'runtime-created');
  assert.strictEqual(
    appRuntime.displaySystems.getById('runtime-created').display.canvas.colormap.id,
    'viridis',
  );

  // **另存为不检查源能不能写** —— 自带展示系统正是要能被另存为，那是它唯一的出路。
  const duplicated = appRuntime.displaySystems.duplicate('built-in-demo', {
    id: 'built-in-demo-copy',
    name: '我的内置副本',
    canvas: { colormap: 'inferno' },
  });
  assert.strictEqual(duplicated.displaySystem.id, 'built-in-demo-copy');
  assert.ok(fs.existsSync(path.join(writableRoot, 'display-systems', 'built-in-demo-copy', 'display-system.json')));
  // 副本躺在可写目录里，metadata.origin 也被改写过，所以它是可编辑的 ——
  // 否则用户另存为之后连第二次保存都做不了。
  assert.strictEqual(
    appRuntime.displaySystems.getStatus().systems
      .find((system) => system.id === 'built-in-demo-copy').editable,
    true,
  );
  assert.strictEqual(fs.readFileSync(builtInManifestPath, 'utf8'), builtInBefore);
  assert.strictEqual(appRuntime.displaySystems.duplicate('no-such-system', { id: 'x' }), null);

  console.log('appRuntimeDisplaySystems.test.js passed');
} finally {
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir()))) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
