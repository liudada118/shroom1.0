const assert = require('assert');
const path = require('path');
const {
  loadDisplaySystemDirectory,
  validateLineOrderDefinition,
  validatePointOrderDefinition,
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

console.log('configValidation.test.js passed');
