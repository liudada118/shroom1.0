/**
 * 后端启动编排入口。
 *
 * 当前职责：
 * - 创建 HTTP/WebSocket 服务和运行时上下文。
 * - 装配串口、传感器 runtime、Display Systems 和实时输出管线。
 * - 保留 legacy 前端和旧 WebSocket 命令的兼容桥接。
 *
 * 业务处理逻辑应优先下沉到 application、services、serial、sensors/runtime 或 displaySystems。
 */
const logger = require('../../common/logger');
const {
  buildTelemetryChannelDefinitions,
} = require('../realtime/telemetryChannelService');
const { startWorker, callPy, stopWorker } = require('../algorithm-channel/pythonWorker');
const {
  buildRealtimeChannelMetadata,
} = require('./websocket/websocketChannelService');
const { createWebSocketHandlerAttacher } = require('./websocket/webSocketHandlerFactory');
const { createWebSocketHandlerContext } = require('./runtime/legacyWebSocketContext');
const {
  WILDCARD_CHANNEL,
} = require('./websocket/websocketSubscriptionService');
const { attachHeartbeat, parseJsonMessage } = require('./websocket/websocketTransportService');
const { createServerShutdownOrchestrator } = require('./bootstrap/serverShutdownOrchestrator');
const { createPetCareRuntimeService } = require('../algorithm-channel/petCareRuntimeService');
const { createControlCommandRouter } = require('./commands/controlCommandRouter');
const { registerRuntimeCommandHandlers } = require('./commands/registerRuntimeCommandHandlers');
const { registerSerialControlHandlers } = require('../serial/serialControlService');
const { createControlCommandService } = require('./commands/controlCommandService');
const { createHttpApp } = require('./http/httpAppFactory');
const { syncSystemTime } = require('./bootstrap/systemTimeSyncService');
const {
  DEFAULT_REPORT_HTTP_PORT,
  scanStartupSerialPorts,
  startLocalHttpServer,
} = require('./bootstrap/bootstrapServer');
const { createRuntimeStateStore } = require('./runtime/runtimeStateStore');
const { createZeroStateStore } = require('./runtime/zeroStateStore');
const { createZeroCommandService } = require('./runtime/zeroCommandService');
const { createServerRuntimeStateStore } = require('./runtime/runtimeStateStoreFactory');
const { bindLegacySerialRuntime } = require('../../extensions/built-in-sensors/runtimeBindingsFactory');
const { createRuntimeStatePatchers } = require('./runtime/runtimeStatePatchFactory');
const { createSerialRuntime } = require('../serial/serialRuntimeFactory');
const { createSerialPortOrchestrator } = require('../serial/serialPortOrchestrator');
const { createWebSocketRuntime } = require('./websocket/websocketRuntimeFactory');
const { createServerRuntimeContext } = require('./runtime/runtimeContextFactory');
const { createServerFramePipeline } = require('../realtime/framePipelineFactory');
const { createServerHandRuntime } = require('../../extensions/built-in-sensors/handRuntimeFactory');
const { createServerSensorProcessors } = require('../../extensions/built-in-sensors/sensorProcessorFactory');
const { createServerSmallBedRuntime } = require('../../extensions/built-in-sensors/smallBedRuntimeFactory');
const {
  DEFAULT_COLLECTION_FREQUENCY_HZ,
  createCollectionDiskSpaceGuard,
  createCollectionStorageClock,
  normalizeCollectFrequency,
  normalizeCollectOptions,
} = require('@shroom/backend/collection/collectionService.js');
const { createCollectionInsertQueueService } = require('@shroom/backend/collection/collectionInsertQueueService.js');
const {
  createHistoryRowsForPlayback,
  getHistoryStats,
  queryHistoryDates,
  queryHistoryRows,
} = require('../storage/history/historyQueryService');
const {
  buildZeroPlaybackPayload: buildHistoryZeroPlaybackPayload,
  getHistoryLengthFromCounts,
  getHistorySeries: createHistorySeries,
} = require('../playback/historyPlaybackService');
const { createPlaybackFrameService } = require('../playback/playbackFrameService');
const { createPlaybackTimerService } = require('../playback/playbackTimerService');
const { createCsvDownloadService } = require('../csv/csvDownloadService');
const { createHistoryMaintenanceService } = require('../storage/history/historyMaintenanceService');
const { createHistoryFrameTransformService } = require('../playback/historyFrameTransformService');
const { createAppRuntime } = require('../../extension-host/appRuntimeFactory');
let electronApp = null;
try {
  ({ app: electronApp } = require('electron'));
} catch {}
const path = require('path');
const os = require('os');
const fs = require('fs');
const {
  listPorts,
} = require('@shroom/backend/serial/serialHelper.js');
const { createSerialPortFilterService } = require('@shroom/backend/serial/serialPortFilterService.js');
const sqlite3 = require('../storage/sqlite3-compat').verbose();
const {
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
} = require('@shroom/backend/processing');
const module2 = require('./license/aes_ecb')
const { validateLicenseKey } = require('./license/licenseValidationService');
const { readStoredLicenseKey, writeStoredLicenseKey } = require('./license/licenseKeyStore');
const { createServerPathConfig } = require('./serverPathConfig');
const { isCar, dedupli, totalToN, } = require('../../compatibility/legacyDataUtils');
const { estimatePointPressure, FILTER_THRESHOLD: PRESSURE_CALIBRATION_FILTER_THRESHOLD } = require('../../../util/pressureCalibration_V2.7.54');
const { pressSmallBed } = require('@shroom/backend/processing/utilMatrix.js');
const { gaussBlur_return, gaussBlur_2, interpSmall, findMax, numLessZeroToZero, press6, pressNew1220, press6sit, bytes4ToInt10, arrToRealLine, pressNew12203131 } = require('@shroom/backend/processing/mathUtils.js');
const { initDb: _initDbFromModule } = require('../storage/dbManager');
const { createJqbedAlgorithmConfigStore } = require('../algorithm-channel/jqbedAlgorithmConfig');
const {
  buildJqbedGetDataArgs,
  createJqbedAlgorithmCommandHandler,
  createJqbedAlgorithmProtocol,
} = require('../algorithm-channel/jqbedAlgorithmProtocol');
const sensorRegistry = require('@shroom/backend/sensors');
const smallBed12B = sensorRegistry.smallBed12B;
const minzhen = sensorRegistry.minzhen;
const wholeChair = sensorRegistry.wholeChair;
const handGloveFullPacket = sensorRegistry.handGloveFullPacket;
const handGloveDouble = sensorRegistry.handGloveDouble;

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
const smallBed12BCalibration = {
  estimatePointPressure,
  filterThreshold: PRESSURE_CALIBRATION_FILTER_THRESHOLD,
};
const roundSmallBed12BPressureValue = smallBed12B.roundPressureValue;
const normalizeSmallBed12BDisplayOptions = smallBed12B.normalizeDisplayOptions;
let lastHandGloveRealtimeSendAt = {
  sit: 0,
  back: 0,
};

const maskMinzhenMatrixValues = minzhen.maskMatrixValues;
const applyMinzhenBackendGauss = (frame) => minzhen.applyBackendGauss(frame, {
  gaussBlur: gaussBlur_return,
});
const parseMinzhenSensorFrame = minzhen.parseSensorFrame;
const minzhenSensorExtractor = minzhen.createTextFrameExtractor();

/**
 * 处理敏枕附加串口收到的文本数据，并在授权有效时输出到靠背通道。
 *
 * @param {Buffer | string} data 串口收到的原始数据块。
 */
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

/**
 * 同步靠背串口的托管状态。
 * 当前保留为兼容入口，实际打开/关闭由 SerialManager 统一处理。
 */
function bindBackPortParser() {
  return getManagedSerialPort(serialRoles.BACK);
}

/**
 * 关闭敏枕附加传感器串口，并清空文本分帧缓存。
 *
 * @param {string} reason 关闭原因，写入串口管理日志。
 */
function closeMinzhenSensorPort(reason = 'close') {
  minzhenSensorExtractor.reset();
  closeManagedSerialPort(serialRoles.SENSOR, reason);
}

/**
 * 打开敏枕附加传感器使用的独立串口。
 *
 * @param {string} portPath 用户选择或自动检测到的串口路径。
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

/**
 * 在整椅模式下按段归一化矩阵数据，其他模式直接返回原数据。
 *
 * @param {'sit' | 'back' | 'head'} section 整椅数据段名称。
 * @param {unknown[]} data 当前段的原始矩阵数据。
 * @returns {unknown[]} 归一化后的矩阵数据。
 */
function normalizeWholeChairFrame(section, data) {
  return file === WHOLE_CHAIR_TYPE ? wholeChair.normalizeFrame(section, data) : data;
}

const serverPathConfig = createServerPathConfig({
  electronApp,
  processRef: process,
});
const {
  configCandidates,
  csvPath,
  filePath,
  imgPath,
  nameTxt,
  pdfPath,
  runtimeResourceRoot,
  runtimeWritableRoot,
  writableNameTxt,
} = serverPathConfig;
logger.info("[Path] resourceRoot=", runtimeResourceRoot);
logger.info("[Path] writableRoot=", runtimeWritableRoot);
logger.info("[Path] db=", filePath, "data=", csvPath, "config=", nameTxt);
logger.info("[Path] configCandidates=", configCandidates.join(", "));

// JQBed 参数属于可写运行态扩展，不进入 Electron 稳定内核或串口协议。
const jqbedAlgorithmConfigStore = createJqbedAlgorithmConfigStore({
  filePath: path.join(runtimeWritableRoot, 'jqbed-algorithm-config.json'),
  logger,
});
jqbedAlgorithmConfigStore.load();
let jqbedAlgorithmStatus = { state: 'waiting', error: null };

const appRuntime = createAppRuntime({
  logger,
  runtimeResourceRoot,
  runtimeWritableRoot,
});

function getDisplaySystemStatus() {
  return appRuntime.displaySystems.getStatus();
}

function getDisplaySystemById(id) {
  return appRuntime.displaySystems.getById(id);
}

function getDisplaySystemEditorById(id) {
  return appRuntime.displaySystems.getEditorById(id);
}

const serialPortFilterService = createSerialPortFilterService({ logger });
const {
  getPort,
  logSerialPortList,
} = serialPortFilterService;

const zeroStateStore = createZeroStateStore();
const getZeroState = (key) => zeroStateStore.get(key);
const setZeroState = (key, value) => zeroStateStore.set(key, value);
const zeroStateAccessor = (key) => ({
  get: () => getZeroState(key),
  set: (value) => setZeroState(key, value),
});

const historyFrameTransformService = createHistoryFrameTransformService({
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
  getCollectOptions: () => getCollectionState('collectOptions'),
  getRuntime: () => ({
    file: runtimeContext.getSensorType(),
    colHZ: getCollectionState('colHZ'),
    pointArr1RawZero: getZeroState('pointArr1RawZero'),
    pointArr1zero: getZeroState('pointArr1zero'),
    pointArr2RawZero: getZeroState('pointArr2RawZero'),
    pointArr2zero: getZeroState('pointArr2zero'),
    pointArr4zero: getZeroState('pointArr4zero'),
  }),
});
const {
  buildSmallBed12BCollectionStorageData,
  buildSmallBedPlaybackPayload,
  buildTempFullBedPlaybackPayload,
  buildZeroAwareStorageData,
  formatMatrixTotalForFile,
  getCsvElapsedSeconds,
  getCsvFilePrefix,
  getCsvTitleMap,
  getStoredSitData,
  normalizeFiniteFrame,
  normalizeHistoryPressureData,
  normalizeSmallBed12BPressureData,
  parseStoredFrameData,
  parseStoredSensorFrame,
  shouldTransposeSmallBedRawMatrix,
  shouldTransposeSmallBedRawMatrixFrame,
  transposeSquareMatrix,
} = historyFrameTransformService;

/**
 * 判断当前通道是否可以发送实时帧。
 * 手套类传感器会按 60FPS 做限频，其他类型直接发送。
 *
 * @param {string} channel manifest outputChannel 或兼容通道名称。
 * @returns {boolean} 是否允许发送本帧。
 */
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

/**
 * 重置采集存储时钟，用于开始采集或修改采集频率后重新计时。
 */
function resetCollectionStorageClock() {
  collectionStorageClock.reset();
}

/**
 * 判断指定通道当前帧是否应该入库。
 *
 * @param {'sit' | 'back' | 'head'} channel 采集通道名称。
 * @returns {boolean} 是否满足当前采集频率策略。
 */
function shouldStoreCollectionFrame(channel = 'sit') {
  return collectionStorageClock.shouldStore(channel);
}

function broadcastCollectionStorageError(error = {}) {
  return publishSystemEvent( {
    collectionStorageError: {
      message: error.message || 'database space is insufficient; collection stopped',
      freeBytes: error.freeBytes,
      minFreeBytes: error.minFreeBytes,
      file: runtimeContext.getSensorType(),
      saveTime: getCollectionState('saveTime'),
    },
  });
}

function getCollectionFreeBytes() {
  return collectionDiskSpaceGuard.getFreeBytes();
}

function stopCollectionForStorageError(error, extra = {}) {
  flushCollectionInsertQueues();
  setCollectionState('flag', false);
  const message = error?.message || String(error || 'database write failed; collection stopped');
  logger.error('[Collection] stop collection:', message);
  broadcastCollectionStorageError({
    message: message.includes('database or disk is full')
      ? 'database or disk space is insufficient; collection stopped'
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
      new Error('database or disk space is insufficient'),
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
  enqueueCollectionInsert(dbRef, [dataToStore, Date.now(), getCollectionState('saveTime')], channel);
}

function initDb(fileStr) {
  return _initDbFromModule(fileStr, filePath, runtimeResourceRoot);
}

const playbackStateStore = createRuntimeStateStore({
  initialState: {
    indexArr: [0, 0],
    localData: [],
    localDataBack: [],
    localDataHead: [],
    nowIndex: 0,
  },
});
const getPlaybackState = (key) => playbackStateStore.get(key);
const setPlaybackState = (key, value) => playbackStateStore.set(key, value);
const patchPlaybackState = (next = {}) => playbackStateStore.patch(next);
const playbackStateAccessor = (key) => ({
  get: () => getPlaybackState(key),
  set: (value) => setPlaybackState(key, value),
});

function getHistorySeries({ sitRows = [], backRows = [], start = 0, end = null, file = '' }) {
  return createHistorySeries({
    sitRows,
    backRows,
    start,
    end,
    sensorType: runtimeContext.getSensorType(),
    normalizeHistoryPressureData,
    formatMatrixTotalForFile,
    totalToN,
  });
}

function buildZeroPlaybackPayload() {
  return buildHistoryZeroPlaybackPayload({
    sensorType: runtimeContext.getSensorType(),
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
    sensorType: runtimeContext.getSensorType(),
    sitRows: getPlaybackState('localData'),
    backRows: getPlaybackState('localDataBack'),
    headRows: getPlaybackState('localDataHead'),
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
    const currentIndex = getPlaybackState('nowIndex');
    const currentRange = getPlaybackState('indexArr');
    if (currentIndex <= currentRange[1]) {
      const nextIndex = currentIndex + 1;
      setPlaybackState('nowIndex', nextIndex);
      publishPlaybackFrame(nextIndex);
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
    const sensorType = runtimeContext.getSensorType();
    const sitDb = runtimeContext.getDatabase('sit');
    const backDb = runtimeContext.getDatabase('back');
    const headDb = runtimeContext.getDatabase('head');
    stopPlaybackTimer();
    patchPlaybackState({
      indexArr: [0, 0],
      localData: [],
      localDataBack: [],
      localDataHead: [],
      nowIndex: 0,
    });

    const sitStats = getHistoryStats(sitDb, dateLabel, logger);
    const backStats = isCar(sensorType) && backDb
      ? getHistoryStats(backDb, dateLabel, logger)
      : { count: 0, minId: 0, maxId: 0 };
    const headStats = isThreePortFile(sensorType) && headDb
      ? getHistoryStats(headDb, dateLabel, logger)
      : { count: 0, minId: 0, maxId: 0 };
    const totalLength = isThreePortFile(sensorType)
      ? getHistoryLengthFromCounts(sitStats.count, backStats.count, headStats.count)
      : isCar(sensorType)
        ? getHistoryLengthFromCounts(sitStats.count, backStats.count)
        : getHistoryLengthFromCounts(sitStats.count);
    const maxRows = Math.max(sitStats.count, backStats.count, headStats.count);
    const eager = maxRows <= HISTORY_EAGER_ROW_LIMIT;

    const sitRows = createHistoryRowsForPlayback(sitDb, dateLabel, sitStats, eager, logger);
    let backRows = [];
    let headRows = [];
    if (isCar(sensorType) && backDb) {
      backRows = createHistoryRowsForPlayback(backDb, dateLabel, backStats, eager, logger);
    }
    if (isThreePortFile(sensorType) && headDb) {
      headRows = createHistoryRowsForPlayback(headDb, dateLabel, headStats, eager, logger);
    }
    patchPlaybackState({
      localData: sitRows,
      localDataBack: backRows,
      localDataHead: headRows,
    });

    const historySeries = getHistorySeries({
      sitRows,
      backRows,
      file: sensorType,
    });
    length = totalLength || historySeries.length;
    setPlaybackState('indexArr', [0, Math.max(length - 2, 0)]);
    timeStamp = historySeries.time;
    detectedInterval = calcDetectedInterval(timeStamp);
    interval = detectedInterval;
    historyArr = [0, length];

    broadcastHistorySelectionPayload({
      length,
      time: timeStamp,
      historyTimeArr: timeStamp,
      index: getPlaybackState('nowIndex'),
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
    if (d > 0 && d < 5000) diffs.push(d);
  }
  if (diffs.length === 0) return timeNum;
  diffs.sort((a, b) => a - b);
  const median = diffs[Math.floor(diffs.length / 2)];
  return Math.max(1, median);
}

let petCareTimer = null;
let petCareMiniTimer = null;
let jqbedTimer = null;
let reportHttpServer = null;
let serverOpened = false;
let serverShutdownRequested = false;
let serverShutdownPromise = null;

let shutdownOrchestrator = null;

function getShutdownOrchestrator() {
  if (shutdownOrchestrator) return shutdownOrchestrator;

  shutdownOrchestrator = createServerShutdownOrchestrator({
    logger,
    serialManager,
    stopPlaybackTimer,
    stopWorker,
    getRuntime: () => ({
      backClose,
      com,
      com1,
      comSensor,
      comhead,
      db: runtimeContext.getDatabase('sit'),
      db1: runtimeContext.getDatabase('back'),
      db2: runtimeContext.getDatabase('head'),
      headClose,
      jqbedTimer,
      localFlag: runtimeContext.isLocalPlayback(),
      petCareMiniTimer,
      petCareTimer,
      reportHttpServer,
      sensorClose,
      server,
      serverOpened,
      serverShutdownPromise,
      serverShutdownRequested,
      sitClose,
    }),
    setRuntime: (next = {}) => {
      if (Object.prototype.hasOwnProperty.call(next, 'backClose')) backClose = next.backClose;
      if (Object.prototype.hasOwnProperty.call(next, 'com')) com = next.com;
      if (Object.prototype.hasOwnProperty.call(next, 'com1')) com1 = next.com1;
      if (Object.prototype.hasOwnProperty.call(next, 'comSensor')) comSensor = next.comSensor;
      if (Object.prototype.hasOwnProperty.call(next, 'comhead')) comhead = next.comhead;
      if (Object.prototype.hasOwnProperty.call(next, 'headClose')) headClose = next.headClose;
      if (Object.prototype.hasOwnProperty.call(next, 'jqbedTimer')) jqbedTimer = next.jqbedTimer;
      if (Object.prototype.hasOwnProperty.call(next, 'localFlag')) localFlag = next.localFlag;
      if (Object.prototype.hasOwnProperty.call(next, 'petCareMiniTimer')) petCareMiniTimer = next.petCareMiniTimer;
      if (Object.prototype.hasOwnProperty.call(next, 'petCareTimer')) petCareTimer = next.petCareTimer;
      if (Object.prototype.hasOwnProperty.call(next, 'reportHttpServer')) reportHttpServer = next.reportHttpServer;
      if (Object.prototype.hasOwnProperty.call(next, 'sensorClose')) sensorClose = next.sensorClose;
      if (Object.prototype.hasOwnProperty.call(next, 'serverOpened')) serverOpened = next.serverOpened;
      if (Object.prototype.hasOwnProperty.call(next, 'serverShutdownPromise')) serverShutdownPromise = next.serverShutdownPromise;
      if (Object.prototype.hasOwnProperty.call(next, 'serverShutdownRequested')) serverShutdownRequested = next.serverShutdownRequested;
      if (Object.prototype.hasOwnProperty.call(next, 'sitClose')) sitClose = next.sitClose;
    },
  });

  return shutdownOrchestrator;
}

function shutdownServer() {
  appRuntime.displaySystems.stopRuntimeDispatch();
  return getShutdownOrchestrator().shutdownServer();
}
let baudRate = 1000000;
const timeNum = 1000 / 12;
let localFlag = false;
let playFlag = false;
let interval = timeNum;
let detectedInterval = timeNum;
let time;

let timeStamp;
let historyArr;
let newsit;
let newback;
let backAreaSelect = [];
let backPressSelect = [];
let sitAreaSelect = [];
let sitPressSelect = [];
let sitClose = false;
let backClose = false;
let headClose = false;
let sensorClose = false;
const sitnum1 = 64;
const sitnum2 = 64;
const backnum1 = 64;
const backnum2 = 64;
const backTotal = backnum1 * backnum2;
const sitTotal = sitnum1 * sitnum2;
let smoothValue = 0;
let useMatrixOrigin = false;
let jqbedMatrixOrigin = null;
let lastData = new Array(1024).fill(0);
let firstData = new Array(1024).fill(0);
let pointArr = new Array(sitTotal).fill(0);
let pointArr2 = new Array(backTotal).fill(0);
let pointArr3 = new Array(backTotal).fill(0);
let pointArr4 = new Array(backTotal).fill(0);
let newData = new Array(sitTotal).fill(0);
let length;
let history;
let nowDate = 0;
let endDate = 0;

const defauleFile = 'hand0205';
let date, sysStartTime, file = defauleFile, selectFlag;
let licenseFile = null;

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

let getTime,
  nowGetTime,
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




let dbObj = initDb(file);
let db = dbObj.db;
let db1 = dbObj.db1;
let db2 = dbObj.db2;
let runtimeStateStoreForContext = null;
const runtimeContext = createServerRuntimeContext({
  getRuntimeStateStore: () => runtimeStateStoreForContext,
  fallbacks: {
    baudRate: () => baudRate,
    db: () => db,
    db1: () => db1,
    db2: () => db2,
    file: () => file,
    localFlag: () => localFlag,
    nowDate: () => nowDate,
  },
});

const collectionStateStore = createRuntimeStateStore({
  initialState: {
    collectOptions: normalizeCollectOptions({
      frequencyMode: 'serial',
      frequencyHz: DEFAULT_COLLECTION_FREQUENCY_HZ,
    }),
    colHZ: DEFAULT_COLLECTION_FREQUENCY_HZ,
    flag: false,
    saveTime: undefined,
  },
});
const getCollectionState = (key) => collectionStateStore.get(key);
const setCollectionState = (key, value) => collectionStateStore.set(key, value);
const collectionStateAccessor = (key) => ({
  get: () => getCollectionState(key),
  set: (value) => setCollectionState(key, value),
});
const collectionStorageClock = createCollectionStorageClock({
  getOptions: () => getCollectionState('collectOptions'),
  getFallbackFrequencyHz: () => getCollectionState('colHZ'),
});
let smallBed12BDisplayOptions = { matrixMode: '32x32', samplePoint: 'topLeft' };
let splitBuffer = Buffer.from([0xaa, 0x55, 0x03, 0x99]);
// let splitBuffer1 = Buffer.from([0xaa, 0x55, 0x03, 0x09]);
const serialRuntime = createSerialRuntime({
  frameDelimiter: splitBuffer,
  smallBed12BDelimiter: SMALL_BED_12B_FRAME_TAIL,
  logger,
});
const {
  serialParserManager,
  serialManager,
  serialRoles,
  serialPortStateAccessor,
  setSerialPortState,
} = serialRuntime;

const serialPortOrchestrator = createSerialPortOrchestrator({
  getBaudRate: runtimeContext.getBaudRate,
  getSerialConfig: appRuntime.displaySystems.getSerialConfig,
  getSensorType: runtimeContext.getSensorType,
  handleMinzhenSensorPortData,
  logger,
  minzhenType: MINZHEN_TYPE,
  serialManager,
  serialParserManager,
  serialRoles,
  smallBed12BType: SMALL_BED_12B_TYPE,
  listSerialChannels: appRuntime.displaySystems.listSerialChannels,
  resetMinzhenSensorExtractor: () => minzhenSensorExtractor.reset(),
});
const {
  closeAllManagedSerialPorts,
  closeManagedSerialPort,
  closeManagedSerialPorts,
  getManagedSerialPort,
  openBackSerialPort,
  openHeadSerialPort,
  openManagedSerialPort,
  openManifestSerialPort,
  openManifestSerialPorts,
  openSitSerialPort,
} = serialPortOrchestrator;

function getManagedSerialPorts() {
  return {
    port1: getManagedSerialPort(serialRoles.SIT),
    port2: getManagedSerialPort(serialRoles.BACK),
    portHead: getManagedSerialPort(serialRoles.HEAD),
    portSensor: getManagedSerialPort(serialRoles.SENSOR),
  };
}

serialManager.startReconnectLoop({
  intervalMs: 3000,
  reason: 'registered serial reconnect',
  onReconnect: (results) => {
    logger.info('[SerialManager] reconnect results', results);
  },
});

const webSocketRuntime = createWebSocketRuntime({
  logger,
  getSensorType: runtimeContext.getSensorType,
});
const {
  channelBus,
  publishRealtimeFrame: publishRealtimeFrameToRuntime,
  wsServer,
  wsSubscriptions,
} = webSocketRuntime;
let server = wsServer;

function publishRealtimeFrame(channel, jsonData) {
  return publishRealtimeFrameToRuntime(channel, jsonData);
}

function publishRealtimeChannel(channel, jsonData, { respectFrequency = true } = {}) {
  if (runtimeContext.isLocalPlayback()) return 0;
  if (respectFrequency && !shouldSendRealtimeFrame(channel)) return 0;
  return publishRealtimeFrame(channel, jsonData);
}

function publishSystemEvent(data) {
  return wsSubscriptions.publishScope('main', data);
}

function sendJqbedAlgorithmJson(client, payload) {
  if (!client || client.readyState !== 1) return false;
  try {
    client.send(JSON.stringify(payload));
    return true;
  } catch (error) {
    logger.warn('[JQBed] failed to send algorithm configuration response', error.message || error);
    return false;
  }
}

function setJqbedAlgorithmStatus(nextStatus) {
  if (JSON.stringify(nextStatus) === JSON.stringify(jqbedAlgorithmStatus)) return;
  jqbedAlgorithmStatus = nextStatus;
  publishSystemEvent({ jqbedAlgorithmStatus });
}

const jqbedAlgorithmProtocol = createJqbedAlgorithmProtocol({
  store: jqbedAlgorithmConfigStore,
  sendJson: sendJqbedAlgorithmJson,
  broadcastJson: publishSystemEvent,
  getAlgorithmStatus: () => jqbedAlgorithmStatus,
});

function getRealtimeChannelMetadata() {
  const sensorType = runtimeContext.getSensorType();
  const manifestChannels = appRuntime.displaySystems.listSerialChannels(sensorType);
  const realtimeChannels = buildRealtimeChannelMetadata({
    sensorType,
    manifestChannels,
    managedChannels: serialManager.getStatus(),
  });

  return [
    ...realtimeChannels,
    ...buildTelemetryChannelDefinitions(
      sensorType,
      realtimeChannels.map((channel) => channel.channelId),
    ),
  ];
}

function publishHistoryDateList() {
  const sensorType = runtimeContext.getSensorType();
  const sitDb = runtimeContext.getDatabase('sit');
  const backDb = runtimeContext.getDatabase('back');
  const sitRows = queryHistoryDates(sitDb, 500, 0, logger);
  sitTimeArr = sitRows;

  if (isCar(sensorType)) {
    const backRows = queryHistoryDates(backDb, 500, 0, logger);
    backTimeArr = backRows;
    const mergedTimeArr = dedupli(sitTimeArr, backTimeArr);

    if (sensorType === 'car') {
      publishSystemEvent({
        timeArr: mergedTimeArr,
        backData: new Array(backTotal).fill(0),
      });
    }

    if (sensorType === 'car10') {
      publishSystemEvent({
        timeArr: backRows,
        backData: new Array(100).fill(0),
      });
    }
  }

  const timeArr = isCar(sensorType) ? dedupli(sitTimeArr, backTimeArr) : sitRows;
  publishSystemEvent({
    timeArr: sensorType === 'bigBed' ? sitRows : timeArr,
    index: getPlaybackState('nowIndex'),
    sitData: new Array(sensorType === 'bigBed' ? 2048 : sitTotal).fill(0),
  });

  if (isCar(sensorType)) {
    publishSystemEvent({
      backData: new Array(backTotal).fill(0),
    });

    if (isThreePortFile(sensorType)) {
      publishSystemEvent({
        headData: new Array(100).fill(0),
      });
    }
  }
}

const petCareRuntimeService = createPetCareRuntimeService({
  buildJqbedGetDataArgs,
  getJqbedAlgorithmConfigSnapshot: jqbedAlgorithmConfigStore.getSnapshot,
  logger,
  callPy,
  getPointArr: () => pointArr,
  getFile: runtimeContext.getSensorType,
  getPort: () => getManagedSerialPort(serialRoles.SIT),
  probeJqbedAlgorithmConfig: () => callPy('health', {}, { timeoutMs: 10000 }),
  publishSystemEvent,
  setJqbedAlgorithmStatus,
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
    file: runtimeContext.getSensorType(),
    historyArr,
  }),
  getDatabases: () => ({
    db: runtimeContext.getDatabase('sit'),
    db1: runtimeContext.getDatabase('back'),
    db2: runtimeContext.getDatabase('head'),
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
    db: runtimeContext.getDatabase('sit'),
    db1: runtimeContext.getDatabase('back'),
  }),
  isCar,
  getSensorType: runtimeContext.getSensorType,
  publishSystemEvent,
});

const controlCommandRouter = createControlCommandRouter({ logger });
controlCommandRouter.register(createJqbedAlgorithmCommandHandler({
  protocol: jqbedAlgorithmProtocol,
  getRuntimeContext: () => ({
    activeFile: runtimeContext.getSensorType(),
    licenseValid: runtimeContext.getNowDate() < endDate,
    realtime: !runtimeContext.isLocalPlayback(),
  }),
}));
const runtimeStatePatchers = createRuntimeStatePatchers({
  setCollectionState,
  setPlaybackState,
  setSerialPortState,
  mutableSetters: {
    smallBed12BDisplayOptions: (value) => { smallBed12BDisplayOptions = value; },
    history: (value) => { history = value; },
    up: (value) => { up = value; },
    down: (value) => { down = value; },
    interval: (value) => { interval = value; },
    playFlag: (value) => { playFlag = value; },
    baudRate: (value) => { baudRate = value; },
    gauss: (value) => { gauss = value; },
    smoothValue: (value) => { smoothValue = value; },
    file: (value) => { file = value; },
    db: (value) => { db = value; },
    db1: (value) => { db1 = value; },
    db2: (value) => { db2 = value; },
    localFlag: (value) => { localFlag = value; },
    getTime: (value) => { getTime = value; },
    nowGetTime: (value) => { nowGetTime = value; },
    sitClose: (value) => { sitClose = value; },
    backClose: (value) => { backClose = value; },
    headClose: (value) => { headClose = value; },
    sensorClose: (value) => { sensorClose = value; },
    com: (value) => { com = value; },
    com1: (value) => { com1 = value; },
    comhead: (value) => { comhead = value; },
    comSensor: (value) => { comSensor = value; },
  },
});

function getStoredLicenseKey() {
  return readStoredLicenseKey({ preferredPath: writableNameTxt || nameTxt });
}

function activateSubmittedLicenseKey(licenseKey) {
  const validation = validateLicenseKey(licenseKey, {
    decryptStr: module2.decryptStr,
    fallbackFile: runtimeContext.getSensorType() || defauleFile,
  });
  if (!validation.ok) return validation;

  const state = validation.state;
  writeStoredLicenseKey(licenseKey, { targetPath: writableNameTxt });
  licenseFile = state.licenseFile;
  selectFlag = state.selectFlag;
  endDate = state.endDate;

  if (state.nextFile) {
    file = state.nextFile;
    baudRate = getSensorBaudRate(file);
    petCareRuntimeService.resetAll();
    runtimeStatePatchers.applySerialCommandPatch({ file, baudRate });
  }

  return {
    ok: true,
    code: 'OK',
    payload: {
      date: endDate,
      nowDate: runtimeContext.getNowDate(),
      file: licenseFile || file,
      currentSensorType: file,
      selectFlag,
      ...(state.moduleConfig ? { moduleConfig: state.moduleConfig } : {}),
    },
  };
}

// 娉ㄥ唽杩愯鏃舵帶鍒跺懡浠わ紝getRuntime/setRuntime 鏄棫杩愯鏃跺彉閲忕殑杩囨浮閫傞厤灞傘€?
registerRuntimeCommandHandlers(controlCommandRouter, {
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
    backTotal,
    colHZ: getCollectionState('colHZ'),
    com,
    com1,
    collectOptions: getCollectionState('collectOptions'),
    detectedInterval,
    endDate,
    file: runtimeContext.getSensorType(),
    nowDate: runtimeContext.getNowDate(),
    playFlag,
    ...getManagedSerialPorts(),
    sitTotal,
  }),
  setRuntime: runtimeStatePatchers.applyRuntimeCommandPatch,
});

registerSerialControlHandlers(controlCommandRouter, {
  HAND_GLOVE_DOUBLE,
  closeAllManagedSerialPorts,
  closeManagedSerialPort,
  closeManagedSerialPorts,
  closeMinzhenSensorPort,
  getPort,
  getRuntime: () => ({
    backTotal,
    com,
    com1,
    endDate,
    file: runtimeContext.getSensorType(),
    nowDate: runtimeContext.getNowDate(),
    ...getManagedSerialPorts(),
    sitTotal,
  }),
  getSensorBaudRate,
  initDb,
  isCar,
  isThreePortFile,
  listPorts,
  loadSelectedHistory,
  logSerialPortList,
  logger,
  openBackSerialPort,
  openHeadSerialPort,
  openManifestSerialPort,
  openManifestSerialPorts,
  openMinzhenSensorPort,
  openSitSerialPort,
  petCareRuntimeService,
  publishHistoryDateList,
  publishSystemEvent,
  rebindDisplaySystemRuntime: appRuntime.displaySystems.rebindRuntimeChannels,
  serialRoles,
  setRuntime: runtimeStatePatchers.applySerialCommandPatch,
  stopPlaybackTimer,
});

const controlCommandService = createControlCommandService({
  commandRouter: controlCommandRouter,
  logger,
});

let up = 1245, down = 2

const zeroCommandService = createZeroCommandService({
  getRuntime: () => ({
    newArr147: getZeroState('newArr147'),
    newArr147_2: getZeroState('newArr147_2'),
    pointArr,
    pointArr1RawZeroData: getZeroState('pointArr1RawZeroData'),
    pointArr1zeroData: getZeroState('pointArr1zeroData'),
    pointArr2,
    pointArr2RawZeroData: getZeroState('pointArr2RawZeroData'),
    pointArr2zeroData: getZeroState('pointArr2zeroData'),
    pointArr3,
    pointArr3zeroData: getZeroState('pointArr3zeroData'),
    pointArr4,
    pointArr4zeroData: getZeroState('pointArr4zeroData'),
  }),
  setZeroState,
});

const webSocketHandlerContext = createWebSocketHandlerContext({
  dependencies: {
    SMALL_BED_12B_TYPE,
    TEMP_FULL_BED_TYPE,
    WILDCARD_CHANNEL,
    activateSubmittedLicenseKey,
    attachHeartbeat,
    buildTempFullBedPlaybackPayload,
    controlCommandService,
    formatMatrixTotalForFile,
    fs,
    getDefaultFileFromLicense,
    getHistorySeries,
    getStoredLicenseKey,
    getSelectFlagFromLicense,
    getSensorBaudRate,
    getStoredSitData,
    isSmallBedMatrixType,
    logger,
    module2,
    normalizeHistoryPressureData,
    parseJsonMessage,
    parseStoredFrameData,
    path,
    petCareRuntimeService,
    publishPlaybackFrame,
    publishSystemEvent,
    server,
    totalToN,
    writableNameTxt,
    wsSubscriptions,
    zeroCommandService,
  },
  mutableAccessors: {
    backAreaSelect: { get: () => backAreaSelect, set: (value) => { backAreaSelect = value; } },
    backPressSelect: { get: () => backPressSelect, set: (value) => { backPressSelect = value; } },
    baudRate: { get: runtimeContext.getBaudRate, set: (value) => { baudRate = value; } },
    endDate: { get: () => endDate, set: (value) => { endDate = value; } },
    file: { get: runtimeContext.getSensorType, set: (value) => { file = value; } },
    historyArr: { get: () => historyArr, set: (value) => { historyArr = value; } },
    length: { get: () => length, set: (value) => { length = value; } },
    licenseFile: { get: () => licenseFile, set: (value) => { licenseFile = value; } },
    localFlag: { get: runtimeContext.isLocalPlayback, set: (value) => { localFlag = value; } },
    nameTxt: { get: () => nameTxt, set: (value) => { nameTxt = value; } },
    newback: { get: () => newback, set: (value) => { newback = value; } },
    nowDate: { get: runtimeContext.getNowDate, set: (value) => { nowDate = value; } },
    pointArr: { get: () => pointArr, set: (value) => { pointArr = value; } },
    pointArr2: { get: () => pointArr2, set: (value) => { pointArr2 = value; } },
    pointArr3: { get: () => pointArr3, set: (value) => { pointArr3 = value; } },
    pointArr4: { get: () => pointArr4, set: (value) => { pointArr4 = value; } },
    selectFlag: { get: () => selectFlag, set: (value) => { selectFlag = value; } },
    serverOpened: { get: () => serverOpened, set: (value) => { serverOpened = value; } },
    serverShutdownRequested: { get: () => serverShutdownRequested, set: (value) => { serverShutdownRequested = value; } },
    sitAreaSelect: { get: () => sitAreaSelect, set: (value) => { sitAreaSelect = value; } },
    sitPressSelect: { get: () => sitPressSelect, set: (value) => { sitPressSelect = value; } },
    timeStamp: { get: () => timeStamp, set: (value) => { timeStamp = value; } },
  },
  playbackStateAccessor,
  serialPortStateAccessor,
  zeroStateAccessor,
});

const attachWebSocketHandlers = createWebSocketHandlerAttacher(webSocketHandlerContext);

module.exports = {
  openServer: attachWebSocketHandlers,
};

scanStartupSerialPorts({
  getPort,
  listPorts,
  logger,
  logSerialPortList,
  setSerialPortState,
});
let index = 0

// 小床 12B runtime 装配由 factory 负责，server.js 只保留状态回写和输出注入。
const smallBed12BRuntime = createServerSmallBedRuntime({
  smallBed12B,
  smallBed12BType: SMALL_BED_12B_TYPE,
  runtimeContext,
  getLineOrder: () => jqbed,
  getZeroFrame: () => getZeroState('pointArr1zero'),
  subtractZero: numLessZeroToZero,
  calibration: smallBed12BCalibration,
  getDisplayOptions: () => smallBed12BDisplayOptions,
  getHz: () => getCollectionState('colHZ'),
  transposeSquareMatrix,
  getEndDate: () => endDate,
  setCurrentPressureFrame: (frame) => {
    pointArr = frame;
  },
  setZeroSourceFrame: (frame) => {
    setZeroState('pointArr1zeroData', frame);
  },
  setCurrentDisplayData: (frame) => {
    newData = frame;
  },
  sendSitFrame: colOrSendData,
});

const {
  sit1024FrameProcessor,
  backHead1024FrameProcessor,
} = createServerSensorProcessors({
  HAND_SINGLE_POINT_TYPE,
  MINZHEN_TYPE,
  WHOLE_CHAIR_TYPE,
  arrToRealLine,
  car10Sit,
  car10Back,
  carCol,
  carBackLine,
  carSitLine,
  carYLine,
  endiSit1024,
  gloves,
  gloves1,
  gloves2,
  handBlue,
  handSinglePoint,
  isCar,
  isPetCareSystem: (sensorType) => petCareRuntimeService.isPetCareSystem(sensorType),
  isSmallBedMatrixType,
  jqbed,
  matColLine,
  maskMinzhenMatrixValues,
  newHand,
  normalizeWholeChairFrame,
  numLessZeroToZero,
  press6sit,
  pressNew1220,
  pressNew12203131,
  rect,
  short,
  sit10Line,
  sit100Line,
  smallBed1,
  smallM1,
  tempFullBed,
  wowSitLine,
  wowBackLine,
  wowhead,
  xiyueReal1,
  yanfeng10sit,
  yanfeng10back,
});

const {
  runtimeStateAccessor,
  runtimeStateStore,
} = createServerRuntimeStateStore({
  runtimeStatePatchers,
  accessors: {
    baudRate: { get: () => baudRate, set: (value) => { baudRate = value; } },
    db: { get: () => db, set: (value) => { db = value; } },
    db1: { get: () => db1, set: (value) => { db1 = value; } },
    db2: { get: () => db2, set: (value) => { db2 = value; } },
    file: { get: () => file, set: (value) => { file = value; } },
    localFlag: { get: () => localFlag, set: (value) => { localFlag = value; } },
    newArr147: zeroStateAccessor('newArr147'),
    newArr147_2: zeroStateAccessor('newArr147_2'),
    nowDate: { get: () => nowDate, set: (value) => { nowDate = value; } },
    pointArr: { get: () => pointArr, set: (value) => { pointArr = value; } },
    pointArr1RawZero: zeroStateAccessor('pointArr1RawZero'),
    pointArr1RawZeroData: zeroStateAccessor('pointArr1RawZeroData'),
    pointArr1zero: zeroStateAccessor('pointArr1zero'),
    pointArr1zeroData: zeroStateAccessor('pointArr1zeroData'),
    pointArr2: { get: () => pointArr2, set: (value) => { pointArr2 = value; } },
    pointArr2RawZero: zeroStateAccessor('pointArr2RawZero'),
    pointArr2RawZeroData: zeroStateAccessor('pointArr2RawZeroData'),
    pointArr2zero: zeroStateAccessor('pointArr2zero'),
    pointArr2zeroData: zeroStateAccessor('pointArr2zeroData'),
    pointArr147zero: zeroStateAccessor('pointArr147zero'),
    pointArr147zero_2: zeroStateAccessor('pointArr147zero_2'),
    port1: { get: () => getManagedSerialPort(serialRoles.SIT) },
    port2: { get: () => getManagedSerialPort(serialRoles.BACK) },
  },
});
runtimeStateStoreForContext = runtimeStateStore;

const {
  handPacketRuntime,
  handleHandGloveDoublePacket,
  handleHandGloveFullPacket,
} = createServerHandRuntime({
  fullPacketType: HAND_GLOVE_FULL_PACKET,
  doublePacketType: HAND_GLOVE_DOUBLE,
  parseFullPacket: parseHandGloveFullPacket,
  mapFullPacketModelMatrix: mapHandGloveFullPacketModelMatrix,
  createDoublePacketParser: handGloveDouble.createHandGloveDoublePacketParser,
  normalizeFiniteFrame,
  bytes4ToInt10,
  numLessZeroToZero,
  handL,
  handR,
  handRVideo1470506,
  publishSit: colOrSendData,
  publishBack: colOrSendData1,
  runtimeStateStore,
});

const {
  frameOutputPipeline,
} = createServerFramePipeline({
  runtimeContext,
  publishRealtimeChannel,
  isCollecting: () => Boolean(getCollectionState('flag')),
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
  minzhenType: MINZHEN_TYPE,
  applyMinzhenBackendGauss,
});
appRuntime.displaySystems.bindRuntimeChannels({
  serialManager,
  serialParserManager,
  frameOutputPipeline,
  getSensorType: runtimeContext.getSensorType,
});

function colOrSendData(jsonData) {
  return frameOutputPipeline.publishSit(jsonData);
}



function colOrSendData1(jsonData) {
  return frameOutputPipeline.publishBack(jsonData);
}







function colOrSendData2(jsonData) {
  return frameOutputPipeline.publishHead(jsonData);
}

const legacySerialFrameRuntimeBaseContext = {
  HAND_GLOVE_FULL_PACKET,
  HAND_GLOVE_FULL_PACKET_LENGTH,
  MINZHEN_TYPE,
  backHead1024FrameProcessor,
  bytes4ToInt10,
  colOrSendData,
  colOrSendData1,
  colOrSendData2,
  enqueueCollectionInsert,
  footL,
  footR,
  footVideo,
  footVideo1,
  gloves0123,
  gloves0123Res,
  handL,
  handR,
  handRVideo1470506,
  handVideo1_0416_0506,
  handVideoRealPoint_0506_3,
  handleHandGloveDoublePacket,
  handleHandGloveFullPacket,
  hasEnoughCollectionDiskSpace,
  isCar,
  isHandGloveType,
  isSmallBedMatrixType,
  numLessZeroToZero,
  parseMinzhenSensorFrame,
  publishSystemEvent,
  shouldStoreCollectionFrame,
  sit1024FrameProcessor,
  smallBed12BRuntime,
  zeroLineMatrix,
};

const { legacySerialRuntimeContext } = bindLegacySerialRuntime({
  baseContext: legacySerialFrameRuntimeBaseContext,
  collectionStateAccessor,
  getManagedSerialPort,
  mutableBindings: {
    baudRate: { get: runtimeContext.getBaudRate, set: (value) => { baudRate = value; } },
    dataFalg: { get: () => dataFalg, set: (value) => { dataFalg = value; } },
    db: { get: () => runtimeContext.getDatabase('sit'), set: (value) => { db = value; } },
    endDate: { get: () => endDate, set: (value) => { endDate = value; } },
    file: { get: runtimeContext.getSensorType, set: (value) => { file = value; } },
    firstData: { get: () => firstData, set: (value) => { firstData = value; } },
    jqbedMatrixOrigin: { get: () => jqbedMatrixOrigin, set: (value) => { jqbedMatrixOrigin = value; } },
    lastData: { get: () => lastData, set: (value) => { lastData = value; } },
    localFlag: { get: runtimeContext.isLocalPlayback, set: (value) => { localFlag = value; } },
    newData: { get: () => newData, set: (value) => { newData = value; } },
    nowDate: { get: runtimeContext.getNowDate, set: (value) => { nowDate = value; } },
    pointArr: { get: () => pointArr, set: (value) => { pointArr = value; } },
    pointArr2: { get: () => pointArr2, set: (value) => { pointArr2 = value; } },
    pointArr3: { get: () => pointArr3, set: (value) => { pointArr3 = value; } },
    pointArr4: { get: () => pointArr4, set: (value) => { pointArr4 = value; } },
    useMatrixOrigin: { get: () => useMatrixOrigin, set: (value) => { useMatrixOrigin = value; } },
  },
  runtimeStateAccessor,
  serialRoles,
  zeroStateAccessor,
  serialParserManager,
});

jqbedTimer = petCareRuntimeService.startVitalSignsTimer();
petCareTimer = petCareRuntimeService.startPetCareTimer('petCare');
petCareMiniTimer = petCareRuntimeService.startPetCareTimer('petCareMini');

module.exports.shutdownServer = shutdownServer;

function getWsServer(channel = 'sit') {
  // 保留 channel 参数，任意 manifest outputChannel 都映射到同一物理服务。
  void channel;
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
module.exports.publishRealtimeFrame = publishRealtimeFrame;
module.exports.getWsSubscriptionStatus = getWsSubscriptionStatus;
module.exports.getRealtimeChannels = getRealtimeChannels;
module.exports.getChannelBusStatus = getChannelBusStatus;
module.exports.handleCommand = handleCommand;

const httpApp = createHttpApp({
  controlCommandService,
  getChannelBusStatus,
  getDisplaySystemById,
  getDisplaySystemBuilderCatalog: appRuntime.displaySystems.getBuilderCatalog,
  getDisplaySystemEditorById,
  getDisplaySystemStatus,
  getPort,
  getRealtimeChannels,
  getSerialStatus: () => serialManager.getStatus(),
  getSitDb: () => runtimeContext.getDatabase('sit'),
  getWsSubscriptionStatus,
  imgPath,
  listPorts,
  logger,
  pdfPath,
  serialManager,
  // 串口协议预设：内置的在 serial/protocols/，用户自定义的在可写目录下的 serial-protocols/。
  serialProtocolDirectories: appRuntime.serialProtocolDirectories,
  reloadDisplaySystems: appRuntime.displaySystems.reload,
  saveDisplaySystem: appRuntime.displaySystems.save,
  saveDisplaySystemDisplaySection: appRuntime.displaySystems.saveDisplaySection,
  duplicateDisplaySystem: appRuntime.displaySystems.duplicate,
});
// ===== OneStep 足压报告 HTTP 服务状态 =====
// 默认仅监听 127.0.0.1，供前端上传截图、生成 PDF 和调用控制 API。
reportHttpServer = startLocalHttpServer({
  app: httpApp,
  logger,
  port: DEFAULT_REPORT_HTTP_PORT,
});
