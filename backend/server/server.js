/**
 * 后端启动编排入口。
 *
 * 阅读路线：
 * - 串口如何打开：看 backend/serial/serialManager.js
 * - 串口如何分帧：看 backend/serial/serialParserManager.js
 * - 传感器数据如何解析：看 backend/sensors/runtime/*
 * - 实时帧如何入库和推送：看 backend/services/realtime/frameOutputPipelineService.js
 * - 历史回放如何加载：看 backend/services/history/historyPlaybackService.js
 * - WebSocket 如何连接和兼容旧消息：看 backend/server/webSocketHandlerFactory.js
 * - 服务如何关闭：看 backend/services/lifecycle/serverLifecycleService.js
 *
 * 当前文件只负责创建对象、注入依赖和保留旧兼容入口。
 */
const logger = require('../common/logger');
const { createChannelBus } = require('../channel/channelBus');
const {
  buildTelemetryChannelDefinitions,
} = require('../channel/telemetryChannelService');
const { startWorker, callPy, stopWorker } = require('../python/pyWorker');
const { normalizeChannel } = require('../services/websocket/websocketChannelService');
const { createWebSocketServers } = require('./webSocketServerFactory');
const { createWebSocketHandlerAttacher } = require('./webSocketHandlerFactory');
const {
  WILDCARD_CHANNEL,
  createWebSocketSubscriptionManager,
} = require('../services/websocket/websocketSubscriptionService');
const { attachHeartbeat } = require('../services/websocket/websocketConnectionService');
const { parseJsonMessage } = require('../services/websocket/websocketMessageService');
const {
  closeHttpServer,
  closeWithTimeout,
  closeWsServer,
} = require('../services/lifecycle/serverLifecycleService');
const { createRealtimeTelemetryGateway } = require('../services/realtime/realtimeTelemetryGateway');
const { createPetCareRuntimeService } = require('../services/petcare/petCareRuntimeService');
const { createWebSocketCommandRouter } = require('../ws/webSocketCommandRouter');
const { registerRuntimeCommandHandlers } = require('../ws/registerRuntimeCommandHandlers');
const { registerSerialCommandHandlers } = require('../ws/registerSerialCommandHandlers');
const { createControlCommandService } = require('../application/controlCommandService');
const { createHttpApp } = require('./httpAppFactory');
const { syncSystemTime } = require('./systemTimeSyncService');
const {
  DEFAULT_REPORT_HTTP_PORT,
  scanStartupSerialPorts,
  startLocalHttpServer,
} = require('./bootstrapServer');
const { createSmallBed12BRuntime } = require('../sensors/runtime/smallBed12BRuntime');
const { createSit1024FrameProcessor } = require('../sensors/runtime/sit1024FrameProcessor');
const { createBackHead1024FrameProcessor } = require('../sensors/runtime/backHead1024FrameProcessor');
const { createHandPacketRuntime } = require('../sensors/runtime/handPacketRuntime');
const { createLegacySerialRuntimeBinding } = require('../sensors/runtime/legacySerialRuntimeBinding');
const { createRuntimeStateStore } = require('../runtime/runtimeStateStore');
const { createZeroStateStore } = require('../runtime/zeroStateStore');
const { createZeroCommandService } = require('../runtime/zeroCommandService');
const {
  createLegacySerialFrameRuntimeAccessors,
  createMutableAccessor,
} = require('../runtime/legacyRuntimeAccessorFactory');
const { createWebSocketContextAccessors } = require('../runtime/webSocketContextAccessorFactory');
const {
  DEFAULT_COLLECTION_FREQUENCY_HZ,
  createCollectionDiskSpaceGuard,
  createCollectionStorageClock,
  normalizeCollectFrequency,
  normalizeCollectOptions,
} = require('../services/collection/collectionService');
const { createCollectionInsertQueueService } = require('../services/collection/collectionInsertQueueService');
const { createCollectionFrameStorageService } = require('../services/collection/collectionFrameStorageService');
const { createFrameOutputPipeline } = require('../services/realtime/frameOutputPipelineService');
const {
  createHistoryRowsForPlayback,
  getHistoryStats,
  queryHistoryDates,
  queryHistoryRows,
} = require('../services/history/historyQueryService');
const {
  buildZeroPlaybackPayload: buildHistoryZeroPlaybackPayload,
  getHistoryLengthFromCounts,
  getHistorySeries: createHistorySeries,
} = require('../services/history/historyPlaybackService');
const { createPlaybackFrameService } = require('../services/playback/playbackFrameService');
const { createPlaybackTimerService } = require('../services/playback/playbackTimerService');
const { createCsvDownloadService } = require('../services/export/csvDownloadService');
const { createHistoryMaintenanceService } = require('../services/history/historyMaintenanceService');
const { createHistoryFrameTransformService } = require('../services/history/historyFrameTransformService');
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
const { createSerialPortFilterService } = require("../serial/serialPortFilterService");
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

// ===== 传感器常量与插件引用 =====
// 从 registry 读取类型、能力和插件，避免业务代码重复写传感器字符串。
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

/**
 * 将敏枕矩阵中已知不稳定的点位强制置零。
 *
 * @param {unknown[]} frame 可变的压力矩阵。
 * @returns {unknown[]} 置零后的同一个矩阵引用。
 */
const maskMinzhenMatrixValues = minzhen.maskMatrixValues;

/**
 * 对敏枕帧应用后端高斯平滑处理。
 *
 * @param {unknown[]} frame 敏枕压力矩阵。
 * @returns {unknown[]} 平滑后的压力矩阵。
 */
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

const serialPortFilterService = createSerialPortFilterService({ logger });
const {
  getPort,
  logSerialPortList,
} = serialPortFilterService;

// zeroStateStore 统一保存零点基准帧、原始零点源帧和 legacy 映射缓存。
const zeroStateStore = createZeroStateStore();
const getZeroState = (key) => zeroStateStore.get(key);
const setZeroState = (key, value) => zeroStateStore.set(key, value);
const zeroStateAccessor = (key) => ({
  get: () => getZeroState(key),
  set: (value) => setZeroState(key, value),
});

// 历史帧转换服务集中处理回放、导出和采集存储中的数据格式细节。
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
    file,
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
 * @param {'sit' | 'back' | 'head'} channel 实时通道名称。
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

// ===== 串口、实时和回放状态 =====
// baudRate 是当前主串口波特率；实际端口实例统一由 serialManager 按角色管理。
// localFlag、playFlag、interval、timer 描述历史回放状态；nowIndex 和历史行缓存已迁入 playbackStateStore。
let baudRate = 1000000

const timeNum = 1000 / 12;
let localFlag = false,
  playFlag = false,
  interval = timeNum,
  detectedInterval = timeNum,
  time;



// ===== 历史回放统计与框选状态 =====
// timeStamp/historyArr 保存当前历史时间轴和范围；backAreaSelect/sitAreaSelect 等数组保存前端框选统计结果。
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
// ===== 生命体征与宠物看护运行缓存 =====
// 下方变量缓存 jqbed、smallBed、petCare 的算法状态、在床计时、心率模拟器和最近一次矩阵数据。
let smoothValue = 0;
let useMatrixOrigin = false; // jqbed 调试开关：true 时使用算法返回的 matrix_origin 作为 sitData。
let jqbedMatrixOrigin = null; // 缓存算法返回的 matrix_origin 数据。
let lastData = new Array(1024).fill(0),
  firstData = new Array(1024).fill(0);
const backTotal = backnum1 * backnum2;
const sitTotal = sitnum1 * sitnum2;
let length, history, nowGetTime;

let nowDate = 0;
let endDate = 0;

syncSystemTime({
  http: require('http'),
  logger,
  setNowDate: (timestamp) => {
    nowDate = timestamp;
  },
});

// ===== 运行路径与资源目录 =====
// 开发态写入项目目录；打包态区分 resourcesPath 和 userData，避免把数据库、图片和配置写进 asar。
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const isPackagedRuntime = Boolean(electronApp?.isPackaged);
const runtimeResourceRoot = isPackagedRuntime ? process.resourcesPath : PROJECT_ROOT;
const runtimeWritableRoot = isPackagedRuntime ? electronApp.getPath('userData') : PROJECT_ROOT;
const exportRoot = isPackagedRuntime
  ? (process.platform === 'darwin' ? app.getPath('desktop') : process.resourcesPath)
  : runtimeWritableRoot;
// filePath、csvPath、imgPath、pdfPath 是运行期可写目录；nameTxt 是当前读取的授权配置文件，writableNameTxt 是写入目标。
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

/**
 * 向前端广播采集存储错误，并附带磁盘剩余空间和当前采集上下文。
 *
 * @param {object} error 错误详情。
 * @returns {number} 推送到的客户端数量。
 */
function broadcastCollectionStorageError(error = {}) {
  return publishSystemEvent( {
    collectionStorageError: {
      message: error.message || '数据库空间不足，已停止采集',
      freeBytes: error.freeBytes,
      minFreeBytes: error.minFreeBytes,
      file,
      saveTime: getCollectionState('saveTime'),
    },
  });
}

/**
 * 获取采集数据库目录当前可用空间。
 *
 * @returns {number | null} 可用字节数，读取失败时由 guard 返回 null。
 */
function getCollectionFreeBytes() {
  return collectionDiskSpaceGuard.getFreeBytes();
}

/**
 * 因磁盘或数据库写入错误停止采集，并通知前端。
 *
 * @param {Error | string} error 错误对象或消息。
 * @param {object} extra 附加上报字段。
 */
function stopCollectionForStorageError(error, extra = {}) {
  flushCollectionInsertQueues();
  setCollectionState('flag', false);
  const message = error?.message || String(error || '数据库写入失败，已停止采集');
  logger.error('[Collection] stop collection:', message);
  broadcastCollectionStorageError({
    message: message.includes('database or disk is full')
      ? '磁盘空间不足，数据库写入失败，已自动停止采集'
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
      new Error('磁盘剩余空间不足，已自动停止采集'),
      { freeBytes, minFreeBytes },
    );
  },
});

/**
 * 判断采集目录是否还有足够磁盘空间。
 *
 * @returns {boolean} 是否满足最低剩余空间要求。
 */
function hasEnoughCollectionDiskSpace() {
  return collectionDiskSpaceGuard.hasEnoughSpace();
}

/**
 * 处理采集入库错误；磁盘满时停止采集，其他错误只记录日志。
 *
 * @param {Error | null} err 入库错误。
 * @param {'sit' | 'back' | 'head'} channel 当前入库通道。
 */
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

/**
 * 立即 flush 所有采集入库队列。
 */
function flushCollectionInsertQueues() {
  collectionInsertQueueService.flushAll();
}

/**
 * 将一条采集记录加入批量入库队列。
 *
 * @param {object} dbRef SQLite 数据库连接。
 * @param {unknown[]} params SQL 参数。
 * @param {'sit' | 'back' | 'head'} channel 采集通道名称。
 */
function enqueueCollectionInsert(dbRef, params, channel = 'sit') {
  collectionInsertQueueService.enqueue(dbRef, params, channel);
}

/**
 * 包装采集帧入队，统一补充时间戳和采集日期。
 *
 * @param {object} dbRef SQLite 数据库连接。
 * @param {string} dataToStore 已序列化的 matrix.data。
 * @param {'sit' | 'back' | 'head'} channel 采集通道名称。
 */
function enqueueCollectionFrame(dbRef, dataToStore, channel) {
  enqueueCollectionInsert(dbRef, [dataToStore, Date.now(), getCollectionState('saveTime')], channel);
}

/**
 * 初始化当前传感器类型对应的三路历史数据库。
 *
 * @param {string} fileStr 传感器类型。
 * @returns {{ db: object, db1: object, db2: object }} 数据库句柄集合。
 */
function initDb(fileStr) {
  return _initDbFromModule(fileStr, filePath, runtimeResourceRoot);
}

// ===== 历史查询和回放数据缓存 =====
// 大历史数据超过阈值时使用懒加载代理，避免一次性把全部 matrix 行读入内存。
const HISTORY_EAGER_ROW_LIMIT = 50000;
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

/**
 * 生成历史回放曲线数据，统一处理坐面和靠背历史行。
 *
 * @param {object} options 历史行和截取范围。
 * @returns {{ length: number, time: unknown[], press: number[], area: number[] }} 曲线数据。
 */
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

/**
 * 构建切换历史/实时状态时需要推送给前端的空白回放帧。
 *
 * @returns {object} 空白回放 payload。
 */
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

/**
 * 发布指定索引的历史回放帧。
 *
 * @param {number} index 历史帧索引。
 * @param {object} options 回放构造选项。
 */
function publishPlaybackFrame(index, options = {}) {
  const { sitPayload, backPayload, headPayload } = playbackFrameService.buildPayloads({
    sensorType: file,
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

/**
 * 向前端广播历史选择结果。
 *
 * @param {object} payload 历史选择 payload。
 * @returns {number} 推送到的客户端数量。
 */
function broadcastHistorySelectionPayload(payload) {
  return publishSystemEvent( payload);
}

/**
 * 加载指定日期的历史数据，并初始化回放曲线、索引和懒加载行代理。
 *
 * @param {string} dateLabel 历史采集日期。
 */
function loadSelectedHistory(dateLabel) {
  try {
    stopPlaybackTimer();
    patchPlaybackState({
      indexArr: [0, 0],
      localData: [],
      localDataBack: [],
      localDataHead: [],
      nowIndex: 0,
    });

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

    const sitRows = createHistoryRowsForPlayback(db, dateLabel, sitStats, eager, logger);
    let backRows = [];
    let headRows = [];
    if (isCar(file) && db1) {
      backRows = createHistoryRowsForPlayback(db1, dateLabel, backStats, eager, logger);
    }
    if (isThreePortFile(file) && db2) {
      headRows = createHistoryRowsForPlayback(db2, dateLabel, headStats, eager, logger);
    }
    patchPlaybackState({
      localData: sitRows,
      localDataBack: backRows,
      localDataHead: headRows,
    });

    const historySeries = getHistorySeries({
      sitRows,
      backRows,
      file,
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

/**
 * 停止历史回放定时器。
 */
function stopPlaybackTimer() {
  playbackTimer.stop();
}

/**
 * 启动历史回放定时器，并标记当前处于播放状态。
 */
function startPlaybackTimer() {
  playFlag = true;
  playbackTimer.start();
}

/**
 * 从时间戳数组推算实际采集帧间隔（ms）。
 * 取前 N 帧时间戳差值的中位数，过滤异常值，fallback 到 timeNum。
 *
 * @param {number[]} timestamps 历史帧时间戳数组。
 * @returns {number} 推算出的帧间隔毫秒数。
 */
function calcDetectedInterval(timestamps) {
  if (!Array.isArray(timestamps) || timestamps.length < 2) return timeNum;
  const sampleSize = Math.min(20, timestamps.length - 1);
  const diffs = [];
  for (let i = 1; i <= sampleSize; i++) {
    const d = timestamps[i] - timestamps[i - 1];
    if (d > 0 && d < 5000) diffs.push(d); // 过滤异常值（>5s 视为无效）。
  }
  if (diffs.length === 0) return timeNum;
  diffs.sort((a, b) => a - b);
  const median = diffs[Math.floor(diffs.length / 2)];
  return Math.max(1, median); // 最少 1ms。
}

// ===== 后端生命周期定时器 =====
// 周期任务句柄，shutdown 时统一清理；串口重连循环由 serialManager 内部维护。
let jqbedTimer = null;
let petCareTimer = null;
let petCareMiniTimer = null;
let reportHttpServer = null;
let serverOpened = false;
let serverShutdownRequested = false;
let serverShutdownPromise = null;

/**
 * 清理托管定时器并记录日志。
 *
 * @param {string} name 日志中展示的定时器名称。
 * @param {NodeJS.Timeout | null} timerRef 定时器句柄。
 * @returns {null} 清理后统一返回 null，便于调用方重置引用。
 */
function clearManagedInterval(name, timerRef) {
  if (!timerRef) return null;
  clearInterval(timerRef);
  logger.info(`[Server] Cleared ${name}`);
  return null;
}

/**
 * 关闭 SQLite 数据库连接，并把回调式 close 包装成 Promise。
 *
 * @param {object | null} dbRef 数据库连接。
 * @param {string} name 日志中展示的数据库名称。
 * @returns {Promise<void>} 关闭完成 Promise。
 */
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
 * 关闭定时器、串口、WebSocket/HTTP 服务、数据库和 Python worker。
 *
 * @returns {Promise<void>} 共享的关闭 Promise，保证重复调用时不会重复释放资源。
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
    serverOpened = false;
  });

  return serverShutdownPromise;
}



// ===== 当前授权、传感器类型和数据库句柄 =====
// file 是当前系统类型；licenseFile/selectFlag 来自授权文件；db/db1/db2 分别对应坐面、靠背、头枕三路历史库。
const defauleFile = 'hand0205'
let date, sysStartTime, file = defauleFile, selectFlag
let licenseFile = null

/**
 * 从授权文件的 file 字段推导前端可选类型标记。
 *
 * @param {string | string[] | null} licenseFile 授权中的 file 字段。
 * @returns {'all' | string[] | undefined} 前端 selectFlag。
 */
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

/**
 * 从授权 file 字段中取默认传感器类型。
 *
 * @param {string | string[] | null} licenseFile 授权中的 file 字段。
 * @param {string | null} fallback 无可用授权类型时的默认值。
 * @returns {string | null} 默认传感器类型。
 */
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
    // 根据授权中的 file 更新当前传感器波特率。
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

// ===== 前端采集控制消息状态 =====
// saveTime 已迁入 collectionStateStore；getTime 记录回放日期；com、com1、comhead、comSensor 保存前端选择的串口路径。
let getTime,

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

// ===== 采集配置和串口解析器 =====
// flag、colHZ、collectOptions 和 saveTime 已迁入 collectionStateStore；parser 系列变量是不同通道和协议使用的串口分帧器。
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
const serialParserManager = createSerialParserManager({
  frameDelimiter: splitBuffer,
  smallBed12BDelimiter: SMALL_BED_12B_FRAME_TAIL,
});
const serialManager = createSerialManager({
  parserManager: serialParserManager,
  logger,
});
const serialRoles = serialManager.roles;
const serialPortStateStore = createRuntimeStateStore({
  initialState: {
    serialport: { a: 1, b: 2 },
  },
});
const getSerialPortState = (key) => serialPortStateStore.get(key);
const setSerialPortState = (key, value) => serialPortStateStore.set(key, value);
const serialPortStateAccessor = (key) => ({
  get: () => getSerialPortState(key),
  set: (value) => setSerialPortState(key, value),
});

/**
 * 按串口角色即时读取托管端口实例。
 *
 * @param {string} role 串口角色。
 * @returns {object | null} 当前端口实例。
 */
function getManagedSerialPort(role) {
  return serialManager.getPort(role);
}

/**
 * 获取旧 runtime 仍使用的四个端口别名。
 *
 * 这些别名只做兼容快照，端口生命周期仍由 serialManager 持有。
 */
function getManagedSerialPorts() {
  return {
    port1: getManagedSerialPort(serialRoles.SIT),
    port2: getManagedSerialPort(serialRoles.BACK),
    portHead: getManagedSerialPort(serialRoles.HEAD),
    portSensor: getManagedSerialPort(serialRoles.SENSOR),
  };
}

/**
 * 根据当前传感器类型选择坐面串口 parser 通道。
 *
 * @returns {string} parser manager 中的通道名。
 */
function getSitParserChannel() {
  return file === SMALL_BED_12B_TYPE
    ? serialParserManager.channels.SMALL_BED_12B
    : serialParserManager.channels.SIT;
}

/**
 * 注册并打开一个托管串口角色。
 *
 * @param {string} role 串口角色。
 * @param {object} options 串口打开配置。
 * @returns {object | null} 打开的串口实例。
 */
function openManagedSerialPort(role, options = {}) {
  serialManager.registerPort(role, {
    ...options,
    role,
    reconnect: options.reconnect === true,
  });
  return serialManager.start(role);
}

/**
 * 关闭指定托管串口角色，并关闭该角色自动重连。
 *
 * @param {string} role 串口角色。
 * @param {string} reason 关闭原因。
 */
function closeManagedSerialPort(role, reason) {
  serialManager.setReconnect(role, false);
  serialManager.stop(role, reason);
}

/**
 * 打开坐面串口，并根据当前传感器类型选择普通、小床 12B 或 bigBed parser。
 *
 * @param {string} portPath 串口路径。
 * @param {string} reason 打开原因。
 * @returns {object | null} 打开的串口实例。
 */
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

/**
 * 打开靠背串口；敏枕类型会走文本数据 handler，其他类型走二进制 parser。
 *
 * @param {string} portPath 串口路径。
 * @param {string} reason 打开原因。
 * @returns {object | null} 打开的串口实例。
 */
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

/**
 * 打开头枕串口并绑定 HEAD parser。
 *
 * @param {string} portPath 串口路径。
 * @param {string} reason 打开原因。
 * @returns {object | null} 打开的串口实例。
 */
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
// ===== WebSocket 三通道与清零基准缓存 =====
// server/server1/server2 分别对应坐面、靠背、头枕推送通道；串口重连状态由 SerialManager 自己维护。
serialManager.startReconnectLoop({
  intervalMs: 3000,
  reason: 'registered serial reconnect',
  onReconnect: (results) => {
    logger.info('[SerialManager] reconnect results', results);
  },
});

let server, server1, server2;
const wsSubscriptions = createWebSocketSubscriptionManager({ logger });
const channelBus = createChannelBus();
const realtimeTelemetryGateway = createRealtimeTelemetryGateway({
  channelBus,
  wsSubscriptions,
  getSensorType: () => file,
});

/**
 * 发布一帧实时数据到兼容旧前端的实时通道和标准 telemetry 通道。
 *
 * @param {'sit' | 'back' | 'head'} channel 实时通道名称。
 * @param {string} jsonData 序列化后的实时帧数据。
 * @returns {number} 旧通道实际发送的客户端数量。
 */
function publishRealtimeFrame(channel, jsonData) {
  return realtimeTelemetryGateway.publishRealtimeFrame(channel, jsonData).legacySent;
}

/**
 * 发布实时通道数据，并根据回放状态和限频策略决定是否跳过。
 *
 * @param {'sit' | 'back' | 'head'} channel 实时通道名称。
 * @param {string} jsonData 序列化后的实时帧数据。
 * @param {{ respectFrequency?: boolean }} options 发布选项。
 * @returns {number} 实际发送的客户端数量。
 */
function publishRealtimeChannel(channel, jsonData, { respectFrequency = true } = {}) {
  if (localFlag) return 0;
  if (respectFrequency && !shouldSendRealtimeFrame(channel)) return 0;
  return publishRealtimeFrame(channel, jsonData);
}

/**
 * 向主 WebSocket scope 广播系统事件或控制反馈。
 *
 * @param {object | string} data 要广播的数据。
 * @returns {number} 实际发送的客户端数量。
 */
function publishSystemEvent(data) {
  return wsSubscriptions.publishScope('main', data);
}

/**
 * 获取当前旧实时通道和标准 telemetry 通道的元数据。
 *
 * @returns {object[]} 实时通道元数据列表。
 */
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

/**
 * 查询历史日期列表，并推送给前端历史回放入口。
 */
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
    index: getPlaybackState('nowIndex'),
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
  getPort: () => getManagedSerialPort(serialRoles.SIT),
  publishSystemEvent,
  // 宠物看护算法会返回 jqbed matrix_origin，这里写回主运行时状态供实时帧输出使用。
  setJqbedMatrixOrigin: (matrixOrigin) => {
    jqbedMatrixOrigin = matrixOrigin;
  },
});

// CSV 下载服务只接收能力函数和运行时快照，避免直接 import server.js 形成反向依赖。
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

// 历史维护服务负责删除历史记录；SQL 细节留在 service 层，server.js 只提供数据库句柄。
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

// 注册运行时控制命令：显示配置、历史回放、采集开关、CSV 导出和历史删除。
// 这里的 getRuntime/setRuntime 是旧运行时变量的过渡适配层，后续应迁入集中 runtimeState。
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
    backTotal,
    colHZ: getCollectionState('colHZ'),
    com,
    com1,
    collectOptions: getCollectionState('collectOptions'),
    detectedInterval,
    endDate,
    file,
    nowDate,
    playFlag,
    ...getManagedSerialPorts(),
    sitTotal,
  }),
  setRuntime: (next = {}) => {
    if (Object.prototype.hasOwnProperty.call(next, 'smallBed12BDisplayOptions')) smallBed12BDisplayOptions = next.smallBed12BDisplayOptions;
    if (Object.prototype.hasOwnProperty.call(next, 'history')) history = next.history;
    if (Object.prototype.hasOwnProperty.call(next, 'up')) up = next.up;
    if (Object.prototype.hasOwnProperty.call(next, 'down')) down = next.down;
    if (Object.prototype.hasOwnProperty.call(next, 'interval')) interval = next.interval;
    if (Object.prototype.hasOwnProperty.call(next, 'playFlag')) playFlag = next.playFlag;
    if (Object.prototype.hasOwnProperty.call(next, 'nowIndex')) setPlaybackState('nowIndex', next.nowIndex);
    if (Object.prototype.hasOwnProperty.call(next, 'saveTime')) setCollectionState('saveTime', next.saveTime);
    if (Object.prototype.hasOwnProperty.call(next, 'flag')) setCollectionState('flag', next.flag);
    if (Object.prototype.hasOwnProperty.call(next, 'colHZ')) setCollectionState('colHZ', next.colHZ);
    if (Object.prototype.hasOwnProperty.call(next, 'collectOptions')) setCollectionState('collectOptions', next.collectOptions);
    if (Object.prototype.hasOwnProperty.call(next, 'baudRate')) baudRate = next.baudRate;
    if (Object.prototype.hasOwnProperty.call(next, 'gauss')) gauss = next.gauss;
    if (Object.prototype.hasOwnProperty.call(next, 'smoothValue')) smoothValue = next.smoothValue;
    if (Object.prototype.hasOwnProperty.call(next, 'file')) file = next.file;
    if (Object.prototype.hasOwnProperty.call(next, 'db')) db = next.db;
    if (Object.prototype.hasOwnProperty.call(next, 'db1')) db1 = next.db1;
    if (Object.prototype.hasOwnProperty.call(next, 'db2')) db2 = next.db2;
    if (Object.prototype.hasOwnProperty.call(next, 'localData')) setPlaybackState('localData', next.localData);
    if (Object.prototype.hasOwnProperty.call(next, 'localDataBack')) setPlaybackState('localDataBack', next.localDataBack);
    if (Object.prototype.hasOwnProperty.call(next, 'localDataHead')) setPlaybackState('localDataHead', next.localDataHead);
    if (Object.prototype.hasOwnProperty.call(next, 'indexArr')) setPlaybackState('indexArr', next.indexArr);
    if (Object.prototype.hasOwnProperty.call(next, 'localFlag')) localFlag = next.localFlag;
    if (Object.prototype.hasOwnProperty.call(next, 'getTime')) getTime = next.getTime;
    if (Object.prototype.hasOwnProperty.call(next, 'nowGetTime')) nowGetTime = next.nowGetTime;
    if (Object.prototype.hasOwnProperty.call(next, 'sitClose')) sitClose = next.sitClose;
    if (Object.prototype.hasOwnProperty.call(next, 'backClose')) backClose = next.backClose;
    if (Object.prototype.hasOwnProperty.call(next, 'headClose')) headClose = next.headClose;
    if (Object.prototype.hasOwnProperty.call(next, 'sensorClose')) sensorClose = next.sensorClose;
    if (Object.prototype.hasOwnProperty.call(next, 'com')) com = next.com;
    if (Object.prototype.hasOwnProperty.call(next, 'com1')) com1 = next.com1;
    if (Object.prototype.hasOwnProperty.call(next, 'comhead')) comhead = next.comhead;
    if (Object.prototype.hasOwnProperty.call(next, 'comSensor')) comSensor = next.comSensor;
    if (Object.prototype.hasOwnProperty.call(next, 'serialport')) setSerialPortState('serialport', next.serialport);
  },
});

// 注册串口控制命令：串口打开/关闭、传感器类型切换、local 回放和自动连接。
// 具体业务已经下沉到 application/serialControlService，这里只暴露旧状态读写能力。
registerSerialCommandHandlers(wsCommandRouter, {
  HAND_GLOVE_DOUBLE,
  closeManagedSerialPort,
  closeMinzhenSensorPort,
  getPort,
  getRuntime: () => ({
    backTotal,
    com,
    com1,
    endDate,
    file,
    nowDate,
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
  openMinzhenSensorPort,
  openSitSerialPort,
  petCareRuntimeService,
  publishHistoryDateList,
  publishSystemEvent,
  serialRoles,
  setRuntime: (next = {}) => {
    if (Object.prototype.hasOwnProperty.call(next, 'file')) file = next.file;
    if (Object.prototype.hasOwnProperty.call(next, 'baudRate')) baudRate = next.baudRate;
    if (Object.prototype.hasOwnProperty.call(next, 'db')) db = next.db;
    if (Object.prototype.hasOwnProperty.call(next, 'db1')) db1 = next.db1;
    if (Object.prototype.hasOwnProperty.call(next, 'db2')) db2 = next.db2;
    if (Object.prototype.hasOwnProperty.call(next, 'nowIndex')) setPlaybackState('nowIndex', next.nowIndex);
    if (Object.prototype.hasOwnProperty.call(next, 'localData')) setPlaybackState('localData', next.localData);
    if (Object.prototype.hasOwnProperty.call(next, 'localDataBack')) setPlaybackState('localDataBack', next.localDataBack);
    if (Object.prototype.hasOwnProperty.call(next, 'localDataHead')) setPlaybackState('localDataHead', next.localDataHead);
    if (Object.prototype.hasOwnProperty.call(next, 'indexArr')) setPlaybackState('indexArr', next.indexArr);
    if (Object.prototype.hasOwnProperty.call(next, 'localFlag')) localFlag = next.localFlag;
    if (Object.prototype.hasOwnProperty.call(next, 'getTime')) getTime = next.getTime;
    if (Object.prototype.hasOwnProperty.call(next, 'nowGetTime')) nowGetTime = next.nowGetTime;
    if (Object.prototype.hasOwnProperty.call(next, 'sitClose')) sitClose = next.sitClose;
    if (Object.prototype.hasOwnProperty.call(next, 'backClose')) backClose = next.backClose;
    if (Object.prototype.hasOwnProperty.call(next, 'headClose')) headClose = next.headClose;
    if (Object.prototype.hasOwnProperty.call(next, 'sensorClose')) sensorClose = next.sensorClose;
    if (Object.prototype.hasOwnProperty.call(next, 'com')) com = next.com;
    if (Object.prototype.hasOwnProperty.call(next, 'com1')) com1 = next.com1;
    if (Object.prototype.hasOwnProperty.call(next, 'comhead')) comhead = next.comhead;
    if (Object.prototype.hasOwnProperty.call(next, 'comSensor')) comSensor = next.comSensor;
    if (Object.prototype.hasOwnProperty.call(next, 'serialport')) setSerialPortState('serialport', next.serialport);
  },
  stopPlaybackTimer,
});

const controlCommandService = createControlCommandService({
  commandRouter: wsCommandRouter,
  logger,
});

let up = 1245, down = 2

const wsServers = createWebSocketServers();
server = wsServers.sit;
server1 = wsServers.back;
server2 = wsServers.head;

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

// WebSocket 连接处理已迁入 factory；这里集中声明它仍需访问的旧运行时上下文。
const webSocketHandlerContext = {
  SMALL_BED_12B_TYPE,
  TEMP_FULL_BED_TYPE,
  WILDCARD_CHANNEL,
  attachHeartbeat,
  buildTempFullBedPlaybackPayload,
  controlCommandService,
  formatMatrixTotalForFile,
  fs,
  getDefaultFileFromLicense,
  getHistorySeries,
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
  server1,
  server2,
  totalToN,
  writableNameTxt,
  wsSubscriptions,
  zeroCommandService,
};

Object.defineProperties(webSocketHandlerContext, createWebSocketContextAccessors({
  mutableAccessors: {
    backAreaSelect: createMutableAccessor(() => backAreaSelect, (value) => { backAreaSelect = value; }),
    backPressSelect: createMutableAccessor(() => backPressSelect, (value) => { backPressSelect = value; }),
    baudRate: createMutableAccessor(() => baudRate, (value) => { baudRate = value; }),
    endDate: createMutableAccessor(() => endDate, (value) => { endDate = value; }),
    file: createMutableAccessor(() => file, (value) => { file = value; }),
    historyArr: createMutableAccessor(() => historyArr, (value) => { historyArr = value; }),
    length: createMutableAccessor(() => length, (value) => { length = value; }),
    licenseFile: createMutableAccessor(() => licenseFile, (value) => { licenseFile = value; }),
    localFlag: createMutableAccessor(() => localFlag, (value) => { localFlag = value; }),
    nameTxt: createMutableAccessor(() => nameTxt, (value) => { nameTxt = value; }),
    newback: createMutableAccessor(() => newback, (value) => { newback = value; }),
    nowDate: createMutableAccessor(() => nowDate, (value) => { nowDate = value; }),
    pointArr: createMutableAccessor(() => pointArr, (value) => { pointArr = value; }),
    pointArr2: createMutableAccessor(() => pointArr2, (value) => { pointArr2 = value; }),
    pointArr3: createMutableAccessor(() => pointArr3, (value) => { pointArr3 = value; }),
    pointArr4: createMutableAccessor(() => pointArr4, (value) => { pointArr4 = value; }),
    selectFlag: createMutableAccessor(() => selectFlag, (value) => { selectFlag = value; }),
    serverOpened: createMutableAccessor(() => serverOpened, (value) => { serverOpened = value; }),
    serverShutdownRequested: createMutableAccessor(() => serverShutdownRequested, (value) => { serverShutdownRequested = value; }),
    sitAreaSelect: createMutableAccessor(() => sitAreaSelect, (value) => { sitAreaSelect = value; }),
    sitPressSelect: createMutableAccessor(() => sitPressSelect, (value) => { sitPressSelect = value; }),
    timeStamp: createMutableAccessor(() => timeStamp, (value) => { timeStamp = value; }),
  },
  playbackStateAccessor,
  serialPortStateAccessor,
  zeroStateAccessor,
}));

const attachWebSocketHandlers = createWebSocketHandlerAttacher(webSocketHandlerContext);

module.exports = {
  openServer: attachWebSocketHandlers,
};

// 启动时先扫描一次串口列表，给前端和自动连接逻辑提供初始候选端口。
scanStartupSerialPorts({
  getPort,
  listPorts,
  logger,
  logSerialPortList,
  setSerialPortState,
});
// ===== 实时协议临时帧缓存 =====
// pointArr/newData 是当前解析帧；分段协议缓存已迁入 RuntimeStateStore。
let pointArr, newData;
let index = 0

// 小床 12B 的串口业务逻辑下沉到独立 runtime，server.js 只保留状态注入和事件绑定。
const smallBed12BRuntime = createSmallBed12BRuntime({
  smallBed12B,
  sensorType: SMALL_BED_12B_TYPE,
  getSensorType: () => file,
  getLineOrder: () => jqbed,
  getZeroFrame: () => getZeroState('pointArr1zero'),
  subtractZero: numLessZeroToZero,
  calibration: smallBed12BCalibration,
  getDisplayOptions: () => smallBed12BDisplayOptions,
  getHz: () => getCollectionState('colHZ'),
  transposeSquareMatrix,
  getNowDate: () => nowDate,
  getEndDate: () => endDate,
  // 小床 runtime 解析完当前帧后，把坐面压力帧写回旧运行时变量，兼容清零和历史采集逻辑。
  setCurrentPressureFrame: (frame) => {
    pointArr = frame;
  },
  // 保存小床当前原始零点源帧，供 resetZero 命令复制到 pointArr1zero。
  setZeroSourceFrame: (frame) => {
    setZeroState('pointArr1zeroData', frame);
  },
  // 保存小床当前展示帧，兼容旧前端和部分导出逻辑读取 newData。
  setCurrentDisplayData: (frame) => {
    newData = frame;
  },
  sendSitFrame: colOrSendData,
});

// SIT 1024 字节矩阵帧处理器承接旧 onData 中的主坐垫矩阵分支。
const sit1024FrameProcessor = createSit1024FrameProcessor({
  HAND_SINGLE_POINT_TYPE,
  MINZHEN_TYPE,
  WHOLE_CHAIR_TYPE,
  arrToRealLine,
  car10Sit,
  carCol,
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
  xiyueReal1,
  yanfeng10sit,
});

// BACK/HEAD 1024 字节矩阵帧处理器，用于收敛靠背和头枕的主矩阵分支。
const backHead1024FrameProcessor = createBackHead1024FrameProcessor({
  HAND_SINGLE_POINT_TYPE,
  WHOLE_CHAIR_TYPE,
  arrToRealLine,
  car10Back,
  carBackLine,
  carYLine,
  handSinglePoint,
  isCar,
  normalizeWholeChairFrame,
  numLessZeroToZero,
  wowBackLine,
  wowhead,
  yanfeng10back,
});

// RuntimeStateStore 是旧变量到新 runtime 服务之间的过渡层。
// 当前已承接手套、零点和 legacy 分段协议缓存，后续继续迁移采集/回放/端口状态。
const runtimeStateStore = createRuntimeStateStore({
  initialState: {
    firstBlueData: [],
    firstBlueData1: [],
    firstBlueData2: [],
    lastBlueData: [],
    lastBlueData1: [],
    lastBlueData2: [],
    newArr: [],
  },
  accessors: {
    file: { get: () => file, set: (value) => { file = value; } },
    newArr147: zeroStateAccessor('newArr147'),
    newArr147_2: zeroStateAccessor('newArr147_2'),
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
const runtimeStateAccessor = (key) => ({
  get: () => runtimeStateStore.get(key),
  set: (value) => runtimeStateStore.set(key, value),
});

// 手套分包运行时承接 handGloveFullPacket 和 handGloveDouble 的解析、路由和输出。
const handPacketRuntime = createHandPacketRuntime({
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
  getRuntime: () => runtimeStateStore.snapshot([
    'file',
    'port1',
    'port2',
    'pointArr1zero',
    'pointArr1RawZero',
    'pointArr2zero',
    'pointArr2RawZero',
    'pointArr147zero',
    'pointArr147zero_2',
  ]),
  setRuntime: (next = {}) => runtimeStateStore.patch(next),
});

/**
 * 兼容旧调用点：处理手套整包数据并交给 handPacketRuntime。
 *
 * @param {Buffer} buffer 串口收到的整包数据。
 * @param {'left' | 'right'} fallbackSide 无法从数据推断时使用的默认手侧。
 * @returns {unknown} handPacketRuntime 的处理结果。
 */
function handleHandGloveFullPacket(buffer, fallbackSide) {
  return handPacketRuntime.handleFullPacket(buffer, fallbackSide);
}

/**
 * 兼容旧调用点：处理手套双串口分包数据。
 *
 * @param {Buffer} buffer 串口收到的分包数据。
 * @param {'left' | 'right'} fallbackSide 默认手侧。
 * @param {'sit' | 'back'} sourcePort 数据来源串口。
 * @returns {boolean} 是否已识别并处理该分包。
 */
function handleHandGloveDoublePacket(buffer, fallbackSide, sourcePort) {
  return handPacketRuntime.handleDoublePacket(buffer, fallbackSide, sourcePort);
}





const collectionFrameStorage = createCollectionFrameStorageService({
  getSensorType: () => file,
  // 三路采集分别写入不同数据库；sit 为主库，back/head 为独立历史库。
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

// 实时帧输出管线统一负责入库和实时通道发布，server.js 保留兼容函数名。
const frameOutputPipeline = createFrameOutputPipeline({
  collectionFrameStorage,
  publishRealtimeChannel,
  getSensorType: () => file,
  minzhenType: MINZHEN_TYPE,
  applyMinzhenBackendGauss,
});

/**
 * 兼容旧坐面输出函数名，把坐面实时帧交给统一输出管线。
 *
 * @param {string} jsonData 坐面实时帧 JSON 字符串。
 * @returns {number | unknown} 输出管线返回值。
 */
function colOrSendData(jsonData) {
  return frameOutputPipeline.publishSit(jsonData);
}

// 靠背实时数据输出包装。

var pointArr2;


/**
 * 兼容旧靠背输出函数名，把靠背实时帧交给统一输出管线。
 *
 * @param {string} jsonData 靠背实时帧 JSON 字符串。
 * @returns {number | unknown} 输出管线返回值。
 */
function colOrSendData1(jsonData) {
  return frameOutputPipeline.publishBack(jsonData);
}

var pointArr3;


var pointArr4;




/**
 * 兼容旧头枕输出函数名，把头枕实时帧交给统一输出管线。
 *
 * @param {string} jsonData 头枕实时帧 JSON 字符串。
 * @returns {number | unknown} 输出管线返回值。
 */
function colOrSendData2(jsonData) {
  return frameOutputPipeline.publishHead(jsonData);
}

// 旧串口帧处理依赖大量可变运行时状态；固定依赖和状态 accessor 分开传入 binding factory。
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

// legacy runtime 使用 accessor 读写尚未完全迁出的旧变量。
// 已迁移到 collection/runtime/zero/serialManager 的状态由 factory 统一拼装。
const legacySerialFrameRuntimeAccessors = createLegacySerialFrameRuntimeAccessors({
  collectionStateAccessor,
  getManagedSerialPort,
  mutableAccessors: {
    baudRate: createMutableAccessor(() => baudRate, (value) => { baudRate = value; }),
    dataFalg: createMutableAccessor(() => dataFalg, (value) => { dataFalg = value; }),
    db: createMutableAccessor(() => db, (value) => { db = value; }),
    endDate: createMutableAccessor(() => endDate, (value) => { endDate = value; }),
    file: createMutableAccessor(() => file, (value) => { file = value; }),
    firstData: createMutableAccessor(() => firstData, (value) => { firstData = value; }),
    jqbedMatrixOrigin: createMutableAccessor(() => jqbedMatrixOrigin, (value) => { jqbedMatrixOrigin = value; }),
    lastData: createMutableAccessor(() => lastData, (value) => { lastData = value; }),
    localFlag: createMutableAccessor(() => localFlag, (value) => { localFlag = value; }),
    newData: createMutableAccessor(() => newData, (value) => { newData = value; }),
    nowDate: createMutableAccessor(() => nowDate, (value) => { nowDate = value; }),
    pointArr: createMutableAccessor(() => pointArr, (value) => { pointArr = value; }),
    pointArr2: createMutableAccessor(() => pointArr2, (value) => { pointArr2 = value; }),
    pointArr3: createMutableAccessor(() => pointArr3, (value) => { pointArr3 = value; }),
    pointArr4: createMutableAccessor(() => pointArr4, (value) => { pointArr4 = value; }),
    useMatrixOrigin: createMutableAccessor(() => useMatrixOrigin, (value) => { useMatrixOrigin = value; }),
  },
  runtimeStateAccessor,
  serialRoles,
  zeroStateAccessor,
});

createLegacySerialRuntimeBinding({
  accessors: legacySerialFrameRuntimeAccessors,
  baseContext: legacySerialFrameRuntimeBaseContext,
  serialParserManager,
});

// 数据处理工具。
// jqbed 数据翻转转换（供 callPy 使用）。
jqbedTimer = petCareRuntimeService.startVitalSignsTimer();
petCareTimer = petCareRuntimeService.startPetCareTimer('petCare');
petCareMiniTimer = petCareRuntimeService.startPetCareTimer('petCareMini');

module.exports.shutdownServer = shutdownServer;

/**
 * 根据通道名称获取对应的 WebSocket server 实例。
 *
 * @param {'sit' | 'back' | 'head'} channel 通道名称。
 * @returns {object} WebSocket server 实例。
 */
function getWsServer(channel = 'sit') {
  const normalizedChannel = normalizeChannel(channel);
  if (normalizedChannel === 'back') return server1;
  if (normalizedChannel === 'head') return server2;
  return server;
}

/**
 * 获取当前 WebSocket 订阅状态。
 *
 * @returns {object} 订阅状态快照。
 */
function getWsSubscriptionStatus() {
  return wsSubscriptions.getStatus();
}

/**
 * 获取当前实时通道元数据。
 *
 * @returns {object[]} 实时通道列表。
 */
function getRealtimeChannels() {
  return getRealtimeChannelMetadata();
}

/**
 * 获取后端 ChannelBus 统计信息。
 *
 * @returns {object} ChannelBus 状态快照。
 */
function getChannelBusStatus() {
  return channelBus.getStats();
}

/**
 * 旧模块兼容命令入口；新控制命令应走 controlCommandService。
 *
 * @param {object} command 旧调用方传入的命令对象。
 * @returns {null} 当前兼容入口不执行命令。
 */
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

const httpApp = createHttpApp({
  controlCommandService,
  getChannelBusStatus,
  getPort,
  getRealtimeChannels,
  getSerialStatus: () => serialManager.getStatus(),
  getSitDb: () => db,
  getWsSubscriptionStatus,
  imgPath,
  listPorts,
  logger,
  pdfPath,
  serialManager,
});



// ===== OneStep 足压报告 HTTP 服务状态 =====
// 默认仅监听 127.0.0.1，供前端上传截图、生成 PDF 和调用控制 API。
reportHttpServer = startLocalHttpServer({
  app: httpApp,
  logger,
  port: DEFAULT_REPORT_HTTP_PORT,
});
