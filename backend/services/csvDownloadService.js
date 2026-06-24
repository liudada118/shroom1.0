/**
 * CSV 下载服务。
 *
 * 负责校验导出目录、分页读取历史数据、构造 CSV 记录、写入 UTF-8 BOM 文件，
 * 并通过系统事件向前端上报导出进度、成功文件列表或失败原因。
 */
const { createObjectCsvStringifier } = require('csv-writer');

const CSV_UTF8_BOM = '\ufeff';

/**
 * 校验目标目录是否可写。
 *
 * @param {object} options 文件系统、path 模块和目标目录。
 * @returns {{ ok: boolean, dir?: string, error?: string }} 校验结果。
 */
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

/**
 * 将历史日期或时间戳格式化为文件名可用的日期标签。
 *
 * @param {string | number} date 历史日期或时间戳。
 * @param {Function} timeStampToDateLabel 时间戳转日期函数。
 * @returns {string} 日期标签。
 */
function formatDateLabel(date, timeStampToDateLabel) {
  const value = String(date || '');
  if (value.includes(' ')) return value.split(' ')[0];
  return timeStampToDateLabel(Number(value));
}

/**
 * 写入单个 CSV 文件。
 *
 * @param {object} options 写入参数。
 * @returns {Promise<string>} 写入完成后的文件路径。
 */
async function writeCsvFile({ fs, filePath, headers, records }) {
  const stringifier = createObjectCsvStringifier({ header: headers });
  const content = CSV_UTF8_BOM +
    stringifier.getHeaderString() +
    stringifier.stringifyRecords(records);
  await fs.promises.writeFile(filePath, content, 'utf8');
  return filePath;
}

/**
 * 创建 CSV 下载服务。
 *
 * @param {object} deps 运行时依赖。
 * @returns {object} CSV 导出 API。
 */
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
  /**
   * 获取并校验 CSV 导出目录。
   *
   * @param {object} downloadOptions 下载配置。
   * @returns {{ ok: boolean, dir?: string, error?: string }} 目录校验结果。
   */
  function getCsvExportDirectory(downloadOptions = {}) {
    const requestedDir =
      (typeof downloadOptions.path === 'string' && downloadOptions.path.trim()) ||
      (typeof downloadOptions.dir === 'string' && downloadOptions.dir.trim()) ||
      csvPath;
    return validateWritableDirectory({ fs, path, targetDir: requestedDir });
  }

  /**
   * 向前端发布 CSV 导出最终结果。
   *
   * @param {string} download 旧前端兼容状态字段。
   * @param {object} result 导出结果。
   * @returns {number} 推送到的客户端数量。
   */
  function publishResult(download, { files = [], dir = '', error = '' } = {}) {
    return publishSystemEvent({
      download,
      downloadStatus: download === 'export csv success' ? 'success' : 'failed',
      downloadFiles: files,
      downloadDir: dir,
      downloadError: error,
    });
  }

  /**
   * 向前端发布 CSV 导出进度。
   *
   * @param {object} progress 进度信息。
   * @returns {number} 推送到的客户端数量。
   */
  function publishProgress(progress = {}) {
    return publishSystemEvent({
      csvDownloadProgress: progress,
      downloadStatus: 'progress',
      downloadDir: progress.dir || '',
    });
  }

  /**
   * 根据语言表头映射构建 csv-writer header 配置。
   *
   * @param {Record<string, string>} csvTitle 表头映射。
   * @returns {Array<{ id: string, title: string }>} CSV header 配置。
   */
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

  /**
   * 将某个通道的历史行转换为 CSV 记录。
   *
   * @param {object} options 通道历史行、传感器类型和导出范围。
   * @returns {{ records: object[], start: number, end: number }} CSV 记录和范围。
   */
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

  /**
   * 导出单个通道的历史 CSV 文件。
   *
   * @param {object} options 通道导出参数。
   * @returns {Promise<string | null>} 导出的文件路径；无数据时返回 null。
   */
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

  /**
   * 导出当前历史日期的 CSV 文件；汽车/三通道类型会导出多路文件。
   *
   * @param {{ date: string, downloadOptions?: object }} options 导出参数。
   * @returns {Promise<void>} 导出完成 Promise。
   */
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
