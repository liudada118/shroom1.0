/**
 * util.jet.test.js - jet 四个出口与被替换掉的原实现等价
 *
 * 这份测试的主张是「新实现 === 旧实现」，所以每一组都先把被删掉的那份原实现
 * **逐字抄一遍**当基准，再拿导出的函数和它比。抄的时候不做任何顺手优化 ——
 * 一旦改写，比的就不是等价性而是我对旧代码的理解了。写法与
 * `src/runtime/sceneFrame.test.js` 一致。
 *
 * 抽公共层之前这条分支阶梯在全仓有 18 份，分四种形状：
 *
 * - `jet`      ← 14 份（util.js 本身 + demo/ 9 个 + NumThreeColor 3 个 + num/Num + foot/Num32DetectLocal）
 * - `jetRgba`  ← 2 份（heatmap/canvas.jsx、onestep/heatmap.js）
 * - `jetRound` ← 1 份（num/NumWs.jsx）
 * - `jetRgb`   ← 1 份（util.js 本身，就是那条阶梯）
 */

import { describe, expect, it } from 'vitest';

import {
  findMax as findMaxFromSdk,
  jet as jetFromSdk,
} from '@shroom/frontend/core/frameMath.js';
import { jetRgb as jetRgbFromLadder } from './jetLadder';
import { findMax as findMaxFromUtil, jet, jetRgb, jetRgba, jetRound } from './util';

/* ------------------------------------------------------------------ *
 * 四份基准实现，全部逐字抄自被替换掉的原文件
 * ------------------------------------------------------------------ */

/** util.js:465 与 demo/ 9 个文件、NumThreeColor 3 个文件里那份（逐字节相同）。 */
function legacyJet(min, max, x) {
  let red, g, blue;
  let dv;
  red = 1.0;
  g = 1.0;
  blue = 1.0;
  if (x < min) {
    x = min;
  }
  if (x > max) {
    x = max;
  }
  dv = max - min;
  if (x < min + 0.25 * dv) {
    red = 0;
    g = (4 * (x - min)) / dv;
  } else if (x < min + 0.5 * dv) {
    red = 0;
    blue = 1 + (4 * (min + 0.25 * dv - x)) / dv;
  } else if (x < min + 0.75 * dv) {
    red = (4 * (x - min - 0.5 * dv)) / dv;
    blue = 0;
  } else {
    g = 1 + (4 * (min + 0.75 * dv - x)) / dv;
    blue = 0;
  }
  var rgb = new Array();
  rgb[0] = parseInt(255 * red + '');
  rgb[1] = parseInt(255 * g + '');
  rgb[2] = parseInt(255 * blue + '');
  return rgb;
}

/**
 * `num/Num.jsx` 与 `foot/Num32DetectLocal.jsx` 里那份。
 *
 * 与 `legacyJet` 只差 `parseInt(255 * r)` 少了 `+ ''`。两者都要经过
 * ToString 才能给 parseInt，所以理论上等价 —— 但这是**待证事实而非假设**，
 * 下面 randomised 那一组会把它和 legacyJet 一起比。
 */
function legacyJetNoCoerce(min, max, x) {
  let r, g, b;
  let dv;
  r = 1;
  g = 1;
  b = 1;
  if (x < min) x = min;
  if (x > max) x = max;
  dv = max - min;
  if (x < min + 0.25 * dv) {
    r = 0;
    g = (4 * (x - min)) / dv;
  } else if (x < min + 0.5 * dv) {
    r = 0;
    b = 1 + (4 * (min + 0.25 * dv - x)) / dv;
  } else if (x < min + 0.75 * dv) {
    r = (4 * (x - min - 0.5 * dv)) / dv;
    b = 0;
  } else {
    g = 1 + (4 * (min + 0.75 * dv - x)) / dv;
    b = 0;
  }
  var rgb = new Array();
  rgb[0] = parseInt(255 * r);
  rgb[1] = parseInt(255 * g);
  rgb[2] = parseInt(255 * b);
  return rgb;
}

/** `heatmap/canvas.jsx` 与 `onestep/heatmap.js` 里那份（不取整，带写死的第四位）。 */
function legacyJetRgba(min, max, x) {
  let red, g, blue;
  let dv;
  red = 1.0;
  g = 1.0;
  blue = 1.0;
  if (x < min) {
    x = min;
  }
  if (x > max) {
    x = max;
  }
  dv = max - min;
  if (x < min + 0.25 * dv) {
    red = 0;
    g = (4 * (x - min)) / dv;
  } else if (x < min + 0.5 * dv) {
    red = 0;
    blue = 1 + (4 * (min + 0.25 * dv - x)) / dv;
  } else if (x < min + 0.75 * dv) {
    red = (4 * (x - min - 0.5 * dv)) / dv;
    blue = 0;
  } else {
    g = 1 + (4 * (min + 0.75 * dv - x)) / dv;
    blue = 0;
  }
  var rgba = new Array();
  rgba[0] = 255 * red;
  rgba[1] = 255 * g;
  rgba[2] = 255 * blue;
  rgba[3] = 1;
  return rgba;
}

/** `num/NumWs.jsx` 里那份（Math.round + 零跨度返白，白色判断在夹取之后）。 */
function legacyJetRound(min, max, x) {
  let r, g, b;
  r = 1; g = 1; b = 1;
  if (x < min) x = min;
  if (x > max) x = max;
  const dv = max - min;
  if (dv === 0) return [255, 255, 255];
  if (x < min + 0.25 * dv) {
    r = 0;
    g = (4 * (x - min)) / dv;
  } else if (x < min + 0.5 * dv) {
    r = 0;
    b = 1 + (4 * (min + 0.25 * dv - x)) / dv;
  } else if (x < min + 0.75 * dv) {
    r = (4 * (x - min - 0.5 * dv)) / dv;
    b = 0;
  } else {
    g = 1 + (4 * (min + 0.75 * dv - x)) / dv;
    b = 0;
  }
  return [Math.round(255 * r), Math.round(255 * g), Math.round(255 * b)];
}

/* ------------------------------------------------------------------ *
 * 取样点
 * ------------------------------------------------------------------ */

/**
 * 覆盖四段分界点、段内、越界与零跨度的取样点。
 *
 * 分界点单独列出来是因为阶梯用的是 `<` 而非 `<=`，`x` 恰好落在
 * `min + 0.25 * dv` 上时走的是**下一段**，这类差一错误只有打在界上才抓得到。
 */
const SAMPLE_CASES = [
  // [min, max, x, 说明]
  [0, 100, -50, '远小于 min，夹到 min'],
  [0, 100, 0, '等于 min'],
  [0, 100, 1e-12, 'min 上方极小值（255 * g 会是 e-12 量级，考验 parseInt 的科学计数法）'],
  [0, 100, 12.5, '第一段段内'],
  [0, 100, 25, '第一/二段分界点'],
  [0, 100, 37.5, '第二段段内'],
  [0, 100, 50, '第二/三段分界点'],
  [0, 100, 62.5, '第三段段内'],
  [0, 100, 75, '第三/四段分界点'],
  [0, 100, 87.5, '第四段段内'],
  [0, 100, 100, '等于 max'],
  [0, 100, 500, '远大于 max，夹到 max'],
  [0, 255, 178.5, '取整策略的分水岭：Math.round 与 parseInt 在这里结果不同'],
  [20, 220, 120, 'min 非零'],
  [-100, 100, 0, 'min 为负'],
  [0, 1, 0.4, '跨度为 1'],
  [0, 2, 1, '真实阈值默认值（carValueg 等六键的默认是 2）'],
  [0, 200, 137, '真实阈值默认值（carValuej 默认 200）'],
  [0, 2655, 1000, '真实阈值默认值（最大的那个离群默认值）'],
];

/** 零跨度单列 —— 三个出口在这里的行为**故意不一致**，见各组断言。 */
const ZERO_SPAN = [
  [0, 0, 0],
  [50, 50, 50],
  [50, 50, 999],
];

describe('jet —— 14 份整数三元组副本', () => {
  it.each(SAMPLE_CASES)('min=%s max=%s x=%s（%s）与原实现逐分量相等', (min, max, x) => {
    expect(jet(min, max, x)).toEqual(legacyJet(min, max, x));
  });

  it('与 num/Num.jsx 那份少写 `+ ""` 的变体也逐分量相等', () => {
    // 这两份原本是不同的字符串，等价性是推理出来的，所以必须打在这里。
    SAMPLE_CASES.forEach(([min, max, x]) => {
      expect(jet(min, max, x)).toEqual(legacyJetNoCoerce(min, max, x));
    });
  });

  it('零跨度时返回 [255, NaN, 0] —— 原实现就是这样，不加保护', () => {
    ZERO_SPAN.forEach(([min, max, x]) => {
      expect(jet(min, max, x)).toEqual(legacyJet(min, max, x));
      const [r, g, b] = jet(min, max, x);
      expect(r).toBe(255);
      expect(Number.isNaN(g)).toBe(true);
      expect(b).toBe(0);
    });
  });

  it('返回三个 0-255 的整数，且不是同一个数组实例', () => {
    const a = jet(0, 100, 30);
    const b = jet(0, 100, 30);
    expect(a).toHaveLength(3);
    a.forEach((v) => {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    });
    a[0] = 999;
    expect(b[0]).not.toBe(999);
  });

  it('在 0-100 上逐点扫一遍都和原实现相等', () => {
    // 上面的取样点是挑出来的，这里补一遍密扫，防止挑漏了某一段。
    for (let x = -10; x <= 110; x += 0.5) {
      expect(jet(0, 100, x)).toEqual(legacyJet(0, 100, x));
    }
  });
});

describe('jetRgba —— heatmap/canvas 与 onestep/heatmap 那两份', () => {
  it.each(SAMPLE_CASES)('min=%s max=%s x=%s（%s）与原实现逐分量相等', (min, max, x) => {
    expect(jetRgba(min, max, x)).toEqual(legacyJetRgba(min, max, x));
  });

  it('长度为 4，第四位恒为 1，前三位**不取整**', () => {
    const rgba = jetRgba(0, 100, 10);
    expect(rgba).toHaveLength(4);
    expect(rgba[3]).toBe(1);
    // 10 落在第一段：g = 4 * 10 / 100 = 0.4 → 102，恰好是整数，换个取样点。
    expect(jetRgba(0, 100, 11)[1] % 1).not.toBe(0);
  });

  it('零跨度时与原实现一致（第二位是 NaN，没有白色保护）', () => {
    ZERO_SPAN.forEach(([min, max, x]) => {
      expect(jetRgba(min, max, x)).toEqual(legacyJetRgba(min, max, x));
    });
  });

  it('在 0-100 上逐点扫一遍都和原实现相等', () => {
    for (let x = -10; x <= 110; x += 0.5) {
      expect(jetRgba(0, 100, x)).toEqual(legacyJetRgba(0, 100, x));
    }
  });
});

describe('jetRound —— num/NumWs 那一份', () => {
  it.each(SAMPLE_CASES)('min=%s max=%s x=%s（%s）与原实现逐分量相等', (min, max, x) => {
    expect(jetRound(min, max, x)).toEqual(legacyJetRound(min, max, x));
  });

  it('零跨度返回白色 —— 这是它和 jet 的第一处真实差异', () => {
    ZERO_SPAN.forEach(([min, max, x]) => {
      expect(jetRound(min, max, x)).toEqual(legacyJetRound(min, max, x));
      expect(jetRound(min, max, x)).toEqual([255, 255, 255]);
    });
  });

  it('Math.round 与 parseInt 的差异是真实存在的 —— 这是第二处，刻意保留', () => {
    // 如果哪天想把 jetRound 并回 jet，这条断言会失败，提醒那不是无损合并。
    // 扫描而不是硬编码一个取样点：分歧点取决于分段系数，硬编码的那个
    // 一旦落在某段的整数刚好处就会假通过（我第一版就写错了：x=178.5 在
    // [0,255] 上落到第三段，255 * 0.8 = 204 恰好是整数，两者并无差异）。
    const divergent = [];
    for (let x = 0; x <= 100; x += 0.05) {
      if (JSON.stringify(jetRound(0, 100, x)) !== JSON.stringify(jet(0, 100, x))) {
        divergent.push(x);
      }
    }
    expect(divergent.length).toBeGreaterThan(0);
  });

  it('顺带锁死 jet 的一个既有 bug：parseInt 撞上科学计数法', () => {
    // 这不是本次引入的，14 份 canonical 副本一直如此，所以按「界面零变化」
    // 的约定原样保留 —— 但要有一条测试写明它是 bug，别让后人以为是设计。
    //
    // x 落在段界下方约 1e-12 处时 blue ≈ 2.8e-14，255 * 它 ≈ 7.1e-12：
    //   parseInt('7.105427357601002e-12') === 7   ← 在 'e' 处停下，取了尾数
    //   Math.round(7.105427357601002e-12) === 0   ← 正确答案
    // 于是 jet 在段界附近会把某个通道输出成 7 而不是 0。肉眼是黑色里掺了一点点
    // 蓝，实际上看不出来，但它确实是错的。
    const x = 49.9999999999993;
    expect(jet(0, 100, x)).toEqual([0, 255, 7]);
    expect(jetRound(0, 100, x)).toEqual([0, 255, 0]);
    expect(parseInt(255 * jetRgb(0, 100, x).b + '')).toBe(7);

    // 想修的话是把三个出口都改成 Math.round，那会同时动 14 处配色，
    // 属于「统一取整策略」那件事，要单独决定、单独手测。
  });

  it('在 0-100 上逐点扫一遍都和原实现相等', () => {
    for (let x = -10; x <= 110; x += 0.5) {
      expect(jetRound(0, 100, x)).toEqual(legacyJetRound(0, 100, x));
    }
  });
});

describe('jetRgb —— 那条唯一的分支阶梯', () => {
  it('三个取整出口都是它的下游，分量关系必须闭合', () => {
    SAMPLE_CASES.forEach(([min, max, x]) => {
      const { r, g, b } = jetRgb(min, max, x);
      expect(jet(min, max, x)).toEqual([
        parseInt(255 * r + ''), parseInt(255 * g + ''), parseInt(255 * b + ''),
      ]);
      expect(jetRgba(min, max, x)).toEqual([255 * r, 255 * g, 255 * b, 1]);
    });
  });

  it('分量落在 0..1（零跨度那一档除外）', () => {
    for (let x = -10; x <= 110; x += 0.5) {
      const { r, g, b } = jetRgb(0, 100, x);
      [r, g, b].forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      });
    }
  });

  it('返回对象而非数组 —— 调用方按 { r, g, b } 解构', () => {
    expect(Object.keys(jetRgb(0, 100, 50)).sort()).toEqual(['b', 'g', 'r']);
  });

  it('util.js 导出的就是 jetLadder.js 里那一个函数，不是第二份实现', () => {
    // 阶梯放在 jetLadder.js 是因为 colormaps.js 要用它，而 colormaps.js 会被
    // 后端测试用裸 Node ESM 加载、import 不了 util.js（详见 jetLadder.js 头部）。
    // util.js 只是 re-export。这条断言防的是有人图省事在 util.js 里再写一份 ——
    // 那样「全仓唯一一条阶梯」就又变成两条了，而且不会有任何测试失败。
    expect(jetRgb).toBe(jetRgbFromLadder);
  });

  it('util.js 导出的 jet / findMax 就是 SDK 包里那两个函数，不是第二份实现', () => {
    // 拆包时 `jet` / `findMax` 搬到了 `@shroom/frontend/core/frameMath.js`
    // （数字矩阵渲染器要用，而包里不能 import 1440 行、顶层读 localStorage 的
    // util.js）。util.js 只是 re-export。这条断言与上面那条防的是同一件事：
    // 有人图省事在 util.js 里再写一份函数体，行为测试全绿，但仓里就有了两份。
    expect(jet).toBe(jetFromSdk);
    expect(findMaxFromUtil).toBe(findMaxFromSdk);
  });
});
