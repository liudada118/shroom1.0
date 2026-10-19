const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { observeUsageOperation } = require('../../common/businessEvents');

const TOKEN = /^sps_[A-Za-z0-9_-]{43}$/;
const SUBMISSION_URL = 'https://shroom.jq-industries.com/api/system-packages/submissions';
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

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
  async function submit(systemId, baseVersion) {
    return observeUsageOperation('custom_system_saved', { featureId: 'system_submission', action: 'submit', systemType: systemId, systemOrigin: 'custom' },
      () => submitPackageUnobserved(exportPackage(systemId), baseVersion));
  }

  /** Submit an already validated revision package with its fixed published baseline. */
  async function submitPackage(input, baseVersion) {
    return observeUsageOperation('custom_system_saved', { featureId: 'system_submission', action: 'submit' }, () => submitPackageUnobserved(input, baseVersion));
  }

  /** Upload one validated package; analytics never receives its contents or staff credential. */
  async function submitPackageUnobserved(input, baseVersion) {
    const token = readToken();
    if (!token) throw Object.assign(new Error('请先在 Agent 设置中填写员工提交令牌'), { code: 'SYSTEM_SUBMISSION_TOKEN_REQUIRED' });
    const body = JSON.stringify({ package: input,
      ...(baseVersion === undefined ? {} : { baseVersion }) });
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
        const messages = {
          SYSTEM_ID_ALREADY_PUBLISHED: `系统 ID 已属于已发布版本 #${result.currentVersion}；确认是更新后再提交，或为新系统更换 ID`,
          SYSTEM_ID_INCOMPATIBLE: '系统类型或原生来源与已发布系统不同，请为新系统使用新 ID',
          SYSTEM_ID_PENDING: `此 ID 已有待审核提交 #${result.pendingId}，请先处理该版本`,
          SYSTEM_ID_BUSY: '同一系统 ID 正在被其他人提交，请稍后重试',
          SUBMISSION_TOKEN_INVALID: '员工提交令牌已失效，请在管理网站重新签发',
        };
        throw Object.assign(new Error(messages[result.error] || result.error || `提交审核失败（HTTP ${response.status}）`), {
          code: result.error || 'SYSTEM_SUBMISSION_FAILED', currentVersion: result.currentVersion,
          httpStatus: response.status === 409 ? 409 : 400,
        });
      }
      return { id: result.id, status: result.status, systemId: input.systemId };
    } catch (error) {
      if (error.name === 'AbortError') throw Object.assign(new Error('提交审核超时，请到管理网站核对是否已收到，避免重复提交'), { code: 'SYSTEM_SUBMISSION_TIMEOUT' });
      throw error;
    } finally { clearTimeout(timeout); }
  }

  /** Read staff-visible published versions without exposing the bearer token to the UI. */
  async function listReleases() {
    const result = await getStaffJson('/api/system-packages/staff/releases');
    if (!Array.isArray(result.releases)) throw Object.assign(new Error('公司系统版本目录格式无效'), { code: 'SYSTEM_RELEASE_RESPONSE_INVALID' });
    return { releases: result.releases };
  }

  /** Fetch one immutable published package for a local revision draft. */
  async function getRelease(systemId, version) {
    if (!SAFE_ID.test(systemId || '') || !Number.isSafeInteger(version) || version < 1) {
      throw Object.assign(new Error('请选择有效的已发布系统版本'), { code: 'SYSTEM_RELEASE_INVALID' });
    }
    return getStaffJson(`/api/system-packages/staff/releases/${encodeURIComponent(systemId)}/${version}`);
  }

  /** Make a bounded staff GET request; HTML/error bodies never reach the revision editor. */
  async function getStaffJson(route) {
    const token = readToken();
    if (!token) throw Object.assign(new Error('请先在 Agent 设置中填写员工提交令牌'), { code: 'SYSTEM_SUBMISSION_TOKEN_REQUIRED' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetchImpl(new URL(route, endpoint), {
        headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
      });
      const contentType = response.headers?.get?.('content-type') || '';
      if (contentType && !contentType.toLowerCase().includes('application/json')) {
        throw Object.assign(new Error('公司系统服务尚未就绪，请联系管理员更新服务器后重试'), { code: 'SYSTEM_SUBMISSION_SERVICE_UNAVAILABLE' });
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const messages = { SUBMISSION_TOKEN_INVALID: '员工提交令牌已失效，请在管理网站重新签发', RELEASE_NOT_FOUND: '该已发布版本不存在或已撤回，请刷新公司系统库' };
        throw Object.assign(new Error(messages[body.error] || body.message || `读取公司系统失败（HTTP ${response.status}）`), {
          code: body.error || 'SYSTEM_RELEASE_REQUEST_FAILED', httpStatus: response.status,
        });
      }
      return body;
    } catch (error) {
      if (error.name === 'AbortError') throw Object.assign(new Error('读取公司系统超时，请稍后重试'), { code: 'SYSTEM_RELEASE_TIMEOUT' });
      throw error;
    } finally { clearTimeout(timeout); }
  }

  return { status, save, clear, submit, submitPackage, listReleases, getRelease };
}

module.exports = { createStaffPackageSubmission };
