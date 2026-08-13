export const HUMAN_BODY_RENDER_SETTINGS_KEY = "humanBodyOptimized.renderSettings.v1";
export const HUMAN_BODY_RENDER_SETTINGS_VERSION = 4;

export const DEFAULT_HUMAN_BODY_RENDER_SETTINGS = Object.freeze({
  version: HUMAN_BODY_RENDER_SETTINGS_VERSION,
  mode: "heatmap",
  radius: 0.1,
  intensity: 0.8,
  opacity: 0.15,
  colorScheme: 0,
  bgColor: "#afacac",
  modelColor: "#718096",
  settingsCollapsed: false,
  overviewAutoRotate: true,
});

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const finiteInRange = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
};

export function clampHumanBodyRadius(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_HUMAN_BODY_RENDER_SETTINGS.radius;
  return Math.min(0.13, Math.max(0.05, number));
}

export function normalizeHumanBodyRenderSettings(value) {
  if (value?.version === 1) {
    value = {
      ...value,
      version: HUMAN_BODY_RENDER_SETTINGS_VERSION,
      bgColor: value.bgColor === "#0a0a0f" ? DEFAULT_HUMAN_BODY_RENDER_SETTINGS.bgColor : value.bgColor,
      modelColor: value.modelColor === "#6a7a8a" ? DEFAULT_HUMAN_BODY_RENDER_SETTINGS.modelColor : value.modelColor,
    };
  }
  if (value?.version === 2) {
    value = {
      ...value,
      version: HUMAN_BODY_RENDER_SETTINGS_VERSION,
      bgColor: value.bgColor === "#e6e6e6" ? DEFAULT_HUMAN_BODY_RENDER_SETTINGS.bgColor : value.bgColor,
      modelColor: value.modelColor === "#d2d6dc" ? DEFAULT_HUMAN_BODY_RENDER_SETTINGS.modelColor : value.modelColor,
    };
  }
  if (value?.version === 3) {
    value = {
      ...value,
      version: HUMAN_BODY_RENDER_SETTINGS_VERSION,
      radius: value.radius === 0.13 ? DEFAULT_HUMAN_BODY_RENDER_SETTINGS.radius : value.radius,
    };
  }
  if (!value || value.version !== HUMAN_BODY_RENDER_SETTINGS_VERSION) {
    return { ...DEFAULT_HUMAN_BODY_RENDER_SETTINGS };
  }

  return {
    version: HUMAN_BODY_RENDER_SETTINGS_VERSION,
    mode: ["heatmap", "crystal"].includes(value.mode)
      ? value.mode
      : DEFAULT_HUMAN_BODY_RENDER_SETTINGS.mode,
    radius: clampHumanBodyRadius(value.radius),
    intensity: finiteInRange(value.intensity, 0.5, 5, DEFAULT_HUMAN_BODY_RENDER_SETTINGS.intensity),
    opacity: finiteInRange(value.opacity, 0.05, 0.8, DEFAULT_HUMAN_BODY_RENDER_SETTINGS.opacity),
    colorScheme: Number.isInteger(value.colorScheme) && value.colorScheme >= 0 && value.colorScheme <= 3
      ? value.colorScheme
      : DEFAULT_HUMAN_BODY_RENDER_SETTINGS.colorScheme,
    bgColor: COLOR_PATTERN.test(value.bgColor || "")
      ? value.bgColor.toLowerCase()
      : DEFAULT_HUMAN_BODY_RENDER_SETTINGS.bgColor,
    modelColor: COLOR_PATTERN.test(value.modelColor || "")
      ? value.modelColor.toLowerCase()
      : DEFAULT_HUMAN_BODY_RENDER_SETTINGS.modelColor,
    settingsCollapsed: typeof value.settingsCollapsed === "boolean"
      ? value.settingsCollapsed
      : DEFAULT_HUMAN_BODY_RENDER_SETTINGS.settingsCollapsed,
    overviewAutoRotate: typeof value.overviewAutoRotate === "boolean"
      ? value.overviewAutoRotate
      : DEFAULT_HUMAN_BODY_RENDER_SETTINGS.overviewAutoRotate,
  };
}

export function readHumanBodyRenderSettings(storage) {
  try {
    const raw = storage?.getItem?.(HUMAN_BODY_RENDER_SETTINGS_KEY);
    return normalizeHumanBodyRenderSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_HUMAN_BODY_RENDER_SETTINGS };
  }
}

export function writeHumanBodyRenderSettings(storage, value) {
  try {
    storage?.setItem?.(
      HUMAN_BODY_RENDER_SETTINGS_KEY,
      JSON.stringify(normalizeHumanBodyRenderSettings({
        ...DEFAULT_HUMAN_BODY_RENDER_SETTINGS,
        ...value,
        version: HUMAN_BODY_RENDER_SETTINGS_VERSION,
      })),
    );
    return Boolean(storage?.setItem);
  } catch {
    return false;
  }
}

export function getHumanBodyAutoRotate({ activeRegion, overviewAutoRotate, temporarilySuspended }) {
  return activeRegion === "overview" && overviewAutoRotate === true && temporarilySuspended !== true;
}
