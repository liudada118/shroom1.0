const assert = require('assert');
const legacy = require('../../compatibility/openWeb');
const pressure = require('@shroom/backend/processing/pressureTransforms.js');

const base = Array.from({ length: 4096 }, (_, index) => (index * 17 + 3) % 251);

/**
 * 逐元素比对新旧两份压力换算实现的输出。**对照测试**，期望值就是
 * `compatibility/openWeb` 的输出，文件里没有写死的期望数值。
 *
 * 换算比线序更需要这种比对：线序错了画面会乱，换算错了只是数值偏一点，肉眼看不出。
 * 且历史库存的是原始 ADC 值、换算在读出后做，改换算会改变已入库数据的显示值。
 * 输入用 `(i * 17 + 3) % 251`，251 是质数以避免短周期重复掩盖错位缺陷。
 *
 * @param {string} name 换算名，只用于失败定位。
 * @param {unknown} oldValue 旧实现输出，充当期望值。
 * @param {unknown} newValue 新实现输出。
 * @throws {AssertionError} 两者不一致时抛。
 */
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
