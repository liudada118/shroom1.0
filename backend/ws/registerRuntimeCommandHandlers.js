function registerRuntimeCommandHandlers(router, deps) {
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

  router.register({
    name: 'display-options',
    when: (message) => message.smallBed12BDisplayOptions != null,
    handle: (message) => {
      setRuntime({
        smallBed12BDisplayOptions: normalizeSmallBed12BDisplayOptions(message.smallBed12BDisplayOptions),
      });
    },
  });

  router.register({
    name: 'history-playback-state',
    when: (message) => (
      message.history != null ||
      message.up != null ||
      message.down != null ||
      message.history === false ||
      message.speed != null ||
      message.play != null ||
      message.index != null
    ),
    handle: (message) => {
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
    },
  });

  router.register({
    name: 'collection-control',
    when: (message) => (
      message.flag === true ||
      message.flag === false ||
      message.colHZ != null ||
      message.collectOptions != null ||
      message.time != null ||
      message.colName != null
    ),
    handle: (message) => {
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
    },
  });

  router.register({
    name: 'runtime-options',
    when: (message) => message.baudRate != null || message.gauss != null,
    handle: (message) => {
      const next = {};
      if (message.baudRate != null) next.baudRate = Number(message.baudRate);
      if (message.gauss != null) next.gauss = message.gauss;
      setRuntime(next);
    },
  });

  router.register({
    name: 'history-maintenance',
    when: (message) => message.delete != null,
    handle: (message) => {
      historyMaintenanceService.deleteHistory(message.delete);
    },
  });

  router.register({
    name: 'csv-download',
    when: (message) => message.download != null,
    handle: (message) => {
      setRuntime({ smoothValue: 0 });
      csvDownloadService.exportHistoryCsv({
        date: message.download,
        downloadOptions: message.downloadOptions || {},
      });
      return { stop: true };
    },
  });
}

module.exports = {
  registerRuntimeCommandHandlers,
};
