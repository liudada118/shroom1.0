import { describe, expect, it } from 'vitest';
import { jet, jetRound } from '../../assets/util/util';
import {
  COLORMAPS,
  DEFAULT_COLORMAP_ID,
  colormapPreviewCss,
  getColormap,
  isClassicColormap,
  isKnownColormapId,
  sampleColormap,
  sampleColormapRgb,
} from './colormaps';

describe('配色方案', () => {
  it('classic 逐字复刻引入配色能力之前的硬编码公式', () => {
    // 老实现：hsl(195 - ratio * 195, 88%, 42% + ratio * 8%)。
    // 这条断言是"既有展示系统观感零变化"的守门人，改公式必须先改这里。
    [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
      const hue = 195 - ratio * 195;
      expect(sampleColormap('classic', ratio)).toBe(`hsl(${hue} 88% ${42 + ratio * 8}%)`);
    });
  });

  it('默认配色就是 classic', () => {
    expect(DEFAULT_COLORMAP_ID).toBe('classic');
    expect(sampleColormap(undefined, 0.4)).toBe(sampleColormap('classic', 0.4));
  });

  it('未知 id 回落到 classic 而不是抛错', () => {
    expect(isKnownColormapId('nope')).toBe(false);
    expect(getColormap('nope').id).toBe('classic');
    expect(sampleColormap('nope', 0.6)).toBe(sampleColormap('classic', 0.6));
  });

  it('ratio 超界被夹到 [0, 1]', () => {
    expect(sampleColormap('viridis', -3)).toBe(sampleColormap('viridis', 0));
    expect(sampleColormap('viridis', 12)).toBe(sampleColormap('viridis', 1));
    expect(sampleColormap('viridis', Number.NaN)).toBe(sampleColormap('viridis', 0));
  });

  it('reverse 把采样位置翻过来', () => {
    expect(sampleColormap('thermal', 0.2, { reverse: true }))
      .toBe(sampleColormap('thermal', 0.8));
    expect(colormapPreviewCss('thermal', { reverse: true })).toContain('270deg');
    expect(colormapPreviewCss('thermal')).toContain('90deg');
  });

  it('插值配色两端就是首尾 stop', () => {
    expect(sampleColormap('grayscale', 0)).toBe('rgb(24 24 24)');
    expect(sampleColormap('grayscale', 1)).toBe('rgb(245 245 245)');
  });
});

describe('数值 RGB 采样', () => {
  // 3D 场景要把颜色写进 canvas 的 fillStyle 和精灵图，拿不到 CSS 字符串，
  // 所以需要一条返回数值三元组的通路，两条通路必须给出同一个颜色。
  it('和 CSS 通路给出同一个颜色', () => {
    // heatBlobs 也在名单里：它的 CSS 通路是直接拿数值通路的结果拼字符串的
    // （`sampleHeatBlobs` 调 `sampleHeatBlobsRgb`），那道 sRGB gamma 因此两边
    // 必然同源。哪天有人只给其中一条加 gamma，这一行会当场红。
    ['grayscale', 'viridis', 'thermal', 'inferno', 'iceFire', 'jet', 'heatBlobs'].forEach((id) => {
      [0, 0.33, 0.5, 1].forEach((ratio) => {
        const [red, green, blue] = sampleColormapRgb(id, ratio);
        expect(sampleColormap(id, ratio)).toBe(`rgb(${red} ${green} ${blue})`);
      });
    });
  });

  it('classic 的数值通路和它的 hsl 公式一致', () => {
    // classic 的 CSS 通路输出 hsl()，没法逐字比对，改比对手算的 HSL→RGB 结果。
    // hsl(195 88% 42%) 和 hsl(0 88% 50%) 的手算结果。
    expect(sampleColormapRgb('classic', 0)).toEqual([13, 154, 201]);
    expect(sampleColormapRgb('classic', 1)).toEqual([240, 15, 15]);
  });

  it('未知 id 和超界 ratio 与 CSS 通路同样宽容', () => {
    expect(sampleColormapRgb('nope', 0.6)).toEqual(sampleColormapRgb('classic', 0.6));
    expect(sampleColormapRgb('viridis', -3)).toEqual(sampleColormapRgb('viridis', 0));
    expect(sampleColormapRgb('viridis', 9)).toEqual(sampleColormapRgb('viridis', 1));
  });

  it('reverse 同样生效', () => {
    expect(sampleColormapRgb('thermal', 0.2, { reverse: true }))
      .toEqual(sampleColormapRgb('thermal', 0.8));
  });
});

describe('jet 配色', () => {
  // jet 是全仓 18 处老配色用的那条阶梯（抽进 util.js 之前每个文件抄一份）。
  // 登记成第 7 条配色之后，画布配置器第一次能显式选到它。
  it('登记在册，且是四段折线而不是插值色标', () => {
    expect(isKnownColormapId('jet')).toBe(true);
    expect(getColormap('jet').label).toBe('彩虹 Jet');
    // 蓝 → 青 → 绿 → 黄 → 红，四个分界点就是 jet 的定义。公式改了这里就会红。
    expect(sampleColormap('jet', 0)).toBe('rgb(0 0 255)');
    expect(sampleColormap('jet', 0.25)).toBe('rgb(0 255 255)');
    expect(sampleColormap('jet', 0.5)).toBe('rgb(0 255 0)');
    expect(sampleColormap('jet', 0.75)).toBe('rgb(255 255 0)');
    expect(sampleColormap('jet', 1)).toBe('rgb(255 0 0)');
  });

  it('走的是 util.js 那条唯一的分支阶梯，用 Math.round 出口', () => {
    // 断言的是"同一条阶梯"，不是"抄了一遍公式"。util.js 里的阶梯改了，
    // 老场景和配色栏会一起变，不会只变一边。
    for (let ratio = 0; ratio <= 1; ratio += 0.01) {
      expect(sampleColormapRgb('jet', ratio)).toEqual(jetRound(0, 1, ratio));
    }
  });

  it('与老场景的 jet() 出口最多差 1，唯一的例外是老 parseInt 那个 bug', () => {
    // 老场景走 `parseInt(255 * r + '')`，配色栏走 Math.round，取整策略不同是
    // 有意的（见 sampleJetRgb 的注释）。正常情况下只差 1/255。
    //
    // 但下面这个 0.01 步长的浮点累加会精确落在 ratio = 0.5000000000000002，
    // 那里 red 分量是 8.881784197001252e-16，255 * 它 = 2.2648549702353193e-13：
    //   parseInt('2.2648549702353193e-13') === 2   ← 在 'e' 处停下，取了尾数
    //   Math.round(2.2648549702353193e-13) === 0   ← 正确答案
    // 这是老 jet() 的既有 bug（util.jet.test.js 里有一条断言锁着它，按
    // 「界面零变化」的约定没有去修），不是本条通路引入的偏差。
    const artifacts = [];
    for (let ratio = 0; ratio <= 1; ratio += 0.01) {
      const viaColormap = sampleColormapRgb('jet', ratio);
      const viaLegacy = jet(0, 1, ratio);
      viaColormap.forEach((channel, index) => {
        if (Math.abs(channel - viaLegacy[index]) <= 1) return;
        // 差超过 1 的只允许是那个 bug：正确答案必须是 0，老实现取到了尾数。
        expect(channel).toBe(0);
        artifacts.push(ratio);
      });
    }

    // 顺带确认这一圈真的踩到了它 —— 否则上面那句 forEach 就是一句空话。
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toBeGreaterThan(0.5);
    expect(artifacts[0]).toBeLessThan(0.5000001);
  });

  it('reverse 与超界夹取和别的配色一视同仁', () => {
    expect(sampleColormapRgb('jet', 0.2, { reverse: true }))
      .toEqual(sampleColormapRgb('jet', 0.8));
    expect(sampleColormapRgb('jet', -5)).toEqual([0, 0, 255]);
    expect(sampleColormapRgb('jet', 5)).toEqual([255, 0, 0]);
    expect(sampleColormapRgb('jet', Number.NaN)).toEqual([0, 0, 255]);
  });

  it('不算 classic —— 显式选 jet 和"没选配色"是两条不同的通路', () => {
    // NumThreeColor1024 / hand 的 classic 分支调的是老 jet()（parseInt 取整）
    // 外加逐实例 (r, 0.2, 1-r) 染色；显式选 jet 走的是色标采样。
    // 两者观感接近但不相同，所以 jet 绝不能被判成 classic。
    expect(isClassicColormap({ id: 'jet' })).toBe(false);
    expect(isClassicColormap('jet')).toBe(false);
  });

  it('排在既有六条之后，不挪动它们的顺序', () => {
    // 画布配置器的配色下拉直接遍历 COLORMAPS，插在中间会让用户的下拉顺序变。
    // `heatBlobs` 是随 `webglHeatmap` 进包时追加的第八条（那条 8 段色带原先只以
    // GLSL 的形式活在着色器里，没有 JS 侧的对应物）—— 同样是**追加在末尾**，
    // 前七条一个没动。
    expect(COLORMAPS.map((item) => item.id)).toEqual([
      'classic', 'thermal', 'viridis', 'inferno', 'grayscale', 'iceFire', 'jet',
      'heatBlobs',
    ]);
  });
});

describe('classic 判定', () => {
  // 3D 场景（NumThreeColor1024 / hand）的 classic 通路不是本模块的 hsl 公式，
  // 而是各自原有的 jet()。它们靠这个判定在逐帧循环外决定走哪条分支，
  // 判错就等于把老展示系统的观感换掉了。
  it('没选配色一律算 classic', () => {
    expect(isClassicColormap(undefined)).toBe(true);
    expect(isClassicColormap(null)).toBe(true);
    expect(isClassicColormap({})).toBe(true);
    expect(isClassicColormap({ id: '' })).toBe(true);
  });

  it('显式 classic 也算，字符串写法同样认', () => {
    expect(isClassicColormap({ id: 'classic' })).toBe(true);
    expect(isClassicColormap('classic')).toBe(true);
    expect(isClassicColormap(DEFAULT_COLORMAP_ID)).toBe(true);
  });

  it('别的配色不算，reverse 不影响判定', () => {
    expect(isClassicColormap({ id: 'viridis' })).toBe(false);
    expect(isClassicColormap('viridis')).toBe(false);
    // 3D 场景的 classic 走 jet()，没有 reverse 这一说，所以 reverse 不该
    // 把它踢出 classic 分支 —— 否则会掉进色标采样、观感当场变掉。
    expect(isClassicColormap({ id: 'classic', reverse: true })).toBe(true);
  });
});
