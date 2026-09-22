const path = require('path');
const { normalizeModelSettings } = require('../../backend/agent-runtime/provider');
const { readJson, writeJsonAtomic } = require('../../backend/agent-runtime/storage');
const { agentError } = require('../../backend/agent-runtime/errors');

/** 通过操作系统加密保存模型密钥，只向界面返回是否已配置。 */
function createAgentSettings({ root, safeStorage }) {
  const file = path.join(root, 'settings.json');
  let saved = readJson(file, { baseUrl: 'https://api.openai.com/v1', model: '' }, 64000);
  let secret = '', warning = '';
  if (saved.encryptedApiKey) {
    try { secret = safeStorage.decryptString(Buffer.from(saved.encryptedApiKey, 'base64')); }
    catch { warning = '当前系统无法解密保存的密钥，请重新填写。'; }
  }

  /** 读取不含凭据的连接状态。 */
  function getPublic() {
    return { ...normalizeModelSettings(saved), hasApiKey: Boolean(secret), ...(warning ? { warning } : {}) };
  }

  /** 主进程和专用 Agent 子进程之间使用的内存凭据。 */
  function getPrivate() { return { ...normalizeModelSettings(saved), apiKey: secret }; }

  /** 保存设置；切换服务地址时不会沿用旧服务的密钥。 */
  function save(input = {}) {
    const normalized = normalizeModelSettings(input);
    if (input.apiKey !== undefined && (typeof input.apiKey !== 'string' || input.apiKey.length > 8192 || /[\r\n]/.test(input.apiKey))) {
      throw agentError('AGENT_SETTINGS_INVALID', 'API 密钥格式无效。');
    }
    let nextSecret = normalized.baseUrl === getPublic().baseUrl ? secret : '';
    if (input.apiKey?.trim()) nextSecret = input.apiKey.trim();
    if (input.clearApiKey === true) nextSecret = '';
    let encryptedApiKey;
    if (nextSecret) {
      if (!safeStorage.isEncryptionAvailable() || safeStorage.getSelectedStorageBackend?.() === 'basic_text') {
        throw agentError('AGENT_ENCRYPTION_UNAVAILABLE', '系统安全存储不可用，无法保存 API 密钥。');
      }
      encryptedApiKey = safeStorage.encryptString(nextSecret).toString('base64');
    }
    const next = { ...normalized, ...(encryptedApiKey ? { encryptedApiKey } : {}) };
    writeJsonAtomic(file, next);
    saved = next; secret = nextSecret; warning = '';
    return getPublic();
  }

  return { getPublic, getPrivate, save };
}

module.exports = { createAgentSettings };
