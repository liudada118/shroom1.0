/** 共用一条可暂停的场景时钟，让返回末段和恢复预览沿用同一运动相位。 */
export function createSceneMotionClock() {
  let previous = null;
  let previousSpeed = 0;
  let elapsed = 0;
  return {
    /** 暂停只丢弃墙钟间隔，不重置点云已经走到的相位。 */
    pause() { previous = null; previousSpeed = 0; },
    /** 按前后速度积分；持续低帧率仍按实际可见时间推进，暂停间隔由 pause 丢弃。 */
    advance(timestamp, speed = 1) {
      const nextSpeed = Math.max(0, Math.min(1, speed));
      const interval = previous === null ? 0 : Math.max(0, (timestamp - previous) / 1000);
      const delta = interval * (previousSpeed + nextSpeed) / 2;
      previous = timestamp;
      previousSpeed = nextSpeed;
      elapsed += delta;
      return { delta, elapsed };
    },
  };
}

/** 归位途中逐渐接回浮动，抵达前恢复原速，不在弹窗出现后另起一段动画。 */
export function returnMotionSpeed(progress) {
  const value = Math.max(0, Math.min(1, (progress - .45) / .45));
  return value * value * (3 - 2 * value);
}

/** 在归位最后约 160ms 混合已贴合的两个画布，避免点纹理和亮度在卸载时硬切。 */
export function returnPreviewBlend(progress) {
  const value = Math.max(0, Math.min(1, 1 - progress / .004));
  return value * value * (3 - 2 * value);
}
