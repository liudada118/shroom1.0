const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

/** Persist host-observed writes and admitted asynchronous work, without claiming hardware zero-loss. */
function createCollectionSessionService({ root, now = Date.now, onStatus = () => {}, onError = () => {}, drainTimeoutMs = 30000 }) {
  const directory = path.join(root, 'collection-sessions');
  const sessions = new Map(), admissions = new WeakMap(), settlements = new WeakSet(), dirty = new Set(), drainTimers = new Map(), waiters = new Map();
  let active = null, checkpoint = null;
  fs.mkdirSync(directory, { recursive: true });
  /** Return finite journal metadata; opaque frame tokens and database handles never enter snapshots. */
  function snapshot(session = active) { return session ? JSON.parse(JSON.stringify(session)) : null; }
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
  /** Atomically save one session; failed evidence stays visibly uncertain. */
  function persist(session) {
    try {
      const target = path.join(directory, `${session.id}.json`), temporary = `${target}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(session), { mode: 0o600 });
      fs.renameSync(temporary, target); dirty.delete(session);
    } catch (error) { session.evidenceError = 'COLLECTION_SUMMARY_WRITE_FAILED'; session.result = 'unknown'; report(error); }
  }
  /** Coalesce hot-path bookkeeping into periodic evidence checkpoints. */
  function schedule(session) {
    dirty.add(session);
    if (checkpoint) return;
    checkpoint = setTimeout(() => { checkpoint = null; for (const item of dirty) persist(item); }, 5000);
    checkpoint.unref?.();
  }
  // A prior process cannot prove the last callbacks; never infer their outcome from queue counters.
  for (const name of fs.readdirSync(directory).filter(name => /^[a-f0-9-]{36}\.json$/.test(name)).slice(-2000)) {
    try {
      const saved = JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
      if (saved.schemaVersion !== 1 || saved.id !== name.slice(0, -5)) continue;
      if (['collecting', 'finalizing'].includes(saved.phase)) {
        saved.phase = 'interrupted'; saved.reason = 'PROCESS_INTERRUPTED'; saved.result = 'unknown';
        saved.recoveredAt = now(); persist(saved);
      }
      sessions.set(saved.id, saved);
    } catch { /* Corrupt evidence never replaces or removes the pressure database. */ }
  }
  /** Start only after the old session's admitted work and writes have reached a known outcome. */
  function begin({ recordKey, systemId, configuration = null, storagePolicy = null, inputCoverage = 'untracked' }) {
    if (active && ['collecting', 'finalizing'].includes(active.phase)) throw new Error('上一条采集仍在收尾，请稍后重试。');
    active = { schemaVersion: 1, id: randomUUID(), recordKey: String(recordKey || ''), systemId: String(systemId || ''),
      startedAt: now(), stoppedAt: null, completedAt: null, phase: 'collecting', result: 'pending', reason: null,
      configuration: configuration ? JSON.parse(JSON.stringify(configuration)) : null,
      storagePolicy, channels: {}, scope: 'host-storage-queue', inputCoverage: ['fenced', 'synchronous'].includes(inputCoverage) ? inputCoverage : 'untracked', completeness: 'not-hardware-verified' };
    sessions.set(active.id, active); persist(active); notify(); return snapshot();
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
    session.completedAt = now(); persist(session); notify(session);
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
    if (session.phase === 'finalizing') complete(session); else schedule(session);
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
          session.completedAt = now(); drainTimers.delete(session.id); persist(session); notify(session);
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
      if (checkpoint) clearTimeout(checkpoint); checkpoint = null;
      for (const timer of drainTimers.values()) clearTimeout(timer); drainTimers.clear();
      for (const session of dirty) persist(session); if (active) persist(active);
      for (const [id, callbacks] of waiters) for (const resolve of callbacks) resolve({ ...snapshot(sessions.get(id)), result: 'unknown' });
      waiters.clear();
    } };
}

module.exports = { createCollectionSessionService };
