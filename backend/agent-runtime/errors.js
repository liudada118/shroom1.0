/** 创建稳定的 Agent 错误，供桌面桥和工具统一报告。 */
function agentError(code, message) {
  return Object.assign(new Error(message), { code });
}

/** 移除凭据及过长细节，避免上游错误回显密钥。 */
function publicError(error, secrets = []) {
  let message = String(error?.message || 'Agent 操作失败');
  for (const secret of secrets.filter(Boolean)) message = message.split(secret).join('[已隐藏]');
  message = message.replace(/Bearer\s+\S+/gi, 'Bearer [已隐藏]').replace(/sk-[\w-]{8,}/g, '[已隐藏]');
  return { code: String(error?.code || 'AGENT_ERROR').slice(0,80), message: message.slice(0,1000) };
}

module.exports = { agentError, publicError };
