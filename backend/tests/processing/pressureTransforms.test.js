const assert = require('assert');
const legacy = require('../../legacy/openWeb');
const pressure = require('../../processing/pressureTransforms');

const base = Array.from({ length: 4096 }, (_, index) => (index * 17 + 3) % 251);

function assertSame(name, oldValue, newValue) {
  assert.deepStrictEqual(newValue, oldValue, `${name} should match legacy output`);
}

assertSame('smallBed', legacy.smallBed(base.slice(0, 1024)), pressure.smallBed(base.slice(0, 1024)));
assertSame('smallBed1', legacy.smallBed1(base.slice(0, 1024)), pressure.smallBed1(base.slice(0, 1024)));
assertSame('smallBedReal', legacy.smallBedReal(base.slice(0, 1024)), pressure.smallBedReal(base.slice(0, 1024)));
assertSame('smallBedReal1', legacy.smallBedReal1(base.slice(0, 1024)), pressure.smallBedReal1(base.slice(0, 1024)));
assertSame('press', legacy.press(base.slice(0, 2048), 1245), pressure.press(base.slice(0, 2048), 1245));
assertSame('press12', legacy.press12(base.slice(0, 2048)), pressure.press12(base.slice(0, 2048)));
assertSame('car10Sit', legacy.car10Sit(base.slice(0, 1024)), pressure.car10Sit(base.slice(0, 1024)));
assertSame('car10Back', legacy.car10Back(base.slice(0, 1024)), pressure.car10Back(base.slice(0, 1024)));

console.log('pressureTransforms.test.js passed');
