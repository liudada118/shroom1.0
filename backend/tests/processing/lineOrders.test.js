const assert = require('assert');
const legacy = require('../../compatibility/openWeb');
const lineOrders = require('@shroom/backend/processing/lineOrders.js');

const base = Array.from({ length: 4096 }, (_, index) => (index * 17 + 3) % 251);

/**
 * 逐元素比对新旧两份实现的输出是否完全相同。本文件是**对照测试**：期望值就是
 * `compatibility/openWeb` 的输出，所以没有写死的期望数据。
 *
 * 线序表编码的是硬件排线顺序，错一位画面整片乱且不报错，所以用 `deepStrictEqual`
 * 而不是求和比对。⚠️ 这三个对照测试（本文件 + pressureTransforms +
 * videoPointMappings）是 `openWeb.js` 至今不能删的唯一原因。
 *
 * @param {string} name 线序名，只用于失败定位。
 * @param {unknown} oldValue 旧实现输出，充当期望值。
 * @param {unknown} newValue 新实现输出。
 * @throws {AssertionError} 两者不一致时抛。
 */
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
