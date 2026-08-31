/**
 * 小床 12B 协议处理模块。
 *
 * 小床 12B 每帧为 1024 个 16 位 ADC 点，后端会做线序转换、零点扣除、
 * 压强标定、16x16 降采样显示和采集入库存储载荷构造。
 */
const TYPE = 'smallBed12B';
const PAYLOAD_LENGTH = 1024 * 2;
const FRAME_TAIL = Buffer.from([0xaa, 0x00, 0x55, 0x00, 0x03, 0x00, 0x99, 0x00]);

/**
 * 将任意值转换成有限数字，非法值按 0 处理。
 * @param {unknown} value 原始值。
 * @returns {number} 有限数字。
 */
function toFiniteNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

/**
 * 将数组中的值统一归一化为有限数字。
 * @param {unknown} data 原始数组。
 * @returns {number[]} 数字数组。
 */
function normalizeNumericArray(data) {
  return Array.isArray(data) ? data.map(toFiniteNumber) : [];
}

/**
 * 判断历史存储数据是否已经是 kPa 压强数据。
 * @param {object} storedData 历史存储对象。
 * @returns {boolean} 是否已是压强数据。
 */
function isPressureStoredData(storedData) {
  return storedData && typeof storedData === 'object' && !Array.isArray(storedData) && (
    storedData.pressureUnit === 'kPa' ||
    storedData.dataUnit === 'kPa' ||
    storedData.unit === 'kPa'
  );
}

/**
 * 将压强值保留 1 位小数。
 * @param {unknown} value 原始压强值。
 * @returns {number} 四舍五入后的压强值。
 */
function roundPressureValue(value) {
  return Number(toFiniteNumber(value).toFixed(1));
}

/**
 * 将 ADC 数据转换为 kPa 压强数据。
 * @param {number[]} data ADC 数据。
 * @param {{estimatePointPressure?: Function, filterThreshold?: number}} calibration 压强标定依赖。
 * @returns {number[]} kPa 压强数组。
 */
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

/**
 * 归一化实时或历史压强数据。
 * @param {number[]} data 原始数据。
 * @param {object | null} storedData 历史存储对象。
 * @param {object} calibration 压强标定依赖。
 * @returns {number[]} 压强数据。
 */
function normalizePressureData(data, storedData = null, calibration) {
  const normalizedData = normalizeNumericArray(data);
  if (isPressureStoredData(storedData)) {
    return normalizedData.map(roundPressureValue);
  }

  return applyPressureCalibration(normalizedData, calibration);
}

/**
 * 从 2048 字节 payload 中读取 1024 个 little-endian 16 位 ADC 点。
 * @param {Buffer | Uint8Array | number[]} buffer 原始 payload。
 * @returns {null | number[]} ADC 帧。
 */
function readAdcFrame(buffer) {
  const source = Buffer.from(buffer || []);
  if (source.length !== PAYLOAD_LENGTH) return null;

  const frame = new Array(PAYLOAD_LENGTH / 2);
  for (let index = 0; index < frame.length; index++) {
    frame[index] = source.readUInt16LE(index * 2);
  }
  return frame;
}

/**
 * 归一化小床展示配置。
 * @param {object} options 展示配置。
 * @returns {{matrixMode:string, samplePoint:string}} 展示配置。
 */
function normalizeDisplayOptions(options = {}) {
  const matrixMode = options.matrixMode === '16x16' ? '16x16' : '32x32';
  return {
    matrixMode,
    samplePoint: options.samplePoint || 'topLeft',
  };
}

/**
 * 获取 2x2 降采样块中的采样点偏移。
 * @param {string} samplePoint 采样点名称。
 * @returns {{row:number,col:number}} 采样偏移。
 */
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

/**
 * 按指定采样点对矩阵做块降采样。
 * @param {number[]} data 原始矩阵。
 * @param {object} options 降采样配置。
 * @returns {number[]} 降采样矩阵。
 */
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

/**
 * 构造小床实时显示帧。
 * @param {number[]} pressureData kPa 压强数据。
 * @param {{displayOptions?: object, hz?: number, transposeSquareMatrix: Function}} options 显示配置。
 * @returns {object} 实时显示 payload。
 */
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

/**
 * 从串口 payload 直接构造小床实时帧。
 * @param {Buffer | Uint8Array | number[]} buffer 原始 payload。
 * @param {object} options 线序、零点、标定和展示配置。
 * @returns {null | object} 处理结果。
 */
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

  const zeroedFrame = Array.isArray(zeroFrame) && zeroFrame.length === orderedFrame.length
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

/**
 * 构造采集入库用的小床数据。
 * @param {object} frameToStore 实时帧或待存储帧。
 * @param {{collectOptions?: object, transposeSquareMatrix: Function}} options 采集配置。
 * @returns {string} JSON 字符串。
 */
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
