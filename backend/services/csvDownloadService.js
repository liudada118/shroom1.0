const { createObjectCsvStringifier } = require('csv-writer');

const CSV_UTF8_BOM = '\ufeff';

function validateWritableDirectory({ fs, path, targetDir }) {
  const dir = String(targetDir || '').trim();
  if (!dir) {
    return { ok: false, error: 'download path is empty' };
  }

  const testFile = path.join(dir, `.shroom-write-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}.tmp`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return { ok: true, dir };
  } catch (error) {
    try {
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    } catch {
      // Ignore cleanup failure.
    }
    return { ok: false, error: error.message };
  }
}

function formatDateLabel(date, timeStampToDateLabel) {
  const value = String(date || '');
  if (value.includes(' ')) return value.split(' ')[0];
  return timeStampToDateLabel(Number(value));
}

async function writeCsvFile({ fs, filePath, headers, records }) {
  const stringifier = createObjectCsvStringifier({ header: headers });
  const content = CSV_UTF8_BOM +
    stringifier.getHeaderString() +
    stringifier.stringifyRecords(records);
  await fs.promises.writeFile(filePath, content, 'utf8');
  return filePath;
}

function createCsvDownloadService({
  fs,
  path,
  logger,
  csvPath,
  publishSystemEvent,
  getRuntime,
  getDatabases,
  getHistoryStats,
  queryHistoryRows,
  normalizeHistoryPressureData,
  formatMatrixTotalForFile,
  totalToN,
  findMax,
  timeStampToDate,
  timeStampToDateLabel,
  getCsvElapsedSeconds,
  getCsvFilePrefix,
  getCsvTitleMap,
  isCar,
  isThreePortFile,
}) {
  function getCsvExportDirectory(downloadOptions = {}) {
    const requestedDir =
      (typeof downloadOptions.path === 'string' && downloadOptions.path.trim()) ||
      (typeof downloadOptions.dir === 'string' && downloadOptions.dir.trim()) ||
      csvPath;
    return validateWritableDirectory({ fs, path, targetDir: requestedDir });
  }

  function publishResult(download, { files = [], dir = '', error = '' } = {}) {
    return publishSystemEvent({
      download,
      downloadStatus: download === 'export csv success' ? 'success' : 'failed',
      downloadFiles: files,
      downloadDir: dir,
      downloadError: error,
    });
  }

  function publishProgress(progress = {}) {
    return publishSystemEvent({
      csvDownloadProgress: progress,
      downloadStatus: 'progress',
      downloadDir: progress.dir || '',
    });
  }

  function buildHeaders(csvTitle) {
    return [
      { id: 'index', title: csvTitle.index },
      { id: 'max', title: csvTitle.max },
      { id: 'time', title: csvTitle.time },
      { id: 'pressureArea', title: csvTitle.pressureArea },
      { id: 'pressure', title: csvTitle.pressure },
      { id: 'realData', title: csvTitle.realData },
    ];
  }

  function buildChannelRecords({ rows, sensorType, channel, range, csvTitle }) {
    const start = Math.max(0, Number(range?.[0] || 0));
    const end = Math.min(Number(range?.[1] || rows.length), rows.length);
    const records = [];

    for (let i = start, frameIndex = 0; i < end; i++, frameIndex++) {
      const row = rows[i];
      const data = normalizeHistoryPressureData(row, sensorType);
      const pressureSum = data.reduce((sum, value) => sum + value, 0);
      const areaThreshold = channel === 'sit' ? 0 : 10;
      const area = data.filter((value) => value > areaThreshold).length;
      const pressure = channel === 'sit'
        ? formatMatrixTotalForFile(pressureSum, sensorType)
        : totalToN(pressureSum, 1.3);

      records.push({
        index: getCsvElapsedSeconds(rows, i, start, frameIndex),
        max: data.length ? findMax(data) : 0,
        time: timeStampToDate(row?.timestamp),
        pressureArea: area,
        pressure,
        realData: JSON.stringify(data),
      });
    }

    return { records, start, end };
  }

  async function exportChannel({
    dbRef,
    date,
    dir,
    csvTitle,
    sensorType,
    channel,
    range,
    downloadOptions,
  }) {
    const stats = getHistoryStats(dbRef, date, logger);
    if (!stats.count) return null;
    const rows = queryHistoryRows(dbRef, date, stats.count, 0, logger);
    if (!rows.length) return null;

    const { records } = buildChannelRecords({
      rows,
      sensorType,
      channel,
      range,
      csvTitle,
    });
    if (!records.length) return null;

    const label = formatDateLabel(date, timeStampToDateLabel);
    const prefix = getCsvFilePrefix(sensorType, channel, downloadOptions);
    const filePath = path.join(dir, `${prefix}${label}.csv`);
    await writeCsvFile({
      fs,
      filePath,
      headers: buildHeaders(csvTitle),
      records,
    });
    return filePath;
  }

  async function exportHistoryCsv({ date, downloadOptions = {} }) {
    const csvFormat = String(downloadOptions?.format || 'csv').toLowerCase();
    if (csvFormat !== 'csv') {
      publishResult('export csv failed', { error: `unsupported export format: ${csvFormat}` });
      return;
    }

    const csvExportDir = getCsvExportDirectory(downloadOptions);
    if (!csvExportDir.ok) {
      logger?.error?.('[CSV] invalid export directory:', csvExportDir.error);
      publishResult('export csv failed', { error: csvExportDir.error });
      return;
    }

    const runtime = getRuntime();
    const databases = getDatabases();
    const csvTitle = getCsvTitleMap(downloadOptions);
    const files = [];

    publishProgress({ phase: 'start', date, dir: csvExportDir.dir });
    try {
      const sitFile = await exportChannel({
        dbRef: databases.db,
        date,
        dir: csvExportDir.dir,
        csvTitle,
        sensorType: runtime.file,
        channel: 'sit',
        range: runtime.historyArr,
        downloadOptions,
      });
      if (sitFile) files.push(sitFile);
      publishProgress({ phase: 'sit', date, dir: csvExportDir.dir, files: files.length });

      if (isCar(runtime.file) && databases.db1) {
        const backFile = await exportChannel({
          dbRef: databases.db1,
          date,
          dir: csvExportDir.dir,
          csvTitle,
          sensorType: runtime.file,
          channel: 'back',
          range: runtime.historyArr,
          downloadOptions,
        });
        if (backFile) files.push(backFile);
        publishProgress({ phase: 'back', date, dir: csvExportDir.dir, files: files.length });
      }

      if (isThreePortFile(runtime.file) && databases.db2) {
        const headFile = await exportChannel({
          dbRef: databases.db2,
          date,
          dir: csvExportDir.dir,
          csvTitle,
          sensorType: runtime.file,
          channel: 'head',
          range: runtime.historyArr,
          downloadOptions,
        });
        if (headFile) files.push(headFile);
        publishProgress({ phase: 'head', date, dir: csvExportDir.dir, files: files.length });
      }

      publishResult('export csv success', { files, dir: csvExportDir.dir });
    } catch (error) {
      logger?.error?.('[CSV] export failed', error);
      publishResult('export csv failed', {
        files,
        dir: csvExportDir.dir,
        error: error?.message || String(error || ''),
      });
    }
  }

  return {
    exportHistoryCsv,
    getCsvExportDirectory,
    publishProgress,
    publishResult,
  };
}

module.exports = {
  createCsvDownloadService,
  validateWritableDirectory,
  writeCsvFile,
};
