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

/** 以目标时间网格选择最近的真实帧，与实时分类器保持相同的选帧顺序。 */
function selectFramesAtInterval(samples, targetIntervalMs) {
  const selected = [samples[0]];
  let nextTarget = samples[0].frame.timestamp + targetIntervalMs, candidate = null;
  /** 接纳一个真实采样，并向前推进目标时刻。 */
  function accept(sample) {
    selected.push(sample);
    nextTarget += targetIntervalMs;
    while (nextTarget <= sample.frame.timestamp) nextTarget += targetIntervalMs;
  }
  for (const sample of samples.slice(1)) {
    if (sample.frame.timestamp < nextTarget) { candidate = sample; continue; }
    if (candidate && nextTarget - candidate.frame.timestamp < sample.frame.timestamp - nextTarget) {
      accept(candidate);
      candidate = null;
      if (sample.frame.timestamp < nextTarget) candidate = sample;
      else accept(sample);
    } else { candidate = null; accept(sample); }
  }
  return selected;
}

/** 按记录形成不重叠窗口；适配时只选真实帧，不跨缺口组成分类窗口。 */
function prepareWindows(records, windowFrames, targetIntervalMs = null) {
  if (targetIntervalMs !== null && (!Number.isFinite(targetIntervalMs) || targetIntervalMs <= 0 || targetIntervalMs > 5000)) throw new Error('目标采样间隔无效。');
  const windows = [], summaries = [];
  let pointCount = null, stage = null;
  for (const record of records) {
    const samples = [], name = record.date || record.id || '未命名记录';
    for (let i = 0; i < record.frames.length; i++) {
      const frame = record.frames[i];
      pointCount ??= frame.values.length; stage ??= frame.stage;
      if (frame.values.length !== pointCount || frame.stage !== stage) throw new Error('所选记录的点数或存储数据阶段不一致。');
      if (!Number.isFinite(frame.timestamp)) throw new Error(`记录“${name}”第 ${(record.startFrame || 0) + i + 1} 帧时间戳无效。`);
      if (i) {
        const previous = record.frames[i - 1], delta = frame.timestamp - previous.timestamp;
        if (delta < 0 || delta > 5000) throw new Error(`记录“${name}”第 ${(record.startFrame || 0) + i + 1} 帧${delta < 0 ? '时间戳倒序' : '存在超过 5 秒的时间断点'}（数据库 ID ${previous.id ?? '未知'} -> ${frame.id ?? '未知'}，间隔 ${delta} ms），请重新选择连续片段。`);
        if (delta === 0) continue;
      }
      samples.push({ frame, offset: i });
    }
    const selected = targetIntervalMs === null ? samples : selectFramesAtInterval(samples, targetIntervalMs);
    const skippedDuplicateTimestamps = record.frames.length - samples.length;
    const segments = [[]];
    for (const sample of selected) {
      const segment = segments.at(-1);
      if (targetIntervalMs !== null && segment.length && sample.frame.timestamp - segment.at(-1).frame.timestamp > targetIntervalMs * 2) segments.push([]);
      segments.at(-1).push(sample);
    }
    let count = 0, unusedTailFrames = 0;
    for (const segment of segments) {
      const complete = Math.floor(segment.length / windowFrames);
      count += complete; unusedTailFrames += segment.length % windowFrames;
      for (let index = 0; index < complete; index++) {
        const part = segment.slice(index * windowFrames, (index + 1) * windowFrames);
        const frames = part.map((sample) => sample.frame);
        windows.push({ recordId: record.id, label: record.label, split: record.split, startFrame: (record.startFrame || 0) + part[0].offset,
          timestamp: frames[0].timestamp, features: windowFeatures(frames) });
      }
    }
    if (!count) throw new Error(targetIntervalMs === null
      ? `记录“${name}”有效采样 ${samples.length} 帧（同毫秒跳过 ${skippedDuplicateTimestamps} 帧），不足一个完整窗口，请增加帧范围或缩小窗口。`
      : `记录“${name}”按当前设备约 ${Math.round(1000 / targetIntervalMs)} Hz 选取真实帧后不足一个完整窗口；请增加该类别已采集帧范围，或缩小窗口，不能插值补造动作峰值。`);
    summaries.push({ id: record.id, date: record.date, label: record.label, split: record.split, frameCount: record.frames.length, usableFrameCount: samples.length,
      skippedDuplicateTimestamps, windows: count, unusedTailFrames,
      ...(targetIntervalMs !== null ? { selectedFrameCount: selected.length, targetIntervalMs } : {}) });
  }
  return { windows, records: summaries, pointCount, stage, ...(targetIntervalMs !== null ? { targetIntervalMs } : {}) };
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
  // 实时窗口必须沿用开发集的采样基准；独立验证只评估冻结代码，不能重写输入契约。
  const referenceRows = prepared.windows.filter((item) => item.split === 'development');
  if (!rows.length) throw new Error(split === 'validation' ? '未选择独立验证记录。' : '没有开发集窗口。');
  if (!referenceRows.length) throw new Error('没有开发集窗口，不能生成实时输入契约。');
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
    records: prepared.records.filter((record) => record.split === split),
    inputContract: { pointCount: prepared.pointCount, stage: prepared.stage,
      sampleIntervalMs: prepared.targetIntervalMs || referenceRows.reduce((sum, row) => sum + row.features.duration * 1000 / (row.features.frameCount - 1), 0) / referenceRows.length },
    ...(prepared.targetIntervalMs ? { preprocessing: { mode: 'nearest-real-frame', targetIntervalMs: prepared.targetIntervalMs,
      source: 'measured-current-device', noInterpolation: true } } : {}) };
}

module.exports = { windowFeatures, prepareWindows, summarize, evaluate, selectFramesAtInterval };
