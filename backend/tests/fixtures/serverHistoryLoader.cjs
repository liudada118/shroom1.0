const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const clientRequire = createRequire(path.resolve(__dirname, '../../../client/package.json'));
const { parse } = clientRequire('espree');
const queries = require('../../kernel/storage/history/historyQueryService');
const history = require('../../kernel/playback/historyPlaybackService');
const channels = require('../../kernel/playback/channelPlaybackService');
const sensors = require('@shroom/backend/sensors');
const { isCar, totalToN } = require('../../compatibility/legacyDataUtils');
const { createHistoryFrameTransformService } = require('../../kernel/playback/historyFrameTransformService');
const { createRuntimeStateStore } = require('../../kernel/platform/runtime/runtimeStateStore');
const { createPlaybackTimerService } = require('../../kernel/playback/playbackTimerService');

/** 执行 server.js 原始加载函数及其常量声明；不启动串口/网络，不替生产代码注入阈值。 */
function createServerHistoryLoader(databases, sensorType = 'hand0205', clock = {}) {
  const filename = path.resolve(__dirname, '../../kernel/platform/server.js');
  const source = fs.readFileSync(filename, 'utf8');
  const names = new Set(['HISTORY_EAGER_ROW_LIMIT', 'loadSelectedHistory', 'getHistorySeries',
    'calcDetectedInterval', 'buildZeroPlaybackPayload', 'broadcastHistorySelectionPayload', 'playbackTimer']);
  const declarations = parse(source, { ecmaVersion: 'latest', range: true }).body.flatMap((node) => {
    if (node.type === 'FunctionDeclaration' && names.has(node.id.name)) return [source.slice(...node.range)];
    if (node.type === 'VariableDeclaration') return node.declarations
      .filter((declaration) => names.has(declaration.id.name))
      .map((declaration) => `${node.kind} ${source.slice(...declaration.range)};`);
    return [];
  });
  const state = createRuntimeStateStore();
  const events = [];
  const errors = [];
  const loads = [];
  const frames = [];
  const transforms = createHistoryFrameTransformService({
    isHandGloveType: sensors.isHandGloveType, isHandStorageType: sensors.isHandStorageType,
    totalToN, getRuntime: () => ({ file: sensorType }),
  });
  const context = vm.createContext({
    ...queries, ...channels, ...transforms,
    getHistoryLengthFromCounts: history.getHistoryLengthFromCounts,
    createHistorySeries: history.getHistorySeries,
    buildHistoryZeroPlaybackPayload: history.buildZeroPlaybackPayload,
    runtimeContext: { getSensorType: () => sensorType, getDatabase: (role) => databases[role] },
    isCar, isThreePortFile: sensors.isThreePortFile, totalToN,
    SMALL_BED_12B_TYPE: 'smallBed12B', smallBed12BDisplayOptions: {},
    length: 0, timeStamp: [], historyArr: [], interval: 10, detectedInterval: 10, timeNum: 10,
    playFlag: false,
    createPlaybackTimerService: (options) => createPlaybackTimerService({ ...options, ...clock }),
    publishPlaybackFrame: (index) => frames.push(index),
    stopPlaybackTimer: () => {}, patchPlaybackState: state.patch,
    setPlaybackState: state.set, getPlaybackState: state.get,
    publishSystemEvent: (event) => events.push(event),
    logger: { warn: () => {}, error: (...args) => errors.push(args) },
    createHistoryRowsForPlayback: (...args) => {
      loads.push({ count: args[2].count, eager: args[3] });
      return queries.createHistoryRowsForPlayback(...args);
    },
  });
  vm.runInContext(declarations.join('\n'), context, { filename });
  return { load: context.loadSelectedHistory, state, events, errors, loads, frames,
    timer: vm.runInContext('playbackTimer', context),
    getTiming: () => ({ interval: context.interval, detectedInterval: context.detectedInterval }) };
}

module.exports = { createServerHistoryLoader };
