const assert = require('assert');
const {
  applyLineOrderDefinition,
  applyPointOrderDefinition,
  executeConfiguredMapping,
  normalizePointDefinition,
} = require('@shroom/backend/processing/configMappingExecutor.js');

const source = [10, 20, 30, 40];
const lineOrder = { order: [4, 2, 1] };
const pointOrder = {
  matrix: { rows: 2, cols: 3 },
  points: [[0, 0], [1, 1], [1, 2]],
};

assert.deepStrictEqual(applyLineOrderDefinition(source, lineOrder), [40, 20, 10]);
assert.deepStrictEqual(applyPointOrderDefinition([7, 8], {
  rows: 2,
  cols: 2,
  points: [[0, 1], [1, 0]],
}), [0, 7, 8, 0]);
assert.deepStrictEqual(executeConfiguredMapping(source, {
  lineOrder,
  pointOrder,
}), [40, 0, 0, 0, 20, 10]);
assert.deepStrictEqual(
  normalizePointDefinition([[0, 1], [1, 2]]),
  { points: [[0, 1], [1, 2]], rows: 2, cols: 3 },
);
assert.deepStrictEqual(
  applyPointOrderDefinition([7, 8], [[0, 1], [1, 2]]),
  [0, 7, 0, 0, 0, 8],
);
assert.throws(
  () => normalizePointDefinition({ matrix: { rows: 1, cols: 2 }, points: [[1, 1]] }),
  /does not contain every point/,
);
assert.throws(
  () => normalizePointDefinition([[0, 0], [0, 0]]),
  /duplicates coordinate/,
);

console.log('configMappingExecutor.test.js passed');
