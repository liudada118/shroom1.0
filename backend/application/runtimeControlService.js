/**
 * 运行时控制应用服务。
 * 这里承接显示配置、历史回放、采集控制、运行参数、历史维护和 CSV 导出等业务动作。
 */
function createRuntimeControlService(deps) {
  const {
    csvDownloadService,
    getRuntime,
    historyMaintenanceService,
    normalizeCollectFrequency,
    normalizeCollectOptions,
    normalizeSmallBed12BDisplayOptions,
    resetCollectionStorageClock,
    flushCollectionInsertQueues,
    startPlaybackTimer,
    stopPlaybackTimer,
    setRuntime,
  } = deps;

  function updateDisplayOptions(options) {
    setRuntime({
      smallBed12BDisplayOptions: normalizeSmallBed12BDisplayOptions(options),
    });
  }

  function updateHistoryPlayback(message) {
    const runtime = getRuntime();
    const next = {};
    if (message.history != null) next.history = message.history;
    if (message.up != null) next.up = Number(message.up);
    if (message.down != null) next.down = Number(message.down);
    if (message.history === false) {
      next.history = false;
      stopPlaybackTimer();
    }
    if (message.speed != null) {
      const speed = Number(message.speed);
      next.interval = Math.max(1, parseInt(runtime.detectedInterval / speed));
      if (runtime.playFlag) startPlaybackTimer();
      else stopPlaybackTimer();
    }
    if (message.play != null) {
      next.playFlag = message.play;
      if (message.play) startPlaybackTimer();
      else stopPlaybackTimer();
    }
    if (message.index != null) next.nowIndex = message.index;
    setRuntime(next);
  }

  function updateCollectionControl(message) {
    const runtime = getRuntime();
    const next = {};
    if (message.time != null) next.saveTime = message.time;
    if (message.colName != null) next.saveTime = message.colName;
    if (message.flag === true) {
      next.flag = true;
      resetCollectionStorageClock();
    } else if (message.flag === false) {
      flushCollectionInsertQueues();
      next.flag = false;
    }
    if (message.colHZ != null) {
      next.colHZ = normalizeCollectFrequency(message.colHZ, runtime.colHZ);
      next.collectOptions = normalizeCollectOptions({
        ...runtime.collectOptions,
        frequencyHz: next.colHZ,
      }, next.colHZ);
    }
    if (message.collectOptions != null) {
      next.collectOptions = normalizeCollectOptions(message.collectOptions, next.colHZ ?? runtime.colHZ);
      next.colHZ = next.collectOptions.frequencyHz;
    }
    setRuntime(next);
  }

  function updateRuntimeOptions(message) {
    const next = {};
    if (message.baudRate != null) next.baudRate = Number(message.baudRate);
    if (message.gauss != null) next.gauss = message.gauss;
    setRuntime(next);
  }

  function deleteHistory(dateLabel) {
    historyMaintenanceService.deleteHistory(dateLabel);
  }

  function exportHistoryCsv(message) {
    setRuntime({ smoothValue: 0 });
    csvDownloadService.exportHistoryCsv({
      date: message.download,
      downloadOptions: message.downloadOptions || {},
    });
  }

  return {
    deleteHistory,
    exportHistoryCsv,
    updateCollectionControl,
    updateDisplayOptions,
    updateHistoryPlayback,
    updateRuntimeOptions,
  };
}

module.exports = {
  createRuntimeControlService,
};
