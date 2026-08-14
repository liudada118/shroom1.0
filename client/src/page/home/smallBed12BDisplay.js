const VALID_SAMPLE_POINTS = new Set([
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
]);

export const DEFAULT_RENDERER_CONFIG = {
  valueg1: 2,
  valuej1: 25,
  valuel1: 2,
  valuef1: 0,
  value1: 0.1,
  valuelInit1: 0,
};

export const normalizeMatrixMode = (value) => (
  value === "16x16" ? "16x16" : "32x32"
);

export const normalizeSamplePoint = (value) => (
  VALID_SAMPLE_POINTS.has(value) ? value : "topLeft"
);

export function getMatrixSize(mode) {
  const size = normalizeMatrixMode(mode) === "16x16" ? 16 : 32;
  return { width: size, height: size };
}

export function getDisplayOptions(mode, samplePoint) {
  return {
    matrixMode: normalizeMatrixMode(mode),
    samplePoint: normalizeSamplePoint(samplePoint),
  };
}

export function normalizeRendererConfig(config = {}) {
  const next = { ...DEFAULT_RENDERER_CONFIG, ...config };
  if (Number(next.valuej1) > 30 || [30, 80, 2205, 4000].includes(Number(next.valuej1))) {
    next.valuej1 = 25;
  }
  if (Number(next.valuel1) === 5) next.valuel1 = 2;
  if (Number(next.valuef1) === 6) next.valuef1 = 0;
  if (Number(next.valuelInit1) === 500) next.valuelInit1 = 0;
  return next;
}

export function getInitialDisplayState(storage = globalThis.localStorage) {
  const matrixMode = normalizeMatrixMode(
    storage?.getItem("smallBed12BRealtimeMatrixMode"),
  );
  const samplePoint = normalizeSamplePoint(
    storage?.getItem("smallBed12BRealtimeSamplePoint"),
  );
  const { width, height } = getMatrixSize(matrixMode);
  return {
    smallBed12BRealtimeMatrixMode: matrixMode,
    smallBed12BRealtimeSamplePoint: samplePoint,
    smallBedMatrixWidth: width,
    smallBedMatrixHeight: height,
  };
}
