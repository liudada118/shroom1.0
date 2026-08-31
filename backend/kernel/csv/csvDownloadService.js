/**
 * CSV 下载服务。
 *
 * 新历史数据按 canonical channelId 精确导出；旧 db/db1/db2 中 channel_id IS NULL
 * 的行继续分别映射为 sit/back/head。新增串口不需要再增加 dbN 分支。
 */
const { createHash } = require('crypto');
const { createObjectCsvStringifier } = require('csv-writer');

const CSV_UTF8_BOM = '\ufeff';
const DATABASE_SLOTS = Object.freeze([
  { key: 'db', legacyChannel: 'sit' },
  { key: 'db1', legacyChannel: 'back' },
  { key: 'db2', legacyChannel: 'head' },
]);

function hasOwn(value, key) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

function parseStoredData(row) {
  if (row?.data == null) return null;
  if (typeof row.data === 'object') return row.data;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

function normalizeLegacyIdentityPart(value, fallback) {
  const normalized = String(value || fallback)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-');
  return normalized || fallback;
}

/** 清理跨平台文件名；短 hash 负责区分清洗后同名的 channelId。 */
function sanitizeFileNameSegment(value, fallback = 'channel') {
  let result = String(value || fallback)
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/[-. ]+$/g, '')
    .replace(/^[-. ]+/g, '')
    .slice(0, 48);
  if (!result) result = fallback;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(result)) result = `_${result}`;
  return result;
}

function shortChannelHash(channelId) {
  return createHash('sha256').update(String(channelId || '')).digest('hex').slice(0, 8);
}

function splitChannelId(channelId, fallbackDisplay = 'legacy', fallbackSensor = 'sensor') {
  const value = String(channelId || '').trim();
  const separator = value.indexOf(':');
  if (separator > 0 && separator < value.length - 1) {
    return {
      displaySystemId: value.slice(0, separator),
      sensorId: value.slice(separator + 1),
    };
  }
  return { displaySystemId: fallbackDisplay, sensorId: fallbackSensor };
}

function validateWritableDirectory({ fs, path, targetDir }) {
  const dir = String(targetDir || '').trim();
  if (!dir) return { ok: false, error: 'download path is empty' };
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
  const content = CSV_UTF8_BOM + stringifier.getHeaderString() + stringifier.stringifyRecords(records);
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
  queryHistoryChannels,
  getChannelHistoryStats,
  queryChannelHistoryRows,
  normalizeHistoryPressureData,
  formatMatrixTotalForFile,
  totalToN,
  findMax,
  timeStampToDate,
  timeStampToDateLabel,
  getCsvElapsedSeconds,
  getCsvFilePrefix,
  getCsvTitleMap,
}) {
  function getCsvExportDirectory(downloadOptions = {}) {
    const requestedDir =
      (typeof downloadOptions.path === 'string' && downloadOptions.path.trim()) ||
      (typeof downloadOptions.dir === 'string' && downloadOptions.dir.trim()) ||
      csvPath;
    return validateWritableDirectory({ fs, path, targetDir: requestedDir });
  }

  function publishResult(download, {
    files = [], artifacts = [], skippedChannels = [], dir = '', error = '',
  } = {}) {
    return publishSystemEvent({
      download,
      downloadStatus: download === 'export csv success' ? 'success' : 'failed',
      downloadFiles: files,
      downloadArtifacts: artifacts,
      downloadSkippedChannels: skippedChannels,
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

  function title(csvTitle, key, fallback) {
    const value = csvTitle?.[key];
    return typeof value === 'string' && value.trim() ? value : fallback;
  }

  function buildHeaders(csvTitle) {
    return [
      { id: 'index', title: title(csvTitle, 'index', 'index') },
      { id: 'max', title: title(csvTitle, 'max', 'max') },
      { id: 'time', title: title(csvTitle, 'time', 'time') },
      { id: 'pressureArea', title: title(csvTitle, 'pressureArea', 'pressureArea') },
      { id: 'pressure', title: title(csvTitle, 'pressure', 'pressure') },
      { id: 'realData', title: title(csvTitle, 'realData', 'realData') },
      { id: 'channelId', title: title(csvTitle, 'channelId', 'channelId') },
      { id: 'displaySystemId', title: title(csvTitle, 'displaySystemId', 'displaySystemId') },
      { id: 'sensorId', title: title(csvTitle, 'sensorId', 'sensorId') },
      { id: 'sensorLabel', title: title(csvTitle, 'sensorLabel', 'sensorLabel') },
      { id: 'sensorType', title: title(csvTitle, 'sensorType', 'sensorType') },
      { id: 'outputChannel', title: title(csvTitle, 'outputChannel', 'outputChannel') },
      { id: 'timestamp', title: title(csvTitle, 'timestamp', 'timestamp') },
      { id: 'schemaVersion', title: title(csvTitle, 'schemaVersion', 'schemaVersion') },
      { id: 'serialRole', title: title(csvTitle, 'serialRole', 'serialRole') },
      { id: 'serialPortPath', title: title(csvTitle, 'serialPortPath', 'serialPortPath') },
      { id: 'baudRate', title: title(csvTitle, 'baudRate', 'baudRate') },
      { id: 'parserChannel', title: title(csvTitle, 'parserChannel', 'parserChannel') },
    ];
  }

  function firstPresent(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== '');
  }

  /** 数据库列和已存帧属于历史事实，优先于 descriptor 的汇总值。 */
  function resolveRecordIdentity(row, storedData, descriptor) {
    const stored = storedData && typeof storedData === 'object' && !Array.isArray(storedData)
      ? storedData
      : {};
    const identity = stored.identity && typeof stored.identity === 'object' ? stored.identity : {};
    const serial = stored.serial && typeof stored.serial === 'object'
      ? stored.serial
      : identity.serial && typeof identity.serial === 'object'
        ? identity.serial
        : stored.metadata?.serial && typeof stored.metadata.serial === 'object'
          ? stored.metadata.serial
          : {};
    return {
      channelId: String(descriptor.channelId || ''),
      displaySystemId: String(firstPresent(
        row?.display_system_id, row?.displaySystemId, stored.displaySystemId,
        identity.displaySystemId, descriptor.displaySystemId,
      ) || ''),
      sensorId: String(firstPresent(
        row?.sensor_id, row?.sensorId, stored.sensorId, identity.sensorId, descriptor.sensorId,
      ) || ''),
      sensorLabel: String(firstPresent(
        row?.sensor_label, row?.sensorLabel, stored.sensorLabel,
        identity.sensorLabel, descriptor.sensorLabel,
      ) || ''),
      sensorType: String(firstPresent(
        row?.sensor_type, row?.sensorType, stored.sensorType,
        identity.sensorType, descriptor.sensorType,
      ) || ''),
      outputChannel: String(firstPresent(
        row?.output_channel, row?.outputChannel, stored.outputChannel,
        identity.outputChannel, descriptor.outputChannel,
      ) || ''),
      schemaVersion: firstPresent(
        row?.schema_version, row?.schemaVersion, stored.schemaVersion,
        identity.schemaVersion, descriptor.schemaVersion, descriptor.legacy ? 0 : 1,
      ),
      serialRole: String(firstPresent(
        row?.serial_role, row?.serialRole, stored.serialRole, identity.serialRole,
        serial.role, serial.serialRole, descriptor.serialRole,
      ) || ''),
      serialPortPath: String(firstPresent(
        row?.serial_port_path, row?.serialPortPath, stored.serialPortPath,
        identity.serialPortPath, serial.path, serial.port, serial.portPath, serial.serialPortPath,
        descriptor.serialPortPath,
      ) || ''),
      baudRate: firstPresent(
        row?.baud_rate, row?.baudRate, stored.baudRate, identity.baudRate,
        serial.baudRate, descriptor.baudRate, '',
      ),
      parserChannel: String(firstPresent(
        row?.parser_channel, row?.parserChannel, stored.parserChannel,
        identity.parserChannel, serial.parserChannel, serial.channel, descriptor.parserChannel,
      ) || ''),
    };
  }

  /** canonical 帧优先 data/normalizedData/${outputChannel}Data；旧行保持原归一化路径。 */
  function rowForPressureNormalization(row, storedData, descriptor) {
    if (descriptor.legacy || !storedData || typeof storedData !== 'object' || Array.isArray(storedData)) {
      return row;
    }
    const outputDataKey = descriptor.outputChannel ? `${descriptor.outputChannel}Data` : '';
    const preferred = [
      storedData.data,
      storedData.normalizedData,
      outputDataKey ? storedData[outputDataKey] : null,
    ].find(Array.isArray);
    if (!preferred) return row;
    return {
      ...row,
      data: JSON.stringify({ ...storedData, pressureData: preferred }),
    };
  }

  const artifactIdentityLists = Object.freeze({
    serialRole: 'serialRoles',
    serialPortPath: 'serialPortPaths',
    baudRate: 'baudRates',
    parserChannel: 'parserChannels',
  });

  function appendArtifactIdentityValue(target, listKey, value) {
    if (value === '' || value == null) return;
    if (!Array.isArray(target[listKey])) target[listKey] = [];
    if (!target[listKey].some((item) => String(item) === String(value))) {
      target[listKey].push(value);
    }
  }

  function mergeArtifactIdentity(target, identity = {}, { fallbackOnly = false } = {}) {
    for (const key of ['sensorType', 'serialRole', 'serialPortPath', 'baudRate', 'parserChannel']) {
      if ((target[key] === '' || target[key] == null) && identity[key] !== '' && identity[key] != null) {
        target[key] = identity[key];
      }
      const listKey = artifactIdentityLists[key];
      if (!listKey) continue;
      const declaredValues = Array.isArray(identity[listKey]) ? identity[listKey] : [];
      const fallbackValues = fallbackOnly && target[listKey]?.length ? [] : [identity[key]];
      for (const value of [...declaredValues, ...fallbackValues]) {
        appendArtifactIdentityValue(target, listKey, value);
      }
    }
  }

  function buildChannelRecords({ rows, sensorType, descriptor, range }) {
    const start = Math.max(0, Number(range?.[0] || 0));
    const end = Math.min(Number(range?.[1] || rows.length), rows.length);
    const records = [];
    // 先从实际历史行取；只有整批行都缺字段时才由 descriptor 兜底。
    const artifactIdentity = {
      sensorType: '',
      serialRole: '',
      serialPortPath: '',
      baudRate: '',
      parserChannel: '',
      serialRoles: [],
      serialPortPaths: [],
      baudRates: [],
      parserChannels: [],
    };

    for (let i = start, frameIndex = 0; i < end; i++, frameIndex++) {
      const row = rows[i];
      const storedData = parseStoredData(row);
      const identity = resolveRecordIdentity(row, storedData, descriptor);
      const rowSensorType = identity.sensorType || descriptor.sensorType || sensorType;
      const data = normalizeHistoryPressureData(
        rowForPressureNormalization(row, storedData, descriptor),
        rowSensorType,
      );
      const pressureSum = data.reduce((sum, value) => sum + value, 0);
      // sit/back 的阈值差异只属于旧三通道格式；canonical outputChannel 是任意展示别名，
      // 不能把名为 sit 的左手误当坐垫，也不能把名为 leftHand 的座垫套靠背阈值。
      const useLegacySecondaryChannelRule = descriptor.legacy && descriptor.outputChannel !== 'sit';
      const areaThreshold = useLegacySecondaryChannelRule ? 10 : 0;
      const pressure = useLegacySecondaryChannelRule
        ? totalToN(pressureSum, 1.3)
        : formatMatrixTotalForFile(pressureSum, rowSensorType);

      mergeArtifactIdentity(artifactIdentity, identity);
      records.push({
        index: getCsvElapsedSeconds(rows, i, start, frameIndex),
        max: data.length ? findMax(data) : 0,
        time: timeStampToDate(row?.timestamp),
        pressureArea: data.filter((value) => value > areaThreshold).length,
        pressure,
        realData: JSON.stringify(data),
        ...identity,
        timestamp: row?.timestamp ?? '',
      });
    }
    mergeArtifactIdentity(artifactIdentity, descriptor, { fallbackOnly: true });
    artifactIdentity.serialChanged = artifactIdentity.serialPortPaths.length > 1;
    return { records, artifactIdentity };
  }

  function normalizeIdentityList(values, fallback) {
    const entries = Array.isArray(values) ? values : [];
    return [...new Map([...entries, fallback]
      .filter((value) => value !== '' && value != null)
      .map((value) => [String(value), value])).values()];
  }

  function normalizeDescriptor(descriptor, source) {
    const channelId = String(descriptor?.channelId || '').trim();
    if (!channelId) return null;
    const parsed = splitChannelId(channelId);
    return {
      channelId,
      displaySystemId: String(descriptor.displaySystemId || parsed.displaySystemId),
      sensorId: String(descriptor.sensorId || parsed.sensorId),
      sensorLabel: String(descriptor.sensorLabel || descriptor.sensorId || parsed.sensorId),
      sensorType: String(descriptor.sensorType || ''),
      outputChannel: String(descriptor.outputChannel || parsed.sensorId),
      schemaVersion: descriptor.schemaVersion ?? 1,
      count: Number(descriptor.count || 0),
      serialRole: String(descriptor.serialRole || ''),
      serialPortPath: String(descriptor.serialPortPath || ''),
      baudRate: descriptor.baudRate ?? '',
      parserChannel: String(descriptor.parserChannel || ''),
      serialRoles: normalizeIdentityList(descriptor.serialRoles),
      serialPortPaths: normalizeIdentityList(descriptor.serialPortPaths),
      baudRates: normalizeIdentityList(descriptor.baudRates),
      parserChannels: normalizeIdentityList(descriptor.parserChannels),
      legacy: false,
      source,
    };
  }

  function buildLegacyDescriptor(runtime, source) {
    const displaySystemId = normalizeLegacyIdentityPart(runtime.file, 'legacy');
    const sensorId = normalizeLegacyIdentityPart(source.legacyChannel, 'sensor');
    return {
      channelId: `${displaySystemId}:${sensorId}`,
      displaySystemId,
      sensorId,
      sensorLabel: source.legacyChannel,
      sensorType: String(runtime.file || ''),
      outputChannel: source.legacyChannel,
      schemaVersion: 0,
      serialRole: source.legacyChannel,
      serialPortPath: '',
      baudRate: '',
      parserChannel: '',
      legacy: true,
      source,
    };
  }

  function getExactStats(dbRef, date, channelId, fallbackToLegacyQuery) {
    if (typeof getChannelHistoryStats === 'function') {
      try {
        return getChannelHistoryStats(dbRef, date, channelId, logger) || { count: 0 };
      } catch (error) {
        if (!fallbackToLegacyQuery) throw error;
        logger?.warn?.('[CSV] exact legacy stats unavailable, using legacy query:', error.message || error);
      }
    }
    return fallbackToLegacyQuery
      ? { ...(getHistoryStats(dbRef, date, logger) || {}), legacyQueryFallback: true }
      : { count: 0 };
  }

  function queryExactRows(dbRef, date, channelId, count, fallbackToLegacyQuery) {
    if (typeof queryChannelHistoryRows === 'function') {
      try {
        return queryChannelHistoryRows(dbRef, date, channelId, count, 0, logger) || [];
      } catch (error) {
        if (!fallbackToLegacyQuery) throw error;
        logger?.warn?.('[CSV] exact legacy rows unavailable, using legacy query:', error.message || error);
      }
    }
    return fallbackToLegacyQuery ? queryHistoryRows(dbRef, date, count, 0, logger) : [];
  }

  /** 扫描三个兼容数据库槽；canonical 与 NULL legacy 行绝不混读。 */
  function discoverSources({ databases, runtime, date }) {
    const sources = [];
    for (const slot of DATABASE_SLOTS) {
      const dbRef = databases?.[slot.key];
      if (!dbRef) continue;
      const source = { ...slot, dbRef };
      let canonicalDescriptors = [];
      if (typeof queryHistoryChannels === 'function') {
        try {
          const queried = queryHistoryChannels(dbRef, date, logger);
          canonicalDescriptors = Array.isArray(queried) ? queried : [];
        } catch (error) {
          logger?.warn?.(`[CSV] failed to discover channels from ${slot.key}:`, error.message || error);
        }
      }

      for (const rawDescriptor of canonicalDescriptors) {
        const descriptor = normalizeDescriptor(rawDescriptor, source);
        if (!descriptor) continue;
        const stats = getExactStats(dbRef, date, descriptor.channelId, false);
        descriptor.count = Number(stats.count || descriptor.count || 0);
        if (descriptor.count > 0) sources.push(descriptor);
      }

      // null 代表 channel_id IS NULL。只有库内没有 canonical 行时才允许 date-only fallback。
      const legacyFallback = canonicalDescriptors.length === 0;
      const legacyStats = getExactStats(dbRef, date, null, legacyFallback);
      if (Number(legacyStats.count || 0) > 0) {
        const legacy = buildLegacyDescriptor(runtime, source);
        legacy.count = Number(legacyStats.count || 0);
        legacy.legacyQueryFallback = Boolean(
          legacyStats.legacyQueryFallback || typeof getChannelHistoryStats !== 'function',
        );
        sources.push(legacy);
      }
    }
    return sources;
  }

  function normalizeRequestedChannelIds(downloadOptions) {
    if (!hasOwn(downloadOptions, 'channelIds')) return { specified: false, channelIds: [] };
    if (!Array.isArray(downloadOptions.channelIds)) {
      return { specified: true, channelIds: [], error: 'downloadOptions.channelIds must be an array' };
    }
    const channelIds = [...new Set(downloadOptions.channelIds
      .map((value) => String(value || '').trim())
      .filter(Boolean))];
    if (!channelIds.length) {
      return { specified: true, channelIds, error: 'downloadOptions.channelIds must not be empty' };
    }
    return { specified: true, channelIds };
  }

  function buildCanonicalFileName(descriptor, label) {
    const sensorLabel = sanitizeFileNameSegment(
      descriptor.sensorLabel || descriptor.sensorId,
      'sensor',
    );
    const sensorId = sanitizeFileNameSegment(descriptor.sensorId, 'sensor');
    const sensorIdentity = descriptor.sensorLabel && sensorLabel !== sensorId
      ? `${sensorLabel}__${sensorId}`
      : sensorId;
    return `${sanitizeFileNameSegment(descriptor.displaySystemId, 'display')}`
      + `__${sensorIdentity}`
      + `--${shortChannelHash(descriptor.channelId)}`
      + `__${sanitizeFileNameSegment(label, 'history')}.csv`;
  }

  function allocateFilePath(dir, fileName, usedFilePaths, sourceKey) {
    let filePath = path.join(dir, fileName);
    if (!usedFilePaths.has(filePath)) {
      usedFilePaths.add(filePath);
      return filePath;
    }
    const extension = path.extname(fileName);
    const baseName = path.basename(fileName, extension);
    const suffix = sanitizeFileNameSegment(sourceKey, 'source');
    filePath = path.join(dir, `${baseName}--${suffix}${extension}`);
    for (let index = 2; usedFilePaths.has(filePath); index++) {
      filePath = path.join(dir, `${baseName}--${suffix}-${index}${extension}`);
    }
    usedFilePaths.add(filePath);
    return filePath;
  }

  async function exportChannel({
    descriptor, date, dir, csvTitle, sensorType, range, downloadOptions, usedFilePaths,
  }) {
    const rows = queryExactRows(
      descriptor.source.dbRef,
      date,
      descriptor.legacy ? null : descriptor.channelId,
      descriptor.count,
      Boolean(descriptor.legacyQueryFallback),
    );
    if (!rows.length) return null;
    const { records, artifactIdentity } = buildChannelRecords({
      rows, sensorType, descriptor, range,
    });
    if (!records.length) return null;

    const label = formatDateLabel(date, timeStampToDateLabel);
    const fileName = descriptor.legacy
      ? `${getCsvFilePrefix(sensorType, descriptor.outputChannel, downloadOptions)}${label}.csv`
      : buildCanonicalFileName(descriptor, label);
    const filePath = allocateFilePath(dir, fileName, usedFilePaths, descriptor.source.key);
    await writeCsvFile({ fs, filePath, headers: buildHeaders(csvTitle), records });
    return {
      file: filePath,
      channelId: descriptor.channelId,
      displaySystemId: descriptor.displaySystemId,
      sensorId: descriptor.sensorId,
      sensorLabel: descriptor.sensorLabel,
      sensorType: descriptor.sensorType || sensorType,
      outputChannel: descriptor.outputChannel,
      schemaVersion: descriptor.schemaVersion,
      rowCount: records.length,
      legacy: descriptor.legacy,
      ...artifactIdentity,
    };
  }

  async function exportHistoryCsv({ date, downloadOptions = {} }) {
    const csvFormat = String(downloadOptions?.format || 'csv').toLowerCase();
    if (csvFormat !== 'csv') {
      const error = `unsupported export format: ${csvFormat}`;
      publishResult('export csv failed', { error });
      return { ok: false, error };
    }

    const requested = normalizeRequestedChannelIds(downloadOptions);
    if (requested.error) {
      publishResult('export csv failed', { error: requested.error });
      return { ok: false, error: requested.error };
    }

    const csvExportDir = getCsvExportDirectory(downloadOptions);
    if (!csvExportDir.ok) {
      logger?.error?.('[CSV] invalid export directory:', csvExportDir.error);
      publishResult('export csv failed', { error: csvExportDir.error });
      return { ok: false, error: csvExportDir.error };
    }

    const runtime = getRuntime();
    const databases = getDatabases();
    const csvTitle = getCsvTitleMap(downloadOptions);
    let discovered;
    try {
      discovered = discoverSources({ databases, runtime, date });
    } catch (error) {
      const errorMessage = error?.message || String(error || '');
      logger?.error?.('[CSV] history channel discovery failed', error);
      publishResult('export csv failed', {
        dir: csvExportDir.dir,
        error: errorMessage,
      });
      return { ok: false, error: errorMessage };
    }
    const discoveredChannelIds = new Set(discovered.map((item) => item.channelId));
    const skippedChannels = requested.specified
      ? requested.channelIds.filter((channelId) => !discoveredChannelIds.has(channelId))
      : [];
    const selected = requested.specified
      ? discovered.filter((item) => requested.channelIds.includes(item.channelId))
      : discovered;

    if (!selected.length) {
      const error = requested.specified
        ? `no requested history channels found: ${requested.channelIds.join(', ')}`
        : 'no history channels found for the selected date';
      publishResult('export csv failed', { dir: csvExportDir.dir, error, skippedChannels });
      return { ok: false, error, skippedChannels };
    }

    const files = [];
    const artifacts = [];
    const usedFilePaths = new Set();
    publishProgress({
      phase: 'start', date, dir: csvExportDir.dir,
      completedChannels: 0, totalChannels: selected.length, percent: 0,
    });

    try {
      for (let index = 0; index < selected.length; index++) {
        const descriptor = selected[index];
        const artifact = await exportChannel({
          descriptor,
          date,
          dir: csvExportDir.dir,
          csvTitle,
          sensorType: descriptor.sensorType || runtime.file,
          range: runtime.historyArr,
          downloadOptions,
          usedFilePaths,
        });
        if (artifact) {
          files.push(artifact.file);
          artifacts.push(artifact);
        }
        publishProgress({
          phase: 'channel', date, dir: csvExportDir.dir,
          channelId: descriptor.channelId,
          currentFile: artifact?.file || '',
          completedChannels: index + 1,
          totalChannels: selected.length,
          percent: Math.round(((index + 1) / selected.length) * 100),
          files: files.length,
        });
      }

      if (!files.length) {
        const error = 'selected history channels contain no rows in the export range';
        publishResult('export csv failed', {
          artifacts, dir: csvExportDir.dir, error, skippedChannels,
        });
        return { ok: false, error, files, artifacts, skippedChannels };
      }

      publishResult('export csv success', {
        files, artifacts, dir: csvExportDir.dir, skippedChannels,
      });
      return { ok: true, files, artifacts, skippedChannels };
    } catch (error) {
      logger?.error?.('[CSV] export failed', error);
      const errorMessage = error?.message || String(error || '');
      publishResult('export csv failed', {
        files, artifacts, dir: csvExportDir.dir, error: errorMessage, skippedChannels,
      });
      return { ok: false, error: errorMessage, files, artifacts, skippedChannels };
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
  parseStoredData,
  sanitizeFileNameSegment,
  shortChannelHash,
  validateWritableDirectory,
  writeCsvFile,
};
