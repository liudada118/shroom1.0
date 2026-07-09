const assert = require('assert');
const legacy = require('../../legacy/openWeb');
const video = require('../../processing/videoPointMappings');

const base = Array.from({ length: 4096 }, (_, index) => (index * 17 + 3) % 251);

function assertSame(name, oldValue, newValue) {
  assert.deepStrictEqual(newValue, oldValue, `${name} should match legacy output`);
}

[
  ['smallM', [base.slice(0, 1024)]],
  ['smallM1', [base.slice(0, 1024)]],
  ['rect', [base.slice(0, 1024)]],
  ['short', [base.slice(0, 1024)]],
  ['matColLine', [base.slice(0, 1024)]],
  ['handBlue', [base.slice(0, 1024)]],
  ['handSinglePoint', [base.slice(0, 1100)]],
  ['carCol', [base.slice(0, 1024)]],
  ['gloves0123Res', [base.slice(0, 256)]],
  ['footVideo1', [base.slice(0, 256)]],
  ['footArrToNormal', [base.slice(0, 2048)]],
  ['rightEye', [base.slice(0, 256)]],
  ['handVideoRealPoint_0506_3', [base.slice(0, 256)]],
  ['handVideo1_0416_0506', [base.slice(0, 256)]],
].forEach(([name, args]) => {
  assertSame(name, legacy[name](...args.map((arg) => (Array.isArray(arg) ? arg.slice() : arg))), video[name](...args));
});

console.log('videoPointMappings.test.js passed');
