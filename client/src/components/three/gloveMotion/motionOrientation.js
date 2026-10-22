import { Quaternion } from 'three';

/** 为单侧手套保存独立姿态与最新有效输入，未连接时等待首帧建立零点。 */
export function createMotionOrientation() {
  return { input: new Quaternion(), latest: null, neutral: null, target: new Quaternion(), resets: 0 };
}

/** 按3D遥操先反转设备X再交换XY；坏帧不覆盖本侧最新有效值或显示方向。 */
export function updateMotionOrientation(state, values) {
  if (!Array.isArray(values) || values.length !== 4 || !values.every(Number.isFinite)
    || Math.hypot(...values) <= 0.000001) return false;
  state.input.set(values[1], -values[0], values[2], values[3]).normalize();
  if (!state.latest) state.latest = new Quaternion();
  state.latest.copy(state.input);
  if (!state.neutral) state.neutral = state.latest.clone().invert();
  state.target.multiplyQuaternions(state.neutral, state.input);
  state.target.x = -state.target.x;
  state.target.normalize();
  return true;
}

/** 软件置零使用最新读数；硬件初始化须丢弃旧基准，等待下一有效姿态。 */
export function resetMotionOrientation(state, options = {}) {
  if (options.waitForNextFrame === true) state.latest = null;
  state.neutral = state.latest ? state.latest.clone().invert() : null;
  state.target.identity();
  state.resets += 1;
  return Boolean(state.latest);
}
