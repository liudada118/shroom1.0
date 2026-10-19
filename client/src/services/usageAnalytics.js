let systemContext = {};
let systemEpoch = 0;
const pendingCommits = new Map();

/** Flush only already confirmed, coalesced UI operations before changing customer/system context. */
export function flushUsageCommits() {
  for (const pending of pendingCommits.values()) { clearTimeout(pending.timer); trackUsage(pending.eventName, pending.properties); }
  pendingCommits.clear();
}

/** Coalesce continuous seek/threshold changes; no parameter value or request body is retained. */
export function trackUsageCommit(eventName, properties) {
  const snapshot = { ...systemContext, ...properties }, key = JSON.stringify([eventName, snapshot.featureId, snapshot.action, systemEpoch]);
  const previous = pendingCommits.get(key); if (previous) clearTimeout(previous.timer);
  if (pendingCommits.size >= 64 && !previous) flushUsageCommits();
  const timer = setTimeout(() => { pendingCommits.delete(key); trackUsage(eventName, snapshot); }, 500);
  pendingCommits.set(key, { timer, eventName, properties: snapshot });
}

/** Keep only the currently mounted system identity, never names or sensor values. */
export function setUsageSystemContext(properties = {}) {
  flushUsageCommits();
  const epoch = ++systemEpoch;
  systemContext = Object.fromEntries(['systemType', 'systemOrigin'].filter(key => properties[key] !== undefined).map(key => [key, properties[key]]));
  return () => { if (epoch === systemEpoch) { flushUsageCommits(); systemContext = {}; } };
}

/** Record a validated product event through the desktop bridge; failures never alter user actions. */
export function trackUsage(eventName, properties = {}) {
  try { void Promise.resolve(globalThis.window?.electronAPI?.services?.invoke('recordUsage', { eventName, properties: { ...systemContext, ...properties } })).catch(() => {}); }
  catch { /* Diagnostics remain independent from business controls. */ }
}

/** Measure confirmed operations without copying their request bodies or returned data. */
export async function trackUsageOperation(eventName, properties, operation) {
  const started = performance.now(), operationId = globalThis.crypto?.randomUUID?.();
  const metadata = { ...systemContext, ...properties, ...(operationId ? { operationId } : {}) };
  trackUsage('feature_attempted', metadata);
  try {
    const result = await operation();
    trackUsage(eventName, { ...metadata, result: result?.ok === false ? 'failure' : 'success',
      durationMs: Math.min(86400000, Math.max(0, performance.now() - started)) });
    return result;
  } catch (error) {
    trackUsage(eventName, { ...metadata, result: error?.name === 'AbortError' ? 'cancelled' : 'failure',
      durationMs: Math.min(86400000, Math.max(0, performance.now() - started)),
      ...(typeof error?.code === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(error.code) ? { errorCode: error.code } : {}) });
    throw error;
  }
}
