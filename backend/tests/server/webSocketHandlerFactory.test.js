const assert = require('assert');

const {
  createSensorStatusPayload,
} = require('../../kernel/platform/websocket/webSocketHandlerFactory');

const payload = createSensorStatusPayload({
  file: 'custom-pressure-map',
  licenseFile: ['hand0205', 'jqbed'],
  selectFlag: ['hand0205', 'jqbed'],
}, {
  date: 123456,
  nowDate: 120000,
});

assert.deepStrictEqual(payload, {
  file: ['hand0205', 'jqbed'],
  currentSensorType: 'custom-pressure-map',
  selectFlag: ['hand0205', 'jqbed'],
  date: 123456,
  nowDate: 120000,
});

const singleTypePayload = createSensorStatusPayload({
  file: 'custom-pressure-map',
  licenseFile: null,
  selectFlag: undefined,
});

assert.strictEqual(singleTypePayload.file, null);
assert.strictEqual(singleTypePayload.currentSensorType, 'custom-pressure-map');

console.log('webSocketHandlerFactory.test.js passed');
