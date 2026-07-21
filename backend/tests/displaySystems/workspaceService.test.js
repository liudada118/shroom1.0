const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createDisplaySystemWorkspaceService,
  loadDisplaySystemDirectory,
} = require('../../displaySystems');

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-display-builder-'));

try {
  const service = createDisplaySystemWorkspaceService({ writableRoot: temporaryRoot });
  const manifest = {
    id: 'page-created-demo',
    name: 'Page Created Demo',
    version: '1.0.0',
    sensor: {
      type: 'pageCreatedDemo',
      matrix: { rows: 2, cols: 2 },
      ports: ['sit'],
    },
    protocol: {
      baudRate: 115200,
      framing: { type: 'fixedLength', frameLength: 4 },
      decoding: { valueType: 'uint8', byteOffset: 0, valueCount: 4 },
    },
    algorithm: { type: 'json' },
    display: {
      views: [{ id: 'main', type: 'heatmap', source: 'data' }],
      widgets: [{ id: 'main', type: 'heatmap', source: 'data' }],
      renderers: [{ id: 'heatmap', type: 'heatmap' }],
      visualizationAlgorithms: [{ id: 'identity', type: 'identity' }],
      profiles: [{
        id: 'default',
        renderer: 'heatmap',
        visualizationAlgorithm: 'identity',
        widgets: ['main'],
      }],
      defaultView: 'main',
      defaultProfile: 'default',
    },
  };

  const saved = service.save({
    manifest,
    definitions: { algorithmData: { scale: 2, zeroBelow: 3 } },
  });
  assert.strictEqual(saved.id, 'page-created-demo');
  assert.ok(fs.existsSync(path.join(saved.directory, 'display-system.json')));

  const loaded = loadDisplaySystemDirectory(saved.directory, { validateFiles: true });
  assert.strictEqual(loaded.ok, true);
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(path.join(saved.directory, 'line-order.json'), 'utf8')).order,
    [1, 2, 3, 4]
  );
  assert.strictEqual(service.read(loaded.config).definitions.algorithmData.scale, 2);
  assert.ok(service.getCatalog().renderers.some((renderer) => renderer.id === 'heatmap'));
  assert.strictEqual(service.getCatalog().serialTemplates.length, 3);
  assert.strictEqual(service.getCatalog().displayTemplates.length, 2);
  assert.strictEqual(service.getCatalog().serialTemplates[1].defaults.valueType, 'uint16le');
  assert.strictEqual(service.getCatalog().serialTemplates[2].defaults.framingType, 'fixedLength');
  assert.ok(service.getCatalog().baudRates.includes(1000000));

  assert.throws(() => service.save({ manifest }), /already exists/);
  assert.doesNotThrow(() => service.save({ manifest, overwrite: true }));
  assert.throws(() => service.save({ manifest: { ...manifest, id: '../escape' } }), /may only contain/);
  assert.throws(() => service.save({
    manifest: { ...manifest, algorithm: { type: 'js', entry: 'unsafe.js' } },
  }), /only supports none and json/);

  console.log('workspaceService.test.js passed');
} finally {
  const resolved = path.resolve(temporaryRoot);
  if (resolved.startsWith(path.resolve(os.tmpdir()))) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
