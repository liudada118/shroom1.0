export const HUMAN_BODY_BALANCED_PIXEL_RATIO = 1.25;
export const HUMAN_BODY_LOW_POWER_PIXEL_RATIO = 1;
export const HUMAN_BODY_ACTIVE_FRAME_INTERVAL_MS = 1000 / 30;

const finiteNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function getHumanBodyRenderPixelRatio(devicePixelRatio, qualityTier = "balanced") {
  const ratio = Math.max(0.75, finiteNumber(devicePixelRatio, 1));
  const cap = qualityTier === "low"
    ? HUMAN_BODY_LOW_POWER_PIXEL_RATIO
    : HUMAN_BODY_BALANCED_PIXEL_RATIO;
  return Math.min(ratio, cap);
}

export function getHumanBodyVisualCenter({
  width,
  leftPanelRight,
  rightPanelLeft,
  gap = 16,
  minimumViewportWidth = 320,
}) {
  const viewportWidth = Math.max(1, finiteNumber(width, 1));
  const fallbackCenter = viewportWidth / 2;
  const safeLeft = Math.max(0, finiteNumber(leftPanelRight, -gap) + gap);
  const safeRight = Math.min(viewportWidth, finiteNumber(rightPanelLeft, viewportWidth + gap) - gap);

  if (safeRight - safeLeft < Math.min(minimumViewportWidth, viewportWidth * 0.35)) {
    return fallbackCenter;
  }
  return safeLeft + (safeRight - safeLeft) / 2;
}

export function getHumanBodyViewOffsetX(width, visualCenterX) {
  const viewportWidth = Math.max(1, finiteNumber(width, 1));
  return viewportWidth / 2 - finiteNumber(visualCenterX, viewportWidth / 2);
}

export function updateHumanBodyQualityState(state, frameIntervalMs) {
  const interval = finiteNumber(frameIntervalMs, 0);
  const current = {
    tier: state?.tier === "low" ? "low" : "balanced",
    slowFrames: Math.max(0, Number(state?.slowFrames) || 0),
    stableFrames: Math.max(0, Number(state?.stableFrames) || 0),
  };

  if (interval <= 0) return current;

  if (current.tier === "balanced") {
    const slowFrames = interval > 42 ? current.slowFrames + 1 : 0;
    return slowFrames >= 10
      ? { tier: "low", slowFrames: 0, stableFrames: 0 }
      : { ...current, slowFrames, stableFrames: 0 };
  }

  const stableFrames = interval < 36 ? current.stableFrames + 1 : 0;
  return stableFrames >= 180
    ? { tier: "balanced", slowFrames: 0, stableFrames: 0 }
    : { ...current, slowFrames: 0, stableFrames };
}

export function shouldRenderHumanBodyFrame({
  visible,
  dirty,
  continuous,
  now,
  lastRenderAt,
}) {
  if (!visible) return false;
  if (!continuous) return dirty === true;
  const elapsed = finiteNumber(now, 0) - finiteNumber(lastRenderAt, 0);
  return elapsed >= HUMAN_BODY_ACTIVE_FRAME_INTERVAL_MS;
}
