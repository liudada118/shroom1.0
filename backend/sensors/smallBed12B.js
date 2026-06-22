const TYPE = 'smallBed12B';
const PAYLOAD_LENGTH = 1024 * 2;
const FRAME_TAIL = Buffer.from([0xaa, 0x00, 0x55, 0x00, 0x03, 0x00, 0x99, 0x00]);

function toFiniteNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeNumericArray(data) {
  return Array.isArray(data) ? data.map(toFiniteNumber) : [];
}

function isPressureStoredData(storedData) {
  return storedData && typeof storedData === 'object' && !Array.isArray(storedData) && (
    storedData.pressureUnit === 'kPa' ||
    storedData.dataUnit === 'kPa' ||
    storedData.unit === 'kPa'
  );
}

function roundPressureValue(value) {
  return Number(toFiniteNumber(value).toFixed(1));
}

function applyPressureCalibration(data, { estimatePointPressure, filterThreshold }) {
  const adcData = normalizeNumericArray(data);
  if (adcData.length === 0) return [];
  if (typeof estimatePointPressure !== 'function') {
    return adcData.map(roundPressureValue);
  }

  let sum = 0;
  let count = 0;
  for (const value of adcData) {
    if (value > filterThreshold) {
      sum += value;
      count += 1;
    }
  }

  if (!count) return adcData.map(() => 0);
  const adcAvg = sum / count;
  return adcData.map((value) => roundPressureValue(estimatePointPressure(adcAvg, value)));
}

function normalizePressureData(data, storedData = null, calibration) {
  const normalizedData = normalizeNumericArray(data);
  if (isPressureStoredData(storedData)) {
    return normalizedData.map(roundPressureValue);
  }

  return applyPressureCalibration(normalizedData, calibration);
}

function readAdcFrame(buffer) {
  const source = Buffer.from(buffer || []);
  if (source.length !== PAYLOAD_LENGTH) return null;

  const frame = new Array(PAYLOAD_LENGTH / 2);
  for (let index = 0; index < frame.length; index++) {
    frame[index] = source.readUInt16LE(index * 2);
  }
  return frame;
}

function normalizeDisplayOptions(options = {}) {
  const matrixMode = options.matrixMode === '16x16' ? '16x16' : '32x32';
  return {
    matrixMode,
    samplePoint: options.samplePoint || 'topLeft',
  };
}

function getDownsampleOffset(samplePoint = 'topLeft') {
  switch (samplePoint) {
    case 'topRight':
      return { row: 0, col: 1 };
    case 'bottomLeft':
      return { row: 1, col: 0 };
    case 'bottomRight':
      return { row: 1, col: 1 };
    case 'topLeft':
    default:
      return { row: 0, col: 0 };
  }
}

function downsampleMatrixByPoint(data, options = {}) {
  if (!Array.isArray(data)) return [];
  const sourceWidth = Number(options.sourceWidth) || 32;
  const sourceHeight = Number(options.sourceHeight) || 32;
  const targetWidth = Number(options.targetWidth) || Math.floor(sourceWidth / 2);
  const targetHeight = Number(options.targetHeight) || Math.floor(sourceHeight / 2);
  const blockWidth = Number(options.blockWidth) || Math.floor(sourceWidth / targetWidth);
  const blockHeight = Number(options.blockHeight) || Math.floor(sourceHeight / targetHeight);
  const offset = getDownsampleOffset(options.samplePoint);
  const result = [];

  for (let row = 0; row < targetHeight; row++) {
    for (let col = 0; col < targetWidth; col++) {
      const sourceRow = Math.min(sourceHeight - 1, row * blockHeight + Math.min(offset.row, blockHeight - 1));
      const sourceCol = Math.min(sourceWidth - 1, col * blockWidth + Math.min(offset.col, blockWidth - 1));
      result.push(data[sourceRow * sourceWidth + sourceCol] ?? 0);
    }
  }

  return result;
}

function buildRealtimeFrame(pressureData, { displayOptions = {}, hz, transposeSquareMatrix }) {
  const normalizedPressureData = Array.isArray(pressureData) ? pressureData : [];
  const options = normalizeDisplayOptions(displayOptions);
  if (options.matrixMode !== '16x16') {
    return {
      sitData: normalizedPressureData,
      rawSitData: normalizedPressureData,
      pressureData: normalizedPressureData,
      matrixWidth: 32,
      matrixHeight: 32,
      pressureUnit: 'kPa',
      hz,
    };
  }

  const displayPressureData = transposeSquareMatrix(normalizedPressureData, 32);
  const downsampled = downsampleMatrixByPoint(displayPressureData, {
    sourceWidth: 32,
    sourceHeight: 32,
    targetWidth: 16,
    targetHeight: 16,
    blockWidth: 2,
    blockHeight: 2,
    samplePoint: options.samplePoint,
  });

  return {
    sitData: downsampled,
    rawSitData: downsampled,
    pressureData: downsampled,
    matrixWidth: 16,
    matrixHeight: 16,
    sourceMatrixWidth: 32,
    sourceMatrixHeight: 32,
    matrixOrientation: 'transposed',
    pressureUnit: 'kPa',
    matrixDownsample: {
      enabled: true,
      samplePoint: options.samplePoint,
      displaySamplePoint: options.samplePoint,
      blockWidth: 2,
      blockHeight: 2,
    },
    hz,
  };
}

function buildRealtimeFrameFromBuffer(buffer, {
  lineOrder,
  zeroFrame = [],
  subtractZero,
  calibration,
  displayOptions = {},
  hz,
  transposeSquareMatrix,
} = {}) {
  const adcFrame = readAdcFrame(buffer);
  if (!adcFrame) return null;

  const orderedFrame = typeof lineOrder === 'function'
    ? lineOrder(adcFrame)
    : adcFrame;

  const zeroedFrame = Array.isArray(zeroFrame) && zeroFrame.length
    ? orderedFrame.map((value, index) => (
      typeof subtractZero === 'function'
        ? subtractZero(value - (zeroFrame[index] || 0))
        : value - (zeroFrame[index] || 0)
    ))
    : [...orderedFrame];

  const pressureData = applyPressureCalibration(zeroedFrame, calibration);
  return {
    adcFrame,
    orderedFrame,
    zeroedFrame,
    pressureData,
    realtimeFrame: buildRealtimeFrame(pressureData, {
      displayOptions,
      hz,
      transposeSquareMatrix,
    }),
  };
}

function buildCollectionStorageData(frameToStore, { collectOptions = {}, transposeSquareMatrix }) {
  const sourceData = Array.isArray(frameToStore?.sitData)
    ? frameToStore.sitData
    : (Array.isArray(frameToStore?.rawSitData) ? frameToStore.rawSitData : []);

  if (collectOptions.matrixDownsample?.enabled !== true) {
    return JSON.stringify({
      sitData: sourceData,
      pressureData: sourceData,
      matrixWidth: Number(frameToStore?.matrixWidth) || 32,
      matrixHeight: Number(frameToStore?.matrixHeight) || 32,
      matrixOrientation: frameToStore?.matrixOrientation,
      sourceMatrixWidth: frameToStore?.sourceMatrixWidth,
      sourceMatrixHeight: frameToStore?.sourceMatrixHeight,
      pressureUnit: 'kPa',
      matrixDownsample: frameToStore?.matrixDownsample,
    });
  }

  if (Number(frameToStore?.matrixWidth) === 16 || sourceData.length === 256) {
    return JSON.stringify({
      sitData: sourceData,
      pressureData: sourceData,
      matrixWidth: Number(frameToStore?.matrixWidth) || 16,
      matrixHeight: Number(frameToStore?.matrixHeight) || 16,
      sourceMatrixWidth: Number(frameToStore?.sourceMatrixWidth) || 32,
      sourceMatrixHeight: Number(frameToStore?.sourceMatrixHeight) || 32,
      matrixOrientation: frameToStore?.matrixOrientation,
      pressureUnit: 'kPa',
      matrixDownsample: frameToStore?.matrixDownsample,
    });
  }

  const options = collectOptions.matrixDownsample || {};
  const displaySamplePoint = options.samplePoint || 'topLeft';
  const displaySourceData = transposeSquareMatrix(sourceData, Number(options.sourceWidth) || 32);
  const downsampled = downsampleMatrixByPoint(displaySourceData, {
    ...options,
    samplePoint: displaySamplePoint,
  });

  return JSON.stringify({
    sitData: downsampled,
    pressureData: downsampled,
    matrixWidth: Number(options.targetWidth) || 16,
    matrixHeight: Number(options.targetHeight) || 16,
    sourceMatrixWidth: Number(options.sourceWidth) || 32,
    sourceMatrixHeight: Number(options.sourceHeight) || 32,
    matrixOrientation: 'transposed',
    pressureUnit: 'kPa',
    matrixDownsample: {
      enabled: true,
      samplePoint: displaySamplePoint,
      displaySamplePoint,
      blockWidth: Number(options.blockWidth) || 2,
      blockHeight: Number(options.blockHeight) || 2,
    },
  });
}

module.exports = {
  TYPE,
  PAYLOAD_LENGTH,
  FRAME_TAIL,
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
