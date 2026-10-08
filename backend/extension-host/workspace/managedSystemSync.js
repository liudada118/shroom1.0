const fs = require('node:fs');
const path = require('node:path');
const { createHash, verify } = require('node:crypto');

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

/** Pull the customer-authorized signed releases into a separate read-only managed directory. */
function createManagedSystemSync({ root, getLicenseKey, installPackage, baseUrl = DEFAULT_URL,
  fetchImpl = globalThis.fetch, publicKey = PUBLIC_KEY }) {
  const managedRoot = path.join(root, 'managed-display-systems');
  const catalogFile = path.join(root, 'managed-system-catalog.json');
  const endpoint = new URL(baseUrl);
  if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(endpoint.hostname)) {
    throw new Error('系统包服务必须使用 HTTPS');
  }

  /** Verify the cached server grant each time it is needed, including key changes and expiry. */
  function cachedCatalog() {
    const key = getLicenseKey();
    if (!key) return null;
    try { return verifyCatalog(JSON.parse(fs.readFileSync(catalogFile, 'utf8')), key, Date.now(), publicKey); }
    catch { return null; }
  }

  /** Query whether a server-managed system may be selected with the current key. */
  function isAllowed(id) { return Boolean(cachedCatalog()?.systems.some((item) => item.systemId === id)); }

  /** Make a bounded HTTPS request using the existing software license only as client identity. */
  async function request(url, key, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { headers: { Authorization: `License ${key}` }, signal: controller.signal });
      if (!response.ok) throw Object.assign(new Error(response.status === 403
        ? '当前软件密钥没有有效的公司系统授权，请联系管理员检查客户关联与密钥状态'
        : `系统包服务器返回 HTTP ${response.status}`), { code: 'SYSTEM_SYNC_HTTP_ERROR' });
      const contentType = response.headers?.get?.('content-type') || '';
      if (contentType && !contentType.toLowerCase().includes('application/json')) {
        throw Object.assign(new Error('公司系统服务尚未就绪，请联系管理员更新服务器后重试'), { code: 'SYSTEM_SYNC_SERVICE_UNAVAILABLE' });
      }
      try { return await response.json(); }
      catch { throw Object.assign(new Error('公司系统服务返回的数据无法读取，请稍后重试'), { code: 'SYSTEM_SYNC_RESPONSE_INVALID' }); }
    } finally { clearTimeout(timer); }
  }

  /** Verify the grant first, then each release; keep the previous installed version on failure. */
  async function sync() {
    const key = getLicenseKey();
    if (!key) throw Object.assign(new Error('请先激活软件密钥'), { code: 'LICENSE_REQUIRED' });
    const envelope = await request(new URL('/api/system-packages/client/catalog', endpoint), key, 12000);
    const catalog = verifyCatalog(envelope, key, Date.now(), publicKey);
    fs.mkdirSync(root, { recursive: true });
    const temporary = `${catalogFile}.${process.pid}.tmp`;
    try { fs.writeFileSync(temporary, JSON.stringify(envelope)); fs.renameSync(temporary, catalogFile); }
    finally { if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true }); }
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
        installed.push({ systemId: item.systemId, name: item.name, version: item.version });
      } catch (error) { errors.push({ systemId: item.systemId, code: error.code || 'SYSTEM_INSTALL_FAILED', message: error.message }); }
    }
    return { installed, errors, available: catalog.systems.map(({ systemId, name, version }) => ({ systemId, name, version })) };
  }

  /** Return only system metadata; never expose a stored license key or package contents. */
  function status() {
    const catalog = cachedCatalog();
    return { available: catalog?.systems.map(({ systemId, name, version }) => ({ systemId, name, version })) || [],
      expiresAt: catalog?.expiresAt || null };
  }

  return { sync, status, isAllowed };
}

module.exports = { createManagedSystemSync, verifyCatalog };
