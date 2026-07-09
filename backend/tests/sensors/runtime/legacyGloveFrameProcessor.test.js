const assert = require('assert');
const {
  createLegacyGloveFrameProcessor,
} = require('../../../sensors/runtime/legacyGloveFrameProcessor');

const published = [];
const processor = createLegacyGloveFrameProcessor({
  gloves0123Res: (values) => values.slice(0, 3),
  gloves0123: (values) => values.map((value) => value + 1),
  publishSystemEvent: (payload) => published.push(JSON.parse(payload)),
});

const frame = Buffer.from(Array.from({ length: 262 }, (_, index) => index % 256));
const result = processor.processSit262Frame(frame, {
  port1: { isOpen: true },
  port2: { isOpen: false },
});

assert.deepStrictEqual(result.pointArr, [1, 2, 3]);
assert.deepStrictEqual(result.rotate, [0, 1, 2, 3, 4, 5]);
assert.strictEqual(published.length, 1);
assert.deepStrictEqual(published[0].sitData, [1, 2, 3]);
assert.strictEqual(published[0].sitFlag, true);
assert.strictEqual(published[0].backFlag, false);
assert.strictEqual(processor.processSit262Frame(Buffer.from([1, 2])), null);

console.log('legacyGloveFrameProcessor.test.js passed');
