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
const {
  registerCalibrationZeroCommandHandler,
} = require('./commands/registerCalibrationZeroCommandHandler');
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
const {
  createZeroFrameAdapter,
  getZeroBaselineForStorage,
} = require('./runtime/zeroFrameAdapter');
const {
  createZeroChannelIdentityResolver,
} = require('./runtime/zeroChannelIdentityResolver');
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
const { gaussBlur_return, gaussBlur_2, interpSmall, findMax, press6, pressNew1220, press6sit, bytes4ToInt10, arrToRealLine, pressNew12203131 } = require('@shroom/backend/processing/mathUtils.js');
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
/**
 * 对敏枕帧做后端高斯模糊。
 *
 * 这是个 partial application：`minzhen.applyBackendGauss` 需要一个模糊实现，
 * 而模糊实现（`gaussBlur_return`）在本文件的依赖里，不在 minzhen 协议模块里。
 * 这样分工是为了让协议模块保持纯粹 —— 它只知道「敏枕的数据要过一次模糊」，
 * 不关心用哪份高斯实现。
 *
 * ⚠️ **敏枕是全仓唯一在后端做模糊的传感器**，其他型号都是把原始矩阵发给前端、
 * 由渲染器决定要不要平滑。这里在后端做是因为敏枕矩阵很小（10×10），
 * 不平滑的话前端插值出来会有明显块状。代价是入库的也是模糊后的数据 ——
 * **原始值拿不回来了**，二开时如果需要原始压力值要改这条链路。
 *
 * @param {object} frame 解析后的敏枕帧。
 * @returns {object} 模糊后的帧。
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

/**
 * 取展示系统注册表的整体状态（已加载哪些、哪些加载失败）。
 *
 * 这三个 `getDisplaySystem*` 都是**一行转发**，存在的意义不是抽象而是**依赖方向**：
 * HTTP 路由和命令 handler 通过 deps 注入拿到这些函数，因此不需要 import
 * `appRuntime`，也就不会形成「路由 → server.js → 路由」的环。
 * 二开时如果要加新的展示系统查询接口，照这个形状加一行转发即可。
 *
 * @returns {object} 注册表状态，含 `discoveryErrors` 与注册失败列表 ——
 *   这是 AI 二开「改坏了要能看见」的唯一数据来源。
 */
function getDisplaySystemStatus() {
  return appRuntime.displaySystems.getStatus();
}

/**
 * 按 id 取展示系统的**运行时**定义（已归一化、可直接喂给 dispatcher）。
 *
 * @param {string} id 展示系统 id。
 * @returns {object | null} 运行时定义；不存在时 null。
 */
function getDisplaySystemById(id) {
  return appRuntime.displaySystems.getById(id);
}

/**
 * 按 id 取展示系统的**编辑器**定义（保留原始字段，供前端编辑后回写）。
 *
 * 与 `getDisplaySystemById` 是两个不同的视图，不能互相替代：运行时定义补过默认值、
 * 展开过继承，直接回写会把推导出来的值固化成显式配置，下次改默认值就不生效了。
 *
 * @param {string} id 展示系统 id。
 * @returns {object | null} 编辑器定义；不存在时 null。
 */
function getDisplaySystemEditorById(id) {
  return appRuntime.displaySystems.getEditorById(id);
}

const serialPortFilterService = createSerialPortFilterService({ logger });
const {
  getPort,
  logSerialPortList,
} = serialPortFilterService;

const zeroStateStore = createZeroStateStore();
const zeroChannelIdentityResolver = createZeroChannelIdentityResolver({
  getActiveSensorType: () => file,
  listSerialChannels: appRuntime.displaySystems.listSerialChannels,
});
const zeroFrameAdapter = createZeroFrameAdapter({
  zeroStateStore,
  resolveChannelIdentity: zeroChannelIdentityResolver.resolveChannelIdentity,
});

/**
 * 取某个输出通道当前的零点基线，用于入库前做零点补偿。
 *
 * channelId 的来源有两条，**优先用帧自带的**：manifest 多传感器系统的帧里已经带了
 * canonical `channelId`，直接用；旧的 sit/back/head 帧没有这个字段，
 * 才回退到按「当前传感器型号 + 通道别名」推导。
 * 顺序不能反 —— 反过来会让 manifest 系统的零点落到推导出的错误通道上，
 * 现象是「点了归零但曲线没变」。
 *
 * @param {string} channel 输出通道别名（sit / back / armLeft…）。
 * @param {object | null} frame 当前帧；带 `channelId` 时优先使用。
 * @returns {number[] | null} 零点基线数组；未归零过时 null（调用方按「不补偿」处理）。
 */
function getZeroFrameForOutputChannel(channel, frame = null) {
  const channelId = String(frame?.channelId || '').trim()
    || zeroChannelIdentityResolver.resolveChannelIdentity(channel).channelId;
  return getZeroBaselineForStorage(zeroStateStore, channelId, frame);
}

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
  }),
  getZeroFrameForChannel: getZeroFrameForOutputChannel,
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

/**
 * 把「采集因存储问题被中止」这件事广播给所有前端。
 *
 * 走 `publishSystemEvent` 广播而不是回给某个客户端，是因为采集是**全局状态**：
 * 任何一个打开的界面都在显示「正在采集」，中止了就都得知道。
 *
 * 附带 `freeBytes` / `minFreeBytes` / `file` / `saveTime` 四个字段，是为了让用户
 * 能自己判断该怎么办（清盘还是换目录），而不是只看到一句「采集停止了」。
 * `saveTime` 尤其重要 —— 它是这次采集在库里的日期标签，
 * 用户要靠它找到那条半截的记录。
 *
 * @param {{message?: string, freeBytes?: number, minFreeBytes?: number}} error 错误信息。
 * @returns {number} 收到广播的客户端数量。
 */
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

/**
 * 取数据库目录所在磁盘的剩余字节数。
 *
 * ⚠️ 这个函数在 `collectionDiskSpaceGuard` **之前**定义、在它**之后**才被调用
 * （见 `handleCollectionDbError`）—— 函数声明提升让这种「先用后建」成立。
 * 顺序看着别扭，但改成先建 guard 会反过来出问题：guard 的
 * `onInsufficientSpace` 要引用 `stopCollectionForStorageError`。
 * 这一圈互相引用是靠函数声明提升解开的，**把任何一个改成 `const` 箭头函数都会
 * 立刻变成 ReferenceError**。
 *
 * @returns {number} 剩余字节数；取不到时返回 0（按「空间不足」处理，偏保守）。
 */
function getCollectionFreeBytes() {
  return collectionDiskSpaceGuard.getFreeBytes();
}

/**
 * 因存储错误中止采集。
 *
 * 顺序是有讲究的：**先 flush 再置 flag=false**。反过来的话，队列里那批已经攒着
 * 但还没写盘的帧会因为 flag 已关而被丢掉 —— 用户会丢掉最后 200 帧
 * （`COLLECTION_INSERT_BATCH_SIZE`）而不知道。
 * 磁盘满的场景下 flush 大概也会失败，但那是「尽力一次」，不是「先放弃」。
 *
 * 把 `database or disk is full` 这句原始英文错误换成自己的措辞，是因为
 * `message` 会经 `broadcastCollectionStorageError` 显示给用户；
 * sqlite 的原文没说清是「数据库文件到上限」还是「磁盘满」，而对用户来说
 * 两者的处置一样（清空间），所以合并成一句可执行的提示。
 *
 * @param {Error | string} error 触发中止的错误。
 * @param {object} extra 附加上报字段（channel / freeBytes / minFreeBytes）。
 * @returns {void}
 */
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

/**
 * 采集前的空间预检。
 *
 * 与 `handleCollectionDbError` 是「事前」与「事后」两道防线，都需要：
 * 预检有 2GB 门槛（`COLLECTION_MIN_FREE_BYTES`）所以能在写坏之前拦住，
 * 但它有缓存（不会每帧都去 statfs），所以长时间采集仍可能撞上真的写失败。
 *
 * @returns {boolean} 空间是否足够；不足时 guard 已经顺带触发了中止流程。
 */
function hasEnoughCollectionDiskSpace() {
  return collectionDiskSpaceGuard.hasEnoughSpace();
}

/**
 * 采集入库失败的统一处理。
 *
 * 只有「盘满」这一类会中止采集，其他错误**只记日志、继续采集**。
 * 这个取舍是刻意的：盘满不会自愈，继续写只会刷屏；而偶发的 busy/锁冲突
 * 下一帧大概就好了，为它中止一整场采集是过度反应 ——
 * 采集通常是一次性的现场测量，中断了补不回来。
 *
 * 判据用了 `err.code` **和** 字符串匹配两条：`sqlite3-compat` 底层是
 * better-sqlite3，它抛的错不一定带 `SQLITE_FULL` 这个 code，
 * 但 message 里一定有 `database or disk is full`。只判一条会漏。
 *
 * @param {Error | null} err 数据库错误；null 时直接返回（成功路径也会调）。
 * @param {string} channel 出错的采集通道，仅用于上报定位。
 * @returns {void}
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
 * 立刻把所有通道攒着的插入批次写盘。
 *
 * 采集是**攒批写**的（200 条或 250ms 触发一次），所以任何「采集要结束了」的时刻
 * 都必须显式 flush，否则最后不满一批的帧会留在内存里丢掉。
 * 调用点有三处：停止采集、存储错误中止、进程退出。
 * 二开时新增任何「结束采集」的路径都要记得调它。
 *
 * @returns {void}
 */
function flushCollectionInsertQueues() {
  collectionInsertQueueService.flushAll();
}

/**
 * 把一条采集记录放进对应数据库的插入队列。
 *
 * 队列**按 dbRef + channel 分组**，因为整椅/车载是三个独立的库文件，
 * 混在一个批次里没法用同一个 prepared statement。
 *
 * @param {object} dbRef 目标数据库句柄。
 * @param {Array<unknown>} params 与 `COLLECTION_INSERT_SQL` 一一对应的三个值。
 * @param {string} channel 通道名，出错上报时用来定位。
 * @returns {void}
 */
function enqueueCollectionInsert(dbRef, params, channel = 'sit') {
  collectionInsertQueueService.enqueue(dbRef, params, channel);
}

/**
 * 入库一帧采集数据，自动补上时间戳和日期标签。
 *
 * 两个时间字段分工不同，都不能省：`Date.now()` 是这一帧的毫秒时间戳，
 * 回放时用来算帧间隔（见 `calcDetectedInterval`）；
 * `saveTime` 是**整场采集共用的日期标签**，是历史列表和「加载某天」的分组键。
 * 所以 `saveTime` 在一场采集里必须保持不变 —— 它在开始采集时定一次，
 * 中途变了会把一场采集切成两条历史记录。
 *
 * @param {object} dbRef 目标数据库句柄。
 * @param {string} dataToStore 已序列化的帧数据（零点补偿后的）。
 * @param {string} channel 通道名。
 * @returns {void}
 */
function enqueueCollectionFrame(dbRef, dataToStore, channel) {
  enqueueCollectionInsert(dbRef, [dataToStore, Date.now(), getCollectionState('saveTime')], channel);
}

/**
 * 按传感器型号打开/建立对应的数据库文件组。
 *
 * 每个型号一套独立的库文件（sit/back/head 最多三个），而不是一个大库加型号字段 ——
 * 这样切型号不会互相影响，单个型号的库也能直接拷走给别人分析。
 * 代价是历史数据不能跨型号一起查（也没有这个需求）。
 *
 * 两个路径参数的分工是本仓的通用规则：`filePath` 是**可写**目录（打包后在 userData），
 * `runtimeResourceRoot` 是**只读**资源目录（打包后在 asar 旁），
 * 后者用来找随包分发的模板/预置库。写进只读目录在打包后会失败，
 * 所以这两个绝不能混用。
 *
 * @param {string} fileStr 传感器型号标识。
 * @returns {{db: object, db1: object, db2: object}} 三个通道的数据库句柄，
 *   单通道型号的 db1/db2 为空。
 */
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
/**
 * 回放状态的四个访问器。
 *
 * 这一组是本文件「把散落的 `let` 收进 store」这条迁移路线的一环
 * （同 `serialRuntimeFactory` / `legacyWebSocketContext` 里的做法）。
 * 迁移的方式是**只留一份真相**：状态搬进 `playbackStateStore` 之后，
 * 旧的全局 `let` 就删掉，所有读写都走这四个函数，
 * 不存在「两处都写、靠人记得同步」的中间态 —— 那种中间态一定会漂移。
 *
 * 分工：
 * - `getPlaybackState` / `setPlaybackState` —— 单字段读写。
 * - `patchPlaybackState` —— 一次改多个字段。批量改的场景（切日期、切型号）
 *   都是「这几个字段必须一起变」，逐个 set 会在中间留下不一致的瞬间；
 *   而回放定时器是异步 tick 的，真的可能读到那个瞬间。
 * - `playbackStateAccessor` —— 生成 `{get, set}` 描述符，喂给
 *   `legacyWebSocketContext`，让旧 handler 里的 `ctx.nowIndex = x` 这类写法
 *   落到 store 上。⚠️ 返回的是**函数**而不是快照值，
 *   原因见 `legacyWebSocketContext` 里那段说明。
 */
const getPlaybackState = (key) => playbackStateStore.get(key);
const setPlaybackState = (key, value) => playbackStateStore.set(key, value);
const patchPlaybackState = (next = {}) => playbackStateStore.patch(next);
const playbackStateAccessor = (key) => ({
  get: () => getPlaybackState(key),
  set: (value) => setPlaybackState(key, value),
});

/**
 * 从历史行算出整段的压力/面积曲线。
 *
 * ⚠️ **入参里的 `file` 是被忽略的** —— 型号一律现取 `runtimeContext.getSensorType()`。
 * 保留这个参数是为了不改调用方签名（`loadSelectedHistory` 还在传），
 * 但它不生效：曲线的算法依赖当前型号，而型号可能在调用者拿到它之后才变。
 * 二开时不要试图用这个参数「算另一个型号的曲线」，它没有用。
 *
 * ⚠️ 当 `sitRows` 是懒加载代理时（超过 `HISTORY_EAGER_ROW_LIMIT` 的大采集），
 * 曲线可能只覆盖一部分 —— 原因见 `historyQueryService` 里那段代理说明：
 * 数组高阶方法在代理上会静默返回空。
 *
 * @param {object} options 参数。
 * @param {Array<object>} options.sitRows 坐垫历史行。
 * @param {Array<object>} options.backRows 靠背历史行。
 * @param {number} options.start 起始下标。
 * @param {number | null} options.end 结束下标；null 表示到末尾。
 * @param {string} options.file 已忽略，见上。
 * @returns {{length:number, time:number[], press:number[], area:number[]}} 曲线数据。
 */
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

/**
 * 构造「进入回放但还没选到帧」时要推给前端的空白载荷。
 *
 * 存在的理由是**清屏**：进入回放时上一帧实时数据还留在画面上，
 * 不推一帧空白的话用户会以为那是历史数据的第一帧。
 * 与 `serialControlService` 里的 `createZeroPayloads` 是同一意图的两个入口 ——
 * 那个管「退出回放回到实时」，这个管「加载历史」。
 *
 * @returns {object} 可展开进历史选择载荷的空白帧字段。
 */
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

/**
 * 推送回放的第 index 帧。
 *
 * **sit 放在最后发**，不是随意排的：前端把 sit 帧当作「这一帧到齐了」的信号来触发
 * 重绘。先发 sit 的话，back/head 会赶不上这一次重绘，
 * 现象是靠背/头枕的画面比坐垫慢一帧 —— 静态看不出来，拖进度条时能看出错位。
 *
 * back/head 用 `if` 而不是无条件发：单通道型号根本没有这两个 payload，
 * `buildPayloads` 返回 undefined，发出去会让前端收到一帧空数据并清屏。
 *
 * 所有三路都标 `source: 'playback'`，前端靠这个字段区分实时帧和回放帧
 * （比如回放时不更新「当前压力」读数）。
 *
 * @param {number} index 帧下标。
 * @param {object} options 透传给 `playbackFrameService.buildPayloads` 的额外选项。
 * @returns {void}
 */
function publishPlaybackFrame(index, options = {}) {
  const { sitPayload, backPayload, headPayload } = playbackFrameService.buildPayloads({
    sensorType: runtimeContext.getSensorType(),
    sitRows: getPlaybackState('localData'),
    backRows: getPlaybackState('localDataBack'),
    headRows: getPlaybackState('localDataHead'),
    index,
    ...options,
  });

  if (backPayload) publishRealtimeFrame('back', backPayload, { source: 'playback' });
  if (headPayload) publishRealtimeFrame('head', headPayload, { source: 'playback' });
  publishRealtimeFrame('sit', sitPayload, { source: 'playback' });
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
 * 广播「历史数据已选定」的元信息（总帧数、时间轴、曲线）。
 *
 * 单独包一层而不是直接调 `publishSystemEvent`，是为了让 `loadSelectedHistory` 的
 * 成功路径和失败路径**用同一个出口**发消息 —— 失败时也必须发（发一份全零的），
 * 否则前端会一直卡在「加载中」，没有超时也没有报错。
 *
 * @param {object} payload 历史元信息。
 * @returns {number} 收到广播的客户端数量。
 */
function broadcastHistorySelectionPayload(payload) {
  return publishSystemEvent( payload);
}

/**
 * 加载某一天的历史数据，进入回放准备状态。
 *
 * 流程：停定时器 → 清空旧回放状态 → 统计三个通道的行数 → 决定 eager/lazy →
 * 建行序列 → 算曲线 → 广播元信息。
 *
 * 几个关键决定：
 *
 * **先 `stopPlaybackTimer()` 再清状态**。反过来的话，定时器可能在清空之后、
 * 新数据装上之前 tick 一次，读到空数组并把 `nowIndex` 推过界。
 *
 * **`eager` 的阈值判据用三个通道里最大的行数**，不是总数。因为三路是分别加载的，
 * 内存压力取决于最大的那一路；用总数会让三通道型号过早退化成懒加载
 * （懒加载有严重的副作用，见 `historyQueryService`）。
 *
 * **`length` 取 `totalLength || historySeries.length`**。前者按行数算，
 * 后者按曲线实际算出来的点数算。正常两者相等；懒加载时曲线可能算不全
 * （代理的高阶方法返回空），这时 `totalLength` 是对的，所以它在前。
 * 反过来会让大采集的进度条只有几帧长。
 *
 * **`indexArr` 的上界是 `length - 2` 而不是 `length - 1`**：回放 tick 是
 * 「先 +1 再取帧」，留一帧余量才不会在最后一帧越界。
 *
 * **整个函数包在 try/catch 里，失败时广播一份全零元信息而不是静默返回。**
 * 历史库可能损坏、可能是别的型号的库、可能日期标签在库里不存在 ——
 * 这些都是用户操作能触发的正常情况，不该让界面卡住。
 *
 * @param {string} dateLabel 历史日期标签（即入库时的 `saveTime`）。
 * @returns {void}
 */
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

/**
 * 停止回放定时器。
 *
 * 注意这里**不动 `playFlag`** —— 它由定时器服务的 `onStop` 回调置 false。
 * 这样安排是为了让「播完自然停」和「手动停」走同一条收尾路径，
 * 只有一处会把 `playFlag` 置 false，不会漂移。
 *
 * 幂等：`playbackTimer.stop()` 对已停止的定时器无副作用，
 * 所以可以在任何「状态要变了」的地方无条件调（切日期、切型号、退出回放、进程退出）。
 *
 * @returns {void}
 */
function stopPlaybackTimer() {
  playbackTimer.stop();
}

/**
 * 启动回放定时器。
 *
 * `playFlag` 在这里**同步**置 true，而 stop 时是由回调置 false ——
 * 不对称是刻意的：前端点了播放要立刻在界面上看到「播放中」，
 * 不能等第一次 tick；而停止的时机以定时器实际停下为准。
 *
 * 帧间隔取 `interval`，它由 `calcDetectedInterval` 从历史时间戳推出来，
 * 所以回放速度会自动贴近原始采集频率，不需要用户设置。
 *
 * @returns {void}
 */
function startPlaybackTimer() {
  playFlag = true;
  playbackTimer.start();
}

/**
 * 从历史时间戳推算回放帧间隔。
 *
 * 用**中位数**而不是平均值，因为采集过程中的卡顿（磁盘忙、串口重连）会产生几个
 * 极大的间隔，平均值会被它们拉偏，现象是整段回放都偏慢。中位数对这种离群点免疫。
 *
 * 只采**前 20 个间隔**：采集频率在一场采集里是固定的，采样多了没有额外信息，
 * 而这里的 `timestamps` 可能来自懒加载序列，多读一个就多一次同步数据库查询。
 *
 * `0 < d < 5000` 这个过滤窗口丢掉两类脏数据：非正的间隔（时间戳乱序或重复，
 * 系统时间被改过就会出现）和超过 5 秒的间隔（采集中断过，那不是帧率）。
 * 5000 是个经验值 —— 本仓最慢的采集频率也远快于 0.2Hz。
 *
 * 全部被过滤掉时回退到 `timeNum`（默认间隔）而不是抛错：
 * 时间戳不可用只影响回放速度，不该让「加载历史」整体失败。
 *
 * `Math.max(1, ...)` 保证至少 1ms —— 0 会让 `setInterval` 退化成尽快执行，
 * 把事件循环打满。
 *
 * @param {number[]} timestamps 按帧顺序的时间戳。
 * @returns {number} 帧间隔毫秒数（≥ 1）。
 */
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

/**
 * 惰性创建关闭编排器（单例）。
 *
 * **惰性**而不是模块加载时就建，是因为编排器的 `getRuntime` 闭包要读本文件后面才声明的
 * `let`（`sitClose`、`baudRate` 那一大批在 1120 行之后）。模块加载时建的话，
 * 闭包本身没问题（闭包是延迟求值的），但 `serialManager`、`server` 这些依赖
 * 在那个时刻确实还没装配好。
 *
 * **单例**是必需的而不是优化：编排器内部持有 `serverShutdownPromise` 用来做幂等，
 * 每次新建一个就等于每次都重新走一遍关闭流程 —— Electron 有多条退出路径
 * （窗口全关、菜单退出、信号），会真的重入。
 *
 * `getRuntime` / `setRuntime` 这对适配器是本文件「全局 `let` → store」迁移的过渡层：
 * 编排器只认一个状态对象，不认这些散落的变量。`setRuntime` 里那 16 个
 * `hasOwnProperty` 判断不能简化成 `next.x !== undefined` ——
 * 关闭流程正是要把 `com`/`com1`/`comhead`/`comSensor` 显式设成 `undefined`，
 * 用 `!== undefined` 判断会让这些赋值全部被跳过，端口引用留着不放。
 *
 * ⚠️ `getRuntime` 返回的是**每次调用现取的快照**。编排器只在关闭开始时取一次
 * （原因见 `serverShutdownOrchestrator` 里那段顺序依赖说明），
 * 这个「取一次」的语义依赖此处每次都是新对象，不要改成缓存。
 *
 * @returns {object} 关闭编排器单例。
 */
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

/**
 * 关闭后端：停展示系统分发，再交给编排器关闭其余资源。
 *
 * **`stopRuntimeDispatch()` 必须在编排器之前调**，而且必须在这里而不是在编排器内部：
 * 分发器是数据的**源头**（它把串口帧推给各个展示系统的处理链）。
 * 先关串口再停分发，中间那段时间分发器会拿着已经关掉的句柄继续跑；
 * 先停分发则整条链路自然静默下来，后面的关闭都在无数据流的状态下进行。
 *
 * 编排器不管这一步，是因为展示系统属于**可写运行态扩展**，
 * 按 `backend/README.md` 划的边界不进稳定内核的关闭流程 ——
 * 二开加的扩展如果关闭时会抛错，不应该影响串口和数据库的正常释放。
 *
 * 这也是 Electron 侧唯一该调的关闭入口（见 `backend/runtime/index.js`）。
 *
 * @returns {Promise<void>} 关闭完成的 promise；**永不 reject**，
 *   原因见 `serverShutdownOrchestrator`。
 */
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

/**
 * 从授权文件的 `file` 字段推出「这台机器允许使用哪些传感器型号」。
 *
 * 授权文件里 `file` 有三种历史形态，都得认（已发出去的 config.txt 改不了）：
 * - `'all'` —— 不限型号，原样返回字符串 `'all'`，调用方靠 `=== 'all'` 判断。
 * - 数组 —— 多型号授权，过滤掉空串和非字符串。
 * - 单个字符串 —— 早期的单型号授权，包成数组统一后续处理。
 *
 * 返回 `undefined`（而不是 `[]`）表示「授权文件里没有型号信息」，
 * 与「授权了空列表」是两回事：前者要走默认型号，后者应该什么都不给。
 * ⚠️ 所以调用方不能用 `if (!selectFlag)` 合并这两种情况。
 *
 * `'all'` 那条分支的返回类型和其他分支不一样（字符串 vs 数组），
 * 这个不一致是兼容包袱 —— 前端的授权列表逻辑依赖它，不能顺手统一。
 *
 * @param {'all' | string | string[] | undefined} licenseFile 授权文件的 `file` 字段。
 * @returns {'all' | string[] | undefined} 允许的型号列表。
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
 * 从授权文件推出启动时的默认传感器型号。
 *
 * 与 `getSelectFlagFromLicense` 是同一份数据的两个视图，
 * 分开两个函数是因为「允许哪些」和「默认用哪个」的取值规则不同：
 * - 数组 → 取**第一个有效项**（授权文件里的顺序就是厂里配机器时的主型号在前）。
 * - `'all'` → 落到 `fallback`。不限型号时没有「主型号」可言，
 *   全型号授权的机器启动时用什么型号只能由代码定（`defauleFile = 'hand0205'`）。
 * - 其他 → `fallback`。
 *
 * @param {'all' | string | string[] | undefined} licenseFile 授权文件的 `file` 字段。
 * @param {string | null} fallback 推不出来时的兜底型号。
 * @returns {string | null} 默认型号。
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
/**
 * 采集状态的三个访问器。
 *
 * 形状与上面的 `getPlaybackState` 那一组完全一样（同一条「全局 `let` → store」
 * 迁移路线），只少一个 `patch` —— 采集状态的四个字段没有「必须一起变」的组合。
 *
 * 采集状态里 `flag`（是否正在采集）和 `saveTime`（本场采集的日期标签）是一对：
 * `flag` 为 true 期间 `saveTime` 必须保持不变，否则一场采集会在历史列表里
 * 裂成多条（见 `enqueueCollectionFrame`）。这个约束没有代码强制，靠调用顺序保证 ——
 * 二开时新增「开始采集」的路径要先定 `saveTime` 再置 `flag`。
 *
 * `collectionStateAccessor` 同样返回 `{get, set}` 函数对而不是快照值，
 * 供 `legacyWebSocketContext` 把旧 handler 的 `ctx.colFlag = true` 落到 store 上。
 */
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

/**
 * 取四个固定角色的串口实例快照。
 *
 * `port1` / `port2` / `portHead` / `portSensor` 这四个键名是**旧前端与旧 handler 的
 * 契约**，不是内部命名 —— 改名会让 `runtime.port1?.isOpen` 这类判断静默失效
 * （可选链把 undefined 吞掉，不报错，现象是「切型号时不清屏」）。
 *
 * ⚠️ 只覆盖这四个固定角色。**manifest 声明的其他通道不在里面** ——
 * 那些走 `serialPortOrchestrator` 的角色表。所以二开新增传感器通道时，
 * 不要指望这个函数能看到它们；需要遍历全部通道的场景要用
 * `appRuntime.displaySystems.listSerialChannels()`。
 *
 * 每次现取而不缓存：串口会被重连循环换成新实例，缓存下来的句柄可能已经关了。
 *
 * @returns {{port1:object|null, port2:object|null, portHead:object|null, portSensor:object|null}}
 *   当前实例；未打开的角色为 null。
 */
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

/**
 * 发布一帧实时数据（无条件发）。
 *
 * 是对 `webSocketRuntime.publishRealtimeFrame` 的一层转发。留这层壳是因为
 * 本文件里有几十处调用点，而这个函数在装配 `webSocketRuntime` 之前就被
 * 其他函数引用了（函数声明提升）—— 直接用解构出来的
 * `publishRealtimeFrameToRuntime` 会遇到 `const` 的 TDZ。
 *
 * ⚠️ **这个函数不做任何过滤**：回放期间也会发，手套的 60FPS 限频也不生效。
 * 只有「回放推帧」和「必须送达的通道」才该直接用它，
 * 采集/实时链路要用下面的 `publishRealtimeChannel`。
 *
 * @param {string} channel 输出通道别名。
 * @param {string | object} jsonData 帧数据。
 * @param {{source?: string, timestamp?: number}} [options] 来源标记。
 * @returns {number} 实际发送成功的客户端数量。
 */
function publishRealtimeFrame(channel, jsonData, options) {
  return publishRealtimeFrameToRuntime(channel, jsonData, options);
}

/**
 * 发布一帧实时数据，带两道门。
 *
 * 这是实时采集链路应该用的入口，两道门都是为了「不让前端收到自相矛盾的数据」：
 *
 * 1. **回放期间一律不发**（返回 0）。回放和实时用的是同一批通道，
 *    不拦的话串口来的实时帧会插在回放帧中间，画面会在两个时间点之间跳。
 *    这道门没有开关 —— 任何「回放时也要看实时」的需求都得另开通道。
 * 2. **手套类型限频到 60FPS**（`shouldSendRealtimeFrame`）。手套串口是
 *    1Mbps，帧率远高于屏幕刷新率，不限频的话 WebSocket 缓冲区会堆积，
 *    延迟越跑越大。`respectFrequency: false` 用于「这一帧必须送到」的场合
 *    （比如归零后的第一帧），它绕过限频但**绕不过回放门**。
 *
 * 返回 0 有三种含义（回放中 / 被限频 / 没有订阅者），调用方都当「这帧没发出去」
 * 处理即可，不需要区分 —— 三种情况都不是错误。
 *
 * @param {string} channel 输出通道别名。
 * @param {string | object} jsonData 帧数据。
 * @param {{respectFrequency?: boolean}} [options] `respectFrequency: false` 跳过限频。
 * @returns {number} 实际发送成功的客户端数量；被拦下时 0。
 */
function publishRealtimeChannel(channel, jsonData, { respectFrequency = true } = {}) {
  if (runtimeContext.isLocalPlayback()) return 0;
  if (respectFrequency && !shouldSendRealtimeFrame(channel)) return 0;
  return publishRealtimeFrame(channel, jsonData);
}

const SENSOR_DATA_FIELDS = Object.freeze(['sitData', 'backData', 'headData', 'sensorData']);
const SENSOR_FRAME_ONLY_FIELDS = Object.freeze([
  'channelId',
  'displaySystemId',
  'sensorId',
  'sensorType',
  'outputChannel',
  'source',
  'timestamp',
  'data',
  'rawData',
  'normalizedData',
  'calibratedData',
  'pressureData',
  'realArr',
  'rawSitData',
  'rawPressureData',
  'mappedData',
  'mappedArr195',
  'newArr147',
  'newArr',
  'rotate',
  'orientation',
  'metrics',
  'algorithmMetrics',
  'metadata',
  'matrix',
  'matrixWidth',
  'matrixHeight',
  'matrixOrientation',
  'pressureThreshold',
  'temperatureRawData',
  'temperatureData',
  'temperatureAvg',
  'temperatureK',
  'sitFlag',
  'backFlag',
  'hz',
  'frameIndex',
  'packetType',
  'handSide',
  'outputSide',
  'packetSourcePort',
  'time',
  'index',
]);

/**
 * 把 `publishSystemEvent` 的入参归一成一个普通对象，归一不了就返回 null。
 *
 * 三种入参都得认，因为调用点横跨十几年的代码：新代码传对象，
 * 旧 handler 传 `JSON.stringify(...)` 的字符串，串口链路偶尔传 Buffer。
 *
 * `!Buffer.isBuffer(data)` 这个判断不能省：Buffer 也是 object，
 * 少了它 Buffer 会被当成「已经是对象」直接返回，后面读 `event.sitData` 拿到
 * undefined，于是整帧数据被当成低频系统事件广播出去 —— 不报错，只是画面不动。
 *
 * `!Array.isArray(parsed)` 同理：JSON 数组解析成功但不是事件形状，
 * 当成 null 交给调用方走「原样广播」的兜底路径。
 *
 * 返回 null 的语义是「这不是可拆解的事件对象」，而不是「出错了」——
 * 调用方（`publishSystemEvent`）会把原始 data 原样广播出去。
 * 这是刻意的宽容：解析失败不该让消息丢掉。
 *
 * @param {object | string | Buffer} data 待归一的载荷。
 * @returns {object | null} 事件对象；归一不了时 null。
 */
function parseOutboundSystemEvent(data) {
  if (data && typeof data === 'object' && !Buffer.isBuffer(data)) return data;
  try {
    const parsed = JSON.parse(String(data));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 发布低频系统事件；若旧调用把压力帧混在系统事件里，则在此边界拆成统一 sensor.frame。
 * 这样旧硬件处理器无需改变，WebSocket wire 上也不会再出现裸 sitData/backData/headData。
 */
function publishSystemEvent(data) {
  const event = parseOutboundSystemEvent(data);
  if (!event) return wsSubscriptions.publishScope('main', data);
  if (event.type === 'sensor.frame' && event.channelId) {
    return publishRealtimeFrame(
      event.outputChannel || event.sensorId || event.channelId,
      event,
      {
        source: event.source || 'realtime',
        timestamp: event.timestamp,
      },
    );
  }

  const channels = SENSOR_DATA_FIELDS
    .filter((field) => event[field] != null)
    .map((field) => field.slice(0, -4));
  if (!channels.length && event.outputChannel && event.data != null) {
    channels.push(event.outputChannel);
  }
  if (!channels.length) return wsSubscriptions.publishScope('main', event);

  let sent = 0;
  for (const channel of [...new Set(channels)]) {
    const framePayload = {
      ...event,
      outputChannel: channels.length === 1 && event.outputChannel
        ? event.outputChannel
        : channel,
    };
    for (const field of SENSOR_DATA_FIELDS) {
      if (field !== `${channel}Data`) delete framePayload[field];
    }
    sent += publishRealtimeFrame(channel, framePayload, {
      source: event.source || 'realtime',
      timestamp: event.timestamp || event.time,
    });
  }

  const systemPayload = { ...event };
  for (const field of [...SENSOR_DATA_FIELDS, ...SENSOR_FRAME_ONLY_FIELDS]) {
    delete systemPayload[field];
  }
  if (event.outputChannel) {
    delete systemPayload[`${event.outputChannel}Data`];
  }
  if (Object.keys(systemPayload).length) {
    sent += wsSubscriptions.publishScope('main', systemPayload);
  }
  return sent;
}

/**
 * 给单个客户端发一条 JQBed 算法配置消息。
 *
 * `readyState !== 1` 就直接返回 false：1 是 `WebSocket.OPEN`。
 * 这里写字面量 1 而不是 `WebSocket.OPEN` 是既有写法，含义相同。
 * 不判的话对正在关闭的连接调 `send` 会抛，而这个函数的调用点在
 * 协议 handler 里，抛出去会让整条命令失败 —— 但「客户端刚好断开」
 * 不该算命令失败。
 *
 * **私发而不是广播**：算法配置是应答某个客户端的请求，
 * 广播出去会让其他界面收到自己没请求过的配置并刷新显示。
 *
 * 用 `warn` 而不是 `error`：发不出去的原因基本都是客户端断开，
 * 不是后端故障，报 error 会把日志刷满。
 *
 * @param {import('ws')} client 目标客户端。
 * @param {object} payload 要发送的 JSON 对象。
 * @returns {boolean} 是否发送成功。
 */
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

/**
 * 更新 JQBed 算法进程的状态，**变了才广播**。
 *
 * 去重是必需的而不是优化：状态探测是**轮询**的（`probeJqbedAlgorithmConfig`
 * 每次都会调 `health`），不去重的话每次轮询都会广播一条相同的状态，
 * 前端每次都重渲染一遍状态指示灯。
 *
 * 用 `JSON.stringify` 比较而不是逐字段比：状态对象是
 * `{state, error}` 这种小而扁平的形状，字段可能增加（比如加个进程 pid），
 * 逐字段比的写法每加一个字段都要记得改，漏了就退化成「永远认为没变」——
 * 那比多广播几次更糟（状态卡住不更新）。
 *
 * ⚠️ `JSON.stringify` 依赖**键顺序**。两个语义相同但键顺序不同的对象会被判成
 * 「变了」，多广播一次而已，无害。但反过来不会漏 —— 不会把变了的判成没变。
 * 所以这个不精确的方向是安全的。
 *
 * @param {{state: string, error: string|null}} nextStatus 新状态。
 * @returns {void}
 */
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

/**
 * 汇总当前可订阅的实时通道清单，供前端建立订阅。
 *
 * 三份输入合成一份清单，缺一不可：
 * - `sensorType` —— 当前型号，决定哪些旧通道（sit/back/head）有意义。
 * - `manifestChannels` —— 展示系统 manifest 声明的通道，二开加的传感器就在这里出现。
 * - `managedChannels`（`serialManager.getStatus()`）—— 每个通道**实际**开没开。
 *
 * 前两份是「声明」，第三份是「现实」。前端要同时知道两者才能画出
 * 「这个通道存在但没连上」这种状态 —— 只给声明的话，用户看到通道在列表里
 * 却收不到数据，无从判断是没插线还是软件坏了。
 *
 * 每次现算而不缓存：串口开关和展示系统切换都会让结果变，
 * 而这个函数是前端主动查的（不是每帧调），现算的开销无所谓。
 *
 * @returns {Array<object>} 通道元信息列表。
 */
function getRealtimeChannelMetadata() {
  const sensorType = runtimeContext.getSensorType();
  const manifestChannels = appRuntime.displaySystems.listSerialChannels(sensorType);
  const realtimeChannels = buildRealtimeChannelMetadata({
    sensorType,
    manifestChannels,
    managedChannels: serialManager.getStatus(),
  });

  return realtimeChannels;
}

/**
 * 广播「有哪些历史采集日期可选」，并顺带清空各通道画面。
 *
 * ⚠️ **这个函数的分支结构是历史包袱，不是设计。** 它对 `car` / `car10` / `bigBed`
 * 三个型号各有一条特例，而且 `dedupli(sitTimeArr, backTimeArr)` 被算了两次
 * （1669 行与 1686 行），`car` 分支还会**先广播一次**再走通用路径广播第二次。
 * 结果是这三个型号的前端会收到两条 `timeArr`。
 *
 * 两次算出来的值对 `car` 是相同的（都是 `dedupli(sit, back)`）；
 * 对 `car10` 不同 —— 第一条是 `backRows`，第二条是合并结果。
 * 哪一条最终生效取决于前端如何处理两次 `timeArr`（未在此处验证），
 * 所以 `car10` 那条特例分支的实际效果只能确定它的清屏部分
 * （`backData: new Array(100)`，car10 的靠背是 10×10 而不是 64×64）。
 * **重构它需要在真机上逐型号验证，不属于「加注释」的范围**，
 * 所以这里只把现状记清楚。二开时如果新增型号，不要照抄这些特例分支 ——
 * 通用路径（1686 行起）就够了。
 *
 * 为什么广播日期列表时要顺带发全零帧：进入历史模式前画面上还是实时数据，
 * 不清屏用户会以为那是历史的第一帧。三个通道各清一次，
 * 单通道型号只清 sit（`isCar` / `isThreePortFile` 两层判断）。
 *
 * `bigBed` 的 sit 尺寸是 2048 而不是 `sitTotal`（4096）——
 * 它是 32×64 的双床垫，这个魔数在本文件里出现多次，全都是同一个原因。
 *
 * 500 条上限：历史日期列表是给人看的下拉框，超过 500 天的机器实际不存在；
 * 真有的话用户看到的是最近 500 天（`ORDER BY timestamp DESC`）。
 *
 * @returns {void}
 */
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

/**
 * 读出当前存着的授权密钥（config.txt 的原始密文）。
 *
 * `writableNameTxt || nameTxt` 这个优先顺序是打包后的关键：
 * `nameTxt` 可能指向**只读**资源目录里随包分发的那份 config.txt，
 * 而用户激活后写入的新授权在 `writableNameTxt`（userData 下）。
 * 顺序反了会让「激活成功但重启后又变回未授权」。
 *
 * @returns {string | null} 密钥密文；没有授权文件时 null。
 */
function getStoredLicenseKey() {
  return readStoredLicenseKey({ preferredPath: writableNameTxt || nameTxt });
}

/**
 * 校验并激活用户提交的授权密钥。
 *
 * ⚠️ **属于「用户权限与身份认证」这一类，改动前要按 CLAUDE.md 走人工确认。**
 * 密钥的格式、加解密方式（见 `aes_ecb.js`）和字段语义都是与**已经发出去的
 * 每一份 config.txt** 的兼容契约。
 *
 * 顺序很讲究，四步不能换：
 * 1. 先 `validateLicenseKey` 校验，**不通过就原样返回校验结果，什么都不改**。
 *    这是唯一的「失败不留痕」保证 —— 输错一次密钥不该把机器搞成半激活状态。
 * 2. 再 `writeStoredLicenseKey` 落盘，然后才更新内存里的三个字段。
 *    落盘在前是因为落盘会失败（磁盘满、权限），内存更新不会 ——
 *    反过来会出现「界面显示已激活但重启后没了」。
 * 3. `state.nextFile` 存在才切型号。授权范围变了不一定意味着当前型号要变
 *    （比如从单型号扩到多型号，当前型号仍在范围内），
 *    无条件切会把用户正在用的型号踢掉。
 * 4. 切型号时同步波特率、重置 petCare 运行态、并通过
 *    `runtimeStatePatchers` 把 file/baudRate 推进运行时 —— 这三件必须一起做，
 *    只改 `file` 会让串口继续用旧波特率读新型号的数据（现象是全是乱帧）。
 *
 * 返回值不是 `HttpResult`，而是 `{ok, code, payload}` 这个内部形状 ——
 * 因为它同时服务 HTTP 路由和 WebSocket 命令两条路，由各自的边界去转换。
 *
 * `payload.file` 与 `payload.currentSensorType` 是**两个不同的东西**，
 * 不能合并：前者是授权范围（可能是 `'all'` 或数组），
 * 后者是当前实际在用的型号。历史上它们共用过 `file` 字段，
 * 结果是激活后前端的授权列表被当前型号覆盖掉。
 *
 * @param {string} licenseKey 用户输入的密钥。
 * @returns {{ok: boolean, code: string, payload?: object}} 激活结果；
 *   失败时直接返回校验器的结果对象（含具体失败原因码）。
 */
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

/**
 * 决定一次采零/清零操作要作用到哪些通道。
 *
 * 显式传了 `channelIds` 就直接用 —— 前端点某个通道的归零按钮时走这条，
 * 不做任何推导。
 *
 * 没传时要把三份来源**并起来去重**，三份缺一不可：
 * - `declared` —— 当前活跃展示系统正在跑的通道（只有目标就是活跃系统时才有值）。
 * - `configured` —— 目标展示系统 manifest 里声明的通道。
 *   过滤 `channel.protocol && channel.id`：没有协议的通道是占位/分组节点，
 *   归零到它上面没有意义。
 * - `observed` —— 零点存储里已经见过的通道。这一份是为了让**已经归零过但现在
 *   没在跑的通道**也能被清零，否则用户切换展示系统之后就再也清不掉旧零点了。
 *
 * `operation === 'capture'` 时 `observed` 加 `withSourcesOnly` 过滤：
 * **采零需要有数据源才能采**（没数据采出来是一片零，等于把基线设成 0，
 * 比不采更糟）；清零不需要，任何见过的通道都该能清。
 * 这个参数是采零与清零唯一的行为差异。
 *
 * ⚠️ **返回值有两种形状**：显式传 `channelIds` 时返回**数组本身**，
 * 否则返回 `{channelIds, skipped}`。这个不一致是既有形状，
 * 消费端 `zeroCommandService.normalizeResolution` 明确兼容了两种
 * （见那边的注释），所以不算 bug；但二开时如果直接调这个函数，
 * 要记得两种都处理。
 *
 * `skipped` 只在「目标不是活跃系统且一个通道都解不出来」时才填 ——
 * 这时用户是在对另一个展示系统操作，需要知道为什么没生效
 * （`unknown-display-system` 还是 `no-target-channels`）。
 * 目标就是活跃系统而解出空列表时**不填 skipped**，交给下游判 409，
 * 因为那种情况下「没有通道」本身就是个更基础的问题。
 *
 * @param {object} [options] 参数。
 * @param {string} [options.displaySystemId] 目标展示系统；省略时用当前活跃的。
 * @param {string[]} [options.channelIds] 显式指定的通道；给了就直接返回。
 * @param {'capture' | 'clear'} [options.operation] 操作类型，影响 observed 的过滤。
 * @returns {string[] | {channelIds: string[], skipped: object[]}} 见上面的形状说明。
 */
function resolveZeroTargetChannelIds({
  displaySystemId,
  channelIds,
  operation,
} = {}) {
  if (Array.isArray(channelIds)) return channelIds;

  const activeDisplaySystemId = zeroChannelIdentityResolver.getActiveDisplaySystemId();
  const targetDisplaySystemId = displaySystemId || activeDisplaySystemId;
  const targetDisplaySystem = targetDisplaySystemId
    ? getDisplaySystemById(targetDisplaySystemId)
    : null;
  const declared = targetDisplaySystemId === activeDisplaySystemId
    ? zeroChannelIdentityResolver.listActiveChannelIds()
    : [];
  const configured = (targetDisplaySystem?.runtimeDefinition?.runtimeChannels || [])
    .filter((channel) => channel?.protocol && channel?.id)
    .map((channel) => String(channel.id));
  const observed = zeroStateStore.listChannelIds({
    displaySystemId: targetDisplaySystemId,
    withSourcesOnly: operation === 'capture',
  });
  const resolvedChannelIds = [...new Set([...declared, ...configured, ...observed])];
  if (!resolvedChannelIds.length && targetDisplaySystemId !== activeDisplaySystemId) {
    return {
      channelIds: [],
      skipped: [{
        displaySystemId: targetDisplaySystemId,
        reason: targetDisplaySystem ? 'no-target-channels' : 'unknown-display-system',
      }],
    };
  }
  return { channelIds: resolvedChannelIds, skipped: [] };
}

const zeroCommandService = createZeroCommandService({
  zeroStateStore,
  resolveTargetChannelIds: resolveZeroTargetChannelIds,
  getActiveDisplaySystemId: zeroChannelIdentityResolver.getActiveDisplaySystemId,
});
// 采零/清零属于实时校准，不走历史/串口 handler 的授权有效期门控；HTTP 与
// legacy WebSocket 共用这一份已在启动期完成的注册。
registerCalibrationZeroCommandHandler(controlCommandService, { zeroCommandService });

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
  zeroStateStore,
  resolveChannelIdentity: zeroChannelIdentityResolver.resolveChannelIdentity,
  calibration: smallBed12BCalibration,
  getDisplayOptions: () => smallBed12BDisplayOptions,
  getHz: () => getCollectionState('colHZ'),
  transposeSquareMatrix,
  getEndDate: () => endDate,
  setCurrentPressureFrame: (frame) => {
    pointArr = frame;
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
    nowDate: { get: () => nowDate, set: (value) => { nowDate = value; } },
    pointArr: { get: () => pointArr, set: (value) => { pointArr = value; } },
    pointArr2: { get: () => pointArr2, set: (value) => { pointArr2 = value; } },
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
  zeroFrameAdapter,
});
appRuntime.displaySystems.bindRuntimeChannels({
  serialManager,
  serialParserManager,
  frameOutputPipeline,
  getSensorType: runtimeContext.getSensorType,
  zeroStateStore,
});

/**
 * 输出一帧坐垫数据：该入库的入库，该发的发。
 *
 * 名字是历史遗留的缩写 —— **col**lect **or** **send**，
 * 反映了最初「要么存要么发」的二选一逻辑。
 * 现在两件事都做（`frameOutputPipeline` 内部按采集状态和回放状态各自决定），
 * 所以名字已经不准确了，但**这三个函数名是几十个硬件处理器的注入契约**
 * （见下面 `legacySerialFrameRuntimeBaseContext`），改名要同步改所有
 * `backend/extensions/built-in-sensors/` 下的处理器 —— 不值得。
 *
 * 三个变体（无后缀 / `1` / `2`）对应 sit / back / head 三条通道，
 * 命名同样是历史的。二开写新的传感器处理器时**不要沿用这个命名** ——
 * manifest 系统有任意多个通道，应该走 `publishRealtimeChannel` 加通道名。
 * 这三个只是给旧的三通道处理器留的入口。
 *
 * @param {string | object} jsonData 已处理好的帧数据。
 * @param {object} [options] 透传给管线的选项。
 * @returns {number} 实际发送成功的客户端数量。
 */
function colOrSendData(jsonData, options) {
  return frameOutputPipeline.publishSit(jsonData, options);
}



/**
 * 输出一帧靠背数据。命名与语义见 `colOrSendData`。
 *
 * @param {string | object} jsonData 已处理好的帧数据。
 * @param {object} [options] 透传给管线的选项。
 * @returns {number} 实际发送成功的客户端数量。
 */
function colOrSendData1(jsonData, options) {
  return frameOutputPipeline.publishBack(jsonData, options);
}







/**
 * 输出一帧头枕数据。命名与语义见 `colOrSendData`。
 *
 * 只有三通道型号（`volvo` / `wholeChair`，见 `isThreePortFile`）会用到它，
 * 其他型号的处理器不会调 —— 但注入表里仍然给了它，
 * 因为注入表是所有处理器共用的一份。
 *
 * @param {string | object} jsonData 已处理好的帧数据。
 * @param {object} [options] 透传给管线的选项。
 * @returns {number} 实际发送成功的客户端数量。
 */
function colOrSendData2(jsonData, options) {
  return frameOutputPipeline.publishHead(jsonData, options);
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
  serialParserManager,
});

jqbedTimer = petCareRuntimeService.startVitalSignsTimer();
petCareTimer = petCareRuntimeService.startPetCareTimer('petCare');
petCareMiniTimer = petCareRuntimeService.startPetCareTimer('petCareMini');

module.exports.shutdownServer = shutdownServer;

/**
 * 取 WebSocket Server 实例。
 *
 * `channel` 参数**已废弃但保留**：历史上每个通道一个端口，
 * 所以要按通道取不同的 server。现在全后端只有一个端口
 * （见 `websocketRuntimeFactory` 里那段单端口说明），
 * 任何通道都返回同一个实例。`void channel` 是显式表明「知道它没用」，
 * 免得后人以为是漏了实现。
 *
 * 删掉这个参数是安全的（多传的参数会被忽略），但也没必要 ——
 * 留着能让老调用点继续读得通。
 *
 * @param {string} [channel] 已忽略。
 * @returns {import('ws').Server} 唯一的 WebSocket Server。
 */
function getWsServer(channel = 'sit') {
  // 保留 channel 参数，任意 manifest outputChannel 都映射到同一物理服务。
  void channel;
  return server;
}

/**
 * 取订阅状态（谁订了哪些通道、各有多少客户端）。
 *
 * 这四个 `get*Status` / `get*Channels` 是**后端唯一的对外自省面**，
 * 由 HTTP 状态接口消费。它们对「打包后二开」很关键：
 * 装机之后没有开发者工具，出问题时只能靠这几个接口看到
 * 「通道存在吗 / 有人订阅吗 / 总线在动吗」。
 * 二开加了新通道而画面不出数据时，这三个的输出就是排查起点。
 *
 * @returns {object} 订阅状态快照。
 */
function getWsSubscriptionStatus() {
  return wsSubscriptions.getStatus();
}

/**
 * 取可订阅的实时通道清单。是 `getRealtimeChannelMetadata` 的导出别名。
 *
 * 分成两个名字是因为**内部调用点和导出契约是两件事**：
 * 内部叫 `...Metadata`（描述返回内容），导出叫 `getRealtimeChannels`
 * （HTTP 路由和 Electron 侧用的名字）。这样内部改名不会破坏对外契约。
 *
 * @returns {Array<object>} 通道元信息列表。
 */
function getRealtimeChannels() {
  return getRealtimeChannelMetadata();
}

/**
 * 取 ChannelBus 的统计信息（各通道的发布计数等）。
 *
 * 与 `getWsSubscriptionStatus` 是两层：总线统计说明「数据有没有产生」，
 * 订阅状态说明「有没有人收」。排查「画面不动」时要同时看这两个 ——
 * 只有总线在动而订阅为空，说明是前端没订上；两个都空则是数据没进来。
 *
 * @returns {object} 总线统计快照。
 */
function getChannelBusStatus() {
  return channelBus.getStats();
}

/**
 * 命令适配器的兜底分支：收到不认识的命令时记一条 warn 并返回 null。
 *
 * 这个函数**没有任何实际处理逻辑**，它是命令体系迁移留下的空壳：
 * 真正的命令处理已经全部搬到 `controlCommandService` +
 * `controlCommandRouter` 那套 handler 注册机制里（见本文件的
 * `registerRuntimeCommandHandlers` / `registerSerialControlHandlers` 等调用）。
 * 保留导出是因为 Electron 侧还 import 它。
 *
 * **返回 null 而不是抛错**，是刻意的：这条路径上的「不支持的命令」
 * 通常来自版本不匹配的前端，不该让后端出错。
 * 但也因此**不认识的命令会静默失败** —— 只有日志里那条 warn。
 * 二开时如果发现新加的命令「什么都没发生」，先来看这条日志，
 * 大概是命令没注册进 router，落到这里了。
 *
 * @param {{type?: string, action?: string}} command 收到的命令。
 * @returns {null} 恒为 null。
 */
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
