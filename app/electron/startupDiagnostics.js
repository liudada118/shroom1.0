const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { normalizeEvent, restoreEvent } = require('./usageAnalytics');
const { compactStackLocations } = require('./diagnosticStack');

const LIMITS = Object.freeze({ records: 100, bytes: 256 * 1024, ageMs: 7 * 86400000, eventBytes: 4096 });
const CODES = Object.freeze({ EADDRINUSE: 'STARTUP_PORT_IN_USE', EACCES: 'STARTUP_PERMISSION_DENIED',
  EPERM: 'STARTUP_PERMISSION_DENIED', LOCAL_SERVICE_CHECK_TIMEOUT: 'STARTUP_PORT_CHECK_TIMEOUT' });
const PHASES = new Set(['initialization', 'port_preflight', 'local_service', 'main_process', 'previous_exit']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const STATES = new Set(['pending', 'local', 'acked', 'dropped', 'expired']);

/** Read an existing credential through the normal path resolver without loading the backend or large files. */
function readStartupLicenseKey() {
  try {
    const file = require('../../backend/kernel/platform/license/licenseKeyStore').findExistingConfigFile();
    if (!file || fs.statSync(file).size > 8192) return '';
    const key = fs.readFileSync(file, 'utf8').trim();
    return /^[A-Za-z0-9+/=]{32,8192}$/.test(key) ? key : '';
  } catch { return ''; }
}

/** Keep only script coordinates; startup evidence never retains arbitrary exception messages or stack labels. */
function safeLocations(error) {
  try {
    return compactStackLocations(typeof error?.stack === 'string' ? error.stack : '').split(/\r?\n/).flatMap(line => {
      const match = /(?:\(|\s)((?:[A-Za-z0-9_$.-]{1,128}\.(?:[cm]?js|jsx|tsx?|vue)|node:[A-Za-z0-9_/-]{1,100}):\d{1,9}:\d{1,9})\)?\s*$/.exec(line);
      return match ? [`    at ${match[1]}`] : [];
    }).slice(0, 12).join('\n').slice(0, 1800);
  } catch { return ''; }
}

/** Persist small immutable startup records synchronously; this adapter never sends requests or starts services. */
function createStartupDiagnostics({ app, root, appVersion, environment, getLicenseKey = readStartupLicenseKey,
  now = Date.now, limits = LIMITS } = {}) {
  try { root ??= app?.getPath?.('userData'); appVersion ??= app?.getVersion?.(); } catch { /* Unknown paths disable evidence storage. */ }
  environment ??= app?.isPackaged ? 'production' : 'development';
  const directory = root ? path.join(root, 'usage-analytics') : '';
  const file = directory ? path.join(directory, 'startup-diagnostics.json') : '';
  const settingsFile = directory ? path.join(directory, 'settings.json') : '';
  const budget = Object.fromEntries(Object.entries(LIMITS).map(([name, value]) => [name,
    Number.isSafeInteger(limits[name]) && limits[name] > 0 ? Math.min(value, limits[name]) : value]));
  const sessionId = randomUUID(), attemptId = randomUUID(), seen = new WeakMap();
  let state = { version: 1, records: [], marker: null, removed: { capacity: 0, expired: 0, suppressed: 0, invalid: 0 } };
  let enabled = false, storageAvailable = true, writing = false, fatal = false, lastEventId = null;

  /** Respect only an existing explicit setting; unreadable or absent consent never turns collection on. */
  function consent() {
    try {
      if (!settingsFile || fs.statSync(settingsFile).size > 16384) return null;
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      return settings.enabled === true && UUID.test(settings.installationId || '') ? settings : null;
    } catch { return null; }
  }

  /** Commit by atomic rename and keep the prior state on failure so acknowledgements cannot erase evidence. */
  function commit(next) {
    if (!file || writing) return false;
    const temporary = `${file}.${randomUUID()}.tmp`;
    let descriptor;
    writing = true;
    try {
      const text = JSON.stringify(next);
      if (Buffer.byteLength(text) > budget.bytes) return false;
      fs.mkdirSync(directory, { recursive: true });
      descriptor = fs.openSync(temporary, 'wx', 0o600);
      fs.writeFileSync(descriptor, text);
      fs.fsyncSync(descriptor);
      fs.closeSync(descriptor); descriptor = undefined;
      fs.renameSync(temporary, file);
      state = next; storageAvailable = true;
      return true;
    } catch { storageAvailable = false; return false; }
    finally {
      writing = false;
      if (descriptor !== undefined) try { fs.closeSync(descriptor); } catch { /* Preserve the original write failure. */ }
      try { fs.unlinkSync(temporary); } catch { /* A completed rename has no temporary file. */ }
    }
  }

  /** Trim known excess before writing, preferring settled evidence over pending diagnostics. */
  function bounded(next) {
    const cutoff = now() - budget.ageMs;
    next.records = next.records.filter(record => {
      if (Date.parse(record.event.occurredAt) >= cutoff) return true;
      next.removed.expired++; return false;
    });
    while (next.records.length && (next.records.length > budget.records || Buffer.byteLength(JSON.stringify(next)) > budget.bytes)) {
      const settled = next.records.findIndex(record => !['pending', 'local'].includes(record.state));
      next.records.splice(settled < 0 ? 0 : settled, 1); next.removed.capacity++;
    }
    return next;
  }

  /** Clone the small store before mutations; the live provider exposes only committed records. */
  function copy() { return JSON.parse(JSON.stringify(state)); }

  /** Clear all uploadable and unassigned evidence when the persistent choice is off or cannot be read. */
  function checkConsent() {
    const settings = consent(); enabled = Boolean(settings);
    const epoch = Number.isSafeInteger(settings?.epoch) ? settings.epoch : 0;
    if ((!settings && (state.records.length || state.marker)) || state.records.some(record => record.epoch !== epoch)
      || (state.marker && state.marker.epoch !== epoch)) {
      const next = copy(), before = next.records.length;
      next.records = settings ? next.records.filter(record => record.epoch === epoch) : [];
      next.removed.suppressed += before - next.records.length;
      if (!settings || next.marker?.epoch !== epoch) next.marker = null;
      commit(next);
    }
    return settings;
  }

  /** Hash the credential once for each fact; later license changes never reassign its customer scope. */
  function currentScope() {
    try {
      const key = String(getLicenseKey() || '').trim();
      return /^[A-Za-z0-9+/=]{32,8192}$/.test(key) ? createHash('sha256').update(key).digest('hex') : '';
    } catch { return ''; }
  }

  /** Add a finite startup fact using its original identity, with no raw exception body. */
  function append(code, phase, error, identity, scope, operationId, occurredAt, severity = 'fatal') {
    try {
      const event = normalizeEvent({ eventName: 'error_reported', properties: { module: 'startup', action: phase,
        operationId, errorCode: code, errorType: phase === 'previous_exit' ? 'UnknownExit' : 'StartupError', severity,
        message: code, ...(safeLocations(error) ? { stack: safeLocations(error) } : {}) } }, { ...identity, scope });
      event.occurredAt = occurredAt;
      if (Buffer.byteLength(JSON.stringify(event)) > budget.eventBytes) return false;
      const next = copy(); next.records.push({ scope, event, state: scope ? 'pending' : 'local', epoch: identity.epoch || 0 });
      if (!commit(bounded(next))) return false;
      if (!state.records.some(record => record.event.eventId === event.eventId)) return false;
      lastEventId = event.eventId; return true;
    } catch { return false; }
  }

  /** Capture a startup failure once per Error object without swallowing or replacing the original exception. */
  function record(error, { phase = 'initialization', uncaught = false } = {}) {
    const settings = checkConsent();
    let code = 'STARTUP_INITIALIZATION_FAILED';
    try { code = uncaught ? 'MAIN_UNCAUGHT_EXCEPTION' : CODES[error?.code] || code; } catch { /* Unsafe getters are not diagnostic input. */ }
    if (!PHASES.has(phase)) phase = 'initialization';
    if (!settings) return { code, saved: false, enabled: false };
    if (error && typeof error === 'object' && seen.has(error)) return { code,
      saved: state.records.some(record => record.event.eventId === seen.get(error)), enabled: true };
    const saved = append(code, phase, error, { installationId: settings.installationId, sessionId, appVersion, environment, epoch: settings.epoch || 0 },
      currentScope(), attemptId, new Date(now()).toISOString());
    if (saved && error && typeof error === 'object') seen.set(error, lastEventId);
    if (uncaught) { fatal = true; if (saved) markClean('fatal_observed'); }
    return { code, saved, enabled: true, eventId: saved ? lastEventId : null };
  }

  /** Mark a confirmed intentional close or observed fatal exit; neither becomes an unknown crash on restart. */
  function markClean(reason = 'normal') {
    if (!checkConsent() || !state.marker) return false;
    const next = copy();
    if (next.marker.state !== 'open' && !fatal) return true;
    next.marker.state = fatal ? 'fatal_observed' : ['normal', 'upgrade', 'startup_failed', 'fatal_observed'].includes(reason) ? reason : 'normal';
    return commit(next);
  }

  /** Return only pending records whose original customer was known; unassigned evidence remains local. */
  function list() {
    const settings = checkConsent();
    if (!settings) return [];
    const next = bounded(copy());
    if (next.records.length !== state.records.length) commit(next);
    return state.records.filter(record => record.epoch === (settings.epoch || 0) && record.scope && record.state === 'pending'
      && Date.parse(record.event.occurredAt) >= now() - budget.ageMs).map(record => ({ ...JSON.parse(JSON.stringify(record)),
        physicalBytes: Buffer.byteLength(JSON.stringify(record)) }));
  }

  /** Persist a host acknowledgement before removing ownership; failed writes leave the original event retryable. */
  function settle(eventId, result, reason) {
    if (!['acked', 'suppressed', 'dropped', 'expired'].includes(result)) return false;
    const next = copy(), index = next.records.findIndex(record => record.event.eventId === eventId);
    if (index < 0) return true;
    if (result === 'suppressed') { next.records.splice(index, 1); next.removed.suppressed++; }
    else {
      next.records[index].state = result;
      next.records[index].reason = typeof reason === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(reason) ? reason : result;
    }
    return commit(bounded(next));
  }

  /** Preview only current-customer or unassigned safe records, never records belonging to another saved license. */
  function preview() {
    const settings = checkConsent();
    if (!settings) return '';
    const scope = currentScope();
    const records = state.records.filter(record => record.epoch === (settings.epoch || 0) && (!record.scope || record.scope === scope)
      && Date.parse(record.event.occurredAt) >= now() - budget.ageMs).map(record => ({
      ownership: record.scope ? 'original_customer' : 'unassigned', state: record.state, event: record.event,
    }));
    while (records.length && Buffer.byteLength(JSON.stringify({ version: 1, records })) > budget.bytes) records.shift();
    return records.length ? JSON.stringify({ version: 1, records }) : '';
  }

  /** Save exactly the previewed bounded material to a user-selected file; no network or automatic sending occurs. */
  function exportTo(target, expected) {
    const text = preview();
    if (!text || text !== expected || Buffer.byteLength(text) > budget.bytes) return false;
    try { fs.writeFileSync(target, text, { mode: 0o600 }); return true; } catch { return false; }
  }

  /** Expose evidence availability without keys, paths or exception content. */
  function status() { return { enabled: Boolean(checkConsent()), storageAvailable, records: enabled ? state.records.length : 0,
    saved: Boolean(lastEventId && state.records.some(record => record.event.eventId === lastEventId)), removed: { ...state.removed } }; }

  const initial = consent(); enabled = Boolean(initial);
  if (initial && file) {
    try {
      if (fs.statSync(file).size > budget.bytes) throw new Error('STARTUP_STORE_TOO_LARGE');
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (saved.version !== 1 || !Array.isArray(saved.records) || saved.records.length > budget.records) throw new Error('STARTUP_STORE_INVALID');
      for (const name of Object.keys(state.removed)) if (Number.isSafeInteger(saved.removed?.[name]) && saved.removed[name] >= 0) state.removed[name] = saved.removed[name];
      for (const record of saved.records) {
        try {
          if (!STATES.has(record.state) || !/^([a-f0-9]{64})?$/.test(record.scope) || (!record.scope && record.state !== 'local')) throw new Error('STARTUP_RECORD_INVALID');
          const event = restoreEvent(record.event, initial.installationId, []);
          if (event.eventName !== 'error_reported' || event.properties.module !== 'startup' || !PHASES.has(event.properties.action)
            || !UUID.test(event.properties.operationId) || event.properties.message !== event.properties.errorCode) throw new Error('STARTUP_RECORD_INVALID');
          state.records.push({ scope: record.scope, event, state: record.state, epoch: Number.isSafeInteger(record.epoch) && record.epoch >= 0 ? record.epoch : 0 });
        } catch { state.removed.invalid++; }
      }
      const marker = saved.marker;
      if (marker && UUID.test(marker.attemptId) && UUID.test(marker.sessionId) && marker.installationId === initial.installationId
        && /^([a-f0-9]{64})?$/.test(marker.scope) && /^\d+\.\d+\.\d+$/.test(marker.appVersion)
        && ['production', 'development', 'test'].includes(marker.environment) && Number.isFinite(Date.parse(marker.startedAt))) state.marker = { ...marker, epoch: marker.epoch || 0 };
    } catch (error) { if (error.code !== 'ENOENT') storageAvailable = false; }
    checkConsent();
    const previous = state.marker;
    if (previous?.state === 'open' && Date.parse(previous.startedAt) >= now() - budget.ageMs) {
      append('PREVIOUS_EXIT_UNCONFIRMED', 'previous_exit', null, { installationId: previous.installationId, sessionId,
        appVersion, environment, epoch: initial.epoch || 0 }, previous.scope, previous.attemptId, new Date(now()).toISOString(), 'warning');
    }
    const next = copy(); next.marker = { attemptId, sessionId, installationId: initial.installationId,
      scope: currentScope(), appVersion, environment, epoch: initial.epoch || 0, startedAt: new Date(now()).toISOString(), state: 'open' };
    commit(bounded(next));
  } else if (file) {
    try { fs.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') storageAvailable = false; }
  }
  return { record, list, settle, markClean, preview, exportTo, status, dispose: markClean };
}

module.exports = { createStartupDiagnostics, readStartupLicenseKey, LIMITS };
