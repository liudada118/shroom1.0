const { performance } = require('node:perf_hooks');

/** Keep authorization time moving during wall-clock rollback and accept a verified server anchor. */
function createLicenseClock({ now = Date.now, monotonic = () => performance.now() } = {}) {
  let anchor = now(), tick = monotonic(), high = anchor;
  return {
    /** Read the greater of elapsed trusted time and the local wall clock. */
    now() { high = Math.max(high, now(), anchor + Math.max(0, monotonic() - tick)); return high; },
    /** Advance the anchor only; a delayed reply cannot move authorization time backward. */
    synchronize(timestamp) {
      if (Number.isFinite(timestamp) && timestamp > high) { anchor = timestamp; tick = monotonic(); high = timestamp; }
    },
  };
}

/** Separate live acquisition, local history and file export without granting expired keys live access. */
function createLicenseAccessPolicy({ clock = createLicenseClock(), onChange = () => {}, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let grant = null, timer = null, lastState = '', closed = false;
  /** Derive all operation permissions from one verified grant and the current deadline. */
  function read() {
    const currentTime = clock.now();
    const licenseExpiresAt = Number(grant?.licenseExpiresAt ?? grant?.expiresAt);
    const expiresAt = Number(grant?.expiresAt);
    const normalExpiry = Boolean(grant && Number.isFinite(licenseExpiresAt) && licenseExpiresAt > 0 && currentTime >= licenseExpiresAt
      && (grant.ok || grant.historyAllowed === true) && !grant.explicitDenial);
    const active = Boolean(grant?.ok && expiresAt > currentTime && licenseExpiresAt > currentTime);
    const state = active ? 'active' : normalExpiry ? 'expired' : grant ? 'restricted' : 'unverified';
    return { schemaVersion: 1, state, now: currentTime,
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
      licenseExpiresAt: Number.isFinite(licenseExpiresAt) ? licenseExpiresAt : null,
      reason: active ? null : normalExpiry ? 'LICENSE_EXPIRED' : grant?.code || 'LICENSE_REQUIRED',
      canAcquire: active, canReadHistory: active || normalExpiry, canAnalyzeHistory: active || normalExpiry,
      canExport: active, canConfigure: active, canStop: true };
  }
  /** Recheck deadlines after sleep as well as while online; never wait for the two-hour refresh. */
  function check() {
    if (closed) return read();
    if (timer) clearTimer(timer);
    timer = null;
    const snapshot = read();
    if (snapshot.state !== lastState) { lastState = snapshot.state; onChange(snapshot); }
    if (grant?.ok && snapshot.state === 'active') {
      const deadline = Math.min(snapshot.expiresAt, snapshot.licenseExpiresAt);
      timer = setTimer(check, Math.max(1, Math.min(1000, deadline - snapshot.now)));
      timer?.unref?.();
    }
    return snapshot;
  }
  /** Install a verification result; explicit denial never falls back to a prior history permission. */
  function update(value) {
    grant = value ? { ...value } : null;
    clock.synchronize(value?.serverTime);
    return check();
  }
  /** Enforce the same action permission for HTTP, legacy commands and Agent tools. */
  function requireAccess(action) {
    const snapshot = check();
    const permission = { acquire: 'canAcquire', history: 'canReadHistory', analyze: 'canAnalyzeHistory', export: 'canExport', configure: 'canConfigure', stop: 'canStop' }[action];
    if (permission && snapshot[permission]) return snapshot;
    throw Object.assign(new Error(snapshot.state === 'expired'
      ? '密钥已到期，可查看历史和使用 Agent 分析；采集及文件导出需续期。'
      : '当前授权不允许此操作，请检查密钥或联网刷新。'), { code: snapshot.reason, httpStatus: 403 });
  }
  return { read, check, update, requireAccess, clock,
    /** Release the deadline check during application shutdown. */
    dispose() { closed = true; if (timer) clearTimer(timer); timer = null; } };
}

module.exports = { createLicenseAccessPolicy, createLicenseClock };
