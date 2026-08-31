const assert = require('assert');
const {
  createLegacyGloveFrameProcessor,
} = require('../../../extensions/built-in-sensors/legacyGloveFrameProcessor');

const processor = createLegacyGloveFrameProcessor({
  gloves0123Res: (values) => values.slice(0, 3),
  gloves0123: (values) => values.map((value) => value + 1),
});

const frame = Buffer.from(Array.from({ length: 262 }, (_, index) => index % 256));
const result = processor.processSit262Frame(frame, {
  port1: { isOpen: true },
  port2: { isOpen: false },
});

assert.deepStrictEqual(result.pointArr, [1, 2, 3]);
assert.deepStrictEqual(result.rotate, [0, 1, 2, 3, 4, 5]);
const payload = JSON.parse(result.jsonData);
assert.deepStrictEqual(payload.sitData, [1, 2, 3]);
assert.strictEqual(payload.sitFlag, true);
assert.strictEqual(payload.backFlag, false);
assert.strictEqual(processor.processSit262Frame(Buffer.from([1, 2])), null);

console.log('legacyGloveFrameProcessor.test.js passed');
