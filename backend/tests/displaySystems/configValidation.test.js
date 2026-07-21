const assert = require('assert');
const path = require('path');
const {
  loadDisplaySystemDirectory,
  validateAlgorithmDataDefinition,
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

console.log('configValidation.test.js passed');
