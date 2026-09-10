import { describe, expect, it } from 'vitest';
import { createSceneMotionClock, returnMotionSpeed, returnPreviewBlend } from './sceneMotionClock';

describe('监测返回后沿用预览运动相位', () => {
  it('大幅归位时不露出第二团点云，最后贴合才混合实际预览材质', () => {
    expect(returnPreviewBlend(1)).toBe(0);
    expect(returnPreviewBlend(.004)).toBe(0);
    expect(returnPreviewBlend(.002)).toBeCloseTo(.5);
    expect(returnPreviewBlend(0)).toBe(1);
    expect(returnPreviewBlend(-1)).toBe(1);
    let previous = 0;
    for (let index = 0; index <= 100; index++) {
      const blend = returnPreviewBlend(.004 * (1 - index / 100));
      expect(blend).toBeGreaterThanOrEqual(previous);
      previous = blend;
    }
    expect(returnPreviewBlend(.004 - .000001)).toBeLessThan(.000001);
    expect(returnPreviewBlend(.000001)).toBeGreaterThan(.999999);
  });
  it('暂停多久都不累计墙钟，也不重置已有相位', () => {
    const clock = createSceneMotionClock();
    clock.advance(0);
    const before = clock.advance(16);
    clock.pause();
    expect(clock.advance(600000, 0)).toEqual({ delta: 0, elapsed: before.elapsed });
    expect(clock.advance(600016, 0)).toEqual({ delta: 0, elapsed: before.elapsed });
  });

  it('返回末段开始连续加速，抵达前已恢复原速；下一 RAF 不另起动画', () => {
    const clock = createSceneMotionClock();
    clock.pause();
    clock.advance(1000, 0);
    let previousSpeed = 0;
    let frame;
    for (let index = 1; index <= 60; index++) {
      const speed = returnMotionSpeed(index / 60);
      frame = clock.advance(1000 + index * 16, speed);
      expect(speed).toBeGreaterThanOrEqual(previousSpeed);
      expect(frame.delta).toBeCloseTo(.016 * (previousSpeed + speed) / 2, 10);
      previousSpeed = speed;
    }
    const next = clock.advance(1976);
    expect(next.delta).toBeCloseTo(.016, 10);
    expect(next.elapsed - frame.elapsed).toBeCloseTo(.016, 10);
  });

  it('快速中断后再次暂停不残留速度或返回时长', () => {
    const clock = createSceneMotionClock();
    clock.advance(0, 0);
    const halfway = clock.advance(50, .5);
    clock.pause();
    expect(clock.advance(5000, 0)).toEqual({ delta: 0, elapsed: halfway.elapsed });
    expect(returnMotionSpeed(-1)).toBe(0);
    expect(returnMotionSpeed(.45)).toBe(0);
    expect(returnMotionSpeed(.9)).toBe(1);
    expect(returnMotionSpeed(2)).toBe(1);
  });
});
