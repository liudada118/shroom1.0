const { EventEmitter } = require('node:events');
const { performance } = require('node:perf_hooks');
const { randomUUID } = require('node:crypto');
const bus = new EventEmitter();

/** Record a completed business event without waiting for disk or network operations. */
function recordBusinessEvent(eventName, properties = {}) {
  for (const listener of bus.listeners('event')) {
    try { listener({ eventName, properties }); } catch { /* Observability must not change the business result. */ }
  }
}

/** Attach the desktop sender; uninstalling it leaves every business operation unchanged. */
function subscribeBusinessEvents(listener) { bus.on('event', listener); return () => bus.off('event', listener); }

/** Observe real completion while preserving synchronous results, promises and original exceptions. */
function observeUsageOperation(eventName, properties, operation) {
  const started = performance.now(), operationId = randomUUID();
  recordBusinessEvent('feature_attempted', { ...properties, operationId });
  /** Emit metadata only; returned objects, configuration values and exception text stay local. */
  function finish(result, error) {
    const failed = Boolean(error || result?.ok === false || result?.verified === false || result?.errors?.length);
    const code = error?.code || result?.errorCode || (failed && result?.code) || (failed ? 'OPERATION_FAILED' : '');
    recordBusinessEvent(eventName, { ...properties, operationId, result: failed ? 'failure' : 'success',
      durationMs: Math.min(86400000, Math.max(0, performance.now() - started)),
      ...(typeof code === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(code) ? { errorCode: code } : {}) });
  }
  try {
    const result = operation();
    if (result?.then) return result.then(value => { finish(value); return value; }, error => { finish(null, error); throw error; });
    finish(result); return result;
  } catch (error) { finish(null, error); throw error; }
}

module.exports = { recordBusinessEvent, subscribeBusinessEvents, observeUsageOperation };
