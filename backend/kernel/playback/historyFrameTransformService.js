/**
 * 历史帧转换服务。
 *
 * 负责历史 matrix 行解析、压力帧归一化、CSV 表头/文件名前缀、回放 payload
 * 和带清零信息的采集存储 payload 构造。server.js 只保留运行时编排，不再直接承载这些格式转换细节。
 */
function createHistoryFrameTransformService({
  HAND_SINGLE_POINT_TYPE,
  JQ_BED_TYPE,
  SMALL_BED_12B_TYPE,
  SMALL_BED_NO_ALG_TYPE,
  SMALL_BED_TYPE,
  TEMP_FULL_BED_PRESSURE_THRESHOLD,
  TEMP_FULL_BED_TYPE,
  isHandGloveType,
  isHandStorageType,
  isZeroFrameStorageType,
  smallBed12B,
  smallBed12BCalibration,
  totalToN,
  getCollectOptions,
  getRuntime,
  getZeroFrameForChannel,
}) {
  /**
   * 解析历史 matrix 行中的 JSON 数据，解析失败时返回 null。
   *
   * @param {{ data?: string }} row 历史数据库行。
   * @returns {object | unknown[] | null} 解析后的帧数据。
   */
  function parseStoredFrameData(row) {
    if (!row?.data) return null;
    try {
      return JSON.parse(row.data);
    } catch (error) {
      return null;
    }
  }

  /**
   * 从历史行中读取坐面矩阵，兼容数组直存和对象包装两种格式。
   *
   * @param {{ data?: string }} row 历史数据库行。
   * @returns {unknown[]} 坐面矩阵数据。
   */
  function getStoredSitData(row) {
    const storedData = parseStoredFrameData(row);
    if (Array.isArray(storedData)) return storedData;
    if (Array.isArray(storedData?.sitData)) return storedData.sitData;
    return [];
  }

  /**
   * 从历史行中提取压力矩阵，兼容 pressureData、sitData、backData 和旧数组格式。
   *
   * @param {{ data?: string }} row 历史数据库行。
   * @returns {unknown[]} 压力数据数组。
   */
  function getHistoryPressureData(row) {
    const storedData = parseStoredFrameData(row);
    if (Array.isArray(storedData)) return storedData;
    if (Array.isArray(storedData?.pressureData)) return storedData.pressureData;
    if (Array.isArray(storedData?.sitData)) return storedData.sitData;
    if (Array.isArray(storedData?.backData)) return storedData.backData;
    return [];
  }

  /**
   * 将任意数组归一化为有限数值数组，可选截断或补齐到指定长度。
   *
   * @param {unknown[]} data 原始数组。
   * @param {number | null} targetLength 目标长度，未传则保持原长度。
   * @returns {number[]} 有限数值数组。
   */
  function normalizeFiniteFrame(data, targetLength = null) {
    const source = Array.isArray(data) ? data : [];
    const normalized = source.map((value) => {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : 0;
    });

    if (!Number.isInteger(targetLength) || targetLength < 0) {
      return normalized;
    }

    if (normalized.length > targetLength) {
      return normalized.slice(0, targetLength);
    }

    while (normalized.length < targetLength) {
      normalized.push(0);
    }
    return normalized;
  }

  /**
   * 按小床 12B 标定配置归一化压力数据。
   *
   * @param {unknown[]} data 原始压力数据。
   * @param {object | null} storedData 历史帧元数据。
   * @returns {number[]} 归一化后的压力数据。
   */
  const normalizeSmallBed12BPressureData = (data, storedData = null) =>
    smallBed12B.normalizePressureData(data, storedData, smallBed12BCalibration);

  /**
   * 将历史数据库行转换为回放和导出可用的数值压力数组。
   *
   * @param {{ data?: string }} row matrix 表中的数据库行。
   * @param {string} sensorType 该行数据对应的传感器类型。
   * @returns {number[]} 归一化后的压力值。
   */
  function normalizeHistoryPressureData(row, sensorType = '') {
    const storedData = parseStoredFrameData(row);
    const data = getHistoryPressureData(row);
    const pressureData = isHandStorageType(sensorType) && data.length > 256 ? data.slice(0, 256) : data;
    const normalizedData = pressureData.map((value) => {
      const numberValue = Number(value);
      return Number.isFinite(numberValue) ? numberValue : 0;
    });
    if (sensorType === SMALL_BED_12B_TYPE) {
      return normalizeSmallBed12BPressureData(normalizedData, storedData);
    }
    if (sensorType !== TEMP_FULL_BED_TYPE) return normalizedData;
    return normalizedData.map((value) => value < TEMP_FULL_BED_PRESSURE_THRESHOLD ? 0 : value);
  }

  /**
   * 根据传感器类型格式化矩阵总压力值。
   *
   * @param {unknown} value 原始总压力值。
   * @param {string} targetFile 目标传感器类型。
   * @returns {number} 展示或导出使用的压力值。
   */
  function formatMatrixTotalForFile(value, targetFile = getRuntime().file) {
    const numberValue = Number(value);
    const safeValue = Number.isFinite(numberValue) ? numberValue : 0;
    if (targetFile === SMALL_BED_12B_TYPE) {
      return Number(safeValue.toFixed(1));
    }
    return totalToN(safeValue);
  }

  /**
   * 计算 CSV 导出行相对起始帧的秒数。
   *
   * @param {Array<{ timestamp?: number }>} rows 历史行数组。
   * @param {number} rowIndex 当前行索引。
   * @param {number} baseIndex 起始行索引。
   * @param {number} frameIndex 当前帧序号。
   * @returns {string} 保留三位小数的秒数字符串。
   */
  function getCsvElapsedSeconds(rows, rowIndex, baseIndex = 0, frameIndex = 0) {
    const currentTimestamp = Number(rows?.[rowIndex]?.timestamp);
    const baseTimestamp = Number(rows?.[baseIndex]?.timestamp);
    if (Number.isFinite(currentTimestamp) && Number.isFinite(baseTimestamp)) {
      return ((currentTimestamp - baseTimestamp) / 1000).toFixed(3);
    }

    const fallbackHz = Number(getRuntime().colHZ) > 0 ? Number(getRuntime().colHZ) : 12;
    return (frameIndex / fallbackHz).toFixed(3);
  }

  /**
   * 判断 CSV 下载配置是否请求英文表头。
   *
   * @param {object} downloadOptions 下载配置。
   * @returns {boolean} 是否使用英文输出。
   */
  function isEnglishCsvDownload(downloadOptions = {}) {
    const language = String(downloadOptions.language || downloadOptions.locale || 'zh').toLowerCase();
    return language.startsWith('en');
  }

  /**
   * 根据传感器类型和通道生成 CSV 文件名前缀。
   *
   * @param {string} sensorType 传感器类型。
   * @param {string} fallbackPrefix 默认前缀。
   * @param {object} downloadOptions 下载配置。
   * @returns {string} CSV 文件名前缀。
   */
  function getCsvFilePrefix(sensorType, fallbackPrefix, downloadOptions = {}) {
    if (sensorType === SMALL_BED_12B_TYPE) return '12B';
    if (sensorType === HAND_SINGLE_POINT_TYPE) return isEnglishCsvDownload(downloadOptions) ? 'detection' : '检测点';
    if (isHandGloveType(sensorType) && fallbackPrefix === 'sit') return 'left';
    if (isHandGloveType(sensorType) && fallbackPrefix === 'back') return 'right';
    return fallbackPrefix;
  }

  /**
   * 构建小床 12B 的采集入库存储数据。
   *
   * @param {object} frameToStore 当前实时帧对象。
   * @returns {string} 可写入 matrix.data 的 JSON 字符串。
   */
  function buildSmallBed12BCollectionStorageData(frameToStore) {
    return smallBed12B.buildCollectionStorageData(frameToStore, {
      collectOptions: getCollectOptions(),
      transposeSquareMatrix,
    });
  }

  /**
   * 构建小床历史回放 payload，兼容 16x16 缩小采集和旧数组存储格式。
   *
   * @param {{ data?: string, timestamp?: number }} row 历史数据库行。
   * @param {object} extra 追加到 payload 的字段。
   * @returns {object} 前端回放可直接消费的坐面 payload。
   */
  function buildSmallBedPlaybackPayload(row, extra = {}) {
    const storedData = parseStoredFrameData(row);
    const { file } = getRuntime();
    if (storedData && typeof storedData === 'object' && !Array.isArray(storedData)) {
      const storedSitData = Array.isArray(storedData.sitData)
        ? storedData.sitData
        : Array.isArray(storedData.pressureData)
          ? storedData.pressureData
          : [];
      if (file === SMALL_BED_12B_TYPE && storedSitData.length === 256) {
        const matrixDownsample = storedData.matrixDownsample || {};
        return {
          sitData: normalizeSmallBed12BPressureData(storedSitData, storedData),
          matrixWidth: Number(storedData.matrixWidth) || 16,
          matrixHeight: Number(storedData.matrixHeight) || 16,
          sourceMatrixWidth: Number(storedData.sourceMatrixWidth) || 32,
          sourceMatrixHeight: Number(storedData.sourceMatrixHeight) || 32,
          matrixOrientation: storedData.matrixOrientation,
          matrixDownsample,
          time: row?.timestamp,
          ...extra,
        };
      }
      return {
        sitData: file === SMALL_BED_12B_TYPE ? normalizeSmallBed12BPressureData(storedSitData, storedData) : storedSitData,
        matrixWidth: storedData.matrixWidth,
        matrixHeight: storedData.matrixHeight,
        matrixOrientation: storedData.matrixOrientation,
        matrixDownsample: storedData.matrixDownsample,
        time: row?.timestamp,
        ...extra,
      };
    }

    if (file === SMALL_BED_12B_TYPE && Array.isArray(storedData) && storedData.length === 256) {
      return {
        sitData: normalizeSmallBed12BPressureData(storedData),
        matrixWidth: 16,
        matrixHeight: 16,
        time: row?.timestamp,
        ...extra,
      };
    }

    return {
      sitData: file === SMALL_BED_12B_TYPE
        ? normalizeSmallBed12BPressureData(Array.isArray(storedData) ? storedData : [], storedData)
        : (Array.isArray(storedData) ? storedData : []),
      time: row?.timestamp,
      ...extra,
    };
  }

  /**
   * 将历史存储帧解析成压力数据、旋转数据和清零帧三个标准字段。
   *
   * @param {object | unknown[]} storedData 历史行中的已解析数据。
   * @param {string} sensorType 传感器类型。
   * @returns {{ pressureData: number[], rotateData: number[], zeroFrame: number[] }} 标准存储帧。
   */
  function parseStoredSensorFrame(storedData, sensorType = '') {
    if (storedData && typeof storedData === 'object' && !Array.isArray(storedData)) {
      return {
        pressureData: normalizeFiniteFrame(
          storedData.pressureData || storedData.rawPressureData || storedData.sitData || storedData.backData || storedData.headData || [],
        ),
        rotateData: normalizeFiniteFrame(storedData.rotate || storedData.quaternion || []),
        zeroFrame: normalizeFiniteFrame(storedData.zeroFrame || []),
      };
    }

    const data = Array.isArray(storedData) ? storedData : [];
    if (isHandGloveType(sensorType)) {
      if (data.length >= 260) {
        return {
          pressureData: normalizeFiniteFrame(data.slice(0, 256)),
          rotateData: normalizeFiniteFrame(data.slice(256, 260)),
          zeroFrame: [],
        };
      }
      if (data.length > 4 && data.length !== 256) {
        return {
          pressureData: normalizeFiniteFrame(data.slice(0, data.length - 4)),
          rotateData: normalizeFiniteFrame(data.slice(data.length - 4)),
          zeroFrame: [],
        };
      }
    }

    if (String(sensorType).includes('robot') && data.length >= 260) {
      return {
        pressureData: normalizeFiniteFrame(data.slice(0, 256)),
        rotateData: normalizeFiniteFrame(data.slice(256, 260)),
        zeroFrame: [],
      };
    }

    return {
      pressureData: normalizeFiniteFrame(data),
      rotateData: [],
      zeroFrame: [],
    };
  }

  /**
   * 从实时帧中挑选适合带清零信息一起入库的压力数据。
   *
   * @param {object} frameToStore 当前实时帧对象。
   * @param {string} dataKey 通道数据字段名。
   * @returns {unknown[]} 256 点压力数据。
   */
  function getZeroAwareStoragePressureData(frameToStore, dataKey) {
    const candidates = [
      frameToStore.rawPressureData,
      frameToStore[dataKey],
      frameToStore.realArr,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length >= 256) {
        return candidate.slice(0, 256);
      }
    }

    return [];
  }

  /**
   * 获取指定通道当前用于入库的清零基准帧。
   *
   * @param {'sit' | 'back' | 'head'} channel 采集通道名称。
   * @returns {unknown[]} 清零基准帧副本。
   */
  function getZeroFrameForStorage(channel = 'sit', frameToStore = null) {
    const source = typeof getZeroFrameForChannel === 'function'
      ? getZeroFrameForChannel(channel, frameToStore)
      : [];
    return Array.isArray(source) ? [...source] : [];
  }

  /**
   * 构建带清零帧信息的历史入库数据，非清零存储类型保持旧数组格式。
   *
   * @param {object} frameToStore 当前实时帧对象。
   * @param {string} dataKey 通道数据字段名。
   * @param {'sit' | 'back' | 'head'} channel 采集通道名称。
   * @returns {string} 可写入 matrix.data 的 JSON 字符串。
   */
  function buildZeroAwareStorageData(frameToStore, dataKey, channel = 'sit') {
    const pressureData = getZeroAwareStoragePressureData(frameToStore, dataKey);
    if (!isZeroFrameStorageType(getRuntime().file)) {
      return JSON.stringify(pressureData);
    }

    return JSON.stringify({
      pressureData,
      rotate: Array.isArray(frameToStore.rotate) ? [...frameToStore.rotate] : [],
      zeroFrame: getZeroFrameForStorage(channel, frameToStore),
    });
  }

  const CSV_TITLES = {
    zh: {
      index: '秒数',
      max: '矩阵最大值',
      time: '时间戳',
      pressureArea: '有效点数',
      pressure: '压力',
      pressValue: '压力总和',
      pressuremmgH: '压力值',
      realData: '矩阵数据',
      realInitData: '原始矩阵数据',
      dataToInterpGauss: '算法数据',
      pressLine: '压力曲线',
      rotate: '四元数',
      temperatureData: '温度数据',
      temperatureAvg: '平均温度',
      temperatureK: '温度K值',
      zeroFrame: '清零帧',
      detectionPoint: '检测点',
      label: '标签',
    },
    en: {
      index: 'seconds',
      max: 'max',
      time: 'time',
      pressureArea: 'area',
      pressure: 'press',
      pressValue: 'pressTotal',
      pressuremmgH: 'pressure',
      realData: 'data',
      realInitData: 'realInitData',
      dataToInterpGauss: 'algorData',
      pressLine: 'pressLine',
      rotate: 'quaternion',
      temperatureData: 'temperatureCelsius',
      temperatureAvg: 'temperatureAvg',
      temperatureK: 'temperatureK',
      zeroFrame: 'zeroFrame',
      detectionPoint: 'detectionPoint',
      label: 'label',
    },
  };

  /**
   * 根据下载配置选择 CSV 表头语言。
   *
   * @param {object} downloadOptions 下载配置。
   * @returns {Record<string, string>} CSV 表头映射。
   */
  function getCsvTitleMap(downloadOptions = {}) {
    const language = String(downloadOptions.language || downloadOptions.locale || 'zh').toLowerCase();
    return language.startsWith('en') ? CSV_TITLES.en : CSV_TITLES.zh;
  }

  /**
   * 转置指定尺寸的方阵，非目标长度数组会安全返回副本。
   *
   * @param {unknown[]} data 方阵数据。
   * @param {number} size 方阵边长。
   * @returns {unknown[]} 转置后的方阵数据。
   */
  function transposeSquareMatrix(data, size = 32) {
    if (!Array.isArray(data) || data.length !== size * size) {
      return Array.isArray(data) ? [...data] : [];
    }

    return data.map((_, index) => {
      const row = Math.floor(index / size);
      const col = index % size;
      return data[col * size + row];
    });
  }

  /**
   * 判断传感器原始小床矩阵是否需要转置后再导出或回放。
   *
   * @param {string} sensorType 传感器类型。
   * @returns {boolean} 是否需要转置。
   */
  function shouldTransposeSmallBedRawMatrix(sensorType) {
    return sensorType === JQ_BED_TYPE || sensorType === SMALL_BED_TYPE || sensorType === SMALL_BED_NO_ALG_TYPE || sensorType === SMALL_BED_12B_TYPE;
  }

  /**
   * 判断当前历史帧是否还需要对小床原始矩阵做转置。
   *
   * @param {string} sensorType 传感器类型。
   * @param {object | null} frame 历史帧元数据。
   * @returns {boolean} 是否需要转置。
   */
  function shouldTransposeSmallBedRawMatrixFrame(sensorType, frame = null) {
    return shouldTransposeSmallBedRawMatrix(sensorType) && frame?.matrixOrientation !== 'transposed';
  }

  /**
   * 归一化温度床回放压力数组，并按阈值过滤无效压力点。
   *
   * @param {unknown[]} data 历史帧中的压力数组。
   * @param {object} frame 历史帧元数据。
   * @returns {number[]} 回放使用的压力矩阵。
   */
  function normalizeTempFullBedPlaybackPressureArray(data, frame = {}) {
    if (!Array.isArray(data)) return [];
    const pressureData = frame.matrixOrientation === 'transposed' || (frame.matrixWidth === 12 && frame.matrixHeight === 15)
      ? data.map((_, index) => {
        const row = Math.floor(index / 15);
        const col = index % 15;
        return data[col * 12 + row];
      })
      : data;
    return pressureData.map((value) => {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue) || numberValue < TEMP_FULL_BED_PRESSURE_THRESHOLD) return 0;
      return numberValue;
    });
  }

  /**
   * 构建温度床历史回放 payload，附带温度矩阵和 K 值等扩展字段。
   *
   * @param {{ data?: string, timestamp?: number }} row 历史数据库行。
   * @param {object} extra 追加到 payload 的字段。
   * @returns {object} 前端回放可消费的温度床 payload。
   */
  function buildTempFullBedPlaybackPayload(row, extra = {}) {
    const storedData = parseStoredFrameData(row);
    const frame = Array.isArray(storedData) ? { sitData: storedData } : (storedData || {});
    const sitData = normalizeTempFullBedPlaybackPressureArray(frame.sitData, frame);
    const rawSitData = normalizeTempFullBedPlaybackPressureArray(frame.rawSitData, frame);
    return {
      sitData,
      rawSitData: rawSitData.length ? rawSitData : undefined,
      matrixWidth: 15,
      matrixHeight: 12,
      matrixOrientation: 'row-major',
      realArr: Array.isArray(frame.realArr) ? frame.realArr : undefined,
      pressureThreshold: frame.pressureThreshold || TEMP_FULL_BED_PRESSURE_THRESHOLD,
      temperatureRawData: Array.isArray(frame.temperatureRawData) ? frame.temperatureRawData : [],
      temperatureData: Array.isArray(frame.temperatureData) ? frame.temperatureData : [],
      temperatureAvg: frame.temperatureAvg,
      temperatureK: frame.temperatureK,
      time: row?.timestamp,
      ...extra,
    };
  }

  return {
    buildSmallBed12BCollectionStorageData,
    buildSmallBedPlaybackPayload,
    buildTempFullBedPlaybackPayload,
    buildZeroAwareStorageData,
    formatMatrixTotalForFile,
    getCsvElapsedSeconds,
    getCsvFilePrefix,
    getCsvTitleMap,
    getHistoryPressureData,
    getStoredSitData,
    normalizeFiniteFrame,
    normalizeHistoryPressureData,
    normalizeSmallBed12BPressureData,
    parseStoredFrameData,
    parseStoredSensorFrame,
    shouldTransposeSmallBedRawMatrix,
    shouldTransposeSmallBedRawMatrixFrame,
    transposeSquareMatrix,
  };
}

module.exports = {
  createHistoryFrameTransformService,
};
