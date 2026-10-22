const fs = require('node:fs');
const path = require('node:path');
const { createHash, verify } = require('node:crypto');
const { getDeviceId } = require('../../../../app/electron/deviceIdentity');
const { observeUsageOperation } = require('../../../common/businessEvents');
const PUBLIC_KEY = fs.readFileSync(path.join(__dirname, '../../../extension-host/workspace/systemPackagePublicKey.pem'), 'utf8');
const LEGACY_AUTHORIZATION_PENDING_MESSAGE = '原密钥自动同步尚未完成，请保持联网重试；若持续失败，请联系管理员更新授权服务，无需更换密钥或到网站补录。';

/** Verify the signed offline allowance for this exact key and computer. */
function verifyDeviceLease(envelope, key, deviceId, now = Date.now(), publicKey = PUBLIC_KEY, allowExpired = false) {
  const lease = envelope?.lease;
  return Boolean(lease?.schemaVersion === 1 && lease.keyHash === createHash('sha256').update(key).digest('hex')
    && lease.deviceId === deviceId && Number.isFinite(lease.issuedAt) && Number.isFinite(lease.expiresAt)
    && lease.issuedAt <= now + 60000 && (allowExpired || lease.expiresAt > now) && lease.expiresAt > lease.issuedAt
    && lease.expiresAt - lease.issuedAt <= 7 * 86400000
    && Number.isInteger(lease.deviceLimit) && lease.deviceLimit >= 0 && typeof envelope.signature === 'string'
    && verify(null, Buffer.from(JSON.stringify(lease)), publicKey, Buffer.from(envelope.signature, 'base64')));
}

/** Refresh device authorization; network failures may use only a valid, computer-bound signed allowance. */
function createDeviceAuthorization({ root, fetchImpl = globalThis.fetch, now = Date.now,
  endpoint = 'https://shroom.jq-industries.com/licenseCheck', deviceId = getDeviceId(root), publicKey = PUBLIC_KEY }) {
  const directory = path.join(root, 'license-devices');
  let lastKey = '', current = null;

  /** Read only this key's saved result; an allowed online result always requires a signature. */
  function cached(key, allowExpired = false) {
    const file = path.join(directory, `${createHash('sha256').update(key).digest('hex')}.json`);
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (value.keyHash !== createHash('sha256').update(key).digest('hex') || value.deviceId !== deviceId) return null;
      if ((value.ok || value.historyAllowed === true) && (!verifyDeviceLease(value.deviceLease, key, deviceId, now(), publicKey, allowExpired)
        || value.deviceLimit !== value.deviceLease.lease.deviceLimit || !Number.isFinite(value.expiresAt)
        || value.expiresAt > value.deviceLease.lease.expiresAt)) return null;
      return value;
    } catch { return null; }
  }

  /** Persist explicit server outcomes, including denials, without storing the software key. */
  function persist(key, value) {
    fs.mkdirSync(directory, { recursive: true });
    const target = path.join(directory, `${createHash('sha256').update(key).digest('hex')}.json`);
    const temporary = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ ...value, keyHash: createHash('sha256').update(key).digest('hex'), deviceId }), { mode: 0o600 });
    fs.renameSync(temporary, target);
  }

  /** Authorize one online key before activation; an offline RSA key retains its existing local contract. */
  async function authorize(key, localState) {
    return observeUsageOperation('usage_session_summary', { featureId: 'license_authorization', action: 'verify' }, () => authorizeUnobserved(key, localState));
  }

  /** Preserve the existing online and RSA decision; only outcome metadata reaches diagnostics. */
  async function authorizeUnobserved(key, localState) {
    key = key.trim();
    if (/^[a-f0-9]+$/i.test(key)) key = key.toLowerCase();
    const onlineKey = /^[a-f0-9]+$/i.test(key.trim());
    let limitedOffline = false;
    if (!onlineKey) {
      try {
        const envelope = JSON.parse(Buffer.from(key, 'base64').toString('utf8'));
        const payload = JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf8'));
        limitedOffline = Number.isInteger(payload.deviceLimit) && payload.deviceLimit > 0;
      } catch { /* The local validator has already rejected malformed keys. */ }
      if (!limitedOffline) {
        lastKey = key;
        current = { ok: localState.endDate > now(), expiresAt: localState.endDate, licenseExpiresAt: localState.endDate,
          historyAllowed: true, deviceLimit: 0, ...(localState.endDate <= now() ? { code: 'LICENSE_EXPIRED', message: '密钥已到期，仍可查看和分析历史数据。' } : {}) };
        return current;
      }
    }
    const previous = cached(key, true);
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
    timeout.unref?.();
    let response;
    try {
      const result = await fetchImpl(limitedOffline ? new URL('/api/license/devices/check', endpoint).href : endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, deviceId, clientTime: now() }), redirect: 'error', signal: controller.signal });
      if (result.ok) {
        const body = await result.text();
        if (Buffer.byteLength(body) > 32768) throw new Error('invalid response');
        response = JSON.parse(body);
        if (typeof response.valid !== 'boolean' || !Number.isFinite(response.time)
          || !Number.isInteger(response.deviceLimit ?? 0) || (response.deviceLimit ?? 0) < 0 || (response.deviceLimit ?? 0) > 10000
          || (response.valid && !Number.isFinite(response.expireTimestamp))) throw new Error('invalid response');
      }
    } catch { /* Offline fallback is evaluated below. */ }
    finally { clearTimeout(timeout); }
    let value;
    if (response) {
      const limit = response.deviceLimit || 0;
      if (response.status === 'LICENSE_NOT_REGISTERED' || (response.valid && !response.deviceLease && response.status === 'UNKNOWN')) {
        value = { ok: false, code: 'LICENSE_NOT_REGISTERED', message: LEGACY_AUTHORIZATION_PENDING_MESSAGE, deviceLimit: limit };
      } else if (response.valid && !response.deviceLease) {
        value = { ok: false, code: 'LICENSE_SERVER_UPGRADE_REQUIRED', message: '授权服务尚未返回电脑授权凭证，请联系管理员更新授权服务后重试。', deviceLimit: limit };
      } else if (response.valid && (!verifyDeviceLease(response.deviceLease, key, deviceId, now(), publicKey)
        || response.deviceLease.lease.deviceLimit !== limit)) {
        value = { ok: false, code: 'DEVICE_LEASE_INVALID', message: '电脑授权凭证校验失败，请联系管理员检查服务端签名配置。', deviceLimit: limit };
      } else value = { ok: response.valid, code: response.status || 'LICENSE_INVALID', message: response.reason || '密钥未通过验证。',
        deviceLimit: limit, licenseExpiresAt: response.expireTimestamp, expiresAt: Math.min(response.expireTimestamp || localState.endDate,
          response.deviceLease?.lease?.expiresAt || 0), ...(response.deviceLease ? { deviceLease: response.deviceLease } : {}) };
      const expiry = Number(value.licenseExpiresAt || response.expireTimestamp || localState.endDate);
      const normalExpiry = ['EXPIRED', 'LICENSE_EXPIRED'].includes(response.status) && expiry > 0 && expiry <= now();
      value = { ...value, licenseExpiresAt: expiry, serverTime: response.time,
        historyAllowed: value.ok || normalExpiry, explicitDenial: !value.ok && !normalExpiry };
      if (normalExpiry && !value.deviceLease && previous?.deviceLease) {
        // Keep signature evidence for read-only restart; this expired lease never grants live acquisition.
        value = { ...value, deviceLease: previous.deviceLease, expiresAt: previous.expiresAt, deviceLimit: previous.deviceLimit };
      }
      persist(key, value);
    } else if (previous) value = { ...previous, licenseExpiresAt: localState.endDate, offline: true,
      ...(previous.code === 'LICENSE_NOT_REGISTERED' ? { message: LEGACY_AUTHORIZATION_PENDING_MESSAGE } : {}) };
    else value = { ok: false, code: 'LICENSE_ONLINE_ACTIVATION_REQUIRED', message: '请先联网验证一次密钥，完成电脑授权后可离线使用。' };
    const normalExpiry = Number(value.licenseExpiresAt || localState.endDate) <= now()
      && !value.explicitDenial && (value.ok || value.historyAllowed === true);
    if (normalExpiry) value = { ...value, ok: false, historyAllowed: true, code: 'LICENSE_EXPIRED',
      licenseExpiresAt: value.licenseExpiresAt || localState.endDate, message: '密钥已到期，仍可查看和分析历史数据。' };
    else if (value.ok && (!Number.isFinite(value.expiresAt) || value.expiresAt <= now())) value = { ...value, ok: false,
      historyAllowed: false, code: 'DEVICE_LEASE_EXPIRED', message: '离线授权凭证已到期，请联网后自动恢复。' };
    lastKey = key; current = value;
    return value;
  }

  /** Return the most recently verified state without exposing key or hardware identity to the UI. */
  function status() { return current ? { ok: current.ok, code: current.code, historyAllowed: current.historyAllowed === true,
    deviceLimit: current.deviceLimit, expiresAt: current.expiresAt, licenseExpiresAt: current.licenseExpiresAt, offline: Boolean(current.offline) } : null; }
  return { authorize, status, getCurrentKey: () => lastKey };
}

module.exports = { createDeviceAuthorization, verifyDeviceLease };
