const { createHash, randomUUID } = require('node:crypto');

const VERSION = 'history-statistics-v1';
const MAX_VALUES = 2000000;
/** 返回可展示的分析错误，不公开数据库或文件路径。 */
function invalid(message, code = 'HISTORY_ANALYSIS_INVALID') { return Object.assign(new Error(message), { code }); }
/** 检查用户明确授权的范围，目录中的 maxId 由宿主生成。 */
function selectHistoryRecords(value, catalog) {
  if (!value || value.systemId !== catalog.systemId || !Array.isArray(value.records) || !value.records.length || value.records.length > 8) throw invalid('请选择当前系统的 1～8 条采集记录。');
  const seen = new Set();
  const records = value.records.map((item) => {
    const record = catalog.records.find((entry) => entry.id === item.id);
    if (!record || seen.has(item.id)) throw invalid('记录已变化或重复，请刷新后选择。');
    seen.add(item.id);
    const range = item.range;
    if (!range || !Number.isInteger(range.frameLimit) || range.frameLimit < 1 || range.frameLimit > 2000) throw invalid('每条记录须明确选择 1～2000 帧的读取上限。');
    if (range.kind === 'frames') {
      if (!Number.isInteger(range.startFrame) || range.startFrame < 0 || range.startFrame + range.frameLimit > record.count) throw invalid('帧区间超出采集记录。');
    } else if (range.kind === 'time') {
      if (!Number.isFinite(range.startTimestamp) || !Number.isFinite(range.endTimestamp) || range.startTimestamp > range.endTimestamp || range.endTimestamp - range.startTimestamp > 86400000) throw invalid('时间区间须为有效毫秒时间戳，且不超过 24 小时。');
    } else throw invalid('请选择帧区间或时间区间。');
    return { ...record, range: { ...range } };
  });
  const region = value.region;
  if (region && !['row', 'column', 'rows', 'cols'].every((key) => Number.isInteger(region[key]) && region[key] >= (['rows', 'cols'].includes(key) ? 1 : 0))) throw invalid('矩阵区域须使用从 0 开始的行列和正整数尺寸。');
  return { systemId: catalog.systemId, catalogOffset: catalog.offset, records, ...(region ? { region: { row: region.row, column: region.column, rows: region.rows, cols: region.cols } } : {}) };
}
/** 仅从已经存储且有来源的矩阵读取区域，禁止按点数猜测二维形状。 */
function matrixOf(frame) {
  const matrix = frame.matrix;
  return matrix && Number.isInteger(matrix.rows) && Number.isInteger(matrix.cols) && matrix.rows > 0 && matrix.cols > 0 && matrix.rows * matrix.cols === frame.values.length
    ? { rows: matrix.rows, cols: matrix.cols } : null;
}
/** 版本证据仅返回摘要和版本字段，不把任意历史对象或归零数组发送给模型。 */
function traceSummary(trace = {}) {
  const configuration = trace.configuration;
  const configurationVersions = {};
  for (const key of ['version', 'revision', 'revisionHash', 'systemRevision', 'protocolId', 'protocolVersion', 'mappingDigest', 'zeroDigest', 'calibrationDigest']) {
    const value = configuration?.[key];
    if ((typeof value === 'string' && value.length <= 160) || (typeof value === 'number' && Number.isFinite(value))) configurationVersions[key] = value;
  }
  const release = {};
  for (const key of ['systemId', 'version', 'packageSha256', 'sha256', 'releaseId']) {
    const value = trace.managedRelease?.[key];
    if ((typeof value === 'string' && value.length <= 160) || (typeof value === 'number' && Number.isFinite(value))) release[key] = value;
  }
  return { status: trace.status === 'known' ? 'known' : 'unknown', configurationVersions,
    configurationSha256: configuration ? createHash('sha256').update(JSON.stringify(configuration)).digest('hex') : null,
    managedRelease: Object.keys(release).length ? release : null, calibrationStatus: 'not-inferred' };
}
/** 汇总一条记录；时序图只保留最多 24 个真实帧的标量统计。 */
function summarize(record, frames, selection, threshold) {
  if (!frames.length) throw invalid('所选区间没有可分析的数据，请调整范围。');
  const firstMatrix = matrixOf(frames[0]);
  const shapeKey = JSON.stringify(firstMatrix);
  const stage = frames[0].stage || 'unknown';
  const region = selection.region;
  if (region && (!firstMatrix || region.row + region.rows > firstMatrix.rows || region.column + region.cols > firstMatrix.cols)) throw invalid('所选区域超出历史矩阵，或记录缺少可靠矩阵信息。');
  let sum = 0, count = 0, min = Infinity, max = -Infinity, active = 0;
  const totals = [], times = [], hash = createHash('sha256');
  const traces = new Map();
  const trend = [];
  const stride = Math.max(1, Math.ceil(frames.length / 24));
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    if (JSON.stringify(matrixOf(frame)) !== shapeKey || (frame.stage || 'unknown') !== stage || frame.values.length !== frames[0].values.length) throw invalid('同一选区包含不同矩阵或数据阶段，不能混合计算。', 'HISTORY_ANALYSIS_INCOMPATIBLE');
    hash.update(JSON.stringify([frame.id, frame.timestamp, frame.values]));
    const trace = traceSummary(frame.trace);
    traces.set(JSON.stringify(trace), trace);
    if (traces.size > 16) throw invalid('所选区间跨越过多配置版本，请缩小范围后分别分析。', 'HISTORY_ANALYSIS_LIMIT');
    let total = 0, frameCount = 0, frameActive = 0, peak = -Infinity;
    for (let index = 0; index < frame.values.length; index += 1) {
      if (region) {
        const row = Math.floor(index / firstMatrix.cols), column = index % firstMatrix.cols;
        if (row < region.row || row >= region.row + region.rows || column < region.column || column >= region.column + region.cols) continue;
      }
      const number = frame.values[index];
      if (!Number.isFinite(number) || Math.abs(number) > 1e12) throw invalid('历史帧包含无效或超出分析数值范围的数值，已停止分析。');
      total += number; sum += number; count += 1; frameCount += 1;
      min = Math.min(min, number); max = Math.max(max, number); peak = Math.max(peak, number);
      if (number > threshold) { active += 1; frameActive += 1; }
    }
    totals.push(total); times.push(frame.timestamp);
    if (frameIndex % stride === 0) trend.push({ frameId: frame.id, timestamp: frame.timestamp, total, average: total / frameCount, peak, activeRatio: frameActive / frameCount });
  }
  const intervals = times.slice(1).map((time, index) => time - times[index]);
  const averageTotal = totals.reduce((acc, number) => acc + number, 0) / totals.length;
  return {
    source: { recordId: record.id, recordName: record.date, channel: record.channel, channelId: record.channelId, sensorId: record.sensorId, maxId: record.maxId,
      requestedRange: record.range, actualFrames: frames.length, firstFrameId: frames[0].id, lastFrameId: frames.at(-1).id,
      firstTimestamp: times[0], lastTimestamp: times.at(-1), matrix: firstMatrix, pointCount: frames[0].values.length,
      dataStage: stage, trace: [...traces.values()], contentSha256: hash.digest('hex') },
    statistics: { values: count, frames: frames.length, minimum: min, maximum: max, average: sum / count, totalMean: averageTotal,
      totalStandardDeviation: Math.sqrt(totals.reduce((acc, number) => acc + (number - averageTotal) ** 2, 0) / totals.length),
      activeRatio: active / count, durationMs: Math.max(...times) - Math.min(...times),
      duplicateOrReverseTimestamps: intervals.filter((interval) => interval <= 0).length }, trend,
  };
}
/** 在固定本机分页接口上分析明确选区，完整帧始终留在本机且不返回给模型。 */
function createHistoryAnalysis({ request, now = () => new Date().toISOString() }) {
  /** 复核目录指纹后逐页读取，不允许工具参数扩大 UI 已确认的范围。 */
  async function analyze(selection, options = {}, context = {}) {
    if (!selection?.records?.length) throw invalid('请先在本轮对话选择历史数据。', 'HISTORY_SELECTION_REQUIRED');
    const threshold = options.activeThreshold ?? 0;
    if (!Number.isFinite(threshold) || threshold < -1e12 || threshold > 1e12) throw invalid('有效点阈值无效。');
    let valuesRead = 0;
    const results = [];
    for (const record of selection.records) {
      const catalog = await request('/api/agent-algorithms/records', { ...context, method: 'POST', body: { offset: selection.catalogOffset || 0 } });
      const current = catalog.records?.find((item) => item.id === record.id);
      if (catalog.systemId !== selection.systemId || !current || current.maxId !== record.maxId || current.count !== record.count) throw invalid('记录或当前系统已变化，请重新确认数据范围。', 'HISTORY_SELECTION_STALE');
      selectHistoryRecords({ ...selection, records: [record] }, catalog);
      const frames = [];
      let rangeLimited = false;
      let offset = record.range.kind === 'frames' ? record.range.startFrame : 0;
      while (frames.length < record.range.frameLimit) {
        context.signal?.throwIfAborted();
        const pageSize = frames.length ? Math.max(1, Math.min(8, Math.floor(1000000 / (frames[0].values.length * 32)))) : 1;
        const limit = Math.min(pageSize, record.range.frameLimit - frames.length);
        const page = await request('/api/agent-algorithms/frames', { ...context, method: 'POST', body: {
          systemId: selection.systemId, recordId: record.id, maxId: record.maxId, offset, limit,
          ...(record.range.kind === 'time' ? { startTimestamp: record.range.startTimestamp, endTimestamp: record.range.endTimestamp } : {}),
        } });
        if (!Array.isArray(page.frames) || page.frames.length > limit) throw invalid('历史接口返回了选区之外的数据。');
        for (const frame of page.frames) {
          if (!Number.isFinite(frame.timestamp) || !Number.isInteger(frame.id) || frame.id > record.maxId || frame.id <= (frames.at(-1)?.id || 0) || !Array.isArray(frame.values) || !frame.values.length || frame.values.length > 65536) throw invalid('历史帧身份或格式无效。');
          if (record.range.kind === 'time' && (frame.timestamp < record.range.startTimestamp || frame.timestamp > record.range.endTimestamp)) throw invalid('历史接口返回了时间区间之外的数据。');
          valuesRead += frame.values.length;
          if (valuesRead > MAX_VALUES) throw invalid('本次超过 200 万个压力数值，请缩小记录或区间。', 'HISTORY_ANALYSIS_LIMIT');
          frames.push(frame);
        }
        if (page.complete || page.frames.length < limit) break;
        rangeLimited = record.range.kind === 'time' && frames.length === record.range.frameLimit;
        if (page.nextOffset !== offset + page.frames.length) throw invalid('历史分页边界无效，已停止读取。');
        offset = page.nextOffset;
      }
      if (record.range.kind === 'frames' && frames.length !== record.range.frameLimit) throw invalid('选定帧区间已不完整，请刷新记录。');
      const result = summarize(record, frames, selection, threshold);
      result.source.rangeLimited = rangeLimited;
      results.push(result);
    }
    const comparisons = [];
    if (options.compare && results.length > 1) {
      const base = results[0];
      for (const result of results.slice(1)) {
        if (!base.source.matrix || !result.source.matrix || JSON.stringify(base.source.matrix) !== JSON.stringify(result.source.matrix)
          || base.source.pointCount !== result.source.pointCount || base.source.dataStage !== result.source.dataStage || base.source.dataStage === 'unknown') throw invalid('比较需要相同且明确的历史矩阵和数据阶段，请分开描述这些记录。', 'HISTORY_ANALYSIS_INCOMPATIBLE');
        comparisons.push({ baselineRecordId: base.source.recordId, recordId: result.source.recordId,
          averageDifference: result.statistics.average - base.statistics.average, peakDifference: result.statistics.maximum - base.statistics.maximum,
          totalMeanDifference: result.statistics.totalMean - base.statistics.totalMean, activeRatioDifference: result.statistics.activeRatio - base.statistics.activeRatio });
      }
    }
    return { id: randomUUID(), version: VERSION, computedAt: now(), systemId: selection.systemId,
      parameters: { activeThreshold: threshold, compare: options.compare === true, region: selection.region || null, maxValues: MAX_VALUES },
      evaluation: { kind: 'descriptive', rule: null, notice: '描述性统计；未提供并验证评价规则，不代表舒适度、合格判断或算法准确率。压力单位沿用记录数值，未推定物理单位。' },
      results, comparisons,
      warnings: [
        ...(results.some((result) => !result.source.matrix || result.source.trace.some((trace) => trace.status !== 'known')) ? ['部分历史矩阵或配置版本未知，已保留未知状态，未用当前配置补写历史证据。'] : []),
        ...(results.some((result) => result.source.rangeLimited) ? ['时间范围已达到用户确认的帧数上限；结果仅描述报告中的实际已读范围，不代表完整时间区间。'] : []),
      ],
    };
  }
  return { analyze };
}

module.exports = { createHistoryAnalysis, selectHistoryRecords, VERSION };
