import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { createMotionOrientation, resetMotionOrientation, updateMotionOrientation } from './motionOrientation';

/** 生成设备XYZW，避免只用单位四元数掩盖基准未重置的问题。 */
function pose(axis, angle) {
  return new Quaternion().setFromAxisAngle(new Vector3(...axis), angle).toArray();
}

/** 以旋转等价比较四元数，q与-q表示同一方向。 */
function expectIdentity(value) {
  expect(Math.abs(value.dot(new Quaternion()))).toBeCloseTo(1, 10);
}

describe('炫酷摇操按侧四元数置零', () => {
  it.each([
    ['X正转', [1, 0, 0], [0, -1, 0], 1], ['X反转', [1, 0, 0], [0, -1, 0], -1],
    ['Y正转', [0, 1, 0], [-1, 0, 0], 1], ['Y反转', [0, 1, 0], [-1, 0, 0], -1],
    ['Z正转', [0, 0, 1], [0, 0, 1], 1], ['Z反转', [0, 0, 1], [0, 0, 1], -1],
  ])('设备%s与3D遥操的旋转轴和方向一致', (_label, deviceAxis, displayAxis, sign) => {
    const state = createMotionOrientation();
    updateMotionOrientation(state, [0, 0, 0, 1]);
    updateMotionOrientation(state, pose(deviceAxis, sign * Math.PI / 3));
    const expected = new Quaternion(...pose(displayAxis, sign * Math.PI / 3));
    expect(Math.abs(state.target.dot(expected))).toBeCloseTo(1, 10);
  });

  it('点击以最新输入为基准，后续相同读数持续为零，变化读数继续响应', () => {
    const state = createMotionOrientation();
    const start = pose([1, 0, 0], .2);
    const latest = pose([0, 1, 0], .7);
    updateMotionOrientation(state, start);
    updateMotionOrientation(state, latest);
    expect(Math.abs(state.target.w)).toBeLessThan(.99);
    expect(resetMotionOrientation(state)).toBe(true);
    expectIdentity(state.target);
    updateMotionOrientation(state, latest);
    expectIdentity(state.target);
    updateMotionOrientation(state, pose([0, 1, 0], 1.1));
    expect(Math.abs(state.target.w)).toBeLessThan(.99);
  });

  it('左手置零不改变右手的最新值、基准或显示目标', () => {
    const left = createMotionOrientation(), right = createMotionOrientation();
    updateMotionOrientation(left, pose([1, 0, 0], .1));
    updateMotionOrientation(right, pose([0, 0, 1], .2));
    updateMotionOrientation(left, pose([0, 1, 0], .8));
    updateMotionOrientation(right, pose([1, 0, 0], .9));
    const before = { latest: right.latest.toArray(), neutral: right.neutral.toArray(), target: right.target.toArray() };
    resetMotionOrientation(left);
    expectIdentity(left.target);
    expect({ latest: right.latest.toArray(), neutral: right.neutral.toArray(), target: right.target.toArray() }).toEqual(before);
    expect(right.resets).toBe(0);
    expect(left.resets).toBe(1);
  });

  it('最近一帧姿态缺失时仍以本侧最后有效姿态置零', () => {
    const state = createMotionOrientation();
    const latest = pose([0, 1, 0], .8);
    updateMotionOrientation(state, [0, 0, 0, 1]);
    updateMotionOrientation(state, latest);
    expect(updateMotionOrientation(state, null)).toBe(false);
    expect(updateMotionOrientation(state, [0, NaN, 0, 1])).toBe(false);
    resetMotionOrientation(state);
    updateMotionOrientation(state, latest);
    expectIdentity(state.target);
  });

  it('尚无有效姿态时等待下一有效帧，不能借另一只手的基准', () => {
    const state = createMotionOrientation();
    expect(resetMotionOrientation(state)).toBe(false);
    for (const invalid of [null, [], [0, 0, 0, 0], [0, Infinity, 0, 1]]) {
      expect(updateMotionOrientation(state, invalid)).toBe(false);
    }
    expect(state.neutral).toBeNull();
    updateMotionOrientation(state, pose([0, 0, 1], .9));
    expectIdentity(state.target);
    updateMotionOrientation(state, pose([0, 0, 1], 1.3));
    expect(Math.abs(state.target.w)).toBeLessThan(.99);
  });

  it('输入数组不被交换或修改，待渲染的最新姿态也能立即成为零点', () => {
    const state = createMotionOrientation();
    const input = pose([1, 0, 0], .65);
    const original = [...input];
    updateMotionOrientation(state, [0, 0, 0, 1]);
    updateMotionOrientation(state, input);
    resetMotionOrientation(state);
    expect(input).toEqual(original);
    expectIdentity(state.target);
    updateMotionOrientation(state, [...input]);
    expectIdentity(state.target);
  });

  it('硬件初始化丢弃旧姿态，设备重置后的不同首帧才成为新零点', () => {
    const state = createMotionOrientation();
    updateMotionOrientation(state, pose([1, 0, 0], .2));
    updateMotionOrientation(state, pose([0, 1, 0], 1.1));
    expect(Math.abs(state.target.w)).toBeLessThan(.99);
    expect(resetMotionOrientation(state, { waitForNextFrame: true })).toBe(false);
    expect(state.latest).toBeNull();
    expect(state.neutral).toBeNull();
    expectIdentity(state.target);
    const newBase = pose([0, 0, 1], -1.3);
    updateMotionOrientation(state, newBase);
    expectIdentity(state.target);
    updateMotionOrientation(state, newBase);
    expectIdentity(state.target);
    updateMotionOrientation(state, pose([0, 0, 1], -.7));
    expect(Math.abs(state.target.w)).toBeLessThan(.99);
  });

  it('硬件初始化期间缺失、零值与坏帧不能消耗等待中的新基准', () => {
    const state = createMotionOrientation();
    updateMotionOrientation(state, pose([1, 0, 0], .4));
    resetMotionOrientation(state, { waitForNextFrame: true });
    for (const invalid of [null, [], [0, 0, 0, 0], [0, NaN, 0, 1], [0, Infinity, 0, 1]]) {
      expect(updateMotionOrientation(state, invalid)).toBe(false);
      expect(state.latest).toBeNull();
      expect(state.neutral).toBeNull();
      expectIdentity(state.target);
    }
    updateMotionOrientation(state, pose([0, 1, 0], -1));
    expectIdentity(state.target);
    expect(state.neutral).not.toBeNull();
    expect(state.resets).toBe(1);
  });

  it('硬件初始化仅清除目标侧，另一侧的读数、零点和显示保持原样', () => {
    const left = createMotionOrientation(), right = createMotionOrientation();
    updateMotionOrientation(left, pose([1, 0, 0], .1));
    updateMotionOrientation(right, pose([0, 0, 1], .2));
    updateMotionOrientation(left, pose([0, 1, 0], .8));
    updateMotionOrientation(right, pose([1, 0, 0], .9));
    const before = { latest: right.latest.toArray(), neutral: right.neutral.toArray(), target: right.target.toArray() };
    resetMotionOrientation(left, { waitForNextFrame: true });
    expect(left.latest).toBeNull();
    expect(left.neutral).toBeNull();
    expectIdentity(left.target);
    expect({ latest: right.latest.toArray(), neutral: right.neutral.toArray(), target: right.target.toArray() }).toEqual(before);
    expect(right.resets).toBe(0);
  });
});
