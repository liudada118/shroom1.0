const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const usageEvidence = require('../../../common/usageEvidence');
const MAX_SESSION_BYTES = 1024 * 1024, MAX_HISTORY_SESSIONS = 2000;

/** Persist host-observed writes and admitted asynchronous work, without claiming hardware zero-loss. */
function createCollectionSessionService({ root, now = Date.now, onStatus = () => {}, onError = () => {}, drainTimeoutMs = 30000,
  evidence = usageEvidence, fsImpl = fs } = {}) {
  const directory = path.join(root, 'collection-sessions');
  const sessions = new Map(), admissions = new WeakMap(), settlements = new WeakSet(), dirty = new Set(), drainTimers = new Map(), waiters = new Map();
  const committed = new Map(), persistenceErrors = new WeakMap(), outboxListeners = new Set(), deferredRecoveries = new Set();
  const ordinaryHistory = [], ordinaryIds = new Set(), liveSessions = new Set();
  let active = null, checkpoint = null, disposed = false, outboxScheduled = false;
  fsImpl.mkdirSync(directory, { recursive: true });
  /** Copy JSON-only evidence so callers and upload adapters cannot mutate an immutable envelope. */
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  /** Hash the exact event object that is persisted and handed to the trusted upload adapter. */
  function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
  /** Keep the newest ordinary history bounded while pending publications and live unfinished work remain reachable. */
  function refreshHistory(session) {
    if (ordinaryIds.delete(session.id)) ordinaryHistory.splice(ordinaryHistory.findIndex(item => item.id === session.id), 1);
    if (session === active || dirty.has(session) || deferredRecoveries.has(session) || ['collecting', 'finalizing'].includes(session.phase)
      || session.usageOutbox?.some(entry => entry.state === 'pending')
      || (liveSessions.has(session.id) && Object.values(session.channels || {}).some(channel => channel.pending > 0 || channel.inFlight > 0))) return;
    const item = { id: session.id, startedAt: Number.isFinite(session.startedAt) ? session.startedAt : 0 };
    let low = 0, high = ordinaryHistory.length;
    while (low < high) {
      const middle = (low + high) >>> 1, other = ordinaryHistory[middle];
      if (other.startedAt < item.startedAt || other.startedAt === item.startedAt && other.id < item.id) low = middle + 1;
      else high = middle;
    }
    ordinaryHistory.splice(low, 0, item); ordinaryIds.add(item.id);
    while (ordinaryHistory.length > MAX_HISTORY_SESSIONS) {
      const oldest = ordinaryHistory.shift(); ordinaryIds.delete(oldest.id);
      sessions.delete(oldest.id); committed.delete(oldest.id); liveSessions.delete(oldest.id);
    }
  }
  /** Read one bounded evidence record; oversized or concurrently growing files remain on disk as recovery gaps. */
  function readSession(file) {
    const descriptor = fsImpl.openSync(file, 'r');
    try {
      const size = fsImpl.fstatSync(descriptor).size;
      if (size > MAX_SESSION_BYTES) throw Object.assign(new Error('collection evidence exceeds the recovery limit'), { code: 'COLLECTION_SUMMARY_TOO_LARGE' });
      const buffer = Buffer.alloc(size + 1); let offset = 0;
      while (offset < buffer.length) {
        const length = fsImpl.readSync(descriptor, buffer, offset, buffer.length - offset, offset);
        if (!length) break;
        offset += length;
      }
      if (offset > size) throw Object.assign(new Error('collection evidence changed during recovery'), { code: 'COLLECTION_SUMMARY_CHANGED' });
      return JSON.parse(buffer.toString('utf8', 0, offset));
    } finally { fsImpl.closeSync(descriptor); }
  }
  /** Return finite journal metadata; opaque frame tokens and database handles never enter snapshots. */
  function snapshot(session = active) {
    if (!session) return null;
    const value = copy(session);
    delete value.usageContext; delete value.usageProperties; delete value.usageOutbox;
    if (persistenceErrors.has(session)) { value.result = 'unknown'; value.evidenceError = 'COLLECTION_SUMMARY_WRITE_FAILED'; }
    return value;
  }
  /** Observer failures must not change a committed transaction or interrupt admission cleanup. */
  function report(error) { try { onError(error); } catch { /* Diagnostic observers are isolated. */ } }
  /** Publish only low-frequency lifecycle changes. */
  function notify(session = active) {
    try { onStatus(snapshot(session)); } catch (error) { report(error); }
    if (session && !['collecting', 'finalizing'].includes(session.phase)) {
      for (const resolve of waiters.get(session.id) || []) resolve(snapshot(session));
      waiters.delete(session.id);
    }
  }
  /** Wake the sender only after a whole evidence/envelope record is durably replaced. */
  function publishOutbox() {
    if (outboxScheduled || disposed) return;
    outboxScheduled = true;
    queueMicrotask(() => {
      outboxScheduled = false;
      if (!disposed) for (const listener of outboxListeners) { try { listener(); } catch (error) { report(error); } }
    });
  }
  /** Flush directory entries where supported; Windows still flushes each file before atomic replacement. */
  function syncDirectory() {
    let descriptor;
    try { descriptor = fsImpl.openSync(directory, 'r'); fsImpl.fsyncSync(descriptor); }
    catch (error) {
      if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EISDIR', 'EINVAL', 'ENOTSUP', 'EBADF'].includes(error.code)) throw error;
    } finally { if (descriptor !== undefined) fsImpl.closeSync(descriptor); }
  }
  /** Commit final evidence and its immutable publications in one fsynced replacement, never separate files. */
  function persist(session) {
    let descriptor;
    try {
      const target = path.join(directory, `${session.id}.json`), temporary = `${target}.${process.pid}.tmp`;
      const serialized = JSON.stringify(session);
      if (Buffer.byteLength(serialized) > MAX_SESSION_BYTES) throw Object.assign(new Error('collection evidence exceeds the recovery limit'), { code: 'COLLECTION_SUMMARY_TOO_LARGE' });
      descriptor = fsImpl.openSync(temporary, 'w', 0o600);
      fsImpl.writeFileSync(descriptor, serialized); fsImpl.fsyncSync(descriptor);
      fsImpl.closeSync(descriptor); descriptor = undefined;
      fsImpl.renameSync(temporary, target); syncDirectory();
      committed.set(session.id, copy(session)); dirty.delete(session); persistenceErrors.delete(session);
      refreshHistory(sessions.get(session.id) || session); publishOutbox(); return true;
    } catch (error) {
      persistenceErrors.set(session, error); dirty.add(session); report(error); return false;
    } finally { if (descriptor !== undefined) { try { fsImpl.closeSync(descriptor); } catch { /* Preserve the original commit failure. */ } } }
  }
  /** Coalesce hot-path bookkeeping into periodic evidence checkpoints. */
  function schedule(session) {
    dirty.add(session);
    if (checkpoint) return;
    checkpoint = setTimeout(() => { checkpoint = null; for (const item of dirty) persist(item); }, 5000);
    checkpoint.unref?.();
  }
  /** Build bounded statistical facts; record names, channel names and configuration bodies stay local. */
  function outcomeProperties(session, revision) {
    const channels = Object.values(session.channels), committedRows = channels.reduce((sum, channel) => sum + channel.committed, 0);
    const failedRows = channels.reduce((sum, channel) => sum + channel.failed, 0);
    const frameCount = channels.reduce((sum, channel) => sum + (session.inputCoverage === 'fenced' ? channel.admitted : channel.queued), 0);
    const outcome = session.result === 'partial' && committedRows === 0 ? 'failed' : session.result;
    const durationMs = session.stoppedAt - session.startedAt;
    return { ...session.usageProperties, featureId: 'collection', collectionId: session.id,
      outcome, result: ({ saved: 'success', partial: 'failure', failed: 'failure', cancelled: 'cancelled', unknown: 'unknown' })[outcome] || 'unknown',
      stopReason: /^[A-Za-z0-9_.:-]{1,80}$/.test(session.reason || '') ? session.reason : 'COLLECTION_STOPPED',
      outcomeRevision: revision, committedRows, failedRows, frameCount,
      ...(Number.isSafeInteger(durationMs) && durationMs >= 0 && durationMs <= 86400000 ? { durationMs } : {}) };
  }
  /** Freeze one result revision before its evidence and publication are committed together. */
  function appendOutcome(session) {
    const revisions = session.usageOutbox || (session.usageOutbox = []), previous = revisions.at(-1);
    const facts = { result: session.result, reason: session.reason, channels: copy(session.channels),
      inputCoverage: session.inputCoverage, evidenceError: session.evidenceError || null, completedAt: session.completedAt };
    const evidenceHash = digest(facts);
    if (previous?.evidenceHash === evidenceHash) return;
    const revision = revisions.length;
    const input = { schemaVersion: 2, eventName: revision ? 'collection_outcome_reconciled' : 'collection_finished',
      occurredAt: new Date(session.completedAt || session.recoveredAt || now()).toISOString(),
      properties: { ...outcomeProperties(session, revision), ...(previous?.eventId ? { supersedesEventId: previous.eventId } : {}) } };
    let prepared = previous && !['pending', 'acked'].includes(previous.state)
      ? { state: 'suppressed', reason: 'USAGE_PREVIOUS_REVISION_UNAVAILABLE' }
      : evidence.prepareUsageEvidence(input, session.usageContext || null);
    if (!prepared || !['pending', 'suppressed', 'dropped'].includes(prepared.state)
      || (prepared.state === 'pending' && (!prepared.scope || !prepared.event?.eventId || prepared.event.properties?.collectionId !== session.id
        || prepared.event.properties?.outcomeRevision !== revision))) prepared = { state: 'dropped', reason: 'USAGE_PREPARATION_INVALID' };
    const entry = { revision, evidenceVersion: 1, evidence: facts, evidenceHash, state: prepared.state };
    if (prepared.state === 'pending') Object.assign(entry, { scope: prepared.scope, event: copy(prepared.event),
      eventId: prepared.event.eventId, contentHash: digest(prepared.event) });
    else entry.reason = prepared.reason || 'USAGE_NOT_ELIGIBLE';
    revisions.push(entry);
  }
  /** Commit a closed session; no uncommitted terminal event can appear in the sender's provider. */
  function commitOutcome(session) { appendOutcome(session); persist(session); notify(session); }
  /** Restore only immutable, hash-consistent publications; never bind old evidence to the current customer. */
  function restorePublications(saved) {
    if (saved.schemaVersion !== 2) { delete saved.usageContext; delete saved.usageProperties; delete saved.usageOutbox; return; }
    if (!Array.isArray(saved.usageOutbox)) { delete saved.usageOutbox; return; }
    for (let index = 0; index < saved.usageOutbox.length; index++) {
      const entry = saved.usageOutbox[index];
      if (!entry || typeof entry !== 'object') throw new Error('COLLECTION_PUBLICATION_INVALID');
      if (entry.revision !== index || !['pending', 'acked', 'suppressed', 'dropped', 'expired'].includes(entry.state)
        || (entry.state === 'pending' && (!entry.event || entry.event.eventId !== entry.eventId
          || digest(entry.event) !== entry.contentHash || entry.scope !== saved.usageContext?.scope
          || digest(entry.evidence) !== entry.evidenceHash || entry.event.properties?.collectionId !== saved.id
          || entry.event.properties?.outcomeRevision !== index
          || entry.event.eventName !== (index ? 'collection_outcome_reconciled' : 'collection_finished')
          || (index > 0 && entry.event.properties.supersedesEventId !== saved.usageOutbox[index - 1].eventId)))) {
        entry.state = 'dropped'; entry.reason = 'USAGE_RESTORE_CONFLICT'; delete entry.event;
      } else if (entry.state !== 'pending') delete entry.event;
    }
  }
  /** Recover the original collection as unknown without inventing completed SQL callbacks or current ownership. */
  function recoverSession(saved) {
    saved.phase = 'interrupted'; saved.reason = 'PROCESS_INTERRUPTED'; saved.result = 'unknown';
    saved.recoveredAt = now(); saved.completedAt = saved.recoveredAt; saved.stoppedAt ??= saved.recoveredAt;
    appendOutcome(saved); persist(saved);
  }
  // A prior process cannot prove the last callbacks; never infer their outcome from queue counters.
  // ⚠️ 不能按 UUID 文件名截取最新 2000 份：遗漏的 pending 会绕过容量处置且永久不补传。
  for (const name of fsImpl.readdirSync(directory).filter(name => /^[a-f0-9-]{36}\.json$/.test(name))) {
    try {
      const saved = readSession(path.join(directory, name));
      if (![1, 2].includes(saved.schemaVersion) || saved.id !== name.slice(0, -5)) continue;
      const original = JSON.stringify(saved);
      restorePublications(saved);
      sessions.set(saved.id, saved); committed.set(saved.id, copy(saved));
      if (['collecting', 'finalizing'].includes(saved.phase)) {
        if (saved.usageContext) deferredRecoveries.add(saved);
        else recoverSession(saved);
      } else if (JSON.stringify(saved) !== original) persist(saved);
      refreshHistory(saved);
    } catch (error) { report(error); /* Corrupt evidence never replaces or removes the pressure database. */ }
  }
  /** List only committed pending envelopes, including prior sessions and original ownership scopes. */
  function listOutbox() {
    return [...committed.values()].flatMap(session => (session.usageOutbox || [])
      .filter(entry => entry.state === 'pending' && entry.event).map(entry => ({ scope: entry.scope, state: 'pending', event: copy(entry.event),
        epoch: Number.isSafeInteger(session.usageContext?.epoch) ? session.usageContext.epoch : 0,
        physicalBytes: Buffer.byteLength(JSON.stringify(entry)) })));
  }
  /** Persist acknowledgement or suppression before removing a pending body; failed commits retain the original. */
  function settleOutbox(eventId, state, reason) {
    if (!['acked', 'suppressed', 'dropped', 'expired'].includes(state)) return false;
    const saved = [...committed.values()].find(session => session.usageOutbox?.some(entry => entry.eventId === eventId));
    if (!saved) return false;
    const previous = saved.usageOutbox.find(entry => entry.eventId === eventId);
    if (previous.state !== 'pending') return previous.state === state;
    const session = sessions.get(saved.id), candidate = copy(saved);
    const hasUncommitted = dirty.has(session) || persistenceErrors.has(session) || JSON.stringify(session) !== JSON.stringify(saved);
    const entry = candidate.usageOutbox.find(item => item.eventId === eventId);
    entry.state = state; if (reason) entry.reason = String(reason).slice(0, 80); delete entry.event;
    if (!persist(candidate)) { dirty.delete(candidate); return false; }
    const current = session.usageOutbox.find(item => item.eventId === eventId);
    current.state = state; if (entry.reason) current.reason = entry.reason; delete current.event;
    if (state !== 'acked') for (const descendant of session.usageOutbox.slice(saved.usageOutbox.length)) {
      if (descendant.state !== 'pending') continue;
      descendant.state = state; descendant.reason = 'USAGE_PREVIOUS_REVISION_UNAVAILABLE'; delete descendant.event;
    }
    if (hasUncommitted) schedule(session);
    refreshHistory(session); return true;
  }
  const unsubscribeOutbox = evidence.registerUsageOutbox({ list: listOutbox, settle: settleOutbox,
    /** Delay contextual crash recovery until the host can validate the original consent epoch and scope. */
    onAdapterReady() { for (const session of deferredRecoveries) { recoverSession(session); deferredRecoveries.delete(session); refreshHistory(session); } },
    /** Notify the host when a committed terminal record or disposition changes. */
    subscribe(listener) { outboxListeners.add(listener); return () => outboxListeners.delete(listener); } });
  /** Start only after the old session's admitted work and writes have reached a known outcome. */
  function begin({ recordKey, systemId, configuration = null, storagePolicy = null, inputCoverage = 'untracked', usageProperties = {} }) {
    if (disposed) throw new Error('采集会话服务已关闭。');
    if (active && ['collecting', 'finalizing'].includes(active.phase)) throw new Error('上一条采集仍在收尾，请稍后重试。');
    const previous = active;
    active = { schemaVersion: 2, id: randomUUID(), recordKey: String(recordKey || ''), systemId: String(systemId || ''),
      startedAt: now(), stoppedAt: null, completedAt: null, phase: 'collecting', result: 'pending', reason: null,
      configuration: configuration ? JSON.parse(JSON.stringify(configuration)) : null,
      storagePolicy, channels: {}, scope: 'host-storage-queue', inputCoverage: ['fenced', 'synchronous'].includes(inputCoverage) ? inputCoverage : 'untracked', completeness: 'not-hardware-verified',
      usageContext: copy(evidence.captureUsageEvidenceContext()), usageProperties: Object.fromEntries(['systemType', 'systemOrigin', 'operationId']
        .filter(key => typeof usageProperties[key] === 'string').map(key => [key, usageProperties[key]])) };
    sessions.set(active.id, active); liveSessions.add(active.id); if (previous) refreshHistory(previous);
    if (persist(active)) evidence.recordUsageEvidence({ schemaVersion: 2, eventName: 'collection_started',
      occurredAt: new Date(active.startedAt).toISOString(), properties: { ...active.usageProperties, featureId: 'collection', collectionId: active.id, result: 'success' } }, active.usageContext);
    notify(); return snapshot();
  }
  /** Resolve a channel counter without storing frame arrays or database objects. */
  function channelFor(session, channelId) {
    if (!Object.hasOwn(session.channels, channelId)) Object.defineProperty(session.channels, channelId, {
      enumerable: true, configurable: true, writable: true, value: { admitted: 0, inFlight: 0, processingFailed: 0, skipped: 0,
        queued: 0, committed: 0, failed: 0, pending: 0, firstTimestamp: null, lastTimestamp: null },
    });
    return session.channels[channelId];
  }
  /** Finish only once no admitted processor or SQL callback can still add a result. */
  function complete(session) {
    if (session.phase !== 'finalizing' || Object.values(session.channels).some(channel => channel.pending > 0 || channel.inFlight > 0)) return;
    clearTimeout(drainTimers.get(session.id)); drainTimers.delete(session.id);
    const failed = Object.values(session.channels).some(channel => channel.failed > 0 || channel.processingFailed > 0);
    session.result = failed ? 'partial' : session.evidenceError || !['fenced', 'synchronous'].includes(session.inputCoverage) ? 'unknown' : 'saved';
    session.phase = failed ? 'save_error' : session.reason === 'USER_STOPPED' ? 'completed' : 'interrupted';
    session.completedAt = now(); commitOutcome(session);
  }
  /** Reconcile a drain timeout only when the original SQL callbacks settle all admitted work in this process. */
  function reconcileSettled(session) {
    if (session.result !== 'unknown' || session.evidenceError !== 'COLLECTION_DRAIN_TIMEOUT'
      || !['fenced', 'synchronous'].includes(session.inputCoverage)
      || Object.values(session.channels).some(channel => channel.pending > 0 || channel.inFlight > 0)) return false;
    session.result = Object.values(session.channels).some(channel => channel.failed > 0 || channel.processingFailed > 0) ? 'partial' : 'saved';
    delete session.evidenceError;
    session.phase = session.result === 'partial' ? 'save_error' : session.reason === 'USER_STOPPED' ? 'completed' : 'interrupted';
    session.completedAt = now(); commitOutcome(session); return true;
  }
  /** Admit before asynchronous processing and freeze the original collection identity and database. */
  function beginFrame({ channelId = 'sit', timestamp = now(), originalDb } = {}) {
    if (!active || active.phase !== 'collecting') return null;
    const token = {}, channel = channelFor(active, channelId);
    admissions.set(token, { session: active, channelId, timestamp, originalDb, ended: false, queued: false });
    channel.admitted++; channel.inFlight++; schedule(active); return token;
  }
  /** Only a live opaque admission can store a tail frame after collection has stopped. */
  function isFrameToken(token) {
    const entry = token && typeof token === 'object' ? admissions.get(token) : null;
    return Boolean(entry && !entry.ended && ['collecting', 'finalizing'].includes(entry.session.phase));
  }
  /** Return the frozen host context for the writer; it must never be serialized to JSON or telemetry. */
  function frameContext(token) {
    if (!isFrameToken(token)) return null;
    const entry = admissions.get(token);
    return { sessionId: entry.session.id, recordKey: entry.session.recordKey, configuration: entry.session.configuration,
      channelId: entry.channelId, timestamp: entry.timestamp, originalDb: entry.originalDb };
  }
  /** Count a queued row in its admitted session, including after admission has closed. */
  function queued({ channelId = 'sit', timestamp = now(), frameToken } = {}) {
    const entry = frameToken && typeof frameToken === 'object' ? admissions.get(frameToken) : null;
    if (frameToken && (!isFrameToken(frameToken) || entry.queued)) return null;
    const session = entry?.session || active;
    if (!session || (!entry && session.phase !== 'collecting')) return null;
    channelId = entry?.channelId || channelId;
    const channel = channelFor(session, channelId);
    channel.queued++; channel.pending++;
    if (entry) entry.queued = true;
    if (Number.isFinite(timestamp)) { channel.firstTimestamp ??= timestamp; channel.lastTimestamp = timestamp; }
    const context = { sessionId: session.id, channelId };
    schedule(session); return context;
  }
  /** Account exactly once after the transaction or asynchronous row callback resolves. */
  function settled(context, ok) {
    if (!context || typeof context !== 'object' || settlements.has(context)) return;
    const session = sessions.get(context.sessionId), channel = session?.channels[context.channelId];
    if (!channel || channel.pending <= 0) return;
    settlements.add(context); channel.pending--; channel[ok ? 'committed' : 'failed']++;
    if (session.phase === 'finalizing') complete(session); else if (!reconcileSettled(session)) schedule(session);
  }
  /** Release an admitted processor on success, filtering, rejection, or cancellation. */
  function endFrame(token, { error, stored = false } = {}) {
    if (!isFrameToken(token)) return;
    const entry = admissions.get(token), channel = channelFor(entry.session, entry.channelId);
    entry.ended = true; channel.inFlight = Math.max(0, channel.inFlight - 1);
    if (error) channel.processingFailed++;
    else if (!stored && !entry.queued) channel.skipped++;
    if (entry.session.phase === 'finalizing') complete(entry.session); else schedule(entry.session);
  }
  /** Close admission, flush once, and retain finalizing until admitted work and SQL writes settle. */
  function finish(reason = 'USER_STOPPED', flush = () => {}) {
    if (!active || !['collecting', 'finalizing'].includes(active.phase)) return snapshot();
    if (active.phase === 'collecting') {
      active.phase = 'finalizing'; active.stoppedAt = now(); active.reason = reason; persist(active); notify();
      try { flush(); } catch (error) { active.evidenceError = 'COLLECTION_FLUSH_FAILED'; report(error); }
      if (active.phase === 'finalizing') {
        const session = active;
        const timer = setTimeout(() => {
          if (session.phase !== 'finalizing') return;
          session.phase = 'interrupted'; session.result = 'unknown'; session.evidenceError = 'COLLECTION_DRAIN_TIMEOUT';
          session.completedAt = now(); drainTimers.delete(session.id); commitOutcome(session);
        }, drainTimeoutMs);
        timer.unref?.(); drainTimers.set(session.id, timer);
      }
    }
    complete(active); return snapshot();
  }
  /** Await the session sealed by finish, including its bounded asynchronous drain deadline. */
  function whenFinished() {
    const session = active;
    if (!session || session.phase !== 'finalizing') return Promise.resolve(snapshot(session));
    drainTimers.get(session.id)?.ref?.();
    return new Promise((resolve) => { if (!waiters.has(session.id)) waiters.set(session.id, new Set()); waiters.get(session.id).add(resolve); });
  }
  return { begin, queued, settled, finish, beginFrame, isFrameToken, frameContext, endFrame, whenFinished,
    /** Read bounded metadata summaries without opening or exporting pressure rows. */
    list({ recordKey, systemId, limit = 30 } = {}) {
      return [...sessions.values()].filter(item => (!recordKey || item.recordKey === recordKey) && (!systemId || item.systemId === systemId))
        .sort((a, b) => b.startedAt - a.startedAt).slice(0, Math.max(1, Math.min(100, Number(limit) || 30))).map(item => snapshot(item));
    },
    current: () => snapshot(),
    trace: () => active?.configuration || null,
    /** Preserve uncompleted evidence on shutdown rather than calling pending work saved. */
    dispose() {
      if (disposed) return;
      if (checkpoint) clearTimeout(checkpoint); checkpoint = null;
      for (const timer of drainTimers.values()) clearTimeout(timer); drainTimers.clear();
      for (const session of dirty) persist(session); if (active) persist(active);
      for (const [id, callbacks] of waiters) for (const resolve of callbacks) resolve({ ...snapshot(sessions.get(id)), result: 'unknown' });
      waiters.clear();
      disposed = true; unsubscribeOutbox?.(); outboxListeners.clear();
    } };
}

module.exports = { createCollectionSessionService };
