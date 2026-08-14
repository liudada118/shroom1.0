const TYPE = "smallBed12B";
const PAYLOAD_LENGTH = 2048;
const PRESSURE_UNIT = "kPa";
const VALID_SAMPLE_POINTS = new Set([
  "topLeft",
  "topRight",
  "bottomLeft",
  "bottomRight",
]);

function toFiniteNonNegative(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

function roundPressureValue(value) {
  return Number(toFiniteNonNegative(value).toFixed(1));
}

function readAdcFrame(buffer) {
  const source = Buffer.from(buffer || []);
  if (source.length !== PAYLOAD_LENGTH) return null;
  return Array.from(
    { length: 1024 },
    (_value, index) => source.readUInt16LE(index * 2),
  );
}

function applyPressureCalibration(data, calibration = {}) {
  const adcData = Array.isArray(data) ? data.map(toFiniteNonNegative) : [];
  const filterThreshold = Number.isFinite(Number(calibration.filterThreshold))
    ? Number(calibration.filterThreshold)
    : 30;
  const valid = adcData.filter((value) => value > filterThreshold);
  if (!valid.length) return adcData.map(() => 0);

  const estimatePointPressure = calibration.estimatePointPressure;
  if (typeof estimatePointPressure !== "function") {
    throw new TypeError("estimatePointPressure must be a function");
  }
  const adcAvg = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  return adcData.map((value) => (
    value > filterThreshold
      ? roundPressureValue(estimatePointPressure(adcAvg, value))
      : 0
  ));
}

function isPressureStoredData(frame) {
  return Boolean(
    frame
      && !Array.isArray(frame)
      && [frame.pressureUnit, frame.dataUnit, frame.unit].includes(PRESSURE_UNIT),
  );
}

function normalizePressureData(data, frame, calibration) {
  const normalized = Array.isArray(data) ? data.map(toFiniteNonNegative) : [];
  return isPressureStoredData(frame)
    ? normalized.map(roundPressureValue)
    : applyPressureCalibration(normalized, calibration);
}

function normalizeDisplayOptions(options = {}) {
  return {
    matrixMode: options.matrixMode === "16x16" ? "16x16" : "32x32",
    samplePoint: VALID_SAMPLE_POINTS.has(options.samplePoint)
      ? options.samplePoint
      : "topLeft",
  };
}

function getDownsampleOffset(samplePoint) {
  const offsets = {
    topLeft: [0, 0],
    topRight: [0, 1],
    bottomLeft: [1, 0],
    bottomRight: [1, 1],
  };
  return offsets[normalizeDisplayOptions({ samplePoint }).samplePoint];
}

function downsampleMatrixByPoint(data, samplePoint) {
  const source = Array.isArray(data) ? data : [];
  const [rowOffset, columnOffset] = getDownsampleOffset(samplePoint);
  return Array.from({ length: 16 }, (_rowValue, row) => (
    Array.from({ length: 16 }, (_columnValue, column) => (
      toFiniteNonNegative(
        source[(row * 2 + rowOffset) * 32 + column * 2 + columnOffset],
      )
    ))
  )).flat();
}

function buildRealtimeFrame(pressureData, options = {}) {
  const source = Array.isArray(pressureData)
    ? pressureData.map(roundPressureValue)
    : [];
  const displayOptions = normalizeDisplayOptions(options.displayOptions);
  if (displayOptions.matrixMode === "32x32") {
    return {
      sitData: source,
      rawSitData: source,
      pressureData: source,
      matrixWidth: 32,
      matrixHeight: 32,
      pressureUnit: PRESSURE_UNIT,
      hz: options.hz,
    };
  }

  const transposed = typeof options.transposeSquareMatrix === "function"
    ? options.transposeSquareMatrix(source, 32)
    : source;
  const downsampled = downsampleMatrixByPoint(
    transposed,
    displayOptions.samplePoint,
  );
  return {
    sitData: downsampled,
    rawSitData: downsampled,
    pressureData: downsampled,
    matrixWidth: 16,
    matrixHeight: 16,
    sourceMatrixWidth: 32,
    sourceMatrixHeight: 32,
    matrixOrientation: "transposed",
    pressureUnit: PRESSURE_UNIT,
    hz: options.hz,
    matrixDownsample: {
      enabled: true,
      samplePoint: displayOptions.samplePoint,
      displaySamplePoint: displayOptions.samplePoint,
      blockWidth: 2,
      blockHeight: 2,
    },
  };
}

function buildRealtimeFrameFromBuffer(buffer, options = {}) {
  const adcFrame = readAdcFrame(buffer);
  if (!adcFrame) return null;

  const orderedFrame = typeof options.lineOrder === "function"
    ? options.lineOrder(adcFrame)
    : adcFrame;
  const zeroedFrame = Array.isArray(options.zeroFrame) && options.zeroFrame.length
    ? orderedFrame.map((value, index) => {
      const difference = value - toFiniteNonNegative(options.zeroFrame[index]);
      return typeof options.subtractZero === "function"
        ? options.subtractZero(difference)
        : Math.max(0, difference);
    })
    : [...orderedFrame];
  const pressureData = applyPressureCalibration(
    zeroedFrame,
    options.calibration,
  );

  return {
    adcFrame,
    orderedFrame,
    zeroedFrame,
    pressureData,
    realtimeFrame: buildRealtimeFrame(pressureData, options),
  };
}

function buildCollectionStorageData(frame, options = {}) {
  const source = Array.isArray(frame && frame.sitData) ? frame.sitData : [];
  const collectDownsample = options.collectOptions
    && options.collectOptions.matrixDownsample;
  const shouldDownsample = Boolean(
    collectDownsample
      && collectDownsample.enabled === true
      && source.length === 1024,
  );
  const samplePoint = normalizeDisplayOptions({
    samplePoint: collectDownsample && collectDownsample.samplePoint,
  }).samplePoint;
  const transposed = shouldDownsample
    && typeof options.transposeSquareMatrix === "function"
    ? options.transposeSquareMatrix(source, 32)
    : source;
  const data = shouldDownsample
    ? downsampleMatrixByPoint(transposed, samplePoint)
    : source.map(roundPressureValue);
  const width = shouldDownsample ? 16 : (Number(frame && frame.matrixWidth) || 32);
  const height = shouldDownsample ? 16 : (Number(frame && frame.matrixHeight) || 32);
  const matrixDownsample = shouldDownsample
    ? {
      enabled: true,
      samplePoint,
      displaySamplePoint: samplePoint,
      blockWidth: 2,
      blockHeight: 2,
    }
    : frame && frame.matrixDownsample;

  return JSON.stringify({
    sitData: data,
    pressureData: data,
    matrixWidth: width,
    matrixHeight: height,
    sourceMatrixWidth: frame && frame.sourceMatrixWidth,
    sourceMatrixHeight: frame && frame.sourceMatrixHeight,
    matrixOrientation: shouldDownsample
      ? "transposed"
      : frame && frame.matrixOrientation,
    pressureUnit: PRESSURE_UNIT,
    matrixDownsample,
  });
}

module.exports = {
  TYPE,
  PAYLOAD_LENGTH,
  PRESSURE_UNIT,
  applyPressureCalibration,
  buildCollectionStorageData,
  buildRealtimeFrame,
  buildRealtimeFrameFromBuffer,
  downsampleMatrixByPoint,
  isPressureStoredData,
  normalizeDisplayOptions,
  normalizePressureData,
  readAdcFrame,
  roundPressureValue,
};
