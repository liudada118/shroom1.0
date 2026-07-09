const assert = require('assert');
const {
  applyLineOrderDefinition,
  applyPointOrderDefinition,
  executeConfiguredMapping,
} = require('../../processing/configMappingExecutor');

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

console.log('configMappingExecutor.test.js passed');
