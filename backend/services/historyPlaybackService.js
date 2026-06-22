const DEFAULT_HISTORY_CHART_SAMPLE_LIMIT = 2000;

/**
 * 计算多路历史数据可同步回放的有效长度。
 *
 * @param {...number} counts 各通道的历史数据条数。
 * @returns {number} 可用于同步回放的最短正数长度。
 */
function getHistoryLengthFromCounts(...counts) {
  const positiveCounts = counts
    .map((value) => Number(value || 0))
    .filter((value) => value > 0);
  if (!positiveCounts.length) return 0;
  return Math.min(...positiveCounts);
}

/**
 * 从历史行数据中抽样生成趋势图需要的压力、面积和时间序列。
 *
 * @param {object} options 历史曲线生成参数。
 * @param {Array<object>} options.sitRows 坐垫/主通道历史行。
 * @param {Array<object>} options.backRows 靠背通道历史行。
 * @param {number} options.start 起始帧下标。
 * @param {number | null} options.end 结束帧下标。
 * @param {string} options.sensorType 当前传感器类型。
 * @param {Function} options.normalizeHistoryPressureData 历史压力数据归一化函数。
 * @param {Function} options.formatMatrixTotalForFile 主通道压力总值格式化函数。
 * @param {Function} options.totalToN 靠背压力总值换算函数。
 * @param {number} options.sampleLimit 趋势图最大抽样点数。
 * @returns {{ length: number, press: number[], area: number[], time: number[], sampleStep: number }} 历史曲线数据。
 */
function getHistorySeries({
  sitRows = [],
  backRows = [],
  start = 0,
  end = null,
  sensorType = '',
  normalizeHistoryPressureData,
  formatMatrixTotalForFile,
  totalToN,
  sampleLimit = DEFAULT_HISTORY_CHART_SAMPLE_LIMIT,
}) {
  const safeSitRows = Array.isArray(sitRows) ? sitRows : [];
  const safeBackRows = Array.isArray(backRows) ? backRows : [];
  const hasSit = safeSitRows.length > 0;
  const hasBack = safeBackRows.length > 0;
  const totalLength = hasSit && hasBack
    ? Math.min(safeSitRows.length, safeBackRows.length)
    : (hasSit ? safeSitRows.length : safeBackRows.length);
  const rangeStart = Math.max(0, start);
  const rangeEnd = Math.min(end == null ? totalLength : end, totalLength);
  const baseRows = hasSit ? safeSitRows : safeBackRows;
  const press = [];
  const area = [];
  const time = [];
  const rangeLength = Math.max(0, rangeEnd - rangeStart);
  const safeSampleLimit = Math.max(1, Number(sampleLimit || DEFAULT_HISTORY_CHART_SAMPLE_LIMIT));
  const sampleStep = rangeLength > safeSampleLimit
    ? Math.ceil(rangeLength / safeSampleLimit)
    : 1;

  for (let i = rangeStart; i < rangeEnd; i += sampleStep) {
    const sitData = hasSit && safeSitRows[i]
      ? normalizeHistoryPressureData(safeSitRows[i], sensorType)
      : null;
    const backData = hasBack && safeBackRows[i]
      ? normalizeHistoryPressureData(safeBackRows[i], sensorType)
      : null;
    const sitTotalValue = sitData ? sitData.reduce((a, b) => a + b, 0) : 0;
    const backTotalValue = backData ? backData.reduce((a, b) => a + b, 0) : 0;
    const sitAreaValue = sitData ? sitData.filter((a) => a > 10).length : 0;
    const backAreaValue = backData ? backData.filter((a) => a > 10).length : 0;

    press.push(
      (sitData ? formatMatrixTotalForFile(sitTotalValue, sensorType) : 0) +
      (backData ? totalToN(backTotalValue, 1.3) : 0)
    );
    area.push(sitAreaValue + backAreaValue);

    if (baseRows[i] && baseRows[i].timestamp != null) {
      time.push(baseRows[i].timestamp);
    }
  }

  return {
    length: totalLength,
    press,
    area,
    time,
    sampleStep,
  };
}

/**
 * 构造历史切换时发送给前端的空白矩阵帧。
 *
 * @param {object} options 空帧参数。
 * @param {string} options.sensorType 当前传感器类型。
 * @param {string} options.smallBed12BType 12B 小床传感器类型常量。
 * @param {object} options.smallBed12BDisplayOptions 12B 小床显示配置。
 * @returns {number[]} 全 0 的矩阵帧。
 */
function buildZeroPlaybackFrame({
  sensorType,
  smallBed12BType,
  smallBed12BDisplayOptions = {},
}) {
  if (sensorType === smallBed12BType) {
    return smallBed12BDisplayOptions.matrixMode === '16x16'
      ? new Array(256).fill(0)
      : new Array(1024).fill(0);
  }
  return sensorType === 'bigBed'
    ? new Array(2048).fill(0)
    : new Array(1024).fill(0);
}

/**
 * 构造历史切换时的空白回放 payload，避免前端保留旧传感器画面。
 *
 * @param {object} options 空白回放参数。
 * @returns {object} 可直接合并到 WebSocket 消息中的 payload。
 */
function buildZeroPlaybackPayload(options) {
  const sitData = buildZeroPlaybackFrame(options);
  const {
    sensorType,
    smallBed12BType,
    smallBed12BDisplayOptions = {},
  } = options;

  if (sensorType === smallBed12BType) {
    const matrixSize = smallBed12BDisplayOptions.matrixMode === '16x16' ? 16 : 32;
    return {
      sitData,
      matrixWidth: matrixSize,
      matrixHeight: matrixSize,
      pressureUnit: 'kPa',
      matrixOrientation: matrixSize === 16 ? 'transposed' : undefined,
    };
  }
  return { sitData };
}

module.exports = {
  DEFAULT_HISTORY_CHART_SAMPLE_LIMIT,
  buildZeroPlaybackFrame,
  buildZeroPlaybackPayload,
  getHistoryLengthFromCounts,
  getHistorySeries,
};
