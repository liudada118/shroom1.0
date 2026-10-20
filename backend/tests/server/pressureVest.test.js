const test = require('node:test');
const assert = require('node:assert/strict');
const sensorMap = require('../../../pressureVestSensorMap.json');
const { SENSOR_INDICES, getPressureVestStatistics } = require('../../extensions/built-in-sensors/pressureVest');

test('vest statistics uses exactly 436 unique original ADC indexes from the shared source map', () => {
  assert.equal(SENSOR_INDICES.length, 436);
  assert.equal(new Set(SENSOR_INDICES).size, 436);
  assert.ok(SENSOR_INDICES.every(index => Number.isInteger(index) && index >= 0 && index < 1024));
  const shared = Object.values(sensorMap).flatMap(rows => rows.flat().map(channel => channel - 1));
  assert.deepEqual(SENSOR_INDICES, [...new Set(shared)]);
});

test('unused ADC channels never influence vest totals, maximum, mean or active point count', () => {
  const frame = new Array(1024).fill(255);
  SENSOR_INDICES.forEach(index => { frame[index] = 0; });
  assert.deepEqual(getPressureVestStatistics(frame), { point: 0, area: 0, totalPres: 0, maxPres: 0, meanPres: 0 });
  frame[0] = 1;
  frame[691] = 2;
  frame[1023] = 10;
  assert.deepEqual(getPressureVestStatistics(frame), { point: 3, area: 3, totalPres: 13, maxPres: 10, meanPres: 13 / 3 });
});

test('finite positive values match frontend semantics without mutating the complete frame', () => {
  const frame = new Array(1024).fill(0);
  frame[SENSOR_INDICES[0]] = '3.5';
  frame[SENSOR_INDICES[1]] = -2;
  frame[SENSOR_INDICES[2]] = Number.NaN;
  frame[SENSOR_INDICES[3]] = Number.POSITIVE_INFINITY;
  const original = frame.slice();
  assert.deepEqual(getPressureVestStatistics(frame), { point: 1, area: 1, totalPres: 3.5, maxPres: 3.5, meanPres: 3.5 });
  assert.deepEqual(frame, original);
  assert.deepEqual(getPressureVestStatistics(null), { point: 0, area: 0, totalPres: 0, maxPres: 0, meanPres: 0 });
  assert.equal(getPressureVestStatistics(frame.slice(0, 1023)).point, 0);
});
