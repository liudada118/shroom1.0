export const HUMAN_BODY_BALANCED_PIXEL_RATIO = 1;
export const HUMAN_BODY_LOW_POWER_PIXEL_RATIO = 0.75;
export const HUMAN_BODY_BALANCED_FRAME_INTERVAL_MS = 1000 / 24;
export const HUMAN_BODY_LOW_POWER_FRAME_INTERVAL_MS = 1000 / 18;
export const HUMAN_BODY_DATA_FRAME_INTERVAL_MS = 1000 / 30;

const SLOW_FRAME_INTERVAL_MS = 45;
const LOW_POWER_STABLE_INTERVAL_MS = 68;
const SLOW_FRAMES_BEFORE_DOWNGRADE = 8;
const STABLE_FRAMES_BEFORE_RECOVERY = 600;

const finiteNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function pinHumanBodyCanvasToViewport(canvas) {
  if (!canvas?.style) return false;
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    display: "block",
    width: "100%",
    height: "100%",
  });
  return true;
}

export function getHumanBodyRenderPixelRatio(devicePixelRatio, qualityTier = "balanced") {
  const ratio = Math.max(0.75, finiteNumber(devicePixelRatio, 1));
  const cap = qualityTier === "low"
    ? HUMAN_BODY_LOW_POWER_PIXEL_RATIO
    : HUMAN_BODY_BALANCED_PIXEL_RATIO;
  return Math.min(ratio, cap);
}

export function getHumanBodyRenderFrameInterval(qualityTier = "balanced") {
  return qualityTier === "low"
    ? HUMAN_BODY_LOW_POWER_FRAME_INTERVAL_MS
    : HUMAN_BODY_BALANCED_FRAME_INTERVAL_MS;
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
    const slowFrames = interval > SLOW_FRAME_INTERVAL_MS ? current.slowFrames + 1 : 0;
    return slowFrames >= SLOW_FRAMES_BEFORE_DOWNGRADE
      ? { tier: "low", slowFrames: 0, stableFrames: 0 }
      : { ...current, slowFrames, stableFrames: 0 };
  }

  const stableFrames = interval < LOW_POWER_STABLE_INTERVAL_MS ? current.stableFrames + 1 : 0;
  return stableFrames >= STABLE_FRAMES_BEFORE_RECOVERY
    ? { tier: "balanced", slowFrames: 0, stableFrames: 0 }
    : { ...current, slowFrames: 0, stableFrames };
}

export function shouldRenderHumanBodyFrame({
  visible,
  dirty,
  continuous,
  now,
  lastRenderAt,
  qualityTier,
  dataPending = false,
}) {
  if (!visible) return false;
  if (!continuous) return dirty === true;
  const elapsed = finiteNumber(now, 0) - finiteNumber(lastRenderAt, 0);
  const interval = dataPending
    ? HUMAN_BODY_DATA_FRAME_INTERVAL_MS
    : getHumanBodyRenderFrameInterval(qualityTier);
  return elapsed >= interval;
}
