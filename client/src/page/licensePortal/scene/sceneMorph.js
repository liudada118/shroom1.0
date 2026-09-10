/** 根据实际可见时间推进形变；低帧率不把一秒动画拖成数秒。 */
export function advanceMorph(progress, deltaSeconds, reducedMotion = false) {
  return reducedMotion ? 1 : Math.min(1, progress + Math.max(0, deltaSeconds) / 1.35);
}

/** 把参考项目的 60 FPS 跟随系数换算为时间阻尼，低帧率不拖尾、高帧率不变硬。 */
export function frameFollowStrength(strength, deltaSeconds, reducedMotion = false) {
  return reducedMotion ? 1 : 1 - Math.pow(1 - strength, Math.max(0, deltaSeconds) * 60);
}

/** 首次先展示完整蘑菇并停留 0.72 秒；减少动画或模型失败时不阻塞系统预览。 */
export function createMushroomIntro() {
  let holdUntil = null;
  let introduced = false;
  return {
    /** 返回这一帧应追随的场景，停留期间的选择以最新一次为准。 */
    select(activeScene, { elapsed, complete, reducedMotion, failed }) {
      if (reducedMotion || failed) introduced = true;
      if (!introduced && complete && holdUntil === null) holdUntil = elapsed + 0.72;
      if (holdUntil !== null && elapsed >= holdUntil) introduced = true;
      return introduced ? activeScene : 'shroom';
    },
  };
}

/** 将扫掠次序归一化到完整区间，最晚启动的粒子也平滑抵达终点。 */
export function sweepProgress(progress, weight, jitter, direction) {
  const edge = 0.42;
  const orderedWeight = direction === 1 ? weight : 1 - weight;
  const eased = progress * progress * (3 - 2 * progress);
  const sweep = eased * (1 + 2 * edge + 0.12) - edge;
  const value = Math.max(0, Math.min(1, (sweep - (orderedWeight - edge + jitter)) / (2 * edge)));
  return value * value * (3 - 2 * value);
}
