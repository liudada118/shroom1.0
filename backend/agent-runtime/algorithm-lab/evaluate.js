const { FEATURES, compile, predict } = require('./restrictedPython');

/** 将固定窗口的真实存储帧转换为有明确单位的统计特征。 */
function windowFeatures(frames) {
  const pointCount = frames[0].values.length;
  let sum = 0, squared = 0, totalMin = Infinity, totalMax = -Infinity, peak = -Infinity, active = 0, maxRiseRate = 0, maxFallRate = 0, change = 0, previous;
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (frame.values.length !== pointCount) throw new Error('记录中的压力点数发生变化，不能组成同一算法输入。');
    let total = 0;
    for (const number of frame.values) { total += number; peak = Math.max(peak, number); if (number > 0) active++; }
    sum += total; squared += total * total; totalMin = Math.min(totalMin, total); totalMax = Math.max(totalMax, total);
    if (i) {
      const seconds = (frame.timestamp - frames[i - 1].timestamp) / 1000;
      if (!(seconds > 0) || seconds > 5) throw new Error('记录含重复、倒序时间戳或超过 5 秒的断点，请重新选择连续片段。');
      const rate = (total - previous) / seconds;
      maxRiseRate = Math.max(maxRiseRate, rate); maxFallRate = Math.max(maxFallRate, -rate); change += Math.abs(total - previous);
    }
    previous = total;
  }
  const totalMean = sum / frames.length;
  const result = { duration: (frames.at(-1).timestamp - frames[0].timestamp) / 1000, frameCount: frames.length, pointCount, totalMean,
    totalStd: Math.sqrt(Math.max(0, squared / frames.length - totalMean * totalMean)), totalMin, totalMax, maxRiseRate, maxFallRate,
    meanChange: change / (frames.length - 1), activeMean: active / frames.length, peak };
  if (Object.values(result).some((number) => !Number.isFinite(number) || Math.abs(number) > 1e15)) throw new Error('数据特征超过可计算范围。');
  return result;
}

/** 按整段记录分组形成不重叠窗口，尾部不足一个窗口明确计数。 */
function prepareWindows(records, windowFrames) {
  const windows = [], summaries = [];
  let pointCount = null, stage = null;
  for (const record of records) {
    for (let i = 0; i < record.frames.length; i++) {
      const frame = record.frames[i];
      pointCount ??= frame.values.length; stage ??= frame.stage;
      if (frame.values.length !== pointCount || frame.stage !== stage) throw new Error('所选记录的点数或存储数据阶段不一致。');
      if (i && (frame.timestamp <= record.frames[i - 1].timestamp || frame.timestamp - record.frames[i - 1].timestamp > 5000)) throw new Error('所选记录包含时间断点或倒序，请选择连续记录。');
    }
    const count = Math.floor(record.frames.length / windowFrames);
    if (!count) throw new Error('所选记录不足一个完整窗口，请增加帧范围或缩小窗口。');
    for (let index = 0; index < count; index++) {
      const frames = record.frames.slice(index * windowFrames, (index + 1) * windowFrames);
      windows.push({ recordId: record.id, label: record.label, split: record.split, startFrame: record.startFrame + index * windowFrames, timestamp: frames[0].timestamp, features: windowFeatures(frames) });
    }
    summaries.push({ id: record.id, date: record.date, label: record.label, split: record.split, frameCount: record.frames.length, windows: count, unusedTailFrames: record.frames.length % windowFrames });
  }
  return { windows, records: summaries, pointCount, stage };
}

/** 返回开发集特征摘要；验证集数值不用于指导生成和修改。 */
function summarize(prepared) {
  const groups = [...new Set(prepared.windows.filter((item) => item.split === 'development').map((item) => item.label))].map((label) => {
    const rows = prepared.windows.filter((item) => item.split === 'development' && item.label === label);
    return { label, windows: rows.length, features: Object.fromEntries(FEATURES.map((key) => {
      const values = rows.map((row) => row.features[key]); return [key, { min: Math.min(...values), max: Math.max(...values), mean: values.reduce((a, b) => a + b, 0) / values.length }];
    })) };
  });
  return { groups, records: prepared.records, pointCount: prepared.pointCount, stage: prepared.stage };
}

/** 用固定源代码评价指定集合，所有得分由本地真实预测计算。 */
function evaluate(prepared, source, labels, split) {
  const program = compile(source);
  const rows = prepared.windows.filter((item) => item.split === split);
  if (!rows.length) throw new Error(split === 'validation' ? '未选择独立验证记录。' : '没有开发集窗口。');
  let correct = 0, unknown = 0;
  const confusion = labels.map(() => Array(labels.length + 1).fill(0));
  const predictions = rows.map((row) => {
    const code = predict(program, row.features, labels.length); const expected = labels.indexOf(row.label);
    if (expected < 0) throw new Error('验证集包含开发集未定义的类别。');
    confusion[expected][code < 0 ? labels.length : code]++;
    if (code === expected) correct++; if (code < 0) unknown++;
    return { recordId: row.recordId, startFrame: row.startFrame, timestamp: row.timestamp, expected: row.label, predicted: code < 0 ? '未知' : labels[code], correct: code === expected };
  });
  return { split, labels, windows: rows.length, correct, unknown, accuracy: correct / rows.length, confusion, columns: [...labels, '未知'], predictions,
    inputContract: { pointCount: prepared.pointCount, stage: prepared.stage,
      sampleIntervalMs: rows.reduce((sum, row) => sum + row.features.duration * 1000 / (row.features.frameCount - 1), 0) / rows.length } };
}

module.exports = { windowFeatures, prepareWindows, summarize, evaluate };
