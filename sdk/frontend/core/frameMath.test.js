import { describe, expect, it } from 'vitest';
import { addSide, gaussBlur_1 } from './frameMath.js';

/** 优化前的 `gaussBlur_1` 原函数体，逐字保留作对拍基准；不要跟着实现一起改。 */
function legacyGaussBlur(scl, tcl, w, h, r) {
  var rs = Math.ceil(r * 2.57); // significant radius
  for (var i = 0; i < h; i++)
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
      tcl[i * w + j] = Math.round(val / wsum);
    }
}

/** 固定种子的伪随机数，失败时能按用例序号复现。 */
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

/** 两边各跑一遍并逐键用 `Object.is` 比较，-0、NaN、没写到的格子和多写的键都算差异。 */
function expectSameAsLegacy(source, w, h, r, label, makeTarget = (length) => new Array(length).fill(-777)) {
  // 非整数尺寸下原实现会写出小数键，出参长度随便给一个够用的整数。
  const length = Number.isInteger(w * h) ? w * h : 12;
  const expected = makeTarget(length);
  const actual = makeTarget(length);
  const before = Array.from(source);
  legacyGaussBlur(source, expected, w, h, r);
  gaussBlur_1(source, actual, w, h, r);
  expect(Array.from(source), `${label}: 源矩阵不能被改写`).toEqual(before);
  const keys = Object.keys(expected);
  expect(Object.keys(actual), `${label}: 写出的键`).toEqual(keys);
  for (const key of keys) {
    if (!Object.is(actual[key], expected[key])) {
      throw new Error(`${label}: [${key}] 得到 ${actual[key]}，原实现是 ${expected[key]}`);
    }
  }
}

describe('gaussBlur_1 与原实现逐位一致', () => {
  it('随机尺寸、半径和稀疏度', () => {
    const random = createRandom(20261116);
    const radii = [0.3, 0.5, 1, 1.5, 2, 2.2, 2.7, 3, 4, 5.5];
    for (let round = 0; round < 400; round++) {
      const w = 1 + Math.floor(random() * 40);
      const h = 1 + Math.floor(random() * 40);
      const r = round % 3 === 0 ? radii[round % radii.length] : 0.2 + random() * 5;
      const density = [0, 0.02, 0.2, 0.7, 1][round % 5];
      const source = Array.from({ length: w * h }, () => {
        if (random() >= density) return 0;
        const kind = random();
        if (kind < 0.6) return Math.floor(random() * 4096);
        if (kind < 0.8) return random() * 255;
        if (kind < 0.9) return -Math.floor(random() * 300);
        return random() < 0.5 ? -0 : 1e-320;
      });
      expectSameAsLegacy(source, w, h, r, `round ${round} ${w}x${h} r=${r}`);
    }
  });

  it('单点贴着四条边和四个角时，折回边缘的抽头不被裁掉', () => {
    const w = 19, h = 13;
    for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [0, 6], [w - 1, 6], [9, 0], [9, h - 1], [9, 6], [1, 1]]) {
      for (const r of [1, 2, 3.3]) {
        const source = new Array(w * h).fill(0);
        source[y * w + x] = 1000;
        expectSameAsLegacy(source, w, h, r, `point ${x},${y} r=${r}`);
      }
    }
  });

  it('手部点图的真实形状：72×72、外圈补 1', () => {
    const random = createRandom(7);
    const inner = Array.from({ length: 64 * 64 }, (_, index) => {
      const distance = Math.hypot((index % 64) - 20, Math.floor(index / 64) - 38);
      return distance < 12 ? Math.round(180 * (1 - distance / 12) + random() * 3) : 0;
    });
    const padded = addSide(inner, 64, 64, 4, 4);
    expect(padded).toHaveLength(72 * 72);
    for (const r of [2, 2.7]) expectSameAsLegacy(padded, 72, 72, r, `hand r=${r}`);
    expectSameAsLegacy(addSide(new Array(64 * 64).fill(0), 64, 64, 4, 4), 72, 72, 2, 'hand idle');
  });

  it('非数值、缺项和类型化数组', () => {
    const w = 9, h = 7;
    const source = new Array(w * h).fill(0);
    source[10] = NaN; source[20] = Infinity; source[30] = '12'; source[40] = null; source[50] = 300;
    expectSameAsLegacy(source, w, h, 1.5, 'mixed values');
    expectSameAsLegacy(source.slice(0, 40), w, h, 1.5, 'short source');
    const typed = Float32Array.from({ length: w * h }, (_, index) => (index % 11 === 0 ? index * 1.5 : 0));
    expectSameAsLegacy(typed, w, h, 2, 'typed source', (length) => new Float64Array(length).fill(-777));
    expectSameAsLegacy(typed, w, h, 2, 'integer target', (length) => new Uint16Array(length).fill(777));
  });

  it('退化参数走原实现：零/负/NaN 半径、超大半径、非整数尺寸', () => {
    const w = 6, h = 5;
    const source = Array.from({ length: w * h }, (_, index) => (index % 4 === 0 ? index * 9 : 0));
    // 不测 Infinity：原实现在无穷半径下循环不会结束，调用方也从不传它。
    for (const r of [0, -1, NaN, 1e-200, '2', 30]) expectSameAsLegacy(source, w, h, r, `r=${String(r)}`);
    expectSameAsLegacy(source, 2.5, 3, 1, 'fractional width');
    expectSameAsLegacy(source, 0, 4, 1, 'zero width');
  });

  it('读写同一块内存时保持原实现的就地结果', () => {
    const w = 8, h = 8;
    const seed = Array.from({ length: w * h }, (_, index) => (index % 5 === 0 ? 40 + index : 0));
    const expected = Array.from(seed);
    const actual = Array.from(seed);
    legacyGaussBlur(expected, expected, w, h, 1.2);
    gaussBlur_1(actual, actual, w, h, 1.2);
    expect(actual).toEqual(expected);

    const expectedBuffer = Float64Array.from(seed);
    const actualBuffer = Float64Array.from(seed);
    legacyGaussBlur(expectedBuffer, new Float64Array(expectedBuffer.buffer), w, h, 1.2);
    gaussBlur_1(actualBuffer, new Float64Array(actualBuffer.buffer), w, h, 1.2);
    expect(Array.from(actualBuffer)).toEqual(Array.from(expectedBuffer));
  });

  it('相同输入重复调用取回同一结果，写进各自的出参', () => {
    const w = 20, h = 14;
    const source = Array.from({ length: w * h }, (_, index) => (index % 9 === 0 ? 30 + index : 0));
    const expected = new Array(w * h).fill(-777);
    legacyGaussBlur(source, expected, w, h, 2);
    for (let round = 0; round < 4; round++) {
      const target = round % 2 ? new Float32Array(w * h).fill(-777) : new Array(w * h).fill(-777);
      gaussBlur_1(round === 2 ? Float64Array.from(source) : source.slice(), target, w, h, 2);
      expect(Array.from(target), `round ${round}`).toEqual(expected);
    }
  });

  it('原地改写源矩阵后重新计算，不取回旧结果', () => {
    const w = 16, h = 16;
    const source = new Array(w * h).fill(0);
    for (let step = 0; step < 12; step++) {
      source[(step * 37) % (w * h)] = 50 + step * 13;
      expectSameAsLegacy(source, w, h, 1.7, `in-place step ${step}`);
      expectSameAsLegacy(source, w, h, 1.7, `in-place step ${step} again`);
    }
    source[5] = -0;
    expectSameAsLegacy(source, w, h, 1.7, 'negative zero');
  });

  it('多种尺寸、半径交替调用超过缓存容量后仍然正确', () => {
    const random = createRandom(99);
    const shapes = Array.from({ length: 14 }, (_, index) => ({ w: 6 + index, h: 5 + (index * 3) % 7, r: 0.8 + (index % 4) * 0.6 }));
    const sources = shapes.map(({ w, h }) => Array.from({ length: w * h }, () => (random() < 0.3 ? Math.floor(random() * 500) : 0)));
    for (let pass = 0; pass < 3; pass++) {
      shapes.forEach(({ w, h, r }, index) => {
        if (pass === 1 && index % 3 === 0) sources[index][index] += 7;
        expectSameAsLegacy(sources[index], w, h, r, `pass ${pass} shape ${index}`);
      });
    }
  });

  it('出参写入中途抛错后，同一输入下次仍得到完整结果', () => {
    const w = 10, h = 10;
    const source = Array.from({ length: w * h }, (_, index) => (index % 6 === 0 ? 90 + index : 0));
    const guarded = new Proxy(new Array(w * h).fill(0), { set(target, key, value) {
      if (key === '57') throw new Error('write rejected');
      target[key] = value; return true;
    } });
    expect(() => gaussBlur_1(source, guarded, w, h, 1.3)).toThrow('write rejected');
    expectSameAsLegacy(source, w, h, 1.3, 'after failed write');
  });

  it('可转成数值的元素与原实现的隐式转换一致', () => {
    const w = 8, h = 6;
    const source = new Array(w * h).fill(0);
    Object.assign(source, { 3: '40', 9: true, 14: [25], 20: '', 27: '0x10', 33: { valueOf: () => 12 }, 40: 'abc' });
    delete source[44];
    expectSameAsLegacy(source, w, h, 1.4, 'coercible values');
    expectSameAsLegacy(source, w, h, 1.4, 'coercible values again');
  });

  it('超过缓存尺寸上限的矩阵照常计算', () => {
    const w = 600, h = 450;
    const source = new Array(w * h).fill(0);
    for (let index = 0; index < 300; index++) source[(index * 7919) % (w * h)] = 100 + index;
    expectSameAsLegacy(source, w, h, 0.5, 'large matrix');
    source[123] = 999;
    expectSameAsLegacy(source, w, h, 0.5, 'large matrix changed');
  });

  it('连续换很多半径后，早先的半径仍然算对', () => {
    const w = 12, h = 10;
    const source = Array.from({ length: w * h }, (_, index) => (index % 7 === 0 ? 100 + index : 0));
    for (let step = 0; step < 40; step++) expectSameAsLegacy(source, w, h, 0.5 + step * 0.1, `sweep ${step}`);
    expectSameAsLegacy(source, w, h, 0.5, 'first radius again');
  });
});
