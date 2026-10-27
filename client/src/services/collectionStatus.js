const PHASES = ['collecting', 'finalizing', 'completed', 'interrupted', 'save_error'];
const RESULTS = ['pending', 'saved', 'partial', 'unknown'];

/** Accept only the backend's low-frequency collection receipt, never infer saved frames from display traffic. */
export function readCollectionSummary(input) {
  if (!input || !PHASES.includes(input.phase) || !RESULTS.includes(input.result) || !input.channels || typeof input.channels !== 'object' || Array.isArray(input.channels)) return null;
  const channels = {};
  for (const [id, source] of Object.entries(input.channels)) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
    const counters = {};
    for (const name of ['queued', 'committed', 'failed', 'pending']) {
      if (source[name] !== undefined && (!Number.isSafeInteger(source[name]) || source[name] < 0)) return null;
      if (source[name] !== undefined) counters[name] = source[name];
    }
    channels[id] = counters;
  }
  const timing = {};
  for (const name of ['startedAt', 'stoppedAt', 'completedAt']) {
    if (Number.isSafeInteger(input[name]) && input[name] > 0) timing[name] = input[name];
  }
  return { phase: input.phase, result: input.result, reason: typeof input.reason === 'string' ? input.reason.slice(0, 200) : '', channels,
    ...(typeof input.id === 'string' && input.id.length <= 100 ? { id: input.id } : {}), ...timing };
}

/** Describe committed, failed and pending totals only when every channel provides that counter. */
export function describeCollectionSummary(summary) {
  if (!summary) return '';
  const channels = Object.values(summary.channels || {});
  const count = name => channels.length && channels.every(channel => Number.isSafeInteger(channel[name]))
    ? channels.reduce((total, channel) => total + channel[name], 0) : null;
  const pending = count('pending'), committed = count('committed'), failed = count('failed');
  const details = [committed !== null ? `已提交 ${committed} 帧` : '', pending !== null ? `待提交 ${pending} 帧` : '', failed ? `失败 ${failed} 帧` : ''].filter(Boolean).join('，');
  const label = summary.phase === 'finalizing' ? '已停止接收新采集数据，正在保存尾部数据'
    : summary.phase === 'completed' && summary.result === 'saved' ? '采集保存完成'
      : summary.phase === 'interrupted' && summary.result === 'saved' ? '采集已中断，已接收的数据保存完成'
      : summary.result === 'partial' ? '采集仅部分保存，请检查保存结果'
        : summary.phase === 'save_error' ? '采集保存失败，不能视为已保存'
          : summary.phase === 'interrupted' ? '采集已中断，保存结果需核对'
            : summary.phase === 'collecting' ? '正在采集' : '采集已停止，保存结果尚未确认';
  return details ? `${label}（${details}）` : label;
}
