const fs = require('node:fs');
const path = require('node:path');
const { createHash, verify } = require('node:crypto');
const { recordBusinessEvent, observeUsageOperation } = require('../../common/businessEvents');

const DEFAULT_URL = 'https://shroom.jq-industries.com';
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const PUBLIC_KEY = fs.readFileSync(path.join(__dirname, 'systemPackagePublicKey.pem'), 'utf8');

/** Read a signed catalog bound to the current software key; expired or changed keys grant nothing. */
function verifyCatalog(envelope, licenseKey, now = Date.now(), publicKey = PUBLIC_KEY) {
  const catalog = envelope?.catalog;
  if (!catalog || typeof envelope.signature !== 'string' || !Array.isArray(catalog.systems)
    || !Number.isFinite(catalog.issuedAt) || !Number.isFinite(catalog.expiresAt)
    || catalog.issuedAt > now + 60000 || catalog.expiresAt <= now || catalog.expiresAt - catalog.issuedAt > 86460000
    || catalog.keyHash !== createHash('sha256').update(licenseKey || '').digest('hex')
    || !verify(null, Buffer.from(JSON.stringify(catalog)), publicKey, Buffer.from(envelope.signature, 'base64'))) {
    throw Object.assign(new Error('系统授权目录签名无效或已过期'), { code: 'SYSTEM_CATALOG_INVALID' });
  }
  for (const item of catalog.systems) {
    if (!SAFE_ID.test(item.systemId || '') || !Number.isSafeInteger(item.version) || item.version < 1
      || !/^[a-f0-9]{64}$/.test(item.sha256 || '') || typeof item.signature !== 'string') {
      throw Object.assign(new Error('系统授权目录包含无效条目'), { code: 'SYSTEM_CATALOG_INVALID' });
    }
  }
  return catalog;
}

/** Verify a key-bound server document independently of the system download catalog. */
function verifyServerDocument(envelope, field, key, now = Date.now(), publicKey = PUBLIC_KEY) {
  const value = envelope?.[field];
  if (!value || value.schemaVersion !== 1 || !Number.isFinite(value.issuedAt) || !Number.isFinite(value.expiresAt)
    || value.issuedAt > now + 60000 || value.expiresAt <= now || value.expiresAt <= value.issuedAt
    || value.expiresAt - value.issuedAt > 86460000 || value.keyHash !== createHash('sha256').update(key || '').digest('hex')
    || typeof envelope.signature !== 'string'
    || !verify(null, Buffer.from(JSON.stringify(value)), publicKey, Buffer.from(envelope.signature, 'base64'))) {
    throw Object.assign(new Error('系统服务状态签名无效或已过期'), { code: 'SYSTEM_STATUS_INVALID' });
  }
  if (field === 'grant' && (value.type !== 'installed-system-status' || !Array.isArray(value.systems) || value.systems.length > 32
    || value.systems.some(item => !SAFE_ID.test(item.id || '') || !Number.isSafeInteger(item.version) || item.version < 1
      || !['published', 'revoked', 'unavailable', 'unauthorized'].includes(item.status)
      || (item.sha256 !== null && !/^[a-f0-9]{64}$/.test(item.sha256 || ''))
      || (item.status === 'revoked' && (!item.withdrawal || item.withdrawal.schemaVersion !== 1
        || !['stop-distribution', 'stop-new-acquisition'].includes(item.withdrawal.mode)))))) {
    throw Object.assign(new Error('已安装系统状态无效'), { code: 'SYSTEM_STATUS_INVALID' });
  }
  if (field === 'policy' && value.diagnosticOnly !== true) throw Object.assign(new Error('服务端策略版本不受支持'), { code: 'SYSTEM_STATUS_INVALID' });
  return value;
}

/** Pull the customer-authorized signed releases into a separate read-only managed directory. */
function createManagedSystemSync({ root, getLicenseKey, installPackage, baseUrl = DEFAULT_URL,
  fetchImpl = globalThis.fetch, publicKey = PUBLIC_KEY, now = Date.now }) {
  const managedRoot = path.join(root, 'managed-display-systems');
  const catalogFile = path.join(root, 'managed-system-catalog.json');
  const statusFile = path.join(root, 'managed-installed-status.json');
  const policyFile = path.join(root, 'managed-server-policy.json');
  const endpoint = new URL(baseUrl);
  if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(endpoint.hostname)) {
    throw new Error('系统包服务必须使用 HTTPS');
  }

  /** Verify the cached server grant each time it is needed, including key changes and expiry. */
  function cachedCatalog() {
    const key = getLicenseKey();
    if (!key) return null;
    try { return verifyCatalog(JSON.parse(fs.readFileSync(catalogFile, 'utf8')), key, now(), publicKey); }
    catch { return null; }
  }

  /** Read only bounded package identity files; local metadata alone never grants access. */
  function installedVersions() {
    const result = [];
    for (const [directory, native] of [[managedRoot, false], [path.join(root, 'managed-native-systems'), true]]) {
      let entries = [];
      try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries.slice(0, 256)) {
        try {
          const id = native ? entry.name.replace(/\.json$/, '') : entry.name;
          if (!SAFE_ID.test(id) || (native ? !entry.isFile() || !entry.name.endsWith('.json') : !entry.isDirectory())) continue;
          const target = path.join(directory, entry.name, ...(native ? [] : ['package-info.json']));
          if (fs.statSync(target).size > 1048576) continue;
          const data = JSON.parse(fs.readFileSync(target, 'utf8'));
          const info = native ? data.managedPackage : data;
          if (info.systemId === id && Number.isSafeInteger(info.version) && info.version > 0 && /^[a-f0-9]{64}$/.test(info.sha256 || '')) {
            result.push({ id, version: info.version, sha256: info.sha256 });
          }
        } catch { /* An incomplete installation cannot be granted by its identity file. */ }
      }
    }
    return result;
  }

  /** Read the exact installed version's signed withdrawal decision, never the diagnostic policy. */
  function installedStatus(id) {
    const installed = installedVersions().find(item => item.id === id);
    if (!installed) return null;
    try {
      const cached = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      for (const envelope of Array.isArray(cached) ? cached : [cached]) {
        const grant = verifyServerDocument(envelope, 'grant', getLicenseKey(), now(), publicKey);
        const item = grant.systems.find(entry => entry.id === id && entry.version === installed.version);
        if (item) return ['unavailable', 'unauthorized'].includes(item.status) || item.sha256 === installed.sha256
          ? item : { ...item, status: 'unavailable', withdrawal: null };
      }
      return null;
    } catch { return null; }
  }

  /** Query live access: a signed per-version withdrawal can stop acquisition even before promotion. */
  function isAllowed(id) {
    const item = installedStatus(id);
    if (item) return item.status === 'published' || (item.status === 'revoked' && item.withdrawal.mode === 'stop-distribution');
    return Boolean(cachedCatalog()?.systems.some(entry => entry.systemId === id));
  }

  /** Return verified server version diagnostics without using them as authorization. */
  function getServerPolicy() {
    try { return verifyServerDocument(JSON.parse(fs.readFileSync(policyFile, 'utf8')), 'policy', getLicenseKey(), now(), publicKey); }
    catch { return null; }
  }

  /** Atomically replace one verified cache; a failed request leaves the previous signed document intact. */
  function saveEnvelope(target, envelope) {
    fs.mkdirSync(root, { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    try { fs.writeFileSync(temporary, JSON.stringify(envelope)); fs.renameSync(temporary, target); }
    finally { if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true }); }
  }

  /** Explicit server denial invalidates cached permission; network failure keeps only unexpired signatures. */
  function clearGrantCaches(all = false) {
    for (const target of all ? [statusFile, catalogFile, policyFile] : [statusFile]) {
      fs.rmSync(target, { force: true });
    }
  }

  /** Make a bounded HTTPS request using the existing software license only as client identity. */
  async function request(url, key, timeoutMs, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
        headers: { Authorization: `License ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, signal: controller.signal });
      const contentType = response.headers?.get?.('content-type') || '';
      if (!response.ok) {
        if ([401, 403].includes(response.status)) clearGrantCaches(true);
        let reason = '';
        if (contentType.toLowerCase().includes('application/json')) {
          try { reason = (await response.json())?.error || ''; } catch { /* Keep a safe fallback. */ }
        }
        const messages = {
          OFFLINE_KEY_NOT_REGISTERED: '这把离线密钥未在当前公司系统服务器登记，请联系管理员核对签发服务器',
          LICENSE_CUSTOMER_REQUIRED: '这把密钥未关联客户；请管理员重新签发并选择客户',
          LICENSE_CUSTOMER_INACTIVE: '关联客户已停用，请联系管理员',
          LICENSE_INACTIVE: '这把密钥已停用或删除，请联系管理员',
          LICENSE_EXPIRED: '这把密钥已过期，请更新密钥',
          LICENSE_INVALID: '密钥格式或签名无效，请核对激活码',
        };
        const message = response.status === 403
          ? messages[reason] || '当前软件密钥没有有效的公司系统授权，请联系管理员检查客户关联与密钥状态'
          : `系统包服务器返回 HTTP ${response.status}`;
        throw Object.assign(new Error(message), { code: reason || 'SYSTEM_SYNC_HTTP_ERROR', httpStatus: response.status });
      }
      if (contentType && !contentType.toLowerCase().includes('application/json')) {
        throw Object.assign(new Error('公司系统服务尚未就绪，请联系管理员更新服务器后重试'), { code: 'SYSTEM_SYNC_SERVICE_UNAVAILABLE' });
      }
      try { return await response.json(); }
      catch { throw Object.assign(new Error('公司系统服务返回的数据无法读取，请稍后重试'), { code: 'SYSTEM_SYNC_RESPONSE_INVALID' }); }
    } finally { clearTimeout(timer); }
  }

  /** Verify the grant first, then each release; keep the previous installed version on failure. */
  async function sync() {
    return observeUsageOperation('custom_system_saved', { featureId: 'system_sync', action: 'sync' }, syncUnobserved);
  }

  /** Assemble a verified customer catalog without publishing raw packages or customer names. */
  async function syncUnobserved() {
    const key = getLicenseKey();
    if (!key) throw Object.assign(new Error('请先激活软件密钥'), { code: 'LICENSE_REQUIRED' });
    let envelope;
    try { envelope = await request(new URL('/api/system-packages/client/catalog', endpoint), key, 12000); }
    catch (error) { if ([401, 403].includes(error.httpStatus)) clearGrantCaches(true); throw error; }
    const catalog = verifyCatalog(envelope, key, now(), publicKey);
    saveEnvelope(catalogFile, envelope);
    const installed = [];
    const errors = [];
    for (const item of catalog.systems) {
      try {
        const infoFile = path.join(managedRoot, item.systemId, 'package-info.json');
        try {
          const info = fs.existsSync(infoFile) ? JSON.parse(fs.readFileSync(infoFile, 'utf8'))
            : JSON.parse(fs.readFileSync(path.join(root, 'managed-native-systems', `${item.systemId}.json`), 'utf8')).managedPackage;
          if (info.sha256 === item.sha256 && info.version === item.version) continue;
        } catch { /* Missing or invalid local version is re-downloaded. */ }
        const data = await request(new URL(`/api/system-packages/client/packages/${encodeURIComponent(item.systemId)}/${item.version}`, endpoint), key, 30000);
        if (data.version !== item.version || data.package?.systemId !== item.systemId
          || data.package?.sha256 !== item.sha256 || data.signature !== item.signature
          || !verify(null, Buffer.from(item.sha256, 'hex'), publicKey, Buffer.from(item.signature, 'base64'))) {
          throw Object.assign(new Error('系统包签名或目录版本不一致'), { code: 'SYSTEM_PACKAGE_SIGNATURE_INVALID' });
        }
        installPackage(data.package, item.version);
        recordBusinessEvent('custom_system_saved', { featureId: 'system_install', action: 'install', result: 'success',
          systemType: item.systemId, systemOrigin: 'custom' });
        installed.push({ systemId: item.systemId, name: item.name, version: item.version });
      } catch (error) {
        recordBusinessEvent('custom_system_saved', { featureId: 'system_install', action: 'install', result: 'failure', errorCode: error.code || 'SYSTEM_INSTALL_FAILED',
          systemType: item.systemId, systemOrigin: 'custom' });
        errors.push({ systemId: item.systemId, code: error.code || 'SYSTEM_INSTALL_FAILED', message: error.message });
        if ([401, 403].includes(error.httpStatus)) throw error;
      }
    }
    const versions = installedVersions();
    try {
      const envelopes = [];
      let previous = [];
      try { const saved = JSON.parse(fs.readFileSync(statusFile, 'utf8')); previous = Array.isArray(saved) ? saved : [saved]; } catch { /* No prior status. */ }
      for (let offset = 0; offset < versions.length; offset += 32) {
        const batch = versions.slice(offset, offset + 32);
        const envelope = await request(new URL('/api/system-packages/client/installed-status', endpoint), key, 12000,
          { systems: batch.map(({ id, version }) => ({ id, version })) });
        const grant = verifyServerDocument(envelope, 'grant', key, now(), publicKey);
        if (grant.systems.length !== batch.length || new Set(grant.systems.map(item => item.id)).size !== batch.length
          || grant.systems.some(item => !batch.some(version => version.id === item.id && version.version === item.version))) throw new Error('unexpected installed status');
        envelopes.push(envelope);
        // Preserve each signed stop decision even if the next batch is unavailable.
        saveEnvelope(statusFile, [...envelopes, ...previous].slice(0, 32));
      }
      if (envelopes.length) saveEnvelope(statusFile, envelopes);
    } catch (error) {
      if ([401, 403].includes(error.httpStatus)) clearGrantCaches(true);
      else if ([404, 405].includes(error.httpStatus)) clearGrantCaches();
      // Network/503 failures retain only previously verified, unexpired per-version decisions.
    }
    try {
      const policyEnvelope = await request(new URL('/api/system-packages/client/policy', endpoint), key, 12000);
      verifyServerDocument(policyEnvelope, 'policy', key, now(), publicKey);
      saveEnvelope(policyFile, policyEnvelope);
    } catch { /* Diagnostics are optional and cannot grant runtime rights. */ }
    return { installed, errors, ...status() };
  }

  /** Return only system metadata; never expose a stored license key or package contents. */
  function status() {
    const catalog = cachedCatalog();
    const available = (catalog?.systems || []).filter(item => isAllowed(item.systemId)).map(({ systemId, name, version }) => ({ systemId, name, version }));
    for (const item of installedVersions()) {
      if (!available.some(entry => entry.systemId === item.id) && isAllowed(item.id)) available.push({ systemId: item.id, name: item.id, version: item.version });
    }
    return { available, expiresAt: catalog?.expiresAt || null,
      installed: installedVersions().map(item => ({ ...item, status: installedStatus(item.id)?.status || 'unknown',
        withdrawal: installedStatus(item.id)?.withdrawal || null })), serverPolicy: getServerPolicy() };
  }

  return { sync, status, isAllowed, installedVersions, installedStatus, getServerPolicy };
}

module.exports = { createManagedSystemSync, verifyCatalog, verifyServerDocument };
