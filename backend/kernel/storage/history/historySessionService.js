/**
 * 创建历史回放会话服务。
 *
 * 该服务承接历史日期列表、历史数据加载、趋势曲线和切换历史时的空白帧 payload。
 * server.js 只提供数据库、运行态 getter/setter 和推送能力。
 *
 * @param {object} options 创建参数。
 * @returns {object} 历史会话能力。
 */
function createHistorySessionService({
  backTotal,
  buildHistoryZeroPlaybackPayload,
  createHistoryRowsForPlayback,
  createHistorySeries,
  dedupli,
  formatMatrixTotalForFile,
  getDatabases,
  getHistoryLengthFromCounts,
  getHistoryStats,
  getPlaybackState,
  getRuntime,
  isCar,
  isThreePortFile,
  logger,
  normalizeHistoryPressureData,
  patchPlaybackState,
  publishSystemEvent,
  queryHistoryDates,
  setPlaybackState,
  setRuntime,
  sitTotal,
  stopPlaybackTimer,
  totalToN,
  historyEagerRowLimit = 50000,
}) {
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
    const runtime = getRuntime();
    return buildHistoryZeroPlaybackPayload({
      sensorType: runtime.file,
      smallBed12BType: runtime.smallBed12BType,
      smallBed12BDisplayOptions: runtime.smallBed12BDisplayOptions,
    });
  }

  function broadcastHistorySelectionPayload(payload) {
    return publishSystemEvent(payload);
  }

  function calcDetectedInterval(timestamps) {
    const runtime = getRuntime();
    if (!Array.isArray(timestamps) || timestamps.length < 2) return runtime.timeNum;
    const sampleSize = Math.min(20, timestamps.length - 1);
    const diffs = [];
    for (let i = 1; i <= sampleSize; i++) {
      const diff = timestamps[i] - timestamps[i - 1];
      if (diff > 0 && diff < 5000) diffs.push(diff);
    }
    if (diffs.length === 0) return runtime.timeNum;
    diffs.sort((a, b) => a - b);
    return Math.max(1, diffs[Math.floor(diffs.length / 2)]);
  }

  function loadSelectedHistory(dateLabel) {
    try {
      const runtime = getRuntime();
      const { db, db1, db2 } = getDatabases();

      stopPlaybackTimer();
      patchPlaybackState({
        indexArr: [0, 0],
        localData: [],
        localDataBack: [],
        localDataHead: [],
        nowIndex: 0,
      });

      const sitStats = getHistoryStats(db, dateLabel, logger);
      const backStats = isCar(runtime.file) && db1
        ? getHistoryStats(db1, dateLabel, logger)
        : { count: 0, minId: 0, maxId: 0 };
      const headStats = isThreePortFile(runtime.file) && db2
        ? getHistoryStats(db2, dateLabel, logger)
        : { count: 0, minId: 0, maxId: 0 };
      const totalLength = isThreePortFile(runtime.file)
        ? getHistoryLengthFromCounts(sitStats.count, backStats.count, headStats.count)
        : isCar(runtime.file)
          ? getHistoryLengthFromCounts(sitStats.count, backStats.count)
          : getHistoryLengthFromCounts(sitStats.count);
      const maxRows = Math.max(sitStats.count, backStats.count, headStats.count);
      const eager = maxRows <= historyEagerRowLimit;

      const sitRows = createHistoryRowsForPlayback(db, dateLabel, sitStats, eager, logger);
      let backRows = [];
      let headRows = [];
      if (isCar(runtime.file) && db1) {
        backRows = createHistoryRowsForPlayback(db1, dateLabel, backStats, eager, logger);
      }
      if (isThreePortFile(runtime.file) && db2) {
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
        file: runtime.file,
      });
      const length = totalLength || historySeries.length;
      const timeStamp = historySeries.time;
      const detectedInterval = calcDetectedInterval(timeStamp);
      setPlaybackState('indexArr', [0, Math.max(length - 2, 0)]);
      setRuntime({
        detectedInterval,
        historyArr: [0, length],
        interval: detectedInterval,
        length,
        timeStamp,
      });

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
      patchPlaybackState({
        indexArr: [0, 0],
        localData: [],
        localDataBack: [],
        localDataHead: [],
        nowIndex: 0,
      });
      setRuntime({
        historyArr: [0, 0],
        length: 0,
        timeStamp: [],
      });
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

  function publishHistoryDateList() {
    const runtime = getRuntime();
    const { db, db1 } = getDatabases();
    const sitRows = queryHistoryDates(db, 500, 0, logger);
    let backRows = [];
    setRuntime({ sitTimeArr: sitRows });

    if (isCar(runtime.file)) {
      backRows = queryHistoryDates(db1, 500, 0, logger);
      setRuntime({ backTimeArr: backRows });
      const mergedTimeArr = dedupli(sitRows, backRows);

      if (runtime.file === 'car') {
        publishSystemEvent({
          timeArr: mergedTimeArr,
          backData: new Array(backTotal).fill(0),
        });
      }

      if (runtime.file === 'car10') {
        publishSystemEvent({
          timeArr: backRows,
          backData: new Array(100).fill(0),
        });
      }
    }

    const timeArr = isCar(runtime.file) ? dedupli(sitRows, backRows) : sitRows;
    publishSystemEvent({
      timeArr: runtime.file === 'bigBed' ? sitRows : timeArr,
      index: getPlaybackState('nowIndex'),
      sitData: new Array(runtime.file === 'bigBed' ? 2048 : sitTotal).fill(0),
    });

    if (isCar(runtime.file)) {
      publishSystemEvent({
        backData: new Array(backTotal).fill(0),
      });

      if (isThreePortFile(runtime.file)) {
        publishSystemEvent({
          headData: new Array(100).fill(0),
        });
      }
    }
  }

  return {
    buildZeroPlaybackPayload,
    calcDetectedInterval,
    getHistorySeries,
    loadSelectedHistory,
    publishHistoryDateList,
  };
}

module.exports = {
  createHistorySessionService,
};
