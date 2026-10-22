const EMPTY_BENDS = Object.freeze([0, 0, 0, 0, 0]);

/** 复制有效的五指预览，缺失项按平铺处理，不修改调用方数组。 */
function previewBends(values) {
  return Array.from({ length: 5 }, (_, index) => {
    const value = Number(values?.[index]);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  });
}

/** 创建独立于实时压力帧的单侧校准预览状态。 */
export function createMotionCalibration() {
  return { active: false, side: 'left', pose: 0, bends: [...EMPTY_BENDS] };
}

/** 显式更新当前校准侧与姿态，关闭时保留设置而不再覆盖实时弯指。 */
export function updateMotionCalibration(previous, update = {}) {
  const side = ['left', 'right'].includes(update.side) ? update.side : previous.side;
  const bends = Array.isArray(update.bends) ? previewBends(update.bends)
    : update.pose === 0 || update.pose === 1 ? Array(5).fill(update.pose) : previous.bends;
  const pose = bends.every((value) => value === 0) ? 0 : bends.every((value) => value === 1) ? 1 : null;
  return { active: typeof update.active === 'boolean' ? update.active : previous.active, side, pose, bends };
}

/** 只覆盖校准目标手；195点整包输入没有弯指契约，不能据此虚构手势。 */
export function resolveMotionBends(calibration, side, frame) {
  if (frame?.pressure?.length === 195) return EMPTY_BENDS;
  if (calibration.active && calibration.side === side) return calibration.bends;
  return frame?.fingers || EMPTY_BENDS;
}
