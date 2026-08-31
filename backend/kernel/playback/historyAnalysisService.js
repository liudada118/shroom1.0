/**
 * 历史回放和框选统计服务。
 *
 * 连接层只负责解析消息；这里承接旧主 WebSocket 中仍保留的历史差值、
 * 回放跳帧、坐面/靠背框选统计和历史曲线统计逻辑。
 */

function createHistoryAnalysisService({
  SMALL_BED_12B_TYPE,
  TEMP_FULL_BED_TYPE,
  buildTempFullBedPlaybackPayload,
  formatMatrixTotalForFile,
  getHistorySeries,
  getStoredSitData,
  isSmallBedMatrixType,
  logger,
  normalizeHistoryPressureData,
  parseStoredFrameData,
  publishPlaybackFrame,
  publishSystemEvent,
  runtime,
  totalToN,
}) {
  if (!runtime || typeof runtime !== 'object') {
    throw new Error('history analysis runtime is required');
  }

  /**
   * 处理授权有效期内的旧 WebSocket 历史/框选命令。
   *
   * @param {object} message 标准化后的前端消息。
   * @param {object} options 处理选项。
   * @param {string} options.clientName 当前连接标识。
   */
  function handle(message, options = {}) {
    if (runtime.nowDate >= runtime.endDate) return;

    if (message.variety != null) {
      publishHistoryDiffFrames();
    }

    if (runtime.localFlag && message.value != null) {
      const value = Number(message.value);
      logger.debug('received playback index %s from %s', value, options.clientName);
      runtime.nowIndex = value;
      publishPlaybackFrame(value, { includeIndex: false });
    }

    if (message.backIndex != null) {
      publishBackSelectionStats(message.backIndex);
    }

    if (message.sitIndex != null) {
      publishSitSelectionStats(message.sitIndex);
    }

    if (message.indexArr != null) {
      publishHistorySeries(message.indexArr);
    }
  }

  function publishHistoryDiffFrames() {
    if (!runtime.indexArr) return;

    if (runtime.localDataBack.length) {
      const startArr = JSON.parse(runtime.localDataBack[runtime.indexArr[0]].data);
      const endArr = JSON.parse(runtime.localDataBack[runtime.indexArr[1]].data);
      const newArr = startArr.map((a, index) => endArr[index] - a);
      publishSystemEvent(JSON.stringify({ backData: newArr }));
    }

    if (runtime.localData.length) {
      const startArr = JSON.parse(runtime.localData[runtime.indexArr[0]].data);
      const endArr = JSON.parse(runtime.localData[runtime.indexArr[1]].data);
      const newArr = startArr.map((a, index) => endArr[index] - a);
      publishSystemEvent(JSON.stringify({ sitData: newArr }));
    }
  }

  function publishBackSelectionStats(backArr) {
    if (!runtime.localDataBack.length) return;

    runtime.backPressSelect = [];
    runtime.backAreaSelect = [];
    for (let i = 0; i < runtime.localDataBack.length; i++) {
      runtime.newback = [];
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
          runtime.newback.push(JSON.parse(runtime.localDataBack[i].data)[x * 32 + y]);
        }
      }

      const total = runtime.newback.reduce((a, b) => a + b, 0);
      const area = runtime.newback.filter((a) => a > 10).length;
      runtime.backPressSelect.push(totalToN(total, 1.3));
      runtime.backAreaSelect.push(area);
    }

    publishSystemEvent({
      pressArr: runtime.backPressSelect,
      areaArr: runtime.backAreaSelect,
      length: runtime.length,
      time: runtime.timeStamp,
      index: runtime.nowIndex,
    });
  }

  function publishSitSelectionStats(sitArr) {
    runtime.sitPressSelect = [];
    runtime.sitAreaSelect = [];
    for (let i = 0; i < runtime.localData.length; i++) {
      const newsit = [];

      if (isSmallBedMatrixType(runtime.file) || runtime.file === SMALL_BED_12B_TYPE || runtime.file === TEMP_FULL_BED_TYPE) {
        const storedSitData = runtime.file === TEMP_FULL_BED_TYPE
          ? buildTempFullBedPlaybackPayload(runtime.localData[i]).sitData
          : runtime.file === SMALL_BED_12B_TYPE
            ? normalizeHistoryPressureData(runtime.localData[i], runtime.file)
            : getStoredSitData(runtime.localData[i]);
        const storedFrame = parseStoredFrameData(runtime.localData[i]);
        const storedWidth = runtime.file === TEMP_FULL_BED_TYPE ? 15 : Number(storedFrame?.matrixWidth) || 32;
        for (let x = sitArr[0]; x < sitArr[1]; x++) {
          for (let y = sitArr[2]; y < sitArr[3]; y++) {
            newsit.push(storedSitData[x * storedWidth + y]);
          }
        }
      } else {
        for (let x = sitArr[2]; x < sitArr[3]; x++) {
          for (let y = sitArr[0]; y < sitArr[1]; y++) {
            newsit.push(JSON.parse(runtime.localData[i].data)[x * 32 + y]);
          }
        }
      }

      const total = newsit.reduce((a, b) => a + b, 0);
      const area = newsit.filter((a) => a > 10).length;
      runtime.sitPressSelect.push(formatMatrixTotalForFile(total, runtime.file));
      runtime.sitAreaSelect.push(area);
    }

    publishSystemEvent({
      length: runtime.length,
      time: runtime.timeStamp,
      index: runtime.nowIndex,
      pressArr: runtime.sitPressSelect,
      areaArr: runtime.sitAreaSelect,
    });
  }

  function publishHistorySeries(indexArr) {
    runtime.historyArr = indexArr;
    const historySeries = getHistorySeries({
      sitRows: runtime.localData,
      backRows: runtime.localDataBack,
      start: indexArr[0],
      end: indexArr[1],
      file: runtime.file,
    });

    publishSystemEvent({
      pressArr: historySeries.press,
      areaArr: historySeries.area,
    });

    runtime.indexArr = indexArr;
  }

  return {
    handle,
  };
}

module.exports = {
  createHistoryAnalysisService,
};
