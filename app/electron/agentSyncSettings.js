const path = require('path');
const { readJson, writeJsonAtomic } = require('../../backend/agent-runtime/storage');
const { agentError } = require('../../backend/agent-runtime/errors');
const { normalizeSyncEndpoint } = require('../../backend/agent-runtime/chatSync');

// Only this exact HTTPS endpoint may receive the application's license automatically.
const DEFAULT_CHAT_SYNC_ENDPOINT = 'https://shroom.jq-industries.com/api/agent/conversations';

/** 独立保存聊天上传设置，上传令牌通过本机系统安全存储加密。 */
function createAgentSyncSettings({ root, safeStorage, getLicenseKey = () => '' }) {
  const file = path.join(root, 'sync-settings.json');
  let saved = { enabled: false, endpoint: DEFAULT_CHAT_SYNC_ENDPOINT }, token = '', warning = '';
  try {
    const stored = readJson(file, saved, 64000);
    if (!stored || typeof stored.enabled !== 'boolean' || typeof stored.endpoint !== 'string') throw new Error('invalid');
    const endpoint = normalizeSyncEndpoint(stored.endpoint);
    // ⚠️ 只给未配置的旧设置补默认地址，不能把已有凭据转交给另一个服务器。
    saved = { enabled: stored.enabled, endpoint: endpoint || (!stored.encryptedToken ? DEFAULT_CHAT_SYNC_ENDPOINT : '') };
    if (stored.encryptedToken) {
      if (typeof stored.encryptedToken !== 'string' || !safeStorage.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === 'basic_text') throw new Error('unavailable');
      token = safeStorage.decryptString(Buffer.from(stored.encryptedToken, 'base64'));
      if (typeof token !== 'string' || !token.trim() || token.length > 8192 || /[\x00-\x20\x7f]/.test(token)) throw new Error('invalid');
    }
    if (saved.enabled && (!saved.endpoint || (!token && saved.endpoint !== DEFAULT_CHAT_SYNC_ENDPOINT))) throw new Error('incomplete');
  } catch {
    saved.enabled = false; token = '';
    warning = '聊天上传配置或令牌无法读取，已暂停上传；原文件保留，请重新保存设置。';
  }

  /** 界面只获得启用状态、服务地址和令牌是否存在。 */
  function getPublic() { return { ...saved, hasToken: Boolean(token), licenseAuthAvailable: saved.endpoint === DEFAULT_CHAT_SYNC_ENDPOINT, ...(warning ? { warning } : {}) }; }

  /** 仅向主进程上传器提供解密后的上传令牌。 */
  function getPrivate() {
    if (!token && saved.endpoint === DEFAULT_CHAT_SYNC_ENDPOINT) {
      let license = '';
      try { license = getLicenseKey().trim(); } catch { /* Report a missing license without exposing a local path. */ }
      return { ...saved, token: license, authScheme: 'License' };
    }
    return { ...saved, token, authScheme: 'Bearer' };
  }

  /** 部分更新设置；地址变化清除旧令牌，保存失败保留内存旧配置。 */
  function save(input = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !['enabled', 'endpoint', 'token', 'clearToken'].includes(key))) {
      throw agentError('AGENT_SYNC_SETTINGS_INVALID', '聊天上传设置格式无效。');
    }
    if ((input.enabled !== undefined && typeof input.enabled !== 'boolean') || (input.clearToken !== undefined && typeof input.clearToken !== 'boolean')) {
      throw agentError('AGENT_SYNC_SETTINGS_INVALID', '聊天上传开关格式无效。');
    }
    if (input.token !== undefined && (typeof input.token !== 'string' || input.token.length > 8192 || /[\x00-\x20\x7f]/.test(input.token.trim()))) {
      throw agentError('AGENT_SYNC_SETTINGS_INVALID', '聊天上传令牌格式无效。');
    }
    const endpoint = input.endpoint === undefined ? saved.endpoint : normalizeSyncEndpoint(input.endpoint);
    const enabled = input.enabled === undefined ? saved.enabled : input.enabled;
    let nextToken = endpoint === saved.endpoint ? token : '';
    if (input.token?.trim()) nextToken = input.token.trim();
    if (input.clearToken === true) nextToken = '';
    if (enabled && (!endpoint || (!nextToken && endpoint !== DEFAULT_CHAT_SYNC_ENDPOINT))) throw agentError('AGENT_SYNC_SETTINGS_INVALID', '自定义聊天接口需要独立上传凭证。');
    let encryptedToken;
    if (nextToken) {
      if (!safeStorage.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === 'basic_text') {
        throw agentError('AGENT_ENCRYPTION_UNAVAILABLE', '系统安全存储不可用，无法保存上传令牌。');
      }
      encryptedToken = safeStorage.encryptString(nextToken).toString('base64');
    }
    writeJsonAtomic(file, { enabled, endpoint, ...(encryptedToken ? { encryptedToken } : {}) });
    saved = { enabled, endpoint }; token = nextToken; warning = '';
    return getPublic();
  }

  return { getPublic, getPrivate, save };
}

module.exports = { createAgentSyncSettings, DEFAULT_CHAT_SYNC_ENDPOINT };
