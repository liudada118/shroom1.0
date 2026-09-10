import { describe, expect, it } from 'vitest';
import { advanceMorph, createMushroomIntro, frameFollowStrength, sweepProgress } from './sceneMorph';

describe('粒子完整扫掠与实际时间', () => {
  it.each([30, 60, 120])('%s FPS 下按相同墙钟时间完成', (fps) => {
    let progress = 0;
    for (let i = 0; i < Math.ceil(fps * 1.35); i++) progress = advanceMorph(progress, 1 / fps);
    expect(progress).toBeCloseTo(1, 10);
  });
  it('减少动画立即归位，负时间不倒退', () => {
    expect(advanceMorph(0.5, -1)).toBe(0.5);
    expect(advanceMorph(0.2, 0, true)).toBe(1);
    expect(advanceMorph(0, 10)).toBe(1);
  });
  it.each([1, -1])('方向 %s 的所有粒子从零连续到达一', (direction) => {
    for (const weight of [0, 0.2, 0.5, 0.8, 1]) {
      for (const jitter of [0, 0.06, 0.12]) {
        expect(sweepProgress(0, weight, jitter, direction)).toBe(0);
        expect(sweepProgress(1, weight, jitter, direction)).toBe(1);
        let previous = 0;
        for (let frame = 1; frame <= 120; frame++) {
          const next = sweepProgress(frame / 120, weight, jitter, direction);
          expect(next).toBeGreaterThanOrEqual(previous);
          expect(next - previous).toBeLessThan(0.06);
          previous = next;
        }
      }
    }
  });
});

describe('参考项目的柔和跟随与首次停留', () => {
  it.each([0.088, 0.055, 0.08])('60 FPS 保持原系数 %s，30/120 FPS 的相同时间收敛一致', (strength) => {
    expect(frameFollowStrength(strength, 1 / 60)).toBeCloseTo(strength, 12);
    const results = [30, 60, 120].map((fps) => {
      let position = 0;
      for (let i = 0; i < fps / 2; i++) position += (1 - position) * frameFollowStrength(strength, 1 / fps);
      return position;
    });
    expect(results[0]).toBeCloseTo(results[1], 10);
    expect(results[1]).toBeCloseTo(results[2], 10);
    expect(results[0]).toBeLessThan(1);
  });
  it('减少动画立即到位；零时间和负时间不移动', () => {
    expect(frameFollowStrength(0.055, 0, true)).toBe(1);
    expect(frameFollowStrength(0.055, 0)).toBe(0);
    expect(frameFollowStrength(0.055, -1)).toBe(0);
  });
  it('首次必须先成形，再停留 0.72 秒；期间连续选择不排队播放过期场景', () => {
    const intro = createMushroomIntro();
    expect(intro.select('chair', { elapsed: 1, complete: false })).toBe('shroom');
    expect(intro.select('chair', { elapsed: 2, complete: true })).toBe('shroom');
    expect(intro.select('glove', { elapsed: 2.71, complete: true })).toBe('shroom');
    expect(intro.select('matrix', { elapsed: 2.73, complete: true })).toBe('matrix');
    expect(intro.select('chair', { elapsed: 3, complete: false })).toBe('chair');
  });
  it.each(['reducedMotion', 'failed'])('%s 时绕过开场，不阻塞真实入口', (flag) => {
    expect(createMushroomIntro().select('matrix', { elapsed: 0, [flag]: true })).toBe('matrix');
  });
});
