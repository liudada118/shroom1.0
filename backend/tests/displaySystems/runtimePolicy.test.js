const assert = require('assert');
const {
  evaluateDisplaySystemDispatchPolicy,
} = require('../../extension-host');

const protectedBinding = {
  id: 'legacy:sit',
  parserChannel: 'sit',
  sensorType: 'smallBed12B',
};

assert.deepStrictEqual(
  evaluateDisplaySystemDispatchPolicy(protectedBinding, {
    currentSensorType: 'smallBed12B',
  }),
  {
    allowed: false,
    reason: 'legacy parser channel sit is protected',
  }
);

assert.deepStrictEqual(
  evaluateDisplaySystemDispatchPolicy({
    ...protectedBinding,
    runtimeMode: 'parallel',
  }, {
    currentSensorType: 'smallBed12B',
  }),
  {
    allowed: true,
    reason: null,
  }
);

assert.deepStrictEqual(
  evaluateDisplaySystemDispatchPolicy({
    ...protectedBinding,
    runtimeMode: 'shadow',
  }, {
    currentSensorType: 'smallBed12B',
  }),
  {
    allowed: true,
    reason: null,
  }
);

assert.deepStrictEqual(
  evaluateDisplaySystemDispatchPolicy({
    ...protectedBinding,
    runtimeMode: 'active',
  }, {
    currentSensorType: 'smallBed12B',
  }),
  {
    allowed: false,
    reason: 'active runtime for legacy parser channel sit is not enabled',
  }
);

assert.deepStrictEqual(
  evaluateDisplaySystemDispatchPolicy({
    ...protectedBinding,
    runtimeMode: 'active',
  }, {
    currentSensorType: 'smallBed12B',
    allowActiveDisplaySystem: true,
  }),
  {
    allowed: true,
    reason: null,
  }
);

const mismatch = evaluateDisplaySystemDispatchPolicy({
  ...protectedBinding,
  runtimeMode: 'parallel',
}, {
  currentSensorType: 'hand0205',
});
assert.strictEqual(mismatch.allowed, false);
assert.strictEqual(mismatch.reason, 'sensor type mismatch: expected smallBed12B, current hand0205');

assert.deepStrictEqual(
  evaluateDisplaySystemDispatchPolicy({
    id: 'template:sit',
    parserChannel: 'sit',
    sensorType: 'smallBed12B',
    metadata: { runtimeMode: 'template' },
  }, {
    currentSensorType: 'smallBed12B',
  }),
  {
    allowed: false,
    reason: 'runtime mode template is not active',
  }
);

console.log('runtimePolicy.test.js passed');
