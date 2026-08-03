const assert = require('assert');
const path = require('path');
const {
  classifyDisplaySystemAccess,
  loadDisplaySystemDirectory,
  normalizeCanvasConfig,
  normalizeDisplayConfig,
  resolveDisplaySystemAccessConflicts,
  validateAlgorithmDataDefinition,
  validateCoordinateMapDefinition,
  validateLineOrderDefinition,
  validatePointOrderDefinition,
  validateProtocolConfig,
  validateDisplayConfig,
} = require('../../displaySystems');

const demoDirectory = path.resolve(__dirname, '../../displaySystems/examples/byte-matrix-demo');
const smallBed12BDemoDirectory = path.resolve(
  __dirname,
  '../../displaySystems/examples/small-bed-12b-manifest-demo'
);
const jqbedDemoDirectory = path.resolve(__dirname, '../../displaySystems/examples/jqbed-manifest-demo');
const handGloveDemoDirectory = path.resolve(
  __dirname,
  '../../displaySystems/examples/hand-glove-manifest-demo'
);
const loaded = loadDisplaySystemDirectory(demoDirectory, { validateFiles: true });
const loadedSmallBed12B = loadDisplaySystemDirectory(smallBed12BDemoDirectory, { validateFiles: true });
const loadedJqbed = loadDisplaySystemDirectory(jqbedDemoDirectory, { validateFiles: true });
const loadedHandGlove = loadDisplaySystemDirectory(handGloveDemoDirectory, { validateFiles: true });

assert.deepStrictEqual(classifyDisplaySystemAccess({
  sourceDirectory: path.resolve('C:/app/display-systems/builtin'),
  metadata: {},
}, {
  runtimeResourceRoot: path.resolve('C:/app'),
  runtimeWritableRoot: path.resolve('C:/users/test'),
}), { origin: 'system', editable: false });
assert.deepStrictEqual(classifyDisplaySystemAccess({
  sourceDirectory: path.resolve('C:/users/test/display-systems/custom'),
  metadata: { createdBy: 'display-system-builder' },
}, {
  runtimeResourceRoot: path.resolve('C:/app'),
  runtimeWritableRoot: path.resolve('C:/users/test'),
}), { origin: 'user', editable: true });
assert.deepStrictEqual(resolveDisplaySystemAccessConflicts([
  {
    id: 'builtin',
    origin: 'system',
    manifestPath: 'C:/app/display-systems/builtin/display-system.json',
  },
  {
    id: 'builtin',
    origin: 'user',
    manifestPath: 'C:/users/test/display-systems/builtin/display-system.json',
  },
]), {
  configs: [{
    id: 'builtin',
    origin: 'system',
    manifestPath: 'C:/app/display-systems/builtin/display-system.json',
  }],
  errors: [
    'C:/users/test/display-systems/builtin/display-system.json: user display system cannot override read-only system "builtin"',
  ],
});

assert.strictEqual(loaded.ok, true);
assert.strictEqual(loaded.config.id, 'byte-matrix-demo');
assert.strictEqual(loaded.config.algorithm.type, 'json');
assert.strictEqual(loaded.config.schemaVersion, 2);
assert.strictEqual(loaded.config.protocol.baudRate, 921600);
assert.strictEqual(loaded.config.protocol.framing.type, 'fixedLength');
assert.strictEqual(loaded.config.display.widgets.length, 2);
assert.strictEqual(loaded.config.display.views[0].source, 'data');
assert.strictEqual(loaded.config.display.renderers.length, 3);
assert.strictEqual(loaded.config.display.visualizationAlgorithms.length, 4);
assert.strictEqual(loaded.config.display.profiles.length, 3);
assert.strictEqual(loaded.config.display.defaultProfile, 'pressure-overview');
assert.strictEqual(path.basename(loaded.config.resolvedFiles.lineOrder), 'line-order.json');
assert.strictEqual(loadedSmallBed12B.ok, true);
assert.strictEqual(loadedSmallBed12B.config.sensor.type, 'smallBed12B');
assert.deepStrictEqual(loadedSmallBed12B.config.sensor.matrix, { rows: 32, cols: 32 });
assert.strictEqual(loadedJqbed.ok, true);
assert.strictEqual(loadedJqbed.config.sensor.type, 'jqbed');
assert.strictEqual(loadedJqbed.config.metadata.runtimeMode, 'template');
assert.strictEqual(loadedHandGlove.ok, true);
assert.strictEqual(loadedHandGlove.config.sensor.type, 'hand0205');
assert.deepStrictEqual(loadedHandGlove.config.sensor.ports, ['sit', 'back']);

assert.deepStrictEqual(validateLineOrderDefinition({ order: [1, 7] }, {
  source: 'line-order.json',
  matrixTotal: 6,
}), ['line-order.json: order[1] exceeds matrix total 6']);

assert.deepStrictEqual(validateCoordinateMapDefinition([
  [[10, 20], [20, 20]],
  [[10, 10], [20, 10]],
], {
  source: 'coordinate-map.json',
  matrix: { rows: 2, cols: 2 },
}), []);
assert.deepStrictEqual(validateCoordinateMapDefinition([
  [[10, 20], [20, 20]],
  [[10, 10], [20, 10]],
], {
  source: 'coordinate-map.json',
  matrix: { rows: 3, cols: 2 },
}), ['coordinate-map.json: matrix.rows must match sensor.matrix.rows 3']);

assert.deepStrictEqual(validatePointOrderDefinition({
  matrix: { rows: 2, cols: 3 },
  points: [[0, 0], [2, 0], [1, 3]],
}, {
  source: 'point-order.json',
  matrix: { rows: 2, cols: 3 },
  maxPointCount: 3,
}), [
  'point-order.json: points[1][0] row is outside 0..1',
  'point-order.json: points[2][1] col is outside 0..2',
]);

assert.deepStrictEqual(validateProtocolConfig({
  baudRate: 0,
  framing: { type: 'fixedLength', frameLength: 0 },
  decoding: { valueType: 'float128', byteOffset: -1 },
}, { source: 'display-system.json' }), [
  'display-system.json: protocol.baudRate must be a positive integer',
  'display-system.json: protocol.framing.frameLength must be a positive integer for fixedLength framing',
  'display-system.json: protocol.decoding.valueType is not supported',
  'display-system.json: protocol.decoding.byteOffset must be a non-negative integer',
]);

assert.deepStrictEqual(validateAlgorithmDataDefinition({
  metrics: [
    { id: 'supportRate', operation: 'activeRatio', threshold: 10, scale: 100 },
    { id: 'supportRate', operation: 'unsafe' },
  ],
}, { source: 'algorithm-data.json' }), [
  'algorithm-data.json: duplicate metric id supportRate',
  'algorithm-data.json: metrics[1].operation is not supported',
]);

assert.deepStrictEqual(validateDisplayConfig({
  views: [{ id: 'main', type: 'heatmap' }],
  widgets: [{ id: 'duplicate', type: 'heatmap' }, { id: 'duplicate', type: 'matrix' }],
  defaultView: 'missing',
}, { source: 'display-system.json' }), [
  'display-system.json: duplicate display widget id duplicate',
  'display-system.json: display.defaultView must reference a configured view',
]);

assert.deepStrictEqual(validateDisplayConfig({
  widgets: [{ id: 'main', type: 'heatmap' }],
  sidebar: {
    algorithmMetrics: [{ id: 'supportRate', label: 'Support Rate', unit: '%' }],
    pressure: {
      primaryMetric: 'algorithm.supportRate',
      metrics: ['totalPressure', 'algorithm.supportRate'],
    },
    area: { metrics: ['activePoints'] },
  },
}, { source: 'display-system.json' }), []);

assert.deepStrictEqual(validateDisplayConfig({
  widgets: [{ id: 'main', type: 'heatmap' }],
  matrixTransform: { type: 'interpolate', factor: 2 },
}, { source: 'display-system.json' }), []);

assert.deepStrictEqual(validateDisplayConfig({
  widgets: [{ id: 'main', type: 'heatmap' }],
  matrixTransform: { type: 'downsample', factor: 0.3 },
}, { source: 'display-system.json' }), [
  'display-system.json: downsample matrix factor must be 0.25 or 0.5',
]);

assert.deepStrictEqual(validateDisplayConfig({
  widgets: [{ id: 'main', type: 'heatmap' }],
  sidebar: {
    pressure: { primaryMetric: 'unknown', metrics: ['maxPressure', 'invalid'] },
    area: { metrics: 'activePoints', threshold: -1, pointArea: 'invalid' },
  },
}, { source: 'display-system.json' }), [
  'display-system.json: display.sidebar.pressure references unknown metric invalid',
  'display-system.json: display.sidebar.area.metrics must be an array',
  'display-system.json: display.sidebar.pressure.primaryMetric is unknown',
  'display-system.json: display.sidebar.area.threshold must be a non-negative number',
  'display-system.json: display.sidebar.area.pointArea must be a non-negative number',
]);

assert.deepStrictEqual(validateDisplayConfig({
  widgets: [{ id: 'main', type: 'heatmap' }],
  renderers: [{ id: 'heat', type: 'heatmap' }],
  visualizationAlgorithms: [{ id: 'raw', type: 'identity' }],
  profiles: [{
    id: 'invalid',
    renderer: 'missing-renderer',
    visualizationAlgorithm: 'missing-algorithm',
    widgets: ['missing-widget'],
  }],
  defaultProfile: 'missing-profile',
}, { source: 'display-system.json' }), [
  'display-system.json: display profile invalid references unknown renderer missing-renderer',
  'display-system.json: display profile invalid references unknown visualization algorithm missing-algorithm',
  'display-system.json: display profile invalid references unknown widget missing-widget',
  'display-system.json: display.defaultProfile must reference a configured profile',
]);

// display.canvas 全字段合法时不该报任何错。
assert.deepStrictEqual(validateDisplayConfig({
  widgets: [{ id: 'main', type: 'heatmap' }],
  canvas: {
    colormap: { id: 'viridis', reverse: true },
    overlays: ['valueLabels', 'legend'],
    widgets: [
      { id: 'main', type: 'heatmap', source: 'sitData', columnSpan: 8 },
      { id: 'stats', type: 'pressureStats', source: 'sitData', columnSpan: 4 },
    ],
  },
}, { source: 'display-system.json' }), []);

// 不带 canvas 的老 manifest 行为不变：既不报错，归一后也拿到与顶层 widgets
// 等价的画布配置（配色 classic、无叠加层）。
assert.deepStrictEqual(validateDisplayConfig({
  widgets: [{ id: 'main', type: 'heatmap', source: 'sitData' }],
}, { source: 'display-system.json' }), []);
assert.deepStrictEqual(
  normalizeDisplayConfig({ widgets: [{ id: 'main', type: 'heatmap', source: 'sitData' }] }).canvas,
  {
    colormap: { id: 'classic', reverse: false },
    overlays: [],
    widgets: [{ id: 'main', type: 'heatmap', label: 'main', source: 'sitData' }],
  }
);

// 显式写错的配色/叠加层要在保存时就报出来，而不是静默变回默认外观。
assert.deepStrictEqual(validateDisplayConfig({
  widgets: [{ id: 'main', type: 'heatmap' }],
  canvas: {
    colormap: { id: 'rainbow' },
    overlays: ['legend', 'sparkles'],
  },
}, { source: 'display-system.json' }), [
  'display-system.json: display.canvas.colormap.id must be one of '
    + 'classic, thermal, viridis, inferno, grayscale, iceFire, jet',
  'display-system.json: display.canvas.overlays contains unknown overlay sparkles',
]);

assert.deepStrictEqual(validateDisplayConfig({
  widgets: [{ id: 'main', type: 'heatmap' }],
  canvas: { overlays: 'legend' },
}, { source: 'display-system.json' }), [
  'display-system.json: display.canvas.overlays must be an array',
]);

assert.deepStrictEqual(validateDisplayConfig({
  widgets: [{ id: 'main', type: 'heatmap' }],
  canvas: ['heatmap'],
}, { source: 'display-system.json' }), [
  'display-system.json: display.canvas must be an object',
]);

assert.deepStrictEqual(validateDisplayConfig({
  widgets: [{ id: 'main', type: 'heatmap' }],
  canvas: {
    widgets: [
      { id: 'main', type: 'heatmap' },
      { id: 'main', type: 'matrix' },
    ],
  },
}, { source: 'display-system.json' }), [
  'display-system.json: duplicate display canvas widget id main',
]);

// 归一只丢弃坏值、不抛错：坏偏好落到磁盘上也只该退回默认外观。
assert.deepStrictEqual(
  normalizeCanvasConfig({
    colormap: 'no-such-colormap',
    overlays: ['legend', 'bogus', 'legend'],
  }, [{ id: 'main', type: 'heatmap', label: 'main', source: 'sitData' }]),
  {
    colormap: { id: 'classic', reverse: false },
    overlays: ['legend'],
    widgets: [{ id: 'main', type: 'heatmap', label: 'main', source: 'sitData' }],
  }
);

console.log('configValidation.test.js passed');
