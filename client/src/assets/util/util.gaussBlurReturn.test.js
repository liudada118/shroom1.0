/**
 * util.gaussBlurReturn.test.js - `gaussBlur_return` 转调 `gaussBlur_1` 后与原实现等价
 *
 * 基准是被替换掉的那份函数体，逐字抄写，不做任何顺手改动。
 */

import { describe, expect, it } from 'vitest';

import { gaussBlur_return } from './util';

/** util.js 里被替换掉的原实现（逐字）。 */
function legacyGaussBlurReturn(scl, w, h, r) {
  const res = new Array(scl.length).fill(1)
  var rs = Math.ceil(r * 2.57); // significant radius
  for (var i = 0; i < h; i++) {
    for (var j = 0; j < w; j++) {
      var val = 0,
        wsum = 0;
      for (var iy = i - rs; iy < i + rs + 1; iy++)
        for (var ix = j - rs; ix < j + rs + 1; ix++) {
          var x = Math.min(w - 1, Math.max(0, ix));
          var y = Math.min(h - 1, Math.max(0, iy));
          var dsq = (ix - j) * (ix - j) + (iy - i) * (iy - i);
          var wght = Math.exp(-dsq / (2 * r * r)) / (Math.PI * 2 * r * r);
          val += scl[y * w + x] * wght;
          wsum += wght;
        }
      res[i * w + j] = Math.round(val / wsum);
    }
  }
  return res
}

/** 固定种子的伪随机数。 */
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 逐键比较，-0、NaN、多出或缺少的键都算差异。 */
function expectSame(scl, w, h, r, label) {
  const before = Array.from(scl);
  const expected = legacyGaussBlurReturn(scl, w, h, r);
  const actual = gaussBlur_return(scl, w, h, r);
  expect(Array.from(scl), `${label}: 源矩阵不能被改写`).toEqual(before);
  expect(Array.isArray(actual), `${label}: 返回普通数组`).toBe(true);
  expect(actual).not.toBe(scl);
  const keys = Object.keys(expected);
  expect(Object.keys(actual), `${label}: 键集合`).toEqual(keys);
  for (const key of keys) {
    if (!Object.is(actual[key], expected[key])) throw new Error(`${label}: [${key}] 得到 ${actual[key]}，原实现是 ${expected[key]}`);
  }
}

describe('gaussBlur_return 与原实现逐位一致', () => {
  it('随机矩阵与多种半径', () => {
    const random = createRandom(4096);
    for (let round = 0; round < 120; round++) {
      const w = 1 + Math.floor(random() * 30), h = 1 + Math.floor(random() * 30);
      const density = [0, 0.05, 0.4, 1][round % 4];
      const scl = Array.from({ length: w * h }, () => (random() < density ? Math.floor(random() * 3000) : 0));
      expectSame(scl, w, h, 0.4 + random() * 4, `round ${round} ${w}x${h}`);
    }
  });

  it('足底渲染器的真实形状：补 1 的外圈、非方阵', () => {
    const w = 40, h = 72;
    const scl = Array.from({ length: w * h }, (_, index) => {
      const x = index % w, y = Math.floor(index / w);
      if (x < 4 || x >= w - 4 || y < 4 || y >= h - 4) return 1;
      const d = Math.hypot(x - 18, y - 30);
      return d < 9 ? Math.round(900 * (1 - d / 9)) : 0;
    });
    expectSame(scl, w, h, 2, 'foot r=2');
    expectSame(scl, w, h, 2, 'foot r=2 again');
    expectSame(scl, w, h, 3.5, 'foot r=3.5');
  });

  it('源数组比 w*h 长或短时，多出的位置保持 1、缺的位置按原实现处理', () => {
    const base = Array.from({ length: 48 }, (_, index) => (index % 5 === 0 ? 60 + index : 0));
    expectSame([...base, 7, 8, 9], 8, 6, 1.5, 'longer source');
    expectSame(base.slice(0, 40), 8, 6, 1.5, 'shorter source');
    expectSame([], 3, 2, 1, 'empty source');
  });

  it('退化半径', () => {
    const scl = Array.from({ length: 30 }, (_, index) => (index % 4 === 0 ? index * 11 : 0));
    for (const r of [0, -2, NaN]) expectSame(scl, 6, 5, r, `r=${String(r)}`);
  });
});
