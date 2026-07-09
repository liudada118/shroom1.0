const assert = require('assert');
const legacy = require('../../legacy/openWeb');
const lineOrders = require('../../processing/lineOrders');

const base = Array.from({ length: 4096 }, (_, index) => (index * 17 + 3) % 251);

function assertSame(name, oldValue, newValue) {
  assert.deepStrictEqual(newValue, oldValue, `${name} should match legacy output`);
}

[
  ['jqbed', [base.slice(0, 1024)]],
  ['newHand', [base.slice(0, 1024)]],
  ['tempFullBed', [base.slice(0, 1200)]],
  ['carSitLine', [base.slice(0, 1024)]],
  ['carBackLine', [base.slice(0, 1024)]],
  ['wowSitLine', [base.slice(0, 1024)]],
  ['wowBackLine', [base.slice(0, 1024)]],
  ['footL', [base.slice(0, 256)]],
  ['footR', [base.slice(0, 256)]],
  ['footVideo', [base.slice(0, 256)]],
  ['handR', [base.slice(0, 256)]],
  ['handL', [base.slice(0, 256)]],
  ['handRVideo1470506', [base.slice(0, 256)]],
  ['gloves', [base.slice(0, 256)]],
  ['gloves1', [base.slice(0, 256)]],
  ['gloves2', [base.slice(0, 256)]],
  ['gloves0123', [base.slice(0, 512)]],
  ['handLine', [base.slice(0, 2048), false]],
  ['sit10Line', [base.slice(0, 1024)]],
  ['sit100Line', [base.slice(0, 1024)]],
  ['endiSit1024', [base.slice(0, 1024)]],
  ['yanfeng10sit', [base.slice(0, 1024)]],
  ['yanfeng10back', [base.slice(0, 1024)]],
  ['wowhead', [base.slice(0, 1024)]],
  ['xiyueReal1', [base.slice(0, 1024)]],
].forEach(([name, args]) => {
  assertSame(name, legacy[name](...args.map((arg) => (Array.isArray(arg) ? arg.slice() : arg))), lineOrders[name](...args));
});

console.log('lineOrders.test.js passed');
