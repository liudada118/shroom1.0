const logger = require('../common/logger');
const { createChannelBus } = require('../channel/channelBus');
const {
  buildTelemetryChannelDefinitions,
} = require('../channel/telemetryChannelService');
const { startWorker, callPy, stopWorker, warmFootAnalysis } = require('../python/pyWorker');
const WebSocket = require("ws");
const { normalizeChannel } = require('../services/websocketChannelService');
const {
  WILDCARD_CHANNEL,
  createWebSocketSubscriptionManager,
} = require('../services/websocketSubscriptionService');
const { attachHeartbeat } = require('../services/websocketConnectionService');
const { parseJsonMessage } = require('../services/websocketMessageService');
const {
  closeHttpServer,
  closeWithTimeout,
  closeWsServer,
} = require('../services/serverLifecycleService');
const { createRealtimeTelemetryGateway } = require('../services/realtimeTelemetryGateway');
const { createPetCareRuntimeService } = require('../services/petCareRuntimeService');
const { createWebSocketCommandRouter } = require('../ws/webSocketCommandRouter');
const { registerRuntimeCommandHandlers } = require('../ws/registerRuntimeCommandHandlers');
const {
  DEFAULT_COLLECTION_FREQUENCY_HZ,
  createCollectionDiskSpaceGuard,
  createCollectionStorageClock,
  normalizeCollectFrequency,
  normalizeCollectOptions,
} = require('../services/collectionService');
const { createCollectionInsertQueueService } = require('../services/collectionInsertQueueService');
const { createCollectionFrameStorageService } = require('../services/collectionFrameStorageService');
const {
  createHistoryRowsForPlayback,
  getHistoryStats,
  queryHistoryDates,
  queryHistoryRows,
} = require('../services/historyQueryService');
const {
  buildZeroPlaybackPayload: buildHistoryZeroPlaybackPayload,
  getHistoryLengthFromCounts,
  getHistorySeries: createHistorySeries,
} = require('../services/historyPlaybackService');
const { createPlaybackFrameService } = require('../services/playbackFrameService');
const { createPlaybackTimerService } = require('../services/playbackTimerService');
const { createCsvDownloadService } = require('../services/csvDownloadService');
const { createHistoryMaintenanceService } = require('../services/historyMaintenanceService');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const HttpResult = require('../common/HttpResult');
let electronApp = null;
try {
  ({ app: electronApp } = require('electron'));
} catch {}
const path = require('path');
const os = require('os');
const fs = require('fs');
const {
  listPorts,
} = require("../serial/serialHelper");
const { createSerialParserManager } = require("../serial/serialParserManager");
const { createSerialManager } = require("../serial/serialManager");
const sqlite3 = require("../db/sqlite3-compat").verbose();
const {
  openWeb,
  interp,
  addSide,
  gaussBlur_1,
  carSitLine,
  carBackLine,
  press,
  calculatePressure,
  car10Back,
  objChange,
  calPress,
  car10Sit,
  interp1016,
  timeStampToDate,
  sit10Line,
  press12,
  calPressArr,
  timeStampTo_Date,
  pressToN,
  smallBed,
  smallM,
  // pressSmallBed,
  smallM1,
  rect,
  short,
  smallBedReal,
  zeroLine,
  smallBedZero,
  handLine,
  matColLine,
  smallBed1,
  smallBedReal1,
  yanfeng10sit,
  yanfeng10back,
  handBlue,
  handSinglePoint,
  wowSitLine,
  wowBackLine,
  wowhead,
  xiyueReal1,
  jqbed,
  tempFullBed,
  carCol,
  newHand,
  gloves,
  gloves1,
  gloves0123Res,
  gloves0123,
  gloves2,
  footR,
  footVideo1,
  handR,
  handRVideo1470506,
  handL,
  footVideo,
  footL,
  handVideo1_0416_0506,
  handVideoRealPoint_0506_3,
  footArrToNormal,
  zeroLineMatrix,
  sit100Line,
  endiSit1024,
  carYLine,
} = require("../processing/openWeb");
const module2 = require('../license/aes_ecb')
const { resolveConfigFile, getConfigFileCandidates, getWritableConfigFile } = require('../license/licenseHelper');
const { isCar, dedupli, totalToN, } = require("../common/util");
const { estimatePointPressure, FILTER_THRESHOLD: PRESSURE_CALIBRATION_FILTER_THRESHOLD } = require("../../util/pressureCalibration_V2.7.54");
const { pressSmallBed } = require("../processing/utilMatrix");
const { gaussBlur_return, gaussBlur_2, interpSmall, findMax, numLessZeroToZero, press6, pressNew1220, press6sit, bytes4ToInt10, arrToRealLine, pressNew12203131 } = require('./modules/mathUtils');
const { initDb: _initDbFromModule } = require('./modules/dbManager');
const sensorRegistry = require('../sensors/registry');
const smallBed12B = sensorRegistry.smallBed12B;
const minzhen = sensorRegistry.minzhen;
const wholeChair = sensorRegistry.wholeChair;
const handGloveFullPacket = sensorRegistry.handGloveFullPacket;
const handGloveDouble = sensorRegistry.handGloveDouble;

// ===== 浼犳劅鍣ㄥ父閲忎笌鎻掍欢寮曠敤 =====
// 浠?registry 璇诲彇绫诲瀷銆佽兘鍔涘拰鎻掍欢锛岄伩鍏嶄笟鍔′唬鐮侀噸澶嶅啓浼犳劅鍣ㄥ瓧绗︿覆銆?
const HAND_GLOVE_FULL_PACKET = sensorRegistry.HAND_GLOVE_FULL_PACKET;
const HAND_GLOVE_DOUBLE = sensorRegistry.HAND_GLOVE_DOUBLE;
const HAND_GLOVE_TYPES = sensorRegistry.HAND_GLOVE_TYPES;
const TEMP_FULL_BED_TYPE = sensorRegistry.TEMP_FULL_BED_TYPE;
const JQ_BED_TYPE = sensorRegistry.JQ_BED_TYPE;
const SMALL_BED_TYPE = sensorRegistry.SMALL_BED_TYPE;
const SMALL_BED_NO_ALG_TYPE = sensorRegistry.SMALL_BED_NO_ALG_TYPE;
const SMALL_BED_12B_TYPE = sensorRegistry.SMALL_BED_12B_TYPE;
const HAND_SINGLE_POINT_TYPE = sensorRegistry.HAND_SINGLE_POINT_TYPE;
const WHOLE_CHAIR_TYPE = sensorRegistry.WHOLE_CHAIR_TYPE;
const MINZHEN_TYPE = sensorRegistry.MINZHEN_TYPE;
const isHandGloveType = sensorRegistry.isHandGloveType;
const isHandStorageType = sensorRegistry.isHandStorageType;
const isZeroFrameStorageType = sensorRegistry.isZeroFrameStorageType;
const isSmallBedMatrixType = sensorRegistry.isSmallBedMatrixType;
const isThreePortFile = sensorRegistry.isThreePortFile;
const getFrameMatrixData = sensorRegistry.getFrameMatrixData;
const getSensorBaudRate = sensorRegistry.getSensorBaudRate;
const HAND_GLOVE_FULL_PACKET_LENGTH = 274;
const TEMP_FULL_BED_PRESSURE_THRESHOLD = 20;
const MINZHEN_SENSOR_BAUD_RATE = minzhen.SENSOR_BAUD_RATE;
const mapHandGloveFullPacketPressure = handGloveFullPacket.mapHandGloveFullPacketPressure;
const mapHandGloveFullPacketModelMatrix = handGloveFullPacket.mapHandGloveFullPacketModelMatrix;
const parseHandGloveFullPacket = handGloveFullPacket.parseHandGloveFullPacket;

const SMALL_BED_12B_PAYLOAD_LENGTH = smallBed12B.PAYLOAD_LENGTH;
const SMALL_BED_12B_FRAME_TAIL = smallBed12B.FRAME_TAIL;
const HAND_GLOVE_REALTIME_SEND_INTERVAL_MS = 1000 / 60;
const COLLECTION_MIN_FREE_BYTES = Number(process.env.SHROOM_MIN_COLLECTION_FREE_BYTES) || 2 * 1024 * 1024 * 1024;
const COLLECTION_INSERT_SQL = "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";
const COLLECTION_INSERT_BATCH_SIZE = Number(process.env.SHROOM_COLLECTION_INSERT_BATCH_SIZE) || 200;
const COLLECTION_INSERT_FLUSH_INTERVAL_MS = Number(process.env.SHROOM_COLLECTION_INSERT_FLUSH_INTERVAL_MS) || 250;
let lastHandGloveRealtimeSendAt = {
  sit: 0,
  back: 0,
};

/**
 * 灏嗘晱鏋曠煩闃典腑宸茬煡涓嶇ǔ瀹氱殑鐐逛綅寮哄埗缃浂銆?
 *
 * @param {unknown[]} frame 鍙彉鐨勫帇鍔涚煩闃点€?
 * @returns {unknown[]} 缃浂鍚庣殑鍚屼竴涓煩闃靛紩鐢ㄣ€?
 */
const maskMinzhenMatrixValues = minzhen.maskMatrixValues;
const applyMinzhenBackendGauss = (frame) => minzhen.applyBackendGauss(frame, {
  gaussBlur: gaussBlur_return,
});
const parseMinzhenSensorFrame = minzhen.parseSensorFrame;
const minzhenSensorExtractor = minzhen.createTextFrameExtractor();

function handleMinzhenSensorPortData(data) {
  if (file !== MINZHEN_TYPE || new Date().getTime() >= endDate) return;

  const frameTexts = minzhenSensorExtractor.push(data);
  frameTexts.forEach((frameText) => {
    const frame = parseMinzhenSensorFrame(Buffer.from(frameText));
    if (frame) {
      colOrSendData1(JSON.stringify(frame));
    }
  });
}

function bindBackPortParser() {
  syncManagedSerialPorts();
}

function closeMinzhenSensorPort(reason = 'close') {
  minzhenSensorExtractor.reset();
  closeManagedSerialPort(serialRoles.SENSOR, reason);
}

/**
 * 鎵撳紑鏁忔灂闄勫姞浼犳劅鍣ㄤ娇鐢ㄧ殑鐙珛涓插彛銆?
 *
 * @param {string} portPath 鐢ㄦ埛閫夋嫨鎴栬嚜鍔ㄦ娴嬪埌鐨勪覆鍙ｈ矾寰勩€?
 */
function openMinzhenSensorPort(portPath) {
  if (!portPath) return;
  if (file !== MINZHEN_TYPE) return;
  sensorClose = false;
  comSensor = portPath;
  closeMinzhenSensorPort('reopen');

  try {
    minzhenSensorExtractor.reset();
    openManagedSerialPort(serialRoles.SENSOR, {
      path: portPath,
      baudRate: MINZHEN_SENSOR_BAUD_RATE,
      reconnect: true,
      dataHandler: handleMinzhenSensorPortData,
      onOpenError: (err) => logger.warn(err, "minzhen sensor port err"),
    });
  } catch (e) {
    logger.warn(e, "minzhen sensor port open error");
  }
}

function normalizeWholeChairFrame(section, data) {
  return file === WHOLE_CHAIR_TYPE ? wholeChair.normalizeFrame(section, data) : data;
}

const WCH_ALLOWED_VENDOR_IDS = new Set(['1A86']);
const WCH_ALLOWED_PRODUCT_IDS = new Set(['7523', '55D3']);

function normalizeSerialIdentifier(value) {
  return String(value ?? '').trim().toUpperCase();
}

function hasWchSerialSignature(port = {}) {
  const vendorId = normalizeSerialIdentifier(port.vendorId ?? port.vendorIdentifier);
  const productId = normalizeSerialIdentifier(port.productId ?? port.productIdentifier);
  const pnpId = normalizeSerialIdentifier(port.pnpId);
  const manufacturer = normalizeSerialIdentifier(port.manufacturer);
  const friendlyName = normalizeSerialIdentifier(port.friendlyName);
  const portPath = normalizeSerialIdentifier(port.path);

  if (vendorId && WCH_ALLOWED_VENDOR_IDS.has(vendorId)) {
    return true;
  }

  if (pnpId.includes('VID_1A86')) {
    return true;
  }

  if (WCH_ALLOWED_PRODUCT_IDS.has(productId) && portPath.includes('USBSERIAL')) {
    return true;
  }

  if (portPath.includes('WCHUSBSERIAL')) {
    return true;
  }

  if (manufacturer.includes('WCH')) {
    return true;
  }

  return friendlyName.includes('CH34') || friendlyName.includes('USB-SERIAL') || friendlyName.includes('USB-ENHANCED-SERIAL');
}

function isWindowsTargetSerialPort(port = {}) {
  return hasWchSerialSignature(port);
}

function isMacTargetSerialPort(port = {}) {
  return hasWchSerialSignature(port);
}

function parseStoredFrameData(row) {
  if (!row?.data) return null;
  try {
    return JSON.parse(row.data);
  } catch (error) {
    return null;
  }
}

function getStoredSitData(row) {
  const storedData = parseStoredFrameData(row);
  if (Array.isArray(storedData)) return storedData;
  if (Array.isArray(storedData?.sitData)) return storedData.sitData;
  return [];
}

function getHistoryPressureData(row) {
  const storedData = parseStoredFrameData(row);
  if (Array.isArray(storedData)) return storedData;
  if (Array.isArray(storedData?.pressureData)) return storedData.pressureData;
  if (Array.isArray(storedData?.sitData)) return storedData.sitData;
  if (Array.isArray(storedData?.backData)) return storedData.backData;
  return [];
}

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
 * 灏嗗巻鍙叉暟鎹簱琛岃浆鎹负鍥炴斁鍜屽鍑哄彲鐢ㄧ殑鏁板€煎帇鍔涙暟缁勩€?
 *
 * @param {{ data?: string }} row matrix 琛ㄤ腑鐨勬暟鎹簱琛屻€?
 * @param {string} file 璇ヨ鏁版嵁瀵瑰簲鐨勪紶鎰熷櫒绫诲瀷銆?
 * @returns {number[]} 褰掍竴鍖栧悗鐨勫帇鍔涘€笺€?
 */
function normalizeHistoryPressureData(row, file = '') {
  const storedData = parseStoredFrameData(row);
  const data = getHistoryPressureData(row);
  const pressureData = isHandStorageType(file) && data.length > 256 ? data.slice(0, 256) : data;
  const normalizedData = pressureData.map((value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
  });
  if (file === SMALL_BED_12B_TYPE) {
    return normalizeSmallBed12BPressureData(normalizedData, storedData);
  }
  if (file !== TEMP_FULL_BED_TYPE) return normalizedData;
  return normalizedData.map((value) => value < TEMP_FULL_BED_PRESSURE_THRESHOLD ? 0 : value);
}

const smallBed12BCalibration = {
  estimatePointPressure,
  filterThreshold: PRESSURE_CALIBRATION_FILTER_THRESHOLD,
};

const normalizeSmallBed12BPressureData = (data, storedData = null) =>
  smallBed12B.normalizePressureData(data, storedData, smallBed12BCalibration);

const roundSmallBed12BPressureValue = smallBed12B.roundPressureValue;

function formatMatrixTotalForFile(value, targetFile = file) {
  const numberValue = Number(value);
  const safeValue = Number.isFinite(numberValue) ? numberValue : 0;
  if (targetFile === SMALL_BED_12B_TYPE) {
    return Number(safeValue.toFixed(1));
  }
  return totalToN(safeValue);
}

function getCsvElapsedSeconds(rows, rowIndex, baseIndex = 0, frameIndex = 0) {
  const currentTimestamp = Number(rows?.[rowIndex]?.timestamp);
  const baseTimestamp = Number(rows?.[baseIndex]?.timestamp);
  if (Number.isFinite(currentTimestamp) && Number.isFinite(baseTimestamp)) {
    return ((currentTimestamp - baseTimestamp) / 1000).toFixed(3);
  }

  const fallbackHz = Number(colHZ) > 0 ? Number(colHZ) : 12;
  return (frameIndex / fallbackHz).toFixed(3);
}

function isEnglishCsvDownload(downloadOptions = {}) {
  const language = String(downloadOptions.language || downloadOptions.locale || 'zh').toLowerCase();
  return language.startsWith('en');
}

function getCsvFilePrefix(sensorType, fallbackPrefix, downloadOptions = {}) {
  if (sensorType === SMALL_BED_12B_TYPE) return '12B';
  if (sensorType === HAND_SINGLE_POINT_TYPE) return isEnglishCsvDownload(downloadOptions) ? 'detection' : '妫€娴嬬偣';
  if (isHandGloveType(sensorType) && fallbackPrefix === 'sit') return 'left';
  if (isHandGloveType(sensorType) && fallbackPrefix === 'back') return 'right';
  return fallbackPrefix;
}

function shouldSendRealtimeFrame(channel = 'sit') {
  if (!isHandGloveType(file)) return true;

  const now = Date.now();
  const lastSendAt = lastHandGloveRealtimeSendAt[channel] || 0;
  if (now - lastSendAt < HAND_GLOVE_REALTIME_SEND_INTERVAL_MS) {
    return false;
  }

  lastHandGloveRealtimeSendAt[channel] = now;
  return true;
}

const normalizeSmallBed12BDisplayOptions = smallBed12B.normalizeDisplayOptions;

function resetCollectionStorageClock() {
  collectionStorageClock.reset();
}

function shouldStoreCollectionFrame(channel = 'sit') {
  return collectionStorageClock.shouldStore(channel);
}

function buildSmallBed12BCollectionStorageData(frameToStore) {
  return smallBed12B.buildCollectionStorageData(frameToStore, {
    collectOptions,
    transposeSquareMatrix,
  });
}

function buildSmallBedPlaybackPayload(row, extra = {}) {
  const storedData = parseStoredFrameData(row);
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

function getZeroFrameForStorage(channel = 'sit') {
  const source = channel === 'back'
    ? (pointArr2RawZero.length ? pointArr2RawZero : pointArr2zero)
    : channel === 'head'
      ? pointArr4zero
      : (pointArr1RawZero.length ? pointArr1RawZero : pointArr1zero);
  return Array.isArray(source) ? [...source] : [];
}

function buildZeroAwareStorageData(frameToStore, dataKey, channel = 'sit') {
  const pressureData = getZeroAwareStoragePressureData(frameToStore, dataKey);
  if (!isZeroFrameStorageType(file)) {
    return JSON.stringify(pressureData);
  }

  return JSON.stringify({
    pressureData,
    rotate: Array.isArray(frameToStore.rotate) ? [...frameToStore.rotate] : [],
    zeroFrame: getZeroFrameForStorage(channel),
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

function getCsvTitleMap(downloadOptions = {}) {
  const language = String(downloadOptions.language || downloadOptions.locale || 'zh').toLowerCase();
  return language.startsWith('en') ? CSV_TITLES.en : CSV_TITLES.zh;
}

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

function shouldTransposeSmallBedRawMatrix(sensorType) {
  return sensorType === JQ_BED_TYPE || sensorType === SMALL_BED_TYPE || sensorType === SMALL_BED_NO_ALG_TYPE || sensorType === SMALL_BED_12B_TYPE;
}

function shouldTransposeSmallBedRawMatrixFrame(sensorType, frame = null) {
  return shouldTransposeSmallBedRawMatrix(sensorType) && frame?.matrixOrientation !== 'transposed';
}

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

const getPort = (ports) => {
  const portList = Array.isArray(ports) ? ports : [];

  if (process.platform === 'win32') {
    const filteredPorts = portList.filter(isWindowsTargetSerialPort);
    logger.info(`[SerialList] filter win32 whitelist matched ${filteredPorts.length}/${portList.length} port(s)`);
    return filteredPorts;
  }

  if (process.platform === 'darwin') {
    const filteredPorts = portList.filter(isMacTargetSerialPort);
    logger.info(`[SerialList] filter darwin whitelist matched ${filteredPorts.length}/${portList.length} port(s)`);
    return filteredPorts;
  }

  return portList
}

function summarizeSerialPort(port = {}) {
  const summary = {
    path: port.path ?? null,
    manufacturer: port.manufacturer ?? null,
    serialNumber: port.serialNumber ?? null,
    pnpId: port.pnpId ?? null,
    vendorId: port.vendorId ?? null,
    productId: port.productId ?? null,
    friendlyName: port.friendlyName ?? null,
    locationId: port.locationId ?? null,
  }

  if (port.vendorIdentifier != null) {
    summary.vendorIdentifier = port.vendorIdentifier
  }

  if (port.productIdentifier != null) {
    summary.productIdentifier = port.productIdentifier
  }

  return summary
}

function logSerialPortList(reason, ports) {
  const portList = Array.isArray(ports) ? ports : []
  logger.info(`[SerialList] ${reason}: detected ${portList.length} port(s)`)

  if (portList.length === 0) {
    logger.warn(`[SerialList] ${reason}: no serial ports detected`)
    return
  }

  portList.forEach((port, index) => {
    logger.info(`[SerialList] ${reason} #${index + 1}`, summarizeSerialPort(port))
  })
}

// ===== 涓插彛銆佸疄鏃跺拰鍥炴斁鐘舵€?=====
// baudRate 鏄綋鍓嶄富涓插彛娉㈢壒鐜囷紱port1/port2/portHead/portSensor 鍒嗗埆瀵瑰簲鍧愰潰銆侀潬鑳屻€佸ご鏋曞拰闄勫姞浼犳劅鍣ㄤ覆鍙ｃ€?
// localFlag銆乸layFlag銆乶owIndex銆乮nterval銆乼imer 鎻忚堪鍘嗗彶鍥炴斁鐘舵€侊紝鍒囧洖瀹炴椂鎴栧叧闂湇鍔℃椂蹇呴』涓€璧锋竻鐞嗐€?
let baudRate = 1000000

let serialport = { a: 1, b: 2 }
const timeNum = 1000 / 12;
let port2,
  port1,
  portHead,
  portSensor,
  localFlag = false,
  playFlag = false,
  nowIndex = 0,
  interval = timeNum,
  detectedInterval = timeNum,
  time;



// ===== 鍘嗗彶鍥炴斁缁熻涓庢閫夌姸鎬?=====
// timeStamp/historyArr 淇濆瓨褰撳墠鍘嗗彶鏃堕棿杞村拰鑼冨洿锛沚ackAreaSelect/sitAreaSelect 绛夋暟缁勪繚瀛樺墠绔閫夌粺璁＄粨鏋溿€?
let timeStamp,
  historyArr,
  newsit,
  newback,
  backAreaSelect = [],
  backPressSelect = [],
  sitAreaSelect = [],
  sitClose = false,
  backClose = false,
  headClose = false,
  sensorClose = false,
  sitPressSelect = [];
const sitnum1 = 64;
const sitnum2 = 64;
const backnum1 = 64;
const backnum2 = 64;
// ===== 鐢熷懡浣撳緛涓庡疇鐗╃湅鎶よ繍琛岀紦瀛?=====
// 涓嬫柟鍙橀噺缂撳瓨 jqbed銆乻mallBed銆乸etCare 鐨勭畻娉曠姸鎬併€佸湪搴婅鏃躲€佸績鐜囨ā鎷熷櫒鍜屾渶杩戜竴娆＄煩闃垫暟鎹€?
let smoothValue = 0;
let useMatrixOrigin = false; // jqbed 璋冭瘯寮€鍏筹細true 鏃朵娇鐢ㄧ畻娉曡繑鍥炵殑 matrix_origin 浣滀负 sitData銆?
let jqbedMatrixOrigin = null; // 缂撳瓨绠楁硶杩斿洖鐨?matrix_origin 鏁版嵁銆?
let lastData = new Array(1024).fill(0),
  firstData = new Array(1024).fill(0);
const backTotal = backnum1 * backnum2;
const sitTotal = sitnum1 * sitnum2;
let length, history, nowGetTime;

let nowDate = 0
let endDate = 0

const https = require('https')
// 浣跨敤鍐呯疆 http 妯″潡鏇夸唬宸插簾寮冪殑 request 鍖呫€?const http = require('http');
http.get('http://sensor.bodyta.com:8080/rcv/login/getSystemTime', {
  headers: { 'content-type': 'application/json; charset=utf-8;' }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const body = JSON.parse(data);
      logger.debug(body.time, 'body');
      nowDate = parseInt(body.time);
    } catch (e) {
      logger.warn('Failed to parse system time response', e);
    }
  });
}).on('error', (err) => {
  logger.warn('Failed to get system time', err);
});

// ===== 杩愯璺緞涓庤祫婧愮洰褰?=====
// 寮€鍙戞€佸啓鍏ラ」鐩洰褰曪紱鎵撳寘鎬佸尯鍒?resourcesPath 鍜?userData锛岄伩鍏嶆妸鏁版嵁搴撱€佸浘鐗囧拰閰嶇疆鍐欒繘 asar銆?
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const isPackagedRuntime = Boolean(electronApp?.isPackaged);
const runtimeResourceRoot = isPackagedRuntime ? process.resourcesPath : PROJECT_ROOT;
const runtimeWritableRoot = isPackagedRuntime ? electronApp.getPath('userData') : PROJECT_ROOT;
const exportRoot = isPackagedRuntime
  ? (process.platform === 'darwin' ? app.getPath('desktop') : process.resourcesPath)
  : runtimeWritableRoot;
// filePath銆乧svPath銆乮mgPath銆乸dfPath 鏄繍琛屾湡鍙啓鐩綍锛沶ameTxt 鏄綋鍓嶈鍙栫殑鎺堟潈閰嶇疆鏂囦欢锛寃ritableNameTxt 鏄啓鍏ョ洰鏍囥€?
let filePath = path.join(runtimeWritableRoot, "db");
let csvPath = path.join(exportRoot, "data");
let imgPath = path.join(runtimeWritableRoot, "img");
let pdfPath = isPackagedRuntime
  ? (process.platform === 'win32' ? path.join(process.resourcesPath, "OneStep") : path.join(exportRoot, "oneStepPdf"))
  : path.join(runtimeWritableRoot, "oneStepPdf");
let nameTxt = resolveConfigFile();
let writableNameTxt = getWritableConfigFile();

if (!fs.existsSync(filePath)) {
  fs.mkdirSync(filePath, { recursive: true });
}

if (!fs.existsSync(csvPath)) {
  fs.mkdirSync(csvPath, { recursive: true });
}
if (!fs.existsSync(imgPath)) {
  fs.mkdirSync(imgPath, { recursive: true });
}
if (!fs.existsSync(pdfPath)) {
  fs.mkdirSync(pdfPath, { recursive: true });
}

logger.info("[Path] resourceRoot=", runtimeResourceRoot);
logger.info("[Path] writableRoot=", runtimeWritableRoot);
logger.info("[Path] db=", filePath, "data=", csvPath, "config=", nameTxt);
logger.info("[Path] configCandidates=", getConfigFileCandidates().join(", "));

function broadcastCollectionStorageError(error = {}) {
  return publishSystemEvent( {
    collectionStorageError: {
      message: error.message || '数据库空间不足，已停止采集',
      freeBytes: error.freeBytes,
      minFreeBytes: error.minFreeBytes,
      file,
      saveTime,
    },
  });
}

function getCollectionFreeBytes() {
  return collectionDiskSpaceGuard.getFreeBytes();
}

function stopCollectionForStorageError(error, extra = {}) {
  flushCollectionInsertQueues();
  flag = false;
  const message = error?.message || String(error || '数据库写入失败，已停止采集');
  logger.error('[Collection] stop collection:', message);
  broadcastCollectionStorageError({
    message: message.includes('database or disk is full')
      ? '纾佺洏绌洪棿涓嶈冻锛屾暟鎹簱鍐欏叆澶辫触锛屽凡鑷姩鍋滄閲囬泦'
      : message,
    ...extra,
  });
}

const collectionDiskSpaceGuard = createCollectionDiskSpaceGuard({
  getDirectory: () => filePath,
  minFreeBytes: COLLECTION_MIN_FREE_BYTES,
  logger,
  onInsufficientSpace: ({ freeBytes, minFreeBytes }) => {
    stopCollectionForStorageError(
      new Error('纾佺洏鍓╀綑绌洪棿涓嶈冻锛屽凡鑷姩鍋滄閲囬泦'),
      { freeBytes, minFreeBytes },
    );
  },
});

function hasEnoughCollectionDiskSpace() {
  return collectionDiskSpaceGuard.hasEnoughSpace();
}

function handleCollectionDbError(err, channel) {
  if (!err) return;
  const message = err.message || String(err);
  if (err.code === 'SQLITE_FULL' || message.includes('database or disk is full')) {
    stopCollectionForStorageError(err, {
      channel,
      freeBytes: getCollectionFreeBytes(),
      minFreeBytes: COLLECTION_MIN_FREE_BYTES,
    });
    return;
  }
  logger.error(err);
}

const collectionInsertQueueService = createCollectionInsertQueueService({
  sql: COLLECTION_INSERT_SQL,
  batchSize: COLLECTION_INSERT_BATCH_SIZE,
  flushIntervalMs: COLLECTION_INSERT_FLUSH_INTERVAL_MS,
  onError: handleCollectionDbError,
});

function flushCollectionInsertQueues() {
  collectionInsertQueueService.flushAll();
}

function enqueueCollectionInsert(dbRef, params, channel = 'sit') {
  collectionInsertQueueService.enqueue(dbRef, params, channel);
}

function enqueueCollectionFrame(dbRef, dataToStore, channel) {
  enqueueCollectionInsert(dbRef, [dataToStore, Date.now(), saveTime], channel);
}

// initDb 包装函数，自动传入 filePath 和 runtimeResourceRoot。
function initDb(fileStr) {
  return _initDbFromModule(fileStr, filePath, runtimeResourceRoot);
}

// ===== 鍘嗗彶鏌ヨ鍜屽洖鏀炬暟鎹紦瀛?=====
// 澶у巻鍙叉暟鎹秴杩囬槇鍊兼椂浣跨敤鎳掑姞杞戒唬鐞嗭紝閬垮厤涓€娆℃€ф妸鍏ㄩ儴 matrix 琛岃鍏ュ唴瀛樸€?
const HISTORY_EAGER_ROW_LIMIT = 50000;
function getHistorySeries({ sitRows = [], backRows = [], start = 0, end = null, file = '' }) {
  return createHistorySeries({
    sitRows,
    backRows,
    start,
    end,
    sensorType: file,
    normalizeHistoryPressureData,
    formatMatrixTotalForFile,
    totalToN,
  });
}

function buildZeroPlaybackPayload() {
  return buildHistoryZeroPlaybackPayload({
    sensorType: file,
    smallBed12BType: SMALL_BED_12B_TYPE,
    smallBed12BDisplayOptions,
  });
}

const playbackFrameService = createPlaybackFrameService({
  footArrToNormal,
  footL,
  footR,
  footVideo,
  footVideo1,
  handL,
  handR,
  handGloveFullPacket: HAND_GLOVE_FULL_PACKET,
  isHandGloveType,
  isSmallBedMatrixType,
  isThreePortFile,
  mapHandGloveFullPacketModelMatrix,
  mapHandGloveFullPacketPressure,
  normalizeFiniteFrame,
  normalizeWholeChairFrame,
  parseStoredSensorFrame,
  buildSmallBedPlaybackPayload,
  buildTempFullBedPlaybackPayload,
  smallBed12BType: SMALL_BED_12B_TYPE,
  tempFullBedType: TEMP_FULL_BED_TYPE,
  wholeChairType: WHOLE_CHAIR_TYPE,
});

function publishPlaybackFrame(index, options = {}) {
  const { sitPayload, backPayload, headPayload } = playbackFrameService.buildPayloads({
    sensorType: file,
    sitRows: localData,
    backRows: localDataBack,
    headRows: localDataHead,
    index,
    ...options,
  });

  if (backPayload) publishSystemEvent(backPayload);
  if (headPayload) publishSystemEvent(headPayload);
  publishSystemEvent(sitPayload);
}

const playbackTimer = createPlaybackTimerService({
  getInterval: () => interval,
  onTick: () => {
    if (nowIndex <= indexArr[1]) {
      nowIndex++;
      publishPlaybackFrame(nowIndex);
      return true;
    }
    return false;
  },
  onStop: () => {
    playFlag = false;
  },
});

function broadcastHistorySelectionPayload(payload) {
  return publishSystemEvent( payload);
}

function loadSelectedHistory(dateLabel) {
  try {
    stopPlaybackTimer();
    nowIndex = 0;
    localData = [];
    localDataBack = [];
    localDataHead = [];
    indexArr = [0, 0];

    const sitStats = getHistoryStats(db, dateLabel, logger);
    const backStats = isCar(file) && db1
      ? getHistoryStats(db1, dateLabel, logger)
      : { count: 0, minId: 0, maxId: 0 };
    const headStats = isThreePortFile(file) && db2
      ? getHistoryStats(db2, dateLabel, logger)
      : { count: 0, minId: 0, maxId: 0 };
    const totalLength = isThreePortFile(file)
      ? getHistoryLengthFromCounts(sitStats.count, backStats.count, headStats.count)
      : isCar(file)
        ? getHistoryLengthFromCounts(sitStats.count, backStats.count)
        : getHistoryLengthFromCounts(sitStats.count);
    const maxRows = Math.max(sitStats.count, backStats.count, headStats.count);
    const eager = maxRows <= HISTORY_EAGER_ROW_LIMIT;

    localData = createHistoryRowsForPlayback(db, dateLabel, sitStats, eager, logger);
    if (isCar(file) && db1) {
      localDataBack = createHistoryRowsForPlayback(db1, dateLabel, backStats, eager, logger);
    }
    if (isThreePortFile(file) && db2) {
      localDataHead = createHistoryRowsForPlayback(db2, dateLabel, headStats, eager, logger);
    }

    const historySeries = getHistorySeries({
      sitRows: localData,
      backRows: localDataBack,
      file,
    });
    length = totalLength || historySeries.length;
    indexArr = [0, Math.max(length - 2, 0)];
    timeStamp = historySeries.time;
    detectedInterval = calcDetectedInterval(timeStamp);
    interval = detectedInterval;
    historyArr = [0, length];

    broadcastHistorySelectionPayload({
      length,
      time: timeStamp,
      historyTimeArr: timeStamp,
      index: nowIndex,
      pressArr: historySeries.press,
      areaArr: historySeries.area,
      ...buildZeroPlaybackPayload(),
    });
  } catch (error) {
    logger.error('[History] failed to load selected history:', error.message || error);
    broadcastHistorySelectionPayload({
      length: 0,
      time: [],
      historyTimeArr: [],
      index: 0,
      pressArr: [],
      areaArr: [],
      ...buildZeroPlaybackPayload(),
    });
  }
}

/**
 * 浠庢椂闂存埑鏁扮粍鎺ㄧ畻瀹為檯閲囬泦甯ч棿闅旓紙ms锛?
 * 鍙栧墠 N 甯ф椂闂存埑宸€肩殑涓綅鏁帮紝杩囨护寮傚父鍊硷紝fallback 鍒?timeNum
 */
function stopPlaybackTimer() {
  playbackTimer.stop();
}

function startPlaybackTimer() {
  playFlag = true;
  playbackTimer.start();
}

function calcDetectedInterval(timestamps) {
  if (!Array.isArray(timestamps) || timestamps.length < 2) return timeNum;
  const sampleSize = Math.min(20, timestamps.length - 1);
  const diffs = [];
  for (let i = 1; i <= sampleSize; i++) {
    const d = timestamps[i] - timestamps[i - 1];
    if (d > 0 && d < 5000) diffs.push(d); // 杩囨护寮傚父鍊硷紙>5s 瑙嗕负鏃犳晥锛?
  }
  if (diffs.length === 0) return timeNum;
  diffs.sort((a, b) => a - b);
  const median = diffs[Math.floor(diffs.length / 2)];
  return Math.max(1, median); // 鏈€灏?1ms
}

// ===== 鍚庣鐢熷懡鍛ㄦ湡瀹氭椂鍣?=====
// 周期任务句柄，shutdown 时统一清理；串口重连循环由 serialManager 内部维护。
let jqbedTimer = null;
let petCareTimer = null;
let petCareMiniTimer = null;
let reportHttpServer = null;
let serverOpened = false;
let serverShutdownRequested = false;
let serverShutdownPromise = null;

/**
 * 缁欒祫婧愬叧闂繃绋嬪姞瓒呮椂淇濇姢锛岄伩鍏嶅簲鐢ㄩ€€鍑烘椂鏃犻檺绛夊緟銆?
 *
 * @param {string} name 鏃ュ織涓睍绀虹殑璧勬簮鍚嶇О銆?
 * @param {Promise<unknown>} promise 琚繚鎶ょ殑鍏抽棴鎿嶄綔銆?
 * @param {number} timeoutMs 鏈€澶х瓑寰呮椂闂淬€?
 * @returns {Promise<unknown | false>} 鍏抽棴缁撴灉锛涜秴鏃舵垨澶辫触鏃惰繑鍥?false銆?
 */
function clearManagedInterval(name, timerRef) {
  if (!timerRef) return null;
  clearInterval(timerRef);
  logger.info(`[Server] Cleared ${name}`);
  return null;
}

function closeDatabase(dbRef, name) {
  if (!dbRef || typeof dbRef.close !== 'function') return Promise.resolve();

  return new Promise((resolve) => {
    try {
      dbRef.close((err) => {
        if (err) {
          logger.warn(`[Server] ${name} close failed:`, err.message || err);
        } else {
          logger.info(`[Server] ${name} closed`);
        }
        resolve();
      });
    } catch (err) {
      logger.warn(`[Server] ${name} close threw:`, err.message);
      resolve();
    }
  });
}

/**
 * 鍏抽棴瀹氭椂鍣ㄣ€佷覆鍙ｃ€乄ebSocket/HTTP 鏈嶅姟銆佹暟鎹簱鍜?Python worker銆?
 *
 * @returns {Promise<void>} 鍏变韩鐨勫叧闂?Promise锛屼繚璇侀噸澶嶈皟鐢ㄦ椂涓嶄細閲嶅閲婃斁璧勬簮銆?
 */
function shutdownServer() {
  if (serverShutdownRequested) {
    return serverShutdownPromise || Promise.resolve();
  }
  serverShutdownRequested = true;

  logger.info("[Server] Shutdown requested, closing sockets/timers/workers...");

  stopPlaybackTimer();
  serialManager.stopReconnectLoop();
  jqbedTimer = clearManagedInterval("jqbed timer", jqbedTimer);
  petCareTimer = clearManagedInterval("petCare timer", petCareTimer);
  petCareMiniTimer = clearManagedInterval("petCareMini timer", petCareMiniTimer);

  localFlag = false;
  sitClose = true;
  backClose = true;
  headClose = true;
  sensorClose = true;
  com = undefined;
  com1 = undefined;
  comhead = undefined;
  comSensor = undefined;

  try {
    stopWorker();
  } catch (err) {
    logger.warn("[Server] stopWorker failed:", err.message);
  }

  const reportServer = reportHttpServer;
  reportHttpServer = null;

  serverShutdownPromise = Promise.all([
    closeWithTimeout("serial ports", serialManager.closeAll("shutdown")),
    closeWithTimeout("server", closeWsServer(server, "server")),
    closeWithTimeout("server1", closeWsServer(server1, "server1")),
    closeWithTimeout("server2", closeWsServer(server2, "server2")),
    closeWithTimeout("report HTTP server", closeHttpServer(reportServer, "report HTTP server")),
    closeWithTimeout("db", closeDatabase(db, "db")),
    closeWithTimeout("db1", closeDatabase(db1, "db1")),
    closeWithTimeout("db2", closeDatabase(db2, "db2")),
  ]).then(() => {
    port1 = null;
    port2 = null;
    portHead = null;
    portSensor = null;
    serverOpened = false;
  });

  return serverShutdownPromise;
}



// ===== 褰撳墠鎺堟潈銆佷紶鎰熷櫒绫诲瀷鍜屾暟鎹簱鍙ユ焺 =====
// file 鏄綋鍓嶇郴缁熺被鍨嬶紱licenseFile/selectFlag 鏉ヨ嚜鎺堟潈鏂囦欢锛沝b/db1/db2 鍒嗗埆瀵瑰簲鍧愰潰銆侀潬鑳屻€佸ご鏋曚笁璺巻鍙插簱銆?
const defauleFile = 'hand0205'
let date, sysStartTime, file = defauleFile, selectFlag
let licenseFile = null

function getSelectFlagFromLicense(licenseFile) {
  if (licenseFile === 'all') return 'all';
  if (Array.isArray(licenseFile)) {
    return licenseFile.filter((item) => typeof item === 'string' && item.trim());
  }

  if (typeof licenseFile === 'string' && licenseFile.trim() && licenseFile !== 'all') {
    return [licenseFile];
  }

  return undefined;
}

function getDefaultFileFromLicense(licenseFile, fallback = null) {
  if (Array.isArray(licenseFile)) {
    return licenseFile.find((item) => typeof item === 'string' && item.trim()) || fallback;
  }

  if (typeof licenseFile === 'string' && licenseFile.trim() && licenseFile !== 'all') {
    return licenseFile;
  }

  return fallback;
}

if (fs.existsSync(nameTxt)) {
  try {
    const dateRes = fs.readFileSync(nameTxt, 'utf8');
    const parsedData = JSON.parse(module2.decryptStr(dateRes));
    endDate = parseFloat(parsedData.date);
    licenseFile = parsedData.file || null;
    selectFlag = getSelectFlagFromLicense(parsedData.file);
    file = getDefaultFileFromLicense(parsedData.file, defauleFile);
    // 閺嶈宓?file 缁鐎风拋鍓х枂濞夈垻澹掗悳?
    baudRate = getSensorBaudRate(file);
  } catch (err) {
    logger.error(err);
  }
} else {
  logger.info("[Config] config.txt not found, skip loading license at startup.");
}

// let db = new sqlite3.Database(`${filePath}/foot.db`);
// let db1 = new sqlite3.Database(`${filePath}/back.db`);
// let db2 = new sqlite3.Database(`${filePath}/volvohead.db`);
let sitTimeArr = [],
  backTimeArr = [];
let dataFalg = 0;

// const createCsvWriter = require("csv-writer").createObjectCsvWriter;

// ===== 鍓嶇閲囬泦鎺у埗娑堟伅鐘舵€?=====
// saveTime/getTime 璁板綍閲囬泦鎴栧洖鏀炬棩鏈燂紱com銆乧om1銆乧omhead銆乧omSensor 淇濆瓨鍓嶇閫夋嫨鐨勪覆鍙ｈ矾寰勩€?
let saveTime,
  getTime,

  com,
  com1,
  comhead,
  comSensor;
// db = new sqlite3.Database(`${filePath}/${file}.db`);

// try {
//   const dateRes = fs.readFileSync(nameTxt, 'utf8');

//   console.log(dateRes)
//   file = dateRes
//   // date = JSON.parse(module2.decryptStr(dateRes)).dateRes
//   // // endDate = JSON.parse(module2.decryptStr(dateRes)).dateRes
//   // sysStartTime = (`${JSON.parse(module2.decryptStr(dateRes)).startTimeRes}`)
//   // console.log(JSON.parse(module2.decryptStr(dateRes)).startTimeRes);
//   // endDate = parseFloat(module2.decryptStr(date))
// } catch (err) {
//   logger.error(err);
// }




const dbObj = initDb(file)
db = dbObj.db
db1 = dbObj.db1
db2 = dbObj.db2

// ===== 閲囬泦閰嶇疆鍜屼覆鍙ｈВ鏋愬櫒 =====
// flag 琛ㄧず鏄惁姝ｅ湪閲囬泦锛沜olHZ/collectOptions 鎺у埗鍏ュ簱棰戠巼锛沺arser 绯诲垪鍙橀噺鏄笉鍚岄€氶亾鍜屽崗璁娇鐢ㄧ殑涓插彛鍒嗗抚鍣ㄣ€?
let flag = false;
let colHZ = DEFAULT_COLLECTION_FREQUENCY_HZ;
let collectOptions = normalizeCollectOptions({ frequencyMode: 'serial', frequencyHz: colHZ });
const collectionStorageClock = createCollectionStorageClock({
  getOptions: () => collectOptions,
  getFallbackFrequencyHz: () => colHZ,
});
let smallBed12BDisplayOptions = { matrixMode: '32x32', samplePoint: 'topLeft' };
let splitBuffer = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
// let splitBuffer1 = Buffer.from([0xaa, 0x55, 0x03, 0x09]);
const serialParserManager = createSerialParserManager({
  frameDelimiter: splitBuffer,
  smallBed12BDelimiter: SMALL_BED_12B_FRAME_TAIL,
});
const serialManager = createSerialManager({
  parserManager: serialParserManager,
  logger,
});
const serialRoles = serialManager.roles;

function syncManagedSerialPorts() {
  port1 = serialManager.getPort(serialRoles.SIT);
  port2 = serialManager.getPort(serialRoles.BACK);
  portHead = serialManager.getPort(serialRoles.HEAD);
  portSensor = serialManager.getPort(serialRoles.SENSOR);
}

function getSitParserChannel() {
  return file === SMALL_BED_12B_TYPE
    ? serialParserManager.channels.SMALL_BED_12B
    : serialParserManager.channels.SIT;
}

function openManagedSerialPort(role, options = {}) {
  serialManager.registerPort(role, {
    ...options,
    role,
    reconnect: options.reconnect === true,
  });
  const port = serialManager.start(role);
  syncManagedSerialPorts();
  return port;
}

function closeManagedSerialPort(role, reason) {
  serialManager.setReconnect(role, false);
  serialManager.stop(role, reason);
  syncManagedSerialPorts();
}

function openSitSerialPort(portPath, reason = 'open sit') {
  if (!portPath) return null;
  return openManagedSerialPort(serialRoles.SIT, {
    path: portPath,
    baudRate,
    reconnect: true,
    parserChannel: file === 'bigBed'
      ? serialParserManager.channels.BIG_BED_SIT
      : getSitParserChannel(),
    onOpenError: (err) => logger.warn(err, `${reason} err`),
  });
}

function openBackSerialPort(portPath, reason = 'open back') {
  if (!portPath) return null;
  const useRawMinzhenText = file === MINZHEN_TYPE;
  if (useRawMinzhenText) {
    minzhenSensorExtractor.reset();
  }
  return openManagedSerialPort(serialRoles.BACK, {
    path: portPath,
    baudRate,
    reconnect: true,
    parserChannel: useRawMinzhenText ? undefined : serialParserManager.channels.BACK,
    dataHandler: useRawMinzhenText ? handleMinzhenSensorPortData : undefined,
    onOpenError: (err) => logger.warn(err, `${reason} err`),
  });
}

function openHeadSerialPort(portPath, reason = 'open head') {
  if (!portPath) return null;
  return openManagedSerialPort(serialRoles.HEAD, {
    path: portPath,
    baudRate,
    reconnect: true,
    parserChannel: serialParserManager.channels.HEAD,
    onOpenError: (err) => logger.warn(err, `${reason} err`),
  });
}
// ===== WebSocket 涓夐€氶亾涓庢竻闆跺熀鍑嗙紦瀛?=====
// server/server1/server2 鍒嗗埆瀵瑰簲鍧愰潰銆侀潬鑳屻€佸ご鏋曟帹閫侀€氶亾锛沺ointArr*zero 淇濆瓨鍚勮矾娓呴浂鍩哄噯甯с€?
serialManager.startReconnectLoop({
  intervalMs: 3000,
  reason: 'registered serial reconnect',
  onReconnect: syncManagedSerialPorts,
});

let server, server1, server2;
const wsSubscriptions = createWebSocketSubscriptionManager({ logger });
const channelBus = createChannelBus();
const realtimeTelemetryGateway = createRealtimeTelemetryGateway({
  channelBus,
  wsSubscriptions,
  getSensorType: () => file,
});

function publishRealtimeFrame(channel, jsonData) {
  return realtimeTelemetryGateway.publishRealtimeFrame(channel, jsonData).legacySent;
}

function publishRealtimeChannel(channel, jsonData, { respectFrequency = true } = {}) {
  if (localFlag) return 0;
  if (respectFrequency && !shouldSendRealtimeFrame(channel)) return 0;
  return publishRealtimeFrame(channel, jsonData);
}

function publishSystemEvent(data) {
  return wsSubscriptions.publishScope('main', data);
}

function getRealtimeChannelMetadata() {
  const legacyChannels = [
    { channelId: 'sit', name: 'Sit pressure legacy channel', port: 19999, legacy: true },
    { channelId: 'back', name: 'Back pressure legacy channel', port: 19998, legacy: true },
    { channelId: 'head', name: 'Head pressure legacy channel', port: 19997, legacy: true },
  ].map((channel) => ({
    ...channel,
    sensorType: file,
    transport: 'websocket',
  }));

  return [
    ...legacyChannels,
    ...buildTelemetryChannelDefinitions(file, legacyChannels.map((channel) => channel.channelId)),
  ];
}
function publishHistoryDateList() {
  const sitRows = queryHistoryDates(db, 500, 0, logger);
  sitTimeArr = sitRows;

  if (isCar(file)) {
    const backRows = queryHistoryDates(db1, 500, 0, logger);
    backTimeArr = backRows;
    const mergedTimeArr = dedupli(sitTimeArr, backTimeArr);

    if (file === 'car') {
      publishSystemEvent({
        timeArr: mergedTimeArr,
        backData: new Array(backTotal).fill(0),
      });
    }

    if (file === 'car10') {
      publishSystemEvent({
        timeArr: backRows,
        backData: new Array(100).fill(0),
      });
    }
  }

  const timeArr = isCar(file) ? dedupli(sitTimeArr, backTimeArr) : sitRows;
  publishSystemEvent({
    timeArr: file === 'bigBed' ? sitRows : timeArr,
    index: nowIndex,
    sitData: new Array(file === 'bigBed' ? 2048 : sitTotal).fill(0),
  });

  if (isCar(file)) {
    publishSystemEvent({
      backData: new Array(backTotal).fill(0),
    });

    if (isThreePortFile(file)) {
      publishSystemEvent({
        headData: new Array(100).fill(0),
      });
    }
  }
}

const petCareRuntimeService = createPetCareRuntimeService({
  logger,
  callPy,
  getPointArr: () => pointArr,
  getFile: () => file,
  getPort: () => port1,
  publishSystemEvent,
  setJqbedMatrixOrigin: (matrixOrigin) => {
    jqbedMatrixOrigin = matrixOrigin;
  },
});

const csvDownloadService = createCsvDownloadService({
  fs,
  path,
  logger,
  csvPath,
  publishSystemEvent,
  getRuntime: () => ({
    file,
    historyArr,
  }),
  getDatabases: () => ({
    db,
    db1,
    db2,
  }),
  getHistoryStats,
  queryHistoryRows,
  normalizeHistoryPressureData,
  formatMatrixTotalForFile,
  totalToN,
  findMax,
  timeStampToDate,
  timeStampToDateLabel: timeStampTo_Date,
  getCsvElapsedSeconds,
  getCsvFilePrefix,
  getCsvTitleMap,
  isCar,
  isThreePortFile,
});

const historyMaintenanceService = createHistoryMaintenanceService({
  logger,
  getDatabases: () => ({
    db,
    db1,
  }),
  isCar,
  getSensorType: () => file,
  publishSystemEvent,
});

const wsCommandRouter = createWebSocketCommandRouter({ logger });
registerRuntimeCommandHandlers(wsCommandRouter, {
  csvDownloadService,
  historyMaintenanceService,
  normalizeCollectFrequency,
  normalizeCollectOptions,
  normalizeSmallBed12BDisplayOptions,
  resetCollectionStorageClock,
  flushCollectionInsertQueues,
  startPlaybackTimer,
  stopPlaybackTimer,
  getRuntime: () => ({
    colHZ,
    collectOptions,
    detectedInterval,
    playFlag,
  }),
  setRuntime: (next = {}) => {
    if (Object.prototype.hasOwnProperty.call(next, 'smallBed12BDisplayOptions')) smallBed12BDisplayOptions = next.smallBed12BDisplayOptions;
    if (Object.prototype.hasOwnProperty.call(next, 'history')) history = next.history;
    if (Object.prototype.hasOwnProperty.call(next, 'up')) up = next.up;
    if (Object.prototype.hasOwnProperty.call(next, 'down')) down = next.down;
    if (Object.prototype.hasOwnProperty.call(next, 'interval')) interval = next.interval;
    if (Object.prototype.hasOwnProperty.call(next, 'playFlag')) playFlag = next.playFlag;
    if (Object.prototype.hasOwnProperty.call(next, 'nowIndex')) nowIndex = next.nowIndex;
    if (Object.prototype.hasOwnProperty.call(next, 'saveTime')) saveTime = next.saveTime;
    if (Object.prototype.hasOwnProperty.call(next, 'flag')) flag = next.flag;
    if (Object.prototype.hasOwnProperty.call(next, 'colHZ')) colHZ = next.colHZ;
    if (Object.prototype.hasOwnProperty.call(next, 'collectOptions')) collectOptions = next.collectOptions;
    if (Object.prototype.hasOwnProperty.call(next, 'baudRate')) baudRate = next.baudRate;
    if (Object.prototype.hasOwnProperty.call(next, 'gauss')) gauss = next.gauss;
    if (Object.prototype.hasOwnProperty.call(next, 'smoothValue')) smoothValue = next.smoothValue;
  },
});

let localData = [],
  localDataBack = [],
  localDataHead = [],
  indexArr = [0, 0];
let up = 1245, down = 2
let pointArr1zero = []
let pointArr147zero = []
let pointArr147zero_2 = []
let pointArr2zero = []
let pointArr3zero = []
let pointArr4zero = []
let pointArr2RawZero = []

let pointArr1zeroData = []
let pointArr2zeroData = []
let pointArr3zeroData = []
let pointArr4zeroData = [], pointArr2RawZeroData = [], newArr147 = [], newArr147_2 = [];
let pointArr1RawZero = []
let pointArr1RawZeroData = []

server = new WebSocket.Server({ port: 19999 });
server1 = new WebSocket.Server({ port: 19998 });
server2 = new WebSocket.Server({ port: 19997 });

module.exports = {
  openServer() {
    if (serverOpened) {
      logger.info("[Server] openServer skipped: listeners already attached");
      return;
    }

    serverOpened = true;
    serverShutdownRequested = false;

    server1.on("open", function open() {
      logger.info("connected");
    });

    server1.on("close", function close() {
      logger.info("disconnected");
    });

    server2.on("connection", function connection(ws, req) {
      const ip = req.connection.remoteAddress;
      const port = req.connection.remotePort;
      const clientName = `${ip}${port}`;
      logger.info("%s is connected to head channel", clientName);
      wsSubscriptions.registerClient(ws, {
        channels: ['head'],
        clientId: clientName,
        scope: 'head',
      });
    });

    server1.on("connection", function connection(ws, req) {
      const ip = req.connection.remoteAddress;
      const port = req.connection.remotePort;
      const clientName = `${ip}${port}`;
      wsSubscriptions.registerClient(ws, {
        channels: ['back'],
        clientId: clientName,
        scope: 'back',
      });
      ws.on("message", function incoming(message) {
        logger.debug("received: %s from %s", message, clientName, localFlag);

        const getMessage = parseJsonMessage(message, { logger, clientName });
        if (!getMessage) return;
        wsCommandRouter.handle(getMessage, { clientName, scope: 'back' });

        /**
         * 鎵撳紑瀹炴椂闈犺儗鏁版嵁閫氶亾銆?
         */
        if (nowDate < endDate) {
          if (getMessage.backPort != null) {
            backClose = false
            com1 = getMessage.backPort;
            try {
              openBackSerialPort(getMessage.backPort, 'main backPort');
            } catch (e) {
              logger.warn(e, "e");
            }
          }

          if (getMessage.local === true) {
            // localFlag = true;
            // localData = []
            // localDataBack = []
            const jsonData = JSON.stringify({
              backData: new Array(backTotal).fill(0),
            });
            publishSystemEvent( jsonData);
          }
          if (getMessage.local === false) {
            localFlag = false;
            stopPlaybackTimer();
            const jsonData = JSON.stringify({
              backData: new Array(backTotal).fill(0),

            });
            publishSystemEvent( jsonData);
            if (com1) {
              try {
                openBackSerialPort(com1, 'server1 resume back');
              } catch (e) {
                logger.warn(e, "e");
              }
            }
          }

          /**
           * 鍏抽棴闈犺儗鏁版嵁閫氶亾銆?
           */
           if (getMessage.backClose === true) {
            backClose = true
            com1 = undefined; // 娓呴櫎 com1 闃叉鑷姩閲嶈繛
            closeManagedSerialPort(serialRoles.BACK, 'server1 manual close');
          }

          // if (getMessage.getTime != null) {
          //   getTime = getMessage.getTime;
          //   localFlag = true;
          //   const selectQuery = "select * from matrix WHERE date=?";
          //   const params = [getTime];

          //   db1.all(selectQuery, params, (err, rows) => {
          //     if (err) {
          //       logger.error(err);
          //     } else {
          //       localDataBack = rows;
          //     }
          //   });
          // }
        }
      });
    });

    server.on("open", function open() {
      logger.info("connected");
    });

    server.on("close", function close() {
      logger.info("disconnected");
    });

    server.on("connection", function connection(ws, req) {

      const ip = req.connection.remoteAddress;
      const port = req.connection.remotePort;
      const clientName = ip + port;
      logger.info("%s is connected", clientName);
      wsSubscriptions.registerClient(ws, {
        channels: [WILDCARD_CHANNEL],
        clientId: clientName,
        scope: 'main',
      });

      attachHeartbeat(ws, { clientName, logger, intervalMs: 30000 });

      publishSystemEvent({
          port: serialport,
          file: licenseFile || file,
          selectFlag: selectFlag
          // length: csvSitData.length,
          // sitData: csvSitData[0], backData: csvBackData[0]
        });

      if (endDate && endDate > 0) {
        publishSystemEvent({
            date: endDate,
            nowDate: nowDate,
            file: licenseFile || file,
            selectFlag: selectFlag
          });
      } else {
        // 娌℃湁鏈夋晥瀵嗛挜鏃讹紝鍙戦€侀敊璇俊鎭粰鍓嶇
        publishSystemEvent({ licenseError: '未检测到有效密钥，请输入密钥后使用', noLicense: true });
      }

      ws.on("message", function incoming(message) {


        const getMessage = parseJsonMessage(message, { logger, clientName });
        if (!getMessage) return;
        const commandResult = wsCommandRouter.handle(getMessage, { clientName, scope: 'main' });
        if (commandResult.stop) return;

        // if(getMessage.compen != null){
        //   compen = getMessage.compen
        // }

        if (getMessage.date != null) {
          try {
            const content = (getMessage.date.date)
            const date = content

            if (!date || date.trim() === '') {
              // 绌哄瘑閽ュ鐞嗭細鍙戦€侀敊璇彁绀虹粰鍓嶇
              logger.warn('[License] Empty license key received');
              publishSystemEvent({ licenseError: '密钥不能为空，请输入有效密钥' });
              return;
            }

            const dateRes = module2.decryptStr(date)

            if (!dateRes) {
              logger.warn('[License] Failed to decrypt license key');
              publishSystemEvent({ licenseError: '密钥无效，解密失败' });
              return;
            }

            fs.mkdirSync(path.dirname(writableNameTxt), { recursive: true });
            fs.writeFile(writableNameTxt, date, err => {
              if (err) {
                logger.error(err);
              }
            });
            nameTxt = writableNameTxt;

            const parsedLicense = JSON.parse(dateRes);
            licenseFile = parsedLicense.file || null;
            selectFlag = getSelectFlagFromLicense(parsedLicense.file);
            // 鏀寔 moduleConfig 瀛楁锛氬悇浼犳劅鍣ㄧ被鍨嬬殑榛樿鍔熻兘妯″潡閰嶇疆
            // { [sensorValue]: numMatrixFlag }
            const rawModuleConfig = parsedLicense.moduleConfig || null;
            const nextFile = getDefaultFileFromLicense(parsedLicense.file);
            if (nextFile) {
              file = nextFile;
              petCareRuntimeService.resetAll();
            }
            endDate = parseFloat(parsedLicense.date);

            baudRate = getSensorBaudRate(file);
            const payload = {
              date: endDate,
              nowDate: nowDate,
              file: licenseFile || file,
              selectFlag: selectFlag,
            };
            // 将功能模块配置一并下发给前端。
            if (rawModuleConfig) {
              payload.moduleConfig = rawModuleConfig;
            }
            publishSystemEvent(payload);

          } catch (err) {
            logger.error('[License] Invalid license key:', err.message);
            publishSystemEvent({ licenseError: '密钥无效，请检查后重新输入' });
          }
        }



        // if(new Date().getTime() >= parseInt(sysStartTime) + parseInt(module2.decryptStr(date)) * 24 * 60 * 60 * 1000){
        //   legacyClientBroadcast( {
        //     /**
        // 鍚戝墠绔箍鎾巿鏉冪姸鎬佹垨鎺堟潈閿欒銆?
        //      *  */
        //     const jsonData = JSON.stringify({
        //       timeExpires: true,
        //       // length: csvSitData.length,
        //       // sitData: csvSitData[0], backData: csvBackData[0]
        //     });
        //     if (client.readyState === WebSocket.OPEN) {
        //       client.send(jsonData);
        //     }
        //   });
        // }

        if (nowDate < endDate) {



          if (getMessage.variety != null) {
            if (indexArr) {
              if (localDataBack.length) {

                const startArr = JSON.parse(localDataBack[indexArr[0]].data);
                const endArr = JSON.parse(localDataBack[indexArr[1]].data);
                const newArr = startArr.map((a, index) => endArr[index] - a);
                const jsonData = JSON.stringify({
                  backData: newArr,
                });
                publishSystemEvent( jsonData);
              }
              if (localData.length) {

                const startArr = JSON.parse(localData[indexArr[0]].data);
                const endArr = JSON.parse(localData[indexArr[1]].data);
                const newArr = startArr.map((a, index) => endArr[index] - a);
                const jsonData = JSON.stringify({
                  sitData: newArr,
                });
                publishSystemEvent( jsonData);
              }
            }
          }

          // 淇濈暀鏃х増璋冭瘯鍒嗘敮銆?
          if (getMessage.resetZero === true) {
            if (pointArr) pointArr1zero = [...pointArr1zeroData]
            if (pointArr2) pointArr2zero = [...pointArr2zeroData]
            if (pointArr3) pointArr3zero = [...pointArr3zeroData]
            if (pointArr4) pointArr4zero = [...pointArr4zeroData]
            if (pointArr1RawZeroData.length) pointArr1RawZero = [...pointArr1RawZeroData]
            if (pointArr2RawZeroData.length) pointArr2RawZero = [...pointArr2RawZeroData]
            if (newArr147) pointArr147zero = [...newArr147]
            if (newArr147_2) pointArr147zero_2 = [...newArr147_2]

          }

          if (getMessage.resetZero === false) {
            pointArr1zero = []
            pointArr2zero = []
            pointArr3zero = []
            pointArr4zero = []
            pointArr1RawZero = []
            pointArr2RawZero = []
            pointArr147zero = []
            pointArr147zero_2 = []
          }

          if (getMessage.file != null) {
            backClose = true
            sitClose = true
            headClose = true
            sensorClose = true
            // 娓呴櫎 com 鍙橀噺锛岄槻姝㈣嚜鍔ㄩ噸杩炲畾鏃跺櫒鐢ㄦ棫鍊奸噸鏂版墦寮€涓插彛
            com = undefined;
            com1 = undefined;
            comhead = undefined;
            comSensor = undefined;
            if (port1?.isOpen) {
              closeManagedSerialPort(serialRoles.SIT, 'file switch');

              const jsonData = JSON.stringify({
                sitData:
                  file == "bigBed"
                    ? new Array(2048).fill(0)
                    : new Array(sitTotal).fill(0),
              });

              publishSystemEvent( jsonData);
            }
            if (port2?.isOpen) {
              closeManagedSerialPort(serialRoles.BACK, 'file switch');
              const jsonData = JSON.stringify({
                backData: new Array(backTotal).fill(0),
              });

              publishSystemEvent( jsonData);
            }

            if (portHead?.isOpen) {
              closeManagedSerialPort(serialRoles.HEAD, 'file switch');
              const jsonData = JSON.stringify({
                headData: new Array(100).fill(0),
              });

              publishSystemEvent( jsonData);
            }
            closeMinzhenSensorPort('file switch');
            const receiveFile = getMessage.file
            // db = new sqlite3.Database(`${filePath}/${receiveFile}.db`);
            file = receiveFile;
            petCareRuntimeService.resetAll();

            baudRate = getSensorBaudRate(receiveFile);

            const dbObj = initDb(file)
            db = dbObj.db
            db1 = dbObj.db1
            db2 = dbObj.db2

            // 鍒囨崲 file 鏃堕噸缃洖鏀剧姸鎬?
            stopPlaybackTimer();
            nowIndex = 0;
            localData = [];
            localDataBack = [];
            localDataHead = [];
            indexArr = [0, 0];

          }

          /**
           * 鎵撳紑鏈湴淇濆瓨鏁版嵁閫氶亾銆?
           */
          if (getMessage.getTime != null) {
            getTime = getMessage.getTime;
            localFlag = true;
            nowGetTime = getTime;
            loadSelectedHistory(getTime);
            return;

          }

          /**
           * 鎵撳紑瀹炴椂搴ф鏁版嵁閫氶亾銆?
           */
          if (getMessage.sitPort != null) {
            sitClose = false
            com = getMessage.sitPort;
            logger.debug(baudRate)
            try {
              openSitSerialPort(getMessage.sitPort, 'main sitPort');
            } catch (e) {
              logger.warn(e, "e");
            }
          }


          if (getMessage.headPort != null) {
            headClose = false
            comhead = getMessage.headPort;
            try {
              openHeadSerialPort(getMessage.headPort, 'main headPort');
            } catch (e) {
              logger.warn(e, "e");
            }
          }

          if (getMessage.sensorPort != null) {
            openMinzhenSensorPort(getMessage.sensorPort);
          }

          /**
           * 鎵撳紑瀹炴椂闈犺儗鏁版嵁閫氶亾銆?
           */
          if (getMessage.backPort != null) {
            backClose = false
            com1 = getMessage.backPort;
            try {
              openBackSerialPort(getMessage.backPort, 'main backPort');
            } catch (e) {
              logger.warn(e, "e");
            }
          }

          /**
           * 鍏抽棴搴ф鏁版嵁閫氶亾銆?
           */
          if (getMessage.sitClose === true) {
            sitClose = true
            com = undefined; // 娓呴櫎 com 闃叉鑷姩閲嶈繛
            closeManagedSerialPort(serialRoles.SIT, 'manual close');
          }

          /**
           * 鎺ㄩ€佸洖鏀惧抚缁欏墠绔€?
           */
          if (getMessage.backClose === true) {
            backClose = true
            com1 = undefined; // 娓呴櫎 com1 闃叉鑷姩閲嶈繛
            closeManagedSerialPort(serialRoles.BACK, 'manual close');
          }

          if (getMessage.headClose === true) {
            headClose = true
            comhead = undefined; // 娓呴櫎 comhead 闃叉鑷姩閲嶈繛
            closeManagedSerialPort(serialRoles.HEAD, 'manual close');
          }

          if (getMessage.sensorClose === true) {
            sensorClose = true
            comSensor = undefined;
            closeMinzhenSensorPort('manual close');
          }
          /**
           * 鎵撳紑璇诲彇鏈湴鏁版嵁閫氶亾銆?
           */
          if (getMessage.local === true) {
            localFlag = true;
            publishHistoryDateList();
          }
          if (getMessage.local === false) {
            localFlag = false;
            let jsonData;
            if (file === "bigBed") {
              jsonData = JSON.stringify({
                sitData: new Array(2048).fill(0),
                // backData: new Array(1024).fill(0)
              });
            } else {
              jsonData = JSON.stringify({
                sitData: new Array(sitTotal).fill(0),
                // backData: new Array(1024).fill(0)
              });
            }

            if (isCar(file)) {
              let jsonData1 = JSON.stringify({
                backData: new Array(sitTotal).fill(0),
                // backData: new Array(1024).fill(0)
              });
              publishSystemEvent(jsonData1);

              if (isThreePortFile(file)) {
                let jsonData2 = JSON.stringify({
                  headData: new Array(sitTotal).fill(0),
                  // backData: new Array(1024).fill(0)
                });
                publishSystemEvent(jsonData2);
              }
            }

            publishSystemEvent( jsonData);

          }
          if (localFlag) {
            if (getMessage.value != null) {
              const value = Number(getMessage.value);
              logger.debug('received playback index %s from %s', value, clientName);
              nowIndex = value;
              publishPlaybackFrame(value, { includeIndex: false });
            }
          }
          // 娴溿倖宕叉稉鎻掑經
          if (getMessage.exchange != null) {
            [com, com1] = [com1, com];
            closeManagedSerialPort(serialRoles.SIT, 'exchange');
            closeManagedSerialPort(serialRoles.BACK, 'exchange');

            setTimeout(() => {
              if (com) {
                try {
                  openSitSerialPort(com, 'exchange sit');
                } catch (e) {
                  logger.warn(e, "e");
                }
              }

              if (com1) {
                try {
                  openBackSerialPort(com1, 'exchange back');
                } catch (e) {
                  logger.warn(e, "e");
                }
              }
            }, 1000);
          }

          if (getMessage.backIndex != null) {
            let press = [],
              area = [];
            if (localDataBack.length) {
              const backArr = getMessage.backIndex;
              (backPressSelect = []), (backAreaSelect = []);
              for (let i = 0; i < localDataBack.length; i++) {
                newback = [];
                // for (let x = backArr[2] < 0 ? 0 :backArr[2] ; x < backArr[3]; x++) {
                //   for (let y = backArr[0] < 0 ? 0 :backArr[0] ; y < backArr[1]; y++) {
                //     newback.push(JSON.parse(localDataBack[i].data)[x * 32 + y])
                //   }
                // }

                for (
                  let x = backArr[0] < 0 ? 0 : backArr[0];
                  x <= (backArr[1] > 31 ? 31 : backArr[1]);
                  x++
                ) {
                  for (
                    let y = 31 - backArr[3] < 0 ? 0 : 31 - backArr[3];
                    y <= (31 - backArr[2] > 31 ? 31 : 31 - backArr[2]);
                    y++
                  ) {
                    newback.push(JSON.parse(localDataBack[i].data)[x * 32 + y]);
                  }
                }
                // newback = newback.filter((a))
                let a = newback.reduce((a, b) => a + b, 0);
                let b = newback.filter((a) => a > 10).length;

                // backPressSelect.push(pressToN(b, a ));
                // backAreaSelect.push(b*2.1);

                backPressSelect.push(totalToN(a, 1.3));
                backAreaSelect.push(b);
              }


              publishSystemEvent({
                  pressArr: backPressSelect,
                  areaArr: backAreaSelect,
                  length: length,
                  time: timeStamp,
                  index: nowIndex,
                  // backData: file === 'car10' ? new Array(100).fill(0) : new Array(1024).fill(0),
                });
            }
          }

          if (getMessage.sitIndex != null) {

            const sitArr = getMessage.sitIndex;
            (sitPressSelect = []), (sitAreaSelect = []);
            for (let i = 0; i < localData.length; i++) {
              const newsit = [];
              // for (let x = sitArr[2]; x < sitArr[3]; x++) {
              //   for (let y = sitArr[0]; y < sitArr[1]; y++) {
              //     newsit.push(JSON.parse(localData[i].data)[x * 32 + y])
              //   }
              // }
              if (isSmallBedMatrixType(file) || file === SMALL_BED_12B_TYPE || file === TEMP_FULL_BED_TYPE) {
                const storedSitData = file === TEMP_FULL_BED_TYPE
                  ? buildTempFullBedPlaybackPayload(localData[i]).sitData
                  : file === SMALL_BED_12B_TYPE
                    ? normalizeHistoryPressureData(localData[i], file)
                    : getStoredSitData(localData[i]);
                const storedFrame = parseStoredFrameData(localData[i]);
                const storedWidth = file === TEMP_FULL_BED_TYPE ? 15 : Number(storedFrame?.matrixWidth) || 32;
                for (let x = sitArr[0]; x < sitArr[1]; x++) {
                  for (let y = sitArr[2]; y < sitArr[3]; y++) {
                    newsit.push(storedSitData[x * storedWidth + y]);
                  }
                }
              } else {
                let data = JSON.parse(localData[i].data)
                // data = pressSmallBed({arr : data ,width : 32 ,height : 32 , type})
                for (let x = sitArr[2]; x < sitArr[3]; x++) {
                  for (let y = sitArr[0]; y < sitArr[1]; y++) {
                    newsit.push(JSON.parse(localData[i].data)[x * 32 + y]);
                  }
                }

              }

              let a = newsit.reduce((a, b) => a + b, 0);
              let b = newsit.filter((a) => a > 10).length;
              // sitPressSelect.push(pressToN(b, a));
              // sitAreaSelect.push(b * 2.1);
              sitPressSelect.push(formatMatrixTotalForFile(a, file));
              sitAreaSelect.push(b);
            }

            publishSystemEvent({
                length: length,
                time: timeStamp,
                index: nowIndex,
                pressArr: sitPressSelect,
                areaArr: sitAreaSelect,
                // length: csvSitData.length,
                // sitData: file === 'bigBed' ? new Array(2048).fill(0) : new Array(1024).fill(0),
              });
          }

          // 娑撳娴嘽sv
          // 璋冩暣楂樻柉婊ゆ尝鍙傛暟銆?
          // 鎵撳紑鍘嬪姏鏁版嵁鎺ㄩ€侀€氶亾銆?
          if (getMessage.serialReset != null) {
// ===== 鍚姩鏃朵覆鍙ｆ灇涓?=====
// serialport 缂撳瓨鍚姩鏃跺彲瑙佽澶囧垪琛紝骞跺湪鍓嶇杩炴帴鍚庣敤浜庝覆鍙ｉ€夋嫨鍜岃皟璇曡緭鍑恒€?
listPorts().then((ports) => {
              serialport = getPort(ports)//ports; //.filter((a,index) => a.manufacturer === 'wch.cn');
              logSerialPortList('serialReset', serialport);

              publishSystemEvent({
                  port: serialport,
                  // length: csvSitData.length,
                  // sitData: csvSitData[0], backData: csvBackData[0]
                });
            }).catch((err) => {
              logger.error('[SerialList] serialReset failed', err);
            });
          }

          if (getMessage.autoConnectHand0205Double === true) {
            listPorts().then((ports) => {
              serialport = getPort(ports);
              logSerialPortList('autoConnectHand0205Double', serialport);
              const paths = serialport.map((port) => port.path).filter(Boolean);

              if (paths.length < 2) {
                const jsonData = JSON.stringify({
                  port: serialport,
                  autoConnectHand0205Double: {
                    success: false,
                    message: `触觉手套2 自动连接失败：只检测到 ${paths.length} 个可用手套串口`,
                  },
                });
                publishSystemEvent( jsonData);
                return;
              }

              const [leftPath, rightPath] = paths;
              sitClose = false;
              backClose = false;
              com = leftPath;
              com1 = rightPath;
              baudRate = getSensorBaudRate(HAND_GLOVE_DOUBLE);

              closeManagedSerialPort(serialRoles.SIT, 'autoConnectHand0205Double');
              closeManagedSerialPort(serialRoles.BACK, 'autoConnectHand0205Double');

              try {
                openSitSerialPort(leftPath, 'autoConnectHand0205Double sit');
                openBackSerialPort(rightPath, 'autoConnectHand0205Double back');

                const jsonData = JSON.stringify({
                  port: serialport,
                  autoConnectHand0205Double: {
                    success: true,
                    portname: leftPath,
                    portnameBack: rightPath,
                    message: `触觉手套2 已连接：${leftPath} / ${rightPath}`,
                  },
                });
                publishSystemEvent( jsonData);
              } catch (err) {
                logger.warn('[autoConnectHand0205Double] open failed', err);
                const jsonData = JSON.stringify({
                  port: serialport,
                  autoConnectHand0205Double: {
                    success: false,
                    message: err?.message || '触觉手套2 自动连接失败',
                  },
                });
                publishSystemEvent( jsonData);
              }
            }).catch((err) => {
              logger.error('[SerialList] autoConnectHand0205Double failed', err);
              const jsonData = JSON.stringify({
                autoConnectHand0205Double: {
                  success: false,
                  message: err?.message || '瑙﹁鎵嬪2 鑷姩杩炴帴澶辫触',
                },
              });
              publishSystemEvent( jsonData);
            });
          }

          // 闁告ê妫楄ぐ?
          if (getMessage.indexArr != null) {

            historyArr = getMessage.indexArr;
            const historySeries = getHistorySeries({
              sitRows: localData,
              backRows: localDataBack,
              start: getMessage.indexArr[0],
              end: getMessage.indexArr[1],
              file,
            });
            const press = historySeries.press;
            const area = historySeries.area;

            publishSystemEvent({
                pressArr: press,
                areaArr: area,
                // length: csvSitData.length,
                // sitData: csvSitData[0], backData: csvBackData[0]
              });

            indexArr = getMessage.indexArr;
            // localData
            // localDataBack
          }
        }
      });
    })
  }
}

listPorts().then((ports) => {
  serialport = getPort(ports)//ports; //.filter((a,index) => a.manufacturer === 'wch.cn');
  logSerialPortList('startup', serialport);
}).catch((err) => {
  logger.error('[SerialList] startup failed', err);
});
// ===== 瀹炴椂鍗忚涓存椂甯х紦瀛?=====
// pointArr/newData 鏄綋鍓嶈В鏋愬抚锛沠irstBlueData/lastBlueData 鐢ㄤ簬 130+146 鍒嗗寘鍗忚鎷兼帴瀹屾暣鍘嬪姏甯с€?
let pointArr, newData, firstBlueData = [], lastBlueData = [], firstBlueData1 = [], lastBlueData1 = [];
let index = 0
function handleHandGloveFullPacket(buffer, fallbackSide) {
  const packet = parseHandGloveFullPacket(buffer, fallbackSide);
  const realArr = [...packet.pressureData];
  let newArr = [...packet.mappedData];
  const outputSide = fallbackSide === 'right' ? 'right' : 'left';

  if (outputSide === 'right') {
    pointArr2 = [...packet.pressureData];
    pointArr2zeroData = [...pointArr2];
    pointArr2RawZeroData = [...pointArr2];
    newArr147_2 = [...newArr];

    if (pointArr2zero.length) {
      pointArr2 = pointArr2.map((a, index) => numLessZeroToZero(a - pointArr2zero[index]));
    }

    if (pointArr147zero_2.length) {
      newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero_2[index]));
    }

    const renderData = mapHandGloveFullPacketModelMatrix(newArr);

    colOrSendData1(JSON.stringify({
      backData: renderData,
      realArr,
      rawPressureData: pointArr2,
      newArr147: newArr,
      mappedArr195: newArr,
      frameIndex: packet.frameIndex,
      packetType: packet.packetType,
      handSide: packet.side,
      outputSide,
      sitFlag: port1?.isOpen,
      backFlag: port2?.isOpen,
    }));
    return;
  }

  pointArr = [...packet.pressureData];
  pointArr1zeroData = [...pointArr];
  pointArr1RawZeroData = [...pointArr];
  newArr147 = [...newArr];

  if (pointArr1zero.length) {
    pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]));
  }

  if (pointArr147zero.length) {
    newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero[index]));
  }

  const renderData = mapHandGloveFullPacketModelMatrix(newArr);

  colOrSendData(JSON.stringify({
    sitData: renderData,
    realArr,
    rawPressureData: pointArr,
    newArr147: newArr,
    mappedArr195: newArr,
    frameIndex: packet.frameIndex,
    packetType: packet.packetType,
    handSide: packet.side,
    outputSide,
    sitFlag: port1?.isOpen,
    backFlag: port2?.isOpen,
  }));
}

// ===== 鍙屾墜濂楀垎鍖呰矾鐢辩姸鎬?=====
// 触觉手套2的 130/146 字节分包协议由传感器模块负责解析，server.js 只处理清零、入库和通道发送。
const handGloveDoublePacketParser = handGloveDouble.createHandGloveDoublePacketParser();

function routeHandGloveDoubleFrame({ pressureData, imuBytes = [], outputSide = 'left', sourcePort = 'sit' }) {
  const realPressureData = normalizeFiniteFrame(pressureData, 256);
  const rotate = bytes4ToInt10(imuBytes);
  const isRight = outputSide === 'right';

  if (isRight) {
    pointArr2 = [...realPressureData];
    pointArr2RawZeroData = [...realPressureData];
    const rawPressureData = pointArr2RawZero.length
      ? realPressureData.map((value, index) => numLessZeroToZero(value - (pointArr2RawZero[index] || 0)))
      : [...realPressureData];
    let mappedData = handR([...realPressureData]);
    pointArr2 = handRVideo1470506([...realPressureData]);
    newArr147_2 = [...mappedData];
    pointArr2zeroData = [...pointArr2];

    if (pointArr2zero.length) {
      pointArr2 = pointArr2.map((value, index) => numLessZeroToZero(value - (pointArr2zero[index] || 0)));
    }
    if (pointArr147zero_2.length) {
      mappedData = mappedData.map((value, index) => numLessZeroToZero(value - (pointArr147zero_2[index] || 0)));
    }

    const payload = {
      backData: pointArr2,
      realArr: realPressureData,
      rawPressureData,
      newArr147: mappedData,
      handSide: 'right',
      packetSourcePort: sourcePort,
      sitFlag: port1?.isOpen,
      backFlag: port2?.isOpen,
    };
    if (rotate.length && !rotate.every((value) => value == 0)) {
      payload.rotate = rotate;
    }
    colOrSendData1(JSON.stringify(payload));
    return;
  }

  pointArr = [...realPressureData];
  pointArr1RawZeroData = [...realPressureData];
  const rawPressureData = pointArr1RawZero.length
    ? realPressureData.map((value, index) => numLessZeroToZero(value - (pointArr1RawZero[index] || 0)))
    : [...realPressureData];
  let mappedData = handL([...realPressureData]);
  newArr147 = [...mappedData];
  pointArr1zeroData = [...pointArr];

  if (pointArr1zero.length) {
    pointArr = pointArr.map((value, index) => numLessZeroToZero(value - (pointArr1zero[index] || 0)));
  }
  if (pointArr147zero.length) {
    mappedData = mappedData.map((value, index) => numLessZeroToZero(value - (pointArr147zero[index] || 0)));
  }

  const payload = {
    sitData: pointArr,
    realArr: realPressureData,
    rawPressureData,
    newArr147: mappedData,
    handSide: 'left',
    packetSourcePort: sourcePort,
    sitFlag: port1?.isOpen,
    backFlag: port2?.isOpen,
  };
  if (rotate.length && !rotate.every((value) => value == 0)) {
    payload.rotate = rotate;
  }
  colOrSendData(JSON.stringify(payload));
}

function handleHandGloveDoublePacket(buffer, fallbackSide, sourcePort) {
  if (file !== HAND_GLOVE_DOUBLE) return false;

  const frame = handGloveDoublePacketParser.handlePacket(buffer, fallbackSide, sourcePort);
  if (!frame) return false;
  if (!frame.complete) return true;

  routeHandGloveDoubleFrame({
    pressureData: frame.pressureData,
    imuBytes: frame.imuBytes,
    outputSide: frame.side,
    sourcePort: frame.sourcePort,
  });
  return true;
}

serialParserManager.onData(serialParserManager.channels.SIT, function (data) {
  pointArr = new Array();
  let buffer = Buffer.from(data);
  newData = new Array();
  // console.log(buffer.length)
  if (nowDate < endDate) {
    if (file === HAND_GLOVE_FULL_PACKET && buffer.length === HAND_GLOVE_FULL_PACKET_LENGTH) {
      handleHandGloveFullPacket(buffer, 'left');
      return;
    }

    if (buffer.length === 1024) {
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }

      let newArr, realArr

      if (file === "car10") {
        pointArr = car10Sit(pointArr);
      }
      else if (file === "car" || file === "foot") {
        pointArr = carSitLine(pointArr);
      }
      else if (file === "sit10") {
        pointArr = sit10Line(pointArr);
      }
      else if (isSmallBedMatrixType(file)) {
        // newArr = smallBed([...pointArr]);
        // realArr = smallBed([...pointArr]);
        pointArr = jqbed(pointArr)
        // newArr = [...pointArr]
        // realArr = [...pointArr]
      } else if (file === "smallBed1") {
        // newArr = smallBed1([...pointArr]);
        // realArr = smallBed1([...pointArr]);
        // newArr = [...pointArr]
        // realArr = [...pointArr]
        pointArr = smallBed1(pointArr)
      }
      else if (file === 'smallM') {
        pointArr = smallM1(pointArr)
      } else if (file === 'rect') {
        pointArr = rect(pointArr)
      } else if (file === 'short') {
        pointArr = short(pointArr)
      } else if (file === 'hand') {
        // pointArr = handLine(pointArr)
        // 625
        pointArr = jqbed(pointArr)
        newData = [...pointArr]
      } else if (file === HAND_SINGLE_POINT_TYPE) {
        pointArr = handSinglePoint(pointArr)
        newData = [...pointArr]
      } else if (file === MINZHEN_TYPE) {
        pointArr = jqbed(pointArr)
        maskMinzhenMatrixValues(pointArr)
        newData = [...pointArr]
      } else if (petCareRuntimeService.isPetCareSystem(file)) {
        pointArr = jqbed(pointArr)
        newData = [...pointArr]
        // pointArr = press6sit(pointArr, 32, 32, 'col')
        // pointArr = zeroLine(pointArr)
      } else if (file === 'sit') {
        // pointArr = handLine(pointArr)
        // 625
        pointArr = jqbed(pointArr)
        for (let i = 0; i < 32; i++) {
          for (let j = 0; j < 16; j++) {
            [pointArr[i * 32 + j], pointArr[i * 32 + 31 - j]] = [pointArr[i * 32 + 31 - j], pointArr[i * 32 + j],]
          }
        }
        newData = [...pointArr]
        pointArr = press6sit(pointArr, 32, 32, 'col')
        // pointArr = zeroLine(pointArr)
      } else if (file === 'matCol') {
        pointArr = matColLine(pointArr)
      } else if (file === 'sitCol') {
        // pointArr = handLine(pointArr)
        pointArr = handBlue(pointArr)
      } else if (file === 'yanfeng10') {
        pointArr = yanfeng10sit(pointArr)
      } else if (file === 'handBlue') {
        pointArr = handBlue(pointArr)
      } else if (file === 'volvo') {
        pointArr = wowSitLine(pointArr)
      } else if (file === WHOLE_CHAIR_TYPE) {
        pointArr = normalizeWholeChairFrame('sit', pointArr)
      } else if (file === 'xiyueReal1') {
        pointArr = xiyueReal1(pointArr)
      } else if (file === 'jqbed') {
        pointArr = jqbed(pointArr)
      } else if (file === 'tempFullBed') {
        const tempFullBedFrame = tempFullBed(pointArr)
        pointArr = tempFullBedFrame.sitData
        newData = tempFullBedFrame
      } else if (file === 'carCol') {
        pointArr = carCol(pointArr)
      } else if (file === 'newHand') {
        pointArr = jqbed(pointArr)
        for (let i = 0; i < 32; i++) {
          for (let j = 0; j < 16; j++) {
            [pointArr[i * 32 + j], pointArr[i * 32 + 31 - j]] = [pointArr[i * 32 + 31 - j], pointArr[i * 32 + j]]
          }
        }
        pointArr = newHand(pointArr)
      } else if (file == 'gloves') {
        pointArr = gloves(pointArr)
      } else if (file == 'gloves1') {
        pointArr = gloves1(pointArr)
      } else if (file == 'gloves2') {
        pointArr = gloves2(pointArr)
      } else if (file == 'sit100') {
        pointArr = pressNew1220({ arr: pointArr, width: 32, height: 32, type: 'col', value: 4096 / 6 })
        pointArr = sit100Line(pointArr)
      } else if (file == 'fast1024sit') {
        pointArr = endiSit1024(pointArr)
      } else if (file == 'fast1024') {
        // pointArr = jqbed(pointArr)
        // console.log('fast1024')
        // console.log(Math.max(...pointArr))
        // pointArr = pressNew1220({ arr: pointArr, height: 32, width: 32, type: 'col', value: 1024 })
        // pointArr = gaussBlur_return(pointArr , 32,32, 0.5)
      } else if (file == 'normalFast') {
        pointArr = pressNew12203131({ arr: pointArr, height: 32, width: 32, type: 'col', value: 1024 })
        // console.log('pressNew12203131')
        // 32*32楂橀€熸祴璇曪紝涓?fast1024 閫昏緫涓€鑷达紝涓嶅仛浠讳綍绾垮簭鍙樻崲
      } else if (file == 'sofa') {
        pointArr = arrToRealLine(pointArr, [[7, 0], [8, 15]], [[0, 15]], 32)
       } else if (file == 'carY') {
        pointArr = carYLine(pointArr)
      } else if (file == 'humanBody') {
        // 浜轰綋鍏ㄨ韩锛氱洿鎺ラ€忎紶 1024 瀛楄妭鍘熷鏁版嵁锛屼笉鍋氱嚎搴忓彉鎹?
      }
      pointArr1zeroData = [...pointArr]


      if (pointArr1zero.length) {
        pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      }

      // jqbed 璋冭瘯妯″紡锛歶seMatrixOrigin=true 鏃朵娇鐢ㄧ畻娉曡繑鍥炵殑 matrix_origin 浣滀负 sitData銆?
      const sitDataToSend = (useMatrixOrigin && file === 'jqbed' && jqbedMatrixOrigin) ? jqbedMatrixOrigin : pointArr;

      let jsonData;

      if (file === 'tempFullBed') {
        jsonData = JSON.stringify({
          sitData: pointArr,
          rawSitData: newData.rawSitData,
          matrixWidth: newData.matrixWidth,
          matrixHeight: newData.matrixHeight,
          matrixOrientation: newData.matrixOrientation,
          realArr: newData.realArr,
          pressureThreshold: newData.pressureThreshold,
          temperatureRawData: newData.temperatureRawData,
          temperatureData: newData.temperatureData,
          temperatureAvg: newData.temperatureAvg,
          temperatureK: newData.temperatureK,
          hz: colHZ,
        });
      } else if (isCar(file)) {
        jsonData = JSON.stringify({
          sitData: sitDataToSend,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
          hz: colHZ
        });
      } else {
        jsonData = JSON.stringify({
          sitData: isSmallBedMatrixType(file) || file == 'smallBed1' ? pointArr : sitDataToSend,
          hz: colHZ,
        });
      }


      // console.log(JSON.stringify(pointArr))
      // if (flag) {
      //   const resDataArr = {
      //     data: JSON.stringify(pointArr),

      //     time: new Date().getTime(),
      //   };

      //   // 1.0
      //   // csvWriter.writeRecords([resDataArr]);

      //   // 2.0
      //   // const matrix = '[1,2,3,4,54,56,6,3,2,3,]';
      // 淇濆瓨褰撳墠鏃堕棿鎴炽€?
      //   const date = saveTime;
      //   const insertQuery =
      //     "INSERT INTO matrix (data, timestamp,date) VALUES (?, ?,?)";

      //   console.log(db,)

      //   db.run(
      //     insertQuery,
      //     // [file == 'smallBed' ? JSON.stringify(realArr) : JSON.stringify(pointArr), timestamp, date],
      //     [JSON.stringify(pointArr), timestamp, date],
      //     function (err) {
      //       if (err) {
      //         logger.error(err);
      //         return;
      //       }
      //       console.log(`Event inserted with ID ${this.lastID}`);
      //     }
      //   );
      // }

      // if (!localFlag) {
      //   let jsonData;

      //   if (isCar(file)) {
      //     jsonData = JSON.stringify({
      //       sitData: pointArr,
      //       newData: (newData),
      //       sitFlag: port1?.isOpen,
      //       backFlag: port2?.isOpen,
      //     });
      //   } else {
      //     // jsonData = JSON.stringify({ sitData: file == 'smallBed' || file == 'smallBed1' ? newArr : pointArr, newData: (newData), });

      //     jsonData = JSON.stringify({ sitData: pointArr, newData: (newData), });
      //   }

      //   legacyClientBroadcast( {
      //     if (client.readyState === WebSocket.OPEN) {
      //       client.send(jsonData);
      //     }
      //   });
      // }
      colOrSendData(jsonData)

    }

    if (buffer.length == 72 || buffer.length == 144) {
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }

      pointArr1zeroData = [...pointArr]


      if (pointArr1zero.length) {
        pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      }

      let jsonData;

      if (isCar(file)) {
        jsonData = JSON.stringify({
          sitData: pointArr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
          hz: colHZ
        });
      } else {
        jsonData = JSON.stringify({ sitData: isSmallBedMatrixType(file) || file == 'smallBed1' ? newArr : pointArr, hz: colHZ });
      }
      colOrSendData(jsonData)
    }

    if (buffer.length == 144) {

    }

    if (buffer.length == 262) {
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      const length = pointArr.length
      const rotate = pointArr.splice(length - 6, length)
      // console.log(pointArr.length , rotate)
      pointArr = gloves0123Res(pointArr)
      pointArr = gloves0123(pointArr)
      const jsonData = JSON.stringify({
        sitData: pointArr,
        rotate: rotate,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      });
      publishSystemEvent( jsonData);
    }

    if (buffer.length == 130) {
      if (handleHandGloveDoublePacket(buffer, 'left', 'sit')) {
        return;
      }

      let firstArr = new Array();
      const length = buffer.length

      for (var i = 0; i < buffer.length; i++) {
        firstArr[i] = buffer.readUInt8(i);
      }

      const order = firstArr[0]
      const type = firstArr[1]
      let newArr

      firstArr = firstArr.splice(2, length)

      // if (order == 1) {
      firstBlueData = [...firstArr]
      // } else {
      //   lastBlueData = [...firstArr]

      //   pointArr = [...firstBlueData, ...lastBlueData]
      //   const realArr = [...pointArr]
      //   // pointArr = footVideo(pointArr)
      //   newArr = handVideoRealPoint_0506_3([...pointArr])
      //   console.log('handVideo147(pointArr)')
      //   // newArr = handVideoRealPoint([...pointArr])
      //   // newArr = handVideo1470506([...pointArr])
      //   // newArr = handVideoRealPoint_0416_3([...newArr])
      //   // newArr = [...pointArr]
      //   if (file == 'handVideo1') {
      //     pointArr = handVideo1_0416_0506(pointArr)
      //   } else {
      //     pointArr = handVideo1470506(pointArr)
      //   }


      //   // realArr = handVideoRealPoint_0506_3([...pointArr])
      //   if (pointArr1zero.length) {
      //     pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      //   }

      //   let jsonData
      //   if (rotate.every((a) => a == 0)) {
      //     jsonData = JSON.stringify({
      //       rotate: rotate,
      //       sitData: pointArr,
      //       realArr,
      //       newArr147: newArr,
      //       sitFlag: port1?.isOpen,
      //       backFlag: port2?.isOpen,
      //     });
      //   } else {
      //     jsonData = JSON.stringify({
      //       rotate: rotate,
      //       sitData: pointArr,
      //       realArr,
      //       newArr147: newArr,
      //       sitFlag: port1?.isOpen,
      //       backFlag: port2?.isOpen,
      //     });
      //   }
      //   // const jsonData = JSON.stringify({
      //   //   rotate: rotate,
      //   //   sitData: pointArr,
      //   //   realArr,
      //   //   newArr147: newArr,
      //   //   sitFlag: port1?.isOpen,
      //   //   backFlag: port2?.isOpen,
      //   // });
      //   // legacyClientBroadcast( {
      //   //   if (client.readyState === WebSocket.OPEN) {
      //   //     client.send(jsonData);
      //   //   }
      //   // });


      //   colOrSendData(jsonData, [])
      // }



    }

    if (buffer.length == 146) {
      if (handleHandGloveDoublePacket(buffer, 'left', 'sit')) {
        return;
      }

      // console.log(file)
      pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      let length = pointArr.length
      pointArr = pointArr.splice(2, length)
      length = pointArr.length
      const arr = pointArr.splice(length - 16, length)
      // dataItem.next = pointArr
      lastBlueData = [...pointArr]

      pointArr = [...firstBlueData, ...lastBlueData]
      const realArr = [...pointArr]
      pointArr1RawZeroData = [...realArr]
      const rawPressureData = pointArr1RawZero.length
        ? realArr.map((a, index) => numLessZeroToZero(a - (pointArr1RawZero[index] || 0)))
        : [...realArr]
      let newArr = []


      // newArr = handVideoRealPoint([...pointArr])
      // newArr = handVideo1470506([...pointArr])
      // newArr = handVideoRealPoint_0416_3([...newArr])
      // newArr = [...pointArr]
      if (file == 'handVideo1') {
        newArr = handVideoRealPoint_0506_3([...pointArr])
        pointArr = handVideo1_0416_0506(pointArr)
      } else if (file == 'footVideo') {
        // pointArr = new Array(256).fill(50)
        newArr = footL(pointArr)
        pointArr = footVideo(pointArr)

      } else if (file.includes('robot')) {

        // pointArr = press6(pointArr, 16, 16, 'col', 116, 1)
        newArr = [...pointArr]
        // pointArr = robot0401(pointArr)



        // if (pointArr1zero.length) {
        //   pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
        // }
      } else if (file == 'smallSample') {
        // 瑙﹁鎵嬪鏁版嵁杞崲锛氬皢浼犳劅鍣ㄧ紪鍙锋槧灏勫埌 16x16 鍘嬪姏鐭╅樀銆?
        // Excel 琛屽垪浣嶇疆鎸?16x16 缃戞牸鎹㈢畻鍒?256 瀛楄妭绱㈠紩銆?
        // 浼犳劅鍣ㄧ紪鍙峰湪 Excel 涓殑浣嶇疆(row,col) -> 256 瀛楄妭绱㈠紩 = row * 16 + col銆?
        // 浼犳劅鍣ㄧ紪鍙峰埌 256 瀛楄妭绱㈠紩鐨勬槧灏勩€?
        const sensorToByteIndex = [
          223, 222, 221, 220, 219, 218, 217, 216, 215, 214,  // 濞磋偐濮甸崝鍛村闯?-10   (閻?3, 闁?5闁?6)
          239, 238, 237, 236, 235, 234, 233, 232, 231, 230,  // 濞磋偐濮甸崝鍛村闯?1-20  (閻?4, 闁?5闁?6)
          255, 254, 253, 252, 251, 250, 249, 248, 247, 246,  // 濞磋偐濮甸崝鍛村闯?1-30  (閻?5, 闁?5闁?6)
          15, 14, 13, 12, 11, 10, 9, 8, 7, 6,                // 濞磋偐濮甸崝鍛村闯?1-40  (閻?,  闁?5闁?6)
          31, 30, 29, 28, 27, 26, 25, 24, 23, 22,            // 濞磋偐濮甸崝鍛村闯?1-50  (閻?,  闁?5闁?6)
          207, 206, 205, 204, 203, 202, 201, 200, 199, 198,  // 濞磋偐濮甸崝鍛村闯?1-60  (閻?2, 闁?5闁?6)
          191, 190, 189, 188, 187, 186, 185, 184, 183, 182,  // 濞磋偐濮甸崝鍛村闯?1-70  (閻?1, 闁?5闁?6)
          175, 174, 173, 172, 171, 170, 169, 168, 167, 166,  // 濞磋偐濮甸崝鍛村闯?1-80  (閻?0, 闁?5闁?6)
          159, 158, 157, 156, 155, 154, 153, 152, 151, 150,  // 濞磋偐濮甸崝鍛村闯?1-90  (閻?,  闁?5闁?6)
          143, 142, 141, 140, 139, 138, 137, 136, 135, 134,  // 濞磋偐濮甸崝鍛村闯?1-100 (閻?,  闁?5闁?6)
        ]
        const mappedArr = []
        for (let i = 0; i < 100; i++) {
          mappedArr.push(pointArr[sensorToByteIndex[i]] || 0)
        }
        pointArr = mappedArr
        newArr = [...mappedArr]
      } else if (file == 'hand0507' || isHandGloveType(file) || file == 'Num3D') {
        // left
        // newArr = handVideoRealPoint_0506_3([...pointArr])
        newArr = handL([...pointArr])

        // pointArr = handVideo1470506(pointArr)

        // 
      } else if (file == 'eye') {
        function leftEye(wsPointData) {

          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 16; j++) {
              [wsPointData[(7 - i) * 16 + j], wsPointData[(i) * 16 + j]] = [wsPointData[(i) * 16 + j], wsPointData[(7 - i) * 16 + j],]
            }
          }

          for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 16; j++) {
              [wsPointData[(8 + 7 - i) * 16 + j], wsPointData[(8 + i) * 16 + j]] = [wsPointData[(8 + i) * 16 + j], wsPointData[(8 + 7 - i) * 16 + j],]
            }
          }

          const arr = [8, 7, 6, 5, 4, 3, 2, 1, 9, 10, 11, 12, 13, 14, 15, 0]
          const newArr = []
          for (let j = 0; j < 16; j++) {
            for (let i = 0; i < arr.length; i++) {

              newArr.push(wsPointData[j * 16 + arr[i]])
            }
          }
          return newArr



        }
        newArr = leftEye([...pointArr])
        pointArr = [...newArr]
      }
      newArr147 = [...newArr]
      pointArr1zeroData = [...pointArr]
      // newArr = handVideoRealPoint([...pointArr])

      // pointArr = handVideo147(pointArr)




      // stamp = new Date().getTime()
      const rotate = bytes4ToInt10(arr)



      // pointArr = footVideo(pointArr)
      if (pointArr1zero.length) {
        pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      }

      if (pointArr147zero.length) {
        newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero[index]))
      }

      let jsonDataObj = {
        sitData: pointArr,
        realArr,
        rawPressureData,
        newArr147: newArr,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      }

      // console.log(JSON.stringify([pointArr[1] , pointArr[2] , pointArr[3]]))

      if (!rotate.every((a) => a == 0)) {
        jsonDataObj.rotate = rotate
      }

      if (newArr.length) {
        jsonDataObj.newArr147 = newArr
      }

      let jsonData = JSON.stringify(jsonDataObj);
      // if (rotate.every((a) => a == 0)) {
      //   jsonData = JSON.stringify({
      //     // rotate: rotate,
      //     sitData: pointArr,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // } else {
      //   jsonData = JSON.stringify({
      //     rotate: rotate,
      //     sitData: pointArr,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // }

      // const jsonData = JSON.stringify({
      //   rotate: rotate,
      //   sitData: pointArr,
      //   realArr,
      //   newArr147: newArr,
      //   sitFlag: port1?.isOpen,
      //   backFlag: port2?.isOpen,
      // });
      // legacyClientBroadcast( {
      //   if (client.readyState === WebSocket.OPEN) {
      //     client.send(jsonData);
      //   }
      // });
      // console.log(jsonDataObj.sitData , jsonData)
      colOrSendData(jsonData, [])
    }

    if (buffer.length == 142) {
      let firstArr = new Array();
      const length = buffer.length

      for (var i = 0; i < buffer.length; i++) {
        firstArr[i] = buffer.readUInt8(i);
      }

      const order = firstArr[0]
      const type = firstArr[1]
      let newArr

      firstArr = firstArr.splice(2, length)

      firstBlueData = [...firstArr]


    }

    if (buffer.length == 158) {

      // console.log(file)
      pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      let length = pointArr.length
      pointArr = pointArr.splice(2, length)
      length = pointArr.length
      const arr = pointArr.splice(length - 16, length)
      // dataItem.next = pointArr
      lastBlueData = [...pointArr]

      pointArr = [...firstBlueData, ...lastBlueData]

      // for(let i = 0 ; i < 280 ; i++){
      //   pointArr[i] = i
      // }

      const realArr = [...pointArr]
      let newArr = []


      if (file == 'daliegu') {
        newArr = [...pointArr]

      }

      // if (file == 'handVideo1') {
      //   newArr = handVideoRealPoint_0506_3([...pointArr])
      //   pointArr = handVideo1_0416_0506(pointArr)
      // } else if (file == 'footVideo') {
      //   // pointArr = new Array(256).fill(50)
      //   newArr = footL(pointArr)
      //   pointArr = footVideo(pointArr)

      // } else if (file.includes('robot')) {

      //   // pointArr = press6(pointArr, 16, 16, 'col', 116, 1)
      //   newArr = [...pointArr]
      //   // pointArr = robot0401(pointArr)



      //   // if (pointArr1zero.length) {
      //   //   pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      //   // }
      // } else if (file == 'hand0507' || file == 'hand0205' || file == 'handGlove115200' || file == 'Num3D') {
      //   // left
      //   // newArr = handVideoRealPoint_0506_3([...pointArr])
      //   newArr = handL([...pointArr])

      //   // pointArr = handVideo1470506(pointArr)

      //   // 
      // } else if (file == 'eye') {
      //   function leftEye(wsPointData) {

      //     for (let i = 0; i < 4; i++) {
      //       for (let j = 0; j < 16; j++) {
      //         [wsPointData[(7 - i) * 16 + j], wsPointData[(i) * 16 + j]] = [wsPointData[(i) * 16 + j], wsPointData[(7 - i) * 16 + j],]
      //       }
      //     }

      //     for (let i = 0; i < 4; i++) {
      //       for (let j = 0; j < 16; j++) {
      //         [wsPointData[(8 + 7 - i) * 16 + j], wsPointData[(8 + i) * 16 + j]] = [wsPointData[(8 + i) * 16 + j], wsPointData[(8 + 7 - i) * 16 + j],]
      //       }
      //     }

      //     const arr = [8, 7, 6, 5, 4, 3, 2, 1, 9, 10, 11, 12, 13, 14, 15, 0]
      //     const newArr = []
      //     for (let j = 0; j < 16; j++) {
      //       for (let i = 0; i < arr.length; i++) {

      //         newArr.push(wsPointData[j * 16 + arr[i]])
      //       }
      //     }
      //     return newArr



      //   }
      //   newArr = leftEye([...pointArr])
      //   pointArr = [...newArr]
      // }
      newArr147 = [...newArr]
      pointArr1zeroData = [...pointArr]
      // newArr = handVideoRealPoint([...pointArr])

      // pointArr = handVideo147(pointArr)




      // stamp = new Date().getTime()
      const rotate = bytes4ToInt10(arr)



      // pointArr = footVideo(pointArr)
      if (pointArr1zero.length) {
        pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
      }

      if (pointArr147zero.length) {
        newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero[index]))
      }

      let jsonDataObj = {
        sitData: pointArr,
        realArr,
        rawPressureData: pointArr,
        newArr147: newArr,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      }

      // console.log(JSON.stringify([pointArr[1] , pointArr[2] , pointArr[3]]))

      if (!rotate.every((a) => a == 0)) {
        jsonDataObj.rotate = rotate
      }

      if (newArr.length) {
        jsonDataObj.newArr147 = newArr
      }

      let jsonData = JSON.stringify(jsonDataObj);
      // if (rotate.every((a) => a == 0)) {
      //   jsonData = JSON.stringify({
      //     // rotate: rotate,
      //     sitData: pointArr,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // } else {
      //   jsonData = JSON.stringify({
      //     rotate: rotate,
      //     sitData: pointArr,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // }

      // const jsonData = JSON.stringify({
      //   rotate: rotate,
      //   sitData: pointArr,
      //   realArr,
      //   newArr147: newArr,
      //   sitFlag: port1?.isOpen,
      //   backFlag: port2?.isOpen,
      // });
      // legacyClientBroadcast( {
      //   if (client.readyState === WebSocket.OPEN) {
      //     client.send(jsonData);
      //   }
      // });
      // console.log(jsonDataObj.sitData , jsonData)
      colOrSendData(jsonData, [])
    }







    // console.log(buffer.length)
    if (buffer.length == 256) {


      // console.log(file , baudRate)
      pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }



      // const index = Math.floor(Math.random() * 4096)
      // let arr = new Array(4096).fill(0)
      // // for (let i = 0; i < 4096; i++) {
      // //   arr[i] = i
      // // }
      // if (index < 4096) {
      //   index++
      // } else {
      //   index = 0
      // }
      // arr[index] = 100
      let jsonData;
      // pointArr = arr

      if (isCar(file)) {
        jsonData = JSON.stringify({
          sitData: pointArr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
          hz: colHZ
        });
      } else {
        jsonData = JSON.stringify({ sitData: isSmallBedMatrixType(file) || file == 'smallBed1' ? newArr : pointArr, hz: colHZ });
      }

      colOrSendData(jsonData)
    }

    if (file.includes('bed4096') && buffer.length == 4096) {
      if (buffer.length != 4096) {
        console.log('bufferLength : ', baudRate, buffer.length)
      }

      // console.log(file , baudRate)
      pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }



      // const index = Math.floor(Math.random() * 4096)
      // let arr = new Array(4096).fill(0)
      // // for (let i = 0; i < 4096; i++) {
      // //   arr[i] = i
      // // }
      // if (index < 4096) {
      //   index++
      // } else {
      //   index = 0
      // }
      // arr[index] = 100
      let jsonData;
      // pointArr = arr

      // for (let i = 0; i < 16; i++) {
      //   for (let j = 0; j < 64; j++) {
      //     [pointArr[(33 + i) * 64 + j], pointArr[(33 + 30 - i) * 64 + j]] = [pointArr[(33 + 30 - i) * 64 + j], pointArr[(33 + i) * 64 + j],]
      //   }
      // }

      // for (let i = 0; i < 64; i++) {
      //   for (let j = 0; j < 16; j++) {
      //     [pointArr[(i) * 64 + j], pointArr[(31 - i) * 64 + j]] = [pointArr[(31 - i) * 64 + j], pointArr[(i) * 64 + j],]
      //   }
      // }

      // const newArr = new Array(64).fill(0)
      // for (let i = 2; i <= 32; i++) {
      //   for (let j = 0; j < 64; j++) {
      //     newArr.push(pointArr[i * 64 + j])
      //   }
      // }

      // for (let j = 0; j < 64; j++) {
      //   newArr.push(pointArr[0 * 64 + j])
      // }

      // for (let i = 33; i < 64; i++) {
      //   for (let j = 0; j < 64; j++) {
      //     newArr.push(pointArr[i * 64 + j])
      //   }
      // }

      pointArr = zeroLineMatrix(pointArr, 64)

      if (isCar(file)) {
        jsonData = JSON.stringify({
          sitData: pointArr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
          hz: colHZ
        });
      } else {
        jsonData = JSON.stringify({ sitData: isSmallBedMatrixType(file) || file == 'smallBed1' ? newArr : pointArr, hz: colHZ });
      }

      // console.log(jsonData)

      colOrSendData(jsonData)

    }

    if (buffer.length == 1) {
      console.log(buffer.readUInt8(i))
      if (buffer.readUInt8(i) == 3) {
        publishSystemEvent({
            handReset: true,
          });
      }
    }

    // 
  }
});

serialParserManager.onData(serialParserManager.channels.SMALL_BED_12B, function (data) {
  pointArr = new Array();
  let buffer = Buffer.from(data);
  newData = new Array();

  const frame = smallBed12B.buildRealtimeFrameFromBuffer(buffer, {
    lineOrder: jqbed,
    zeroFrame: pointArr1zero,
    subtractZero: numLessZeroToZero,
    calibration: smallBed12BCalibration,
    displayOptions: smallBed12BDisplayOptions,
    hz: colHZ,
    transposeSquareMatrix,
  });

  if (nowDate < endDate && file === SMALL_BED_12B_TYPE && frame) {
    pointArr1zeroData = [...frame.orderedFrame];
    pointArr = frame.pressureData;
    newData = [...frame.pressureData];
    const jsonData = JSON.stringify(frame.realtimeFrame);
    colOrSendData(jsonData);
  }
});

const collectionFrameStorage = createCollectionFrameStorageService({
  getSensorType: () => file,
  getDbRef: (channel) => {
    if (channel === 'back') return db1;
    if (channel === 'head') return db2;
    return db;
  },
  shouldStoreCollectionFrame,
  hasEnoughCollectionDiskSpace,
  enqueueCollectionFrame,
  buildZeroAwareStorageData,
  buildSmallBed12BCollectionStorageData,
  getFrameMatrixData,
  isZeroFrameStorageType,
  isSmallBedMatrixType,
  tempFullBedType: TEMP_FULL_BED_TYPE,
  smallBed12BType: SMALL_BED_12B_TYPE,
});

function colOrSendData(jsonData) {
  let frameToStore = null;
  if (file === MINZHEN_TYPE) {
    try {
      frameToStore = JSON.parse(jsonData);
      if (Array.isArray(frameToStore.sitData)) {
        frameToStore.sitData = applyMinzhenBackendGauss(frameToStore.sitData);
        jsonData = JSON.stringify(frameToStore);
      }
    } catch (error) {
      frameToStore = null;
    }
  }

  collectionFrameStorage.storeSit(frameToStore || JSON.parse(jsonData));
  publishRealtimeChannel('sit', jsonData);
}

// 濠㈣泛瀚幃濠冪▔閹绘帒缍撻柡浣哄瀹?

var pointArr2;
serialParserManager.onData(serialParserManager.channels.BACK, function (data) {
  pointArr2 = new Array();
  let buffer = Buffer.from(data);
  if (nowDate < endDate) {
    if (file === MINZHEN_TYPE) {
      const minzhenSensorFrame = parseMinzhenSensorFrame(buffer);
      if (minzhenSensorFrame) {
        colOrSendData1(JSON.stringify(minzhenSensorFrame));
        return;
      }
    }

    if (file === HAND_GLOVE_FULL_PACKET && buffer.length === HAND_GLOVE_FULL_PACKET_LENGTH) {
      handleHandGloveFullPacket(buffer, 'right');
      return;
    }

    if (buffer.length === 1024) {
      for (var i = 0; i < buffer.length; i++) {
        pointArr2[i] = buffer.readUInt8(i);
      }

      if (file === "car10") {
        pointArr2 = car10Back(pointArr2);
      } else if (file === 'yanfeng10') {
        pointArr2 = yanfeng10back(pointArr2);
      } else if (file === 'volvo') {
        pointArr2 = wowBackLine(pointArr2)
      } else if (file == 'carQX') {
      } else if (file === WHOLE_CHAIR_TYPE) {
        pointArr2 = normalizeWholeChairFrame('back', pointArr2)
      } else if (file === HAND_SINGLE_POINT_TYPE) {
        pointArr2 = handSinglePoint(pointArr2)
      } else if (file == 'sofa') {
        pointArr2 = arrToRealLine(pointArr2, [[7, 0], [8, 15]], [[0, 15]], 32)
      } else if (file == 'carY') {
        pointArr2 = carYLine(pointArr2)
      } else {
        pointArr2 = carBackLine(pointArr2);
      }

      pointArr2zeroData = [...pointArr2]

      if (pointArr2zero.length) {
        pointArr2 = pointArr2.map((a, index) => numLessZeroToZero(a - pointArr2zero[index]))
      }

      // pointArr2 = carBackLine(pointArr2);
      if (flag && shouldStoreCollectionFrame('back')) {
        const resDataArr = {
          data: JSON.stringify(pointArr2),
          time: new Date().getTime(),
        };
        // csvWriterback.writeRecords([resDataArr]);

        const timestamp = Date.now(); // 淇濆瓨褰撳墠鏃堕棿鎴炽€?
        const date = saveTime;
        enqueueCollectionInsert(db1, [JSON.stringify(pointArr2), timestamp, date], 'back');
      }

      if (!localFlag) {
        let jsonData = JSON.stringify({ backData: pointArr2 });
        if (isCar(file)) {
          jsonData = JSON.stringify({
            backData: pointArr2,
            sitFlag: port1?.isOpen,
            backFlag: port2?.isOpen,
          });
        } else {
          jsonData = JSON.stringify({ backData: pointArr2 });
        }

        publishSystemEvent( jsonData);
      }


    }

    if (buffer.length == 130) {
      if (handleHandGloveDoublePacket(buffer, 'right', 'back')) {
        return;
      }

      let firstArr = new Array();
      const length = buffer.length

      for (var i = 0; i < buffer.length; i++) {
        firstArr[i] = buffer.readUInt8(i);
      }

      const order = firstArr[0]
      const type = firstArr[1]

      firstArr = firstArr.splice(2, length)

      if (order == 1) {
        firstBlueData1 = [...firstArr]
       } else {
        lastBlueData1 = [...firstArr]
        pointArr = [...firstBlueData1, ...lastBlueData1]
        const realArr1 = [...pointArr]
        pointArr2RawZeroData = [...realArr1]
        const rawPressureData1 = pointArr2RawZero.length
          ? realArr1.map((a, index) => numLessZeroToZero(a - (pointArr2RawZero[index] || 0)))
          : [...realArr1]
        let newArr1 = []
        if (file == 'hand0507' || isHandGloveType(file)) {
          newArr1 = handR(pointArr)
          pointArr = handRVideo1470506(pointArr)
        } else {
          pointArr = footVideo1(pointArr)
        }
        if (pointArr1zero.length) {
          pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
        }
        const arr = [...pointArr]
        const jsonDataObj1 = {
          backData: arr,
          realArr: realArr1,
          rawPressureData: rawPressureData1,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
        }
        if (newArr1.length) {
          jsonDataObj1.newArr147 = newArr1
        }
        const jsonData = JSON.stringify(jsonDataObj1);
        // legacyClientBroadcast( {
        //   if (client.readyState === WebSocket.OPEN) {
        //     client.send(jsonData);
        //   }
        // });

        colOrSendData1(jsonData, [])
      }
    }
    if (buffer.length == 146) {
      if (handleHandGloveDoublePacket(buffer, 'right', 'back')) {
        return;
      }

      let pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      let length = pointArr.length
      pointArr = pointArr.splice(2, length)
      length = pointArr.length
      const arr = pointArr.splice(length - 16, length)
      // pointArr = [...arr]
      // dataItem.next = pointArr
      lastBlueData1 = [...pointArr]
      let newArr = []

      pointArr2 = [...firstBlueData1, ...lastBlueData1]

      const realArr = [...pointArr2]
      pointArr2RawZeroData = [...realArr]
      const rawPressureData = pointArr2RawZero.length
        ? realArr.map((a, index) => numLessZeroToZero(a - (pointArr2RawZero[index] || 0)))
        : [...realArr]

      if (file == 'footVideo') {
        // pointArr2 = new Array(256).fill(50)
        newArr = footR(pointArr2)
        pointArr2 = footVideo1(pointArr2)

      } else if (file == 'hand0507' || isHandGloveType(file)) {
        newArr = handR(pointArr2)

        pointArr2 = handRVideo1470506(pointArr2)

      } else if (file == 'eye') {
        function rightEye(wsPointData) {
          const newArr = []
          let lastArr = wsPointData.splice(128, 128)
          wsPointData = lastArr.concat(wsPointData)
          const arr = [7, 8, 9, 10, 11, 12, 13, 14, 6, 5, 4, 3, 2, 1, 0, 15].reverse()

          for (let j = 0; j < 16; j++) {
            for (let i = 0; i < arr.length; i++) {

              newArr.push(wsPointData[j * 16 + arr[i]])
            }
          }
          return newArr
        }
        newArr = rightEye([...pointArr2])
        pointArr2 = [...newArr]

      }

      newArr147_2 = [...newArr]
      pointArr2zeroData = [...pointArr2]
      // console.log(pointArr2zero)
      if (pointArr2zero.length) {
        pointArr2 = pointArr2.map((a, index) => numLessZeroToZero(a - pointArr2zero[index]))
      }

      if (pointArr147zero_2.length) {
        newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero_2[index]))
      }
      // arr = [...pointArr]
      const rotate = bytes4ToInt10(arr)


      let jsonDataObj = {
        backData: pointArr2,
        realArr,
        rawPressureData,
        newArr147: newArr,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      }

      if (!rotate.every((a) => a == 0)) {
        jsonDataObj.rotate = rotate
      }

      if (newArr.length) {
        jsonDataObj.newArr147 = newArr
      }

      let jsonData = JSON.stringify(jsonDataObj)
      // if (rotate.every((a) => a == 0)) {
      //   jsonData = JSON.stringify({
      //     // rotate: rotate,
      //     backData: pointArr2,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // } else {
      //   jsonData = JSON.stringify({
      //     rotate: rotate,
      //     backData: pointArr2,
      //     realArr,
      //     newArr147: newArr,
      //     sitFlag: port1?.isOpen,
      //     backFlag: port2?.isOpen,
      //   });
      // }
      // legacyClientBroadcast( {
      //   if (client.readyState === WebSocket.OPEN) {
      //     client.send(jsonData);
      //   }
      // });
      colOrSendData1(jsonData, [])

    }

    if (buffer.length == 1) {
      console.log(buffer.readUInt8(i))
      if (buffer.readUInt8(i) == 3) {
        publishSystemEvent({
            handReset: true,
          });
      }
    }
  }
});

function colOrSendData1(jsonData) {
  collectionFrameStorage.storeBack(JSON.parse(jsonData));
  publishRealtimeChannel('back', jsonData);
}

var pointArr3;
serialParserManager.onData(serialParserManager.channels.BIG_BED_SIT, function (data) {
  if (file == "bigBed") {
    pointArr3 = new Array();
    let buffer = Buffer.from(data);

    let res = [];
    if (nowDate < endDate) {
      if (buffer.length === 1025) {
        for (var i = 0; i < buffer.length; i++) {
          pointArr3[i] = buffer.readUInt8(i);
        }

        if (pointArr3[pointArr3.length - 1] == 0) {
          firstData = [...pointArr3];
          firstData.pop();
          // 閸欏疇绔熺痪鍨碍

        }
        if (pointArr3[pointArr3.length - 1] == 1) {
          lastData = [...pointArr3];
          lastData.pop();
          // 婵烇綀顕ф慨?
          let a = [];
          for (let i = 0; i < 32; i++) {
            for (let j = 0; j < 32; j++) {
              a.push(firstData[i * 32 + j]);
            }
            for (let j = 0; j < 32; j++) {
              a.push(lastData[i * 32 + j]);
            }
          }
          res = a;
          if (!localFlag) {
            let jsonData = JSON.stringify({ sitData: res });
            publishSystemEvent( jsonData);
          }

          if (flag && shouldStoreCollectionFrame('sit') && hasEnoughCollectionDiskSpace()) {
            const resDataArr = {
              data: JSON.stringify(res),
              time: new Date().getTime(),
            };
            dataFalg++;
            // 1.0
            // csvWriter.writeRecords([resDataArr]);xai
            // 2.0
            // const matrix = '[1,2,3,4,54,56,6,3,2,3,]';
            if (dataFalg % 10 == 0) {
              const timestamp = Date.now(); // 淇濆瓨褰撳墠鏃堕棿鎴炽€?
              const date = saveTime;
              enqueueCollectionInsert(db, [JSON.stringify(res), timestamp, date], 'sit');
            }
            if (dataFalg >= 10) {
              dataFalg = 0;
            }
          }
        }
      }




    }
  }
});

var pointArr4;

serialParserManager.onData(serialParserManager.channels.HEAD, function (data) {
  pointArr4 = new Array();
  let buffer = Buffer.from(data);
  if (nowDate < endDate) {
    if (buffer.length === 1024) {

      for (var i = 0; i < buffer.length; i++) {
        pointArr4[i] = buffer.readUInt8(i);
      }
      if (file == 'volvo') {
        pointArr4 = wowhead(pointArr4);
      } else if (file === WHOLE_CHAIR_TYPE) {
        pointArr4 = normalizeWholeChairFrame('head', pointArr4);
      }


      pointArr4zeroData = [...pointArr4]

      if (pointArr4zero.length) {
        pointArr4 = pointArr4.map((a, index) => numLessZeroToZero(a - pointArr4zero[index]))
      }

      if (flag && shouldStoreCollectionFrame('head') && hasEnoughCollectionDiskSpace()) {
        const resDataArr = {
          data: JSON.stringify(pointArr4),
          time: new Date().getTime(),
        };
        // csvWriterback.writeRecords([resDataArr]);

        const timestamp = Date.now(); // 淇濆瓨褰撳墠鏃堕棿鎴炽€?
        const date = saveTime;
        enqueueCollectionInsert(db2, [JSON.stringify(pointArr4), timestamp, date], 'head');
      }

      if (!localFlag) {
        let jsonData = JSON.stringify({ headData: pointArr4 });
        if (isCar(file)) {
          jsonData = JSON.stringify({
            headData: pointArr4,
            sitFlag: port1?.isOpen,
            backFlag: port2?.isOpen,
          });
        } else {
          jsonData = JSON.stringify({ headData: pointArr4 });
        }

        publishSystemEvent( jsonData);
      }


    }


    if (buffer.length == 130) {
      let firstArr = new Array();
      const length = buffer.length

      for (var i = 0; i < buffer.length; i++) {
        firstArr[i] = buffer.readUInt8(i);
      }

      const order = firstArr[0]
      const type = firstArr[1]

      firstArr = firstArr.splice(2, length)

      if (order == 1) {
        firstBlueData2 = [...firstArr]
      } else {
        lastBlueData2 = [...firstArr]
        pointArr = [...firstBlueData2, ...lastBlueData2]
        pointArr = footVideo1(pointArr)

        if (pointArr1zero.length) {
          pointArr = pointArr.map((a, index) => numLessZeroToZero(a - pointArr1zero[index]))
        }
        const arr = [...pointArr]
        const jsonData = JSON.stringify({
          backData: arr,
          sitFlag: port1?.isOpen,
          backFlag: port2?.isOpen,
        });
        // legacyClientBroadcast( {
        //   if (client.readyState === WebSocket.OPEN) {
        //     client.send(jsonData);
        //   }
        // });

        colOrSendData1(jsonData, [])
      }



    }

    if (buffer.length == 146) {
      let pointArr = new Array();
      for (var i = 0; i < buffer.length; i++) {
        pointArr[i] = buffer.readUInt8(i);
      }
      let length = pointArr.length
      pointArr = pointArr.splice(2, length)
      length = pointArr.length
      const arr = pointArr.splice(length - 16, length)
      // pointArr = [...arr]
      // dataItem.next = pointArr
      lastBlueData2 = [...pointArr]
      let newArr = []

      pointArr4 = [...firstBlueData2, ...lastBlueData2]

      const realArr = [...pointArr4]

      if (file == 'footVideo') {
        newArr = footR(pointArr4)
        pointArr4 = footVideo1(pointArr4)

      } else if (file == 'hand0507' || isHandGloveType(file)) {
        newArr = handR(pointArr4)

        pointArr4 = handRVideo1470506(pointArr4)

      }

      newArr147_2 = [...newArr]

      pointArr4zeroData = [...pointArr4]

      if (pointArr4zero.length) {
        pointArr4 = pointArr4.map((a, index) => numLessZeroToZero(a - pointArr4zero[index]))
      }

      if (pointArr147zero_2.length) {
        newArr = newArr.map((a, index) => numLessZeroToZero(a - pointArr147zero_2[index]))
      }
      // arr = [...pointArr]
      const rotate = bytes4ToInt10(arr)


      let jsonDataObj = {
        headData: pointArr4,
        realArr,
        rawPressureData: pointArr4,
        newArr147: newArr,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
      }

      if (!rotate.every((a) => a == 0)) {
        jsonDataObj.rotate = rotate
      }

      if (newArr.length) {
        jsonDataObj.newArr147 = newArr
      }

      let jsonData = JSON.stringify(jsonDataObj)

      colOrSendData2(jsonData, [])

    }

  }
});


function colOrSendData2(jsonData) {
  collectionFrameStorage.storeHead(JSON.parse(jsonData));
  publishRealtimeChannel('head', jsonData, { respectFrequency: false });
}

// 鏁版嵁澶勭悊宸ュ叿銆?
// jqbed 鏁版嵁缈昏浆鍙樻崲锛堜緵 callPy 浣跨敤锛夈€?
jqbedTimer = petCareRuntimeService.startVitalSignsTimer();
petCareTimer = petCareRuntimeService.startPetCareTimer('petCare');
petCareMiniTimer = petCareRuntimeService.startPetCareTimer('petCareMini');

module.exports.shutdownServer = shutdownServer;
function getWsServer(channel = 'sit') {
  const normalizedChannel = normalizeChannel(channel);
  if (normalizedChannel === 'back') return server1;
  if (normalizedChannel === 'head') return server2;
  return server;
}

function getWsSubscriptionStatus() {
  return wsSubscriptions.getStatus();
}

function getRealtimeChannels() {
  return getRealtimeChannelMetadata();
}

function getChannelBusStatus() {
  return channelBus.getStats();
}

function handleCommand(command) {
  logger.warn('[Server] handleCommand adapter received unsupported command', {
    type: command?.type,
    action: command?.action,
  });
  return null;
}

module.exports.getWsServer = getWsServer;
module.exports.getWsSubscriptionStatus = getWsSubscriptionStatus;
module.exports.getRealtimeChannels = getRealtimeChannels;
module.exports.getChannelBusStatus = getChannelBusStatus;
module.exports.handleCommand = handleCommand;


// ===== OneStep 瓒冲帇鎶ュ憡 HTTP 鏈嶅姟鐘舵€?=====
// pdfArrData 缂撳瓨褰撳墠鎶ュ憡鐢熸垚浣跨敤鐨勮冻鍘嬪巻鍙插抚锛屼緵鐑姏鍥惧拰 PDF 鎶ュ憡鎺ュ彛澶嶇敤銆?
let pdfArrData = [];

function sanitizeFilename(name) {
  if (typeof name !== 'string') return '';
  let safe = name.trim();
  safe = safe.replace(/[\\/]/g, '');
  safe = safe.replace(/[\x00-\x1F<>:"|?*]/g, '');
  safe = safe.replace(/[.\s]+$/g, '');
  return safe;
}

function fixMojibake(value) {
  if (typeof value !== 'string') return value;
  try {
    const buf = Buffer.from(value, 'latin1');
    const utf = buf.toString('utf8');
    if (Buffer.from(utf, 'utf8').equals(buf)) return utf;
  } catch {}
  return value;
}

function decodeMaybeUri(value) {
  if (typeof value !== 'string') return value;
  let result = value;
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(result);
      if (decoded === result) break;
      result = decoded;
    } catch { break; }
  }
  return result;
}

function decodeField(value) {
  return decodeMaybeUri(fixMojibake(value));
}

const httpApp = express();
httpApp.use(cors());
httpApp.use(express.json({ limit: '50mb' }));
httpApp.use(express.urlencoded({ limit: '50mb', extended: true }));

httpApp.get('/api/channels', (req, res) => {
  res.json({
    channels: getRealtimeChannelMetadata(),
    subscriptions: wsSubscriptions.getStatus(),
  });
});

httpApp.get('/api/ws/status', (req, res) => {
  res.json({
    channels: getRealtimeChannelMetadata(),
    channelBus: channelBus.getStats(),
    serial: serialManager.getStatus(),
    subscriptions: wsSubscriptions.getStatus(),
  });
});

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imgPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const tempName = `${Date.now()}-${Math.floor(Math.random() * 1e9)}${ext}`;
    cb(null, tempName);
  },
});
const upload = multer({ storage: multerStorage });
const PY_HEATMAP_TIMEOUT_MS = 60000;
const PY_REPORT_TIMEOUT_MS = 120000;

httpApp.post('/getDbHeatmap', async (req, res) => {
  try {
    const { time } = req.body;
    const selectQuery = 'select * from matrix WHERE date=?';
    const params = [time];
    db.all(selectQuery, params, async (err, rows) => {
      if (err) {
        logger.error('[getDbHeatmap] db error:', err);
        return res.json(new HttpResult(1, {}, 'db error'));
      }
      if (!rows || rows.length === 0) {
        return res.json(new HttpResult(1, {}, 'no data'));
      }
      const foot = rows.map(r => JSON.parse(r.data));
      pdfArrData = foot;
      try {
        await warmFootAnalysis();
        const peak_frame = await callPy('get_peak_frame', { sensor_data: foot }, {
          timeoutMs: PY_HEATMAP_TIMEOUT_MS,
        });
        return res.json(new HttpResult(0, peak_frame, 'success'));
      } catch (e) {
        logger.error('[getDbHeatmap] callPy error:', e.message);
        return res.json(new HttpResult(1, {}, 'callPy error'));
      }
    });
  } catch (e) {
    logger.error('[getDbHeatmap] error:', e.message);
    res.json(new HttpResult(1, {}, 'error'));
  }
});

httpApp.post('/uploadCanvas', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.json(new HttpResult(1, {}, 'missing file'));
    }
    if (typeof req.body.filename === 'string') req.body.filename = decodeField(req.body.filename);
    if (typeof req.body.collectName === 'string') req.body.collectName = decodeField(req.body.collectName);
    if (typeof req.body.date === 'string') req.body.date = decodeField(req.body.date);
    if (typeof req.body.gender === 'string') req.body.gender = decodeField(req.body.gender);
    logger.info('[uploadCanvas]', { collectName: req.body.collectName, age: req.body.age, gender: req.body.gender });
    const requestedDate =
      (typeof req.body.date === 'string' && req.body.date.trim()) ||
      (typeof req.query.date === 'string' && req.query.date.trim()) ||
      '';
    const sanitizedRequested = sanitizeFilename(requestedDate);
    if (!sanitizedRequested) {
      fs.unlinkSync(req.file.path);
      return res.json(new HttpResult(1, {}, 'missing date'));
    }
    const finalName = `${sanitizedRequested}.png`;
    const newPath = path.join(imgPath, finalName);
    fs.renameSync(req.file.path, newPath);
    req.file.filename = finalName;
    req.file.path = newPath;
    const absolutePath = path.resolve(req.file.path);
    const name = `${pdfPath}/${sanitizedRequested}`;
    logger.info('[uploadCanvas] calling generate_foot_pressure_report1', name);
    await warmFootAnalysis();
    await callPy('generate_foot_pressure_report1', {
      sensor_data: pdfArrData,
      pdf_name: name,
      heatmap_png_path: `${imgPath}/${sanitizedRequested}.png`,
      user_name: req.body.collectName,
      user_age: req.body.age,
      user_gender: req.body.gender,
      user_id: req.body.userId || 9527,
    }, {
      timeoutMs: PY_REPORT_TIMEOUT_MS,
    });
    const pdfFilePath = `${name}.pdf`;
    res.json(new HttpResult(0, { file: req.file, body: req.body, absolutePath, pdfFilePath, pdfDir: pdfPath }, 'success'));
  } catch (e) {
    logger.error('[uploadCanvas] error:', e.message);
    res.json(new HttpResult(1, {}, 'upload failed'));
  }
});

// HTTP_PORT 鏄湰鍦?OneStep 鎶ュ憡鏈嶅姟绔彛锛屼粎鐩戝惉 127.0.0.1锛屼緵鍓嶇涓婁紶鎴浘鍜岀敓鎴?PDF銆?
const HTTP_PORT = 19245;
reportHttpServer = httpApp.listen(HTTP_PORT, '127.0.0.1', () => {
  logger.info(`[HTTP] OneStep report server listening on http://127.0.0.1:${HTTP_PORT}`);
});
