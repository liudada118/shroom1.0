const CAPABILITIES = ['canAcquire', 'canReadHistory', 'canAnalyzeHistory', 'canExport', 'canConfigure', 'canStop'];
const DENIED_ACCESS = Object.freeze({ schemaVersion: 1, state: 'unverified', reason: 'LICENSE_ACCESS_INVALID',
  canAcquire: false, canReadHistory: false, canAnalyzeHistory: false, canExport: false, canConfigure: false, canStop: true });

/** Read the host capability contract; absent fields keep legacy behavior, malformed contracts fail closed. */
export function readLicenseAccess(message) {
  if (!message || !Object.hasOwn(message, 'licenseAccess')) return undefined;
  const access = message.licenseAccess;
  if (!access || access.schemaVersion !== 1 || !['active', 'expired', 'restricted', 'unverified'].includes(access.state)
    || CAPABILITIES.some(name => typeof access[name] !== 'boolean') || access.canStop !== true
    || (access.state !== 'active' && (access.canAcquire || access.canExport || access.canConfigure))) return DENIED_ACCESS;
  return { schemaVersion: 1, state: access.state, reason: typeof access.reason === 'string' ? access.reason.slice(0, 200) : '',
    expiresAt: access.expiresAt ?? null, licenseExpiresAt: access.licenseExpiresAt ?? null,
    ...Object.fromEntries(CAPABILITIES.map(name => [name, access[name]])) };
}

/** Read the software license deadline; modern lease deadlines never fall back to legacy dates. */
export function getLicenseExpiryTimestamp(message) {
  const access = readLicenseAccess(message);
  const value = access === undefined ? message?.date : access.licenseExpiresAt;
  const timestamp = typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
  return Number.isFinite(timestamp) && timestamp > 0 && Number.isFinite(new Date(timestamp).getTime()) ? timestamp : null;
}

/** Only an explicit normally expired license may retain history viewing and analysis. */
export function isHistoryOnlyLicense(access) {
  return access?.state === 'expired' && access.canReadHistory === true && access.canAcquire === false && access.canExport === false;
}

/** Legacy hosts preserve their established checks; modern hosts require each explicit capability. */
export function canUseLicenseCapability(access, name) {
  return access === undefined || access?.[name] === true;
}
