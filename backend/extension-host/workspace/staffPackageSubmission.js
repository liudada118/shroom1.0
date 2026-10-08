const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const TOKEN = /^sps_[A-Za-z0-9_-]{43}$/;
const SUBMISSION_URL = 'https://shroom.jq-industries.com/api/system-packages/submissions';

/** Save a staff-only submission token encrypted by the OS user account. */
function createStaffPackageSubmission({ root, safeStorage, exportPackage, fetchImpl = globalThis.fetch,
  endpoint = SUBMISSION_URL }) {
  const filename = path.join(root, 'system-package-staff-credential.json');

  /** Fail closed if the host cannot decrypt a stored staff token. */
  function readToken() {
    try {
      if (!safeStorage?.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === 'basic_text') return '';
      const saved = JSON.parse(fs.readFileSync(filename, 'utf8'));
      const token = safeStorage.decryptString(Buffer.from(saved.encryptedToken, 'base64'));
      return TOKEN.test(token) ? token : '';
    } catch { return ''; }
  }

  /** Report configuration without exposing the bearer token to the renderer. */
  function status() { return { configured: Boolean(readToken()) }; }

  /** Atomically replace the encrypted token; a failed write keeps the previous version. */
  function save(token) {
    if (!TOKEN.test(token || '')) throw Object.assign(new Error('员工提交令牌格式无效'), { code: 'SYSTEM_SUBMISSION_TOKEN_INVALID' });
    if (!safeStorage?.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === 'basic_text') {
      throw Object.assign(new Error('系统安全存储不可用，无法保存员工令牌'), { code: 'SYSTEM_SUBMISSION_STORAGE_UNAVAILABLE' });
    }
    fs.mkdirSync(root, { recursive: true });
    const temporary = path.join(root, `.system-package-credential-${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temporary, JSON.stringify({ encryptedToken: safeStorage.encryptString(token).toString('base64') }), { flag: 'wx', mode: 0o600 });
      fs.renameSync(temporary, filename);
    } finally { if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true }); }
    return status();
  }

  /** Remove the local token without changing server-side issuance or audit history. */
  function clear() { fs.rmSync(filename, { force: true }); return status(); }

  /** Submit exactly one freshly exported package with the scoped staff token. */
  async function submit(systemId) {
    const token = readToken();
    if (!token) throw Object.assign(new Error('请先在 Agent 设置中填写员工提交令牌'), { code: 'SYSTEM_SUBMISSION_TOKEN_REQUIRED' });
    const body = JSON.stringify({ package: exportPackage(systemId) });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetchImpl(endpoint, { method: 'POST', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body });
      const contentType = response.headers?.get?.('content-type') || '';
      if (contentType && !contentType.toLowerCase().includes('application/json')) {
        throw Object.assign(new Error('公司系统服务尚未就绪，请联系管理员更新服务器后重试'), { code: 'SYSTEM_SUBMISSION_SERVICE_UNAVAILABLE' });
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !['pending', 'published'].includes(result.status) || !Number.isSafeInteger(result.id)) {
        const message = result.error === 'SUBMISSION_TOKEN_INVALID' ? '员工提交令牌已失效，请在管理网站重新签发'
          : result.error || `提交审核失败（HTTP ${response.status}）`;
        throw Object.assign(new Error(message), { code: 'SYSTEM_SUBMISSION_FAILED' });
      }
      return { id: result.id, status: result.status, systemId };
    } catch (error) {
      if (error.name === 'AbortError') throw Object.assign(new Error('提交审核超时，请到管理网站核对是否已收到，避免重复提交'), { code: 'SYSTEM_SUBMISSION_TIMEOUT' });
      throw error;
    } finally { clearTimeout(timeout); }
  }

  return { status, save, clear, submit };
}

module.exports = { createStaffPackageSubmission };
