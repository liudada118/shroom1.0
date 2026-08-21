const test = require('node:test');
const assert = require('node:assert/strict');

const { LicenseService } = require('../sdk/src/license/LicenseService');
const { LICENSE_SENSOR_GROUPS } = require('../licenseScopes');

test('SDK expands category-all scopes before selecting display systems', () => {
  const service = new LicenseService();
  const precision = LICENSE_SENSOR_GROUPS.find((group) => group.key === 'precision');

  assert.deepEqual(
    service.getSelectFlag('@group:precision'),
    precision.items.map((item) => item.value),
  );
  assert.equal(service.getDefaultFile('@group:precision'), precision.items[0].value);
});

test('SDK keeps legacy all, single and fixed-array scopes compatible', () => {
  const service = new LicenseService();

  assert.equal(service.getSelectFlag('all'), 'all');
  assert.equal(service.getSelectFlag('hand0205'), 'hand0205');
  assert.deepEqual(service.getSelectFlag(['hand0205', 'jqbed']), ['hand0205', 'jqbed']);
  assert.equal(service.getDefaultFile('all', 'jqbed'), 'jqbed');
});
