import { describe, expect, it } from 'vitest';
import { createMotionCalibration, resolveMotionBends, updateMotionCalibration } from './motionCalibration';

/** 构造真实弯指与压力同时到达的展示输入，测试不依赖WebGL。 */
function frame(bend, points = 147) {
  return { pressure: Array(points).fill(30), fingers: Array(5).fill(bend), total: points * 30 };
}

describe('炫酷摇操校准预览', () => {
  it('只锁定当前目标手，另一侧继续采用实时弯指', () => {
    const state = updateMotionCalibration(createMotionCalibration(), { active: true, side: 'left', pose: 1 });
    expect(resolveMotionBends(state, 'left', frame(.2))).toEqual([1, 1, 1, 1, 1]);
    expect(resolveMotionBends(state, 'right', frame(.7))).toEqual(Array(5).fill(.7));
    expect(resolveMotionBends(state, 'right', frame(.3))).toEqual(Array(5).fill(.3));
  });

  it('实时帧继续更新，但不会把平铺/握拳预览覆盖回实时手势', () => {
    const current = frame(.2);
    const original = structuredClone(current);
    const state = updateMotionCalibration(createMotionCalibration(), { active: true, side: 'right', pose: 0 });
    expect(resolveMotionBends(state, 'right', current)).toEqual([0, 0, 0, 0, 0]);
    expect(resolveMotionBends(state, 'right', frame(.8))).toEqual([0, 0, 0, 0, 0]);
    expect(current).toEqual(original);
  });

  it('关闭弹窗直接恢复最新输入，包括采集后无需新串口帧的重算结果', () => {
    let state = updateMotionCalibration(createMotionCalibration(), { active: true, side: 'left', pose: 1 });
    const recalibrated = frame(.12);
    expect(resolveMotionBends(state, 'left', recalibrated)).toEqual(Array(5).fill(1));
    state = updateMotionCalibration(state, { active: false });
    expect(resolveMotionBends(state, 'left', recalibrated)).toBe(recalibrated.fingers);
  });

  it('切换校准侧立即释放原侧，姿态仅作用于新侧', () => {
    const original = updateMotionCalibration(createMotionCalibration(), { active: true, side: 'left', pose: 1 });
    const next = updateMotionCalibration(original, { active: true, side: 'right', pose: 0 });
    expect(resolveMotionBends(next, 'left', frame(.45))).toEqual(Array(5).fill(.45));
    expect(resolveMotionBends(next, 'right', frame(.9))).toEqual(Array(5).fill(0));
    expect(original).toEqual({ active: true, side: 'left', pose: 1, bends: Array(5).fill(1) });
  });

  it('整包195点没有虚构弯指，即使误请求握拳预览也保持平铺', () => {
    const state = updateMotionCalibration(createMotionCalibration(), { active: true, side: 'right', pose: 1 });
    expect(resolveMotionBends(state, 'right', frame(.8, 195))).toEqual([0, 0, 0, 0, 0]);
  });

  it('旧五指接口可提供独立数值，预览钳位不修改调用方数据', () => {
    const values = [-1, .25, 2, NaN, .8];
    const state = updateMotionCalibration(createMotionCalibration(), { active: true, side: 'right', bends: values });
    expect(state.bends).toEqual([0, .25, 1, 0, .8]);
    expect(values[0]).toBe(-1);
    expect(values[2]).toBe(2);
    expect(Number.isNaN(values[3])).toBe(true);
  });
});
