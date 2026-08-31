const assert = require('assert');
const legacy = require('../../compatibility/openWeb');
const video = require('@shroom/backend/processing/videoPointMappings.js');

const base = Array.from({ length: 4096 }, (_, index) => (index * 17 + 3) % 251);

/**
 * 逐元素比对新旧两份点位映射实现的输出。**对照测试**，期望值就是
 * `compatibility/openWeb` 的输出。
 *
 * 测的是把一维矩阵值摊到显示坐标上（`smallM` / `rect` / `handBlue` / `carCol`
 * 这些名字是各型号的贴图布局）。下面用 `[名字, [入参...]]` 数组驱动，
 * 映射有几十个，逐行写容易漏掉某一边。每条的入参长度按型号定
 * （如 `handSinglePoint` 是 1100 不是 1024），长度本身就是被测行为的一部分。
 *
 * @param {string} name 映射名，只用于失败定位。
 * @param {unknown} oldValue 旧实现输出，充当期望值。
 * @param {unknown} newValue 新实现输出。
 * @throws {AssertionError} 两者不一致时抛。
 */
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
