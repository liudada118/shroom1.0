import i18n from '../i18n';

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
export function describeCollectionSummary(summary, t = i18n.t.bind(i18n)) {
  if (!summary) return '';
  const channels = Object.values(summary.channels || {});
  const count = name => channels.length && channels.every(channel => Number.isSafeInteger(channel[name]))
    ? channels.reduce((total, channel) => total + channel[name], 0) : null;
  const pending = count('pending'), committed = count('committed'), failed = count('failed');
  const details = [committed !== null ? t('runtimeUi.receipt.committed', { count: committed }) : '',
    pending !== null ? t('runtimeUi.receipt.pending', { count: pending }) : '',
    failed ? t('runtimeUi.receipt.failed', { count: failed }) : ''].filter(Boolean).join(t('runtimeUi.receipt.separator'));
  const streamTimeout = summary.reason === 'DATA_STREAM_TIMEOUT';
  const status = summary.phase === 'finalizing' ? (streamTimeout ? 'streamTimeoutSaving' : 'finalizing')
    : summary.phase === 'completed' && summary.result === 'saved' ? 'completed'
      : summary.phase === 'interrupted' && summary.result === 'saved' ? (streamTimeout ? 'streamTimeoutSaved' : 'interruptedSaved')
        : summary.result === 'partial' ? 'partial'
          : summary.phase === 'save_error' ? 'saveError'
            : summary.phase === 'interrupted' ? 'interrupted'
              : summary.phase === 'collecting' ? 'collecting' : 'unknown';
  const label = t(`runtimeUi.receipt.${status}`);
  return details ? t('runtimeUi.receipt.withDetails', { label, details }) : label;
}
