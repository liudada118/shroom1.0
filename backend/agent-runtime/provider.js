const { agentError } = require('./errors');

/** 只按已知网络错误码生成提示，不回显可能包含凭据的底层错误正文。 */
function modelNetworkError(error) {
  const code = error?.cause?.code || error?.code || String(error?.message || '').match(/net::(ERR_[A-Z_]+)/)?.[1];
  if (['ERR_PROXY_CONNECTION_FAILED', 'ERR_TUNNEL_CONNECTION_FAILED', 'ERR_NO_SUPPORTED_PROXIES'].includes(code)) {
    return agentError('AGENT_MODEL_PROXY', '无法通过系统代理连接模型服务，请确认代理已启动且可以访问模型服务地址。');
  }
  if (['ENOTFOUND', 'EAI_AGAIN', 'ERR_NAME_NOT_RESOLVED'].includes(code)) {
    return agentError('AGENT_MODEL_DNS', '无法解析模型服务地址，请检查服务地址、DNS 或系统代理。');
  }
  if (['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_CERT_AUTHORITY_INVALID', 'ERR_CERT_DATE_INVALID', 'ERR_CERT_COMMON_NAME_INVALID'].includes(code)) {
    return agentError('AGENT_MODEL_TLS', '模型服务的安全证书校验失败，请检查系统时间、服务地址或代理证书配置。');
  }
  if (['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'ERR_CONNECTION_TIMED_OUT', 'ERR_TIMED_OUT'].includes(code)) {
    return agentError('AGENT_MODEL_TIMEOUT', '连接模型服务超时，请检查网络及系统代理是否可用。');
  }
  return agentError('AGENT_MODEL_NETWORK', '无法连接模型服务，请检查网络、系统代理和连接设置。');
}

/** 限制模型地址为 HTTPS，或明确的本机开发服务。 */
function normalizeModelSettings(input = {}) {
  let url;
  try { url = new URL(input.baseUrl || 'https://api.openai.com/v1'); }
  catch { throw agentError('AGENT_SETTINGS_INVALID', '请输入有效的模型服务地址。'); }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) {
    throw agentError('AGENT_SETTINGS_INVALID', '模型服务须使用 HTTPS；本机服务可使用 HTTP。地址中不能包含凭据或查询参数。');
  }
  const model = String(input.model || '').trim();
  if (model.length > 120 || /[\r\n\x00-\x1f]/.test(model)) throw agentError('AGENT_SETTINGS_INVALID', '模型名称无效。');
  if (url.href.length > 1000) throw agentError('AGENT_SETTINGS_INVALID', '模型服务地址过长。');
  return { baseUrl: url.href.replace(/\/+$/, ''), model };
}

/** 在官方不支持视觉输入的模型上提前拒绝图片，避免提交注定失败的付费请求。 */
function assertModelInputCompatibility(settings, input) {
  if (String(settings.baseUrl || '').replace(/\/+$/, '') !== 'https://api.deepseek.com'
    || settings.model !== 'deepseek-v4-pro' || !Array.isArray(input)) return;
  const hasImage = input.some((item) => [item?.content, item?.output].some((parts) =>
    Array.isArray(parts) && parts.some((part) => part?.type === 'input_image')));
  if (hasImage) throw agentError('AGENT_MODEL_IMAGE_UNSUPPORTED', 'DeepSeek V4 Pro 官方 API 暂不支持图片输入。请在模型设置中选择 DeepSeek Flash 后重新发送。');
}

/** 保留明确拒答，并拒绝没有文本或工具的空终态。 */
function validateCompletedResponse(response) {
  if (response?.status !== 'completed' || !Array.isArray(response.output)) throw agentError('AGENT_MODEL_RESPONSE', '模型服务没有返回完整 Responses 结果。');
  let meaningful = false;
  for (const item of response.output) {
    if (item.type === 'function_call') {
      if (typeof item.name !== 'string' || typeof item.call_id !== 'string' || typeof item.arguments !== 'string') throw agentError('AGENT_MODEL_RESPONSE', '模型返回的工具调用格式无效。');
      meaningful = true;
    }
    for (const content of Array.isArray(item.content) ? item.content : []) {
      if (content.type === 'refusal') throw agentError('AGENT_MODEL_REFUSAL', String(content.refusal || '模型无法处理此请求，本轮没有执行操作。').slice(0, 1000));
      if (content.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) meaningful = true;
    }
  }
  if (!meaningful) throw agentError('AGENT_MODEL_EMPTY', '模型没有返回回答或可执行工具，请调整请求后重试。');
  return response;
}

/** 从有限大小的响应读取文本，避免错误页或流无限占用内存。 */
async function readBoundedText(response, limit, onActivity = () => {}) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let bytes = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength) onActivity();
      bytes += value.byteLength;
      if (bytes > limit) throw agentError('AGENT_RESPONSE_LIMIT', '模型响应超过大小限制。');
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); }
}

/** 从 JSON 或 SSE 错误事件中提取诊断字段，不把原始正文作为用户提示。 */
function parseModelErrorDetail(text) {
  const payloads = [text, ...text.replace(/\r\n?/g, '\n').split('\n\n').map((block) =>
    block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n'))];
  for (const payload of payloads) {
    try {
      const value = JSON.parse(payload);
      const detail = value?.error || value?.response?.error || (typeof value?.message === 'string' ? value : null);
      if (typeof detail === 'string') return { message: detail };
      if (detail && typeof detail === 'object' && !Array.isArray(detail)) return detail;
    } catch { /* 非 JSON 事件及 [DONE] 不包含可用错误字段。 */ }
  }
  return null;
}

/** 有界读取 JSON/SSE 错误以区分额度、权限和接口问题，不回显上游正文或链接。 */
async function modelHttpError(response, baseUrl, onActivity) {
  let detail;
  try { detail = parseModelErrorDetail(await readBoundedText(response, 16 * 1024, onActivity)); }
  catch { /* 非 JSON、超限或断流仍按原 HTTP 状态提示；取消由请求层处理。 */ }
  const status = response.status;
  if (status === 402) {
    return agentError('AGENT_MODEL_PAYMENT_REQUIRED', '模型服务返回 HTTP 402。请在服务商控制台检查账户余额、当前 API Key 的剩余额度和套餐限制，并查看该请求的失败原因；处理后重试。');
  }
  if ([403, 404].includes(status) && typeof detail?.message === 'string'
    && /organi[sz]ation\s+(?:must be|is not)\s+verified/i.test(detail.message)) {
    const official = new URL(baseUrl).origin === 'https://api.openai.com';
    return agentError('AGENT_MODEL_VERIFICATION', official
      ? '当前 API 组织尚未完成验证，无法使用所选模型。请在 OpenAI 平台「设置 → 组织 → 通用」中点击 Verify Organization；验证完成后权限可能需要最多 15 分钟生效。也可选择当前账户已获授权的其他模型。'
      : '模型服务要求先完成组织验证。请在该服务的账户控制台完成验证后重试，或选择已获授权的其他模型。');
  }
  if (status === 404 && detail?.code === 'model_not_found') {
    return agentError('AGENT_MODEL_NOT_FOUND', '所选模型不存在或当前 API 项目无权使用。请确认模型 ID 和项目权限，或选择该账户已获授权的模型。');
  }
  if (status === 404) {
    return agentError('AGENT_MODEL_ENDPOINT', '模型服务返回 HTTP 404。请确认服务支持 Responses API、API 基础地址填写正确，并检查模型可用性；不要重复填写 /responses。');
  }
  if (status === 403) {
    if (typeof detail?.message === 'string' && /分组[^\r\n。]{0,80}(?:未授权|无权限|无权|不允许)/.test(detail.message)) {
      return agentError('AGENT_MODEL_GROUP_PERMISSION', '当前 API 密钥所属分组未获授权使用所选模型（HTTP 403）。请在服务商控制台核对密钥分组和模型权限，选择该分组支持的模型，或使用有权限的密钥。');
    }
    return agentError('AGENT_MODEL_FORBIDDEN', '模型服务拒绝访问（HTTP 403）。请检查当前 API 密钥的分组、所选模型的调用权限及服务商访问限制。');
  }
  if ([502, 503, 504].includes(status)) {
    return agentError('AGENT_MODEL_UNAVAILABLE', `模型服务暂时不可用（HTTP ${status}）。软件已自动重试，仍未恢复；请稍后再试，持续出现时检查服务商状态。`);
  }
  const message = status === 401 ? '模型密钥无效或无权访问，请检查连接设置。'
    : status === 429 ? '模型服务额度或请求频率受限，请稍后重试。'
      : `模型请求失败（HTTP ${status}），请检查服务地址、模型名称及可用性。`;
  return agentError('AGENT_MODEL_HTTP', message);
}

/** 在瞬时服务错误后等待重试，任务取消或超时会立即中断等待。 */
function waitForModelRetry(delayMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    /** 清除尚未触发的等待定时器。 */
    function onAbort() {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason);
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** 消费 Responses SSE，仅完整终态允许执行其中的工具调用。 */
async function readResponseStream(response, onText = () => {}, onActivity = () => {}) {
  const reader = response.body?.getReader();
  if (!reader) throw agentError('AGENT_MODEL_STREAM', '模型服务没有返回可读取的响应。');
  const decoder = new TextDecoder();
  let buffer = '', received = 0, completed = null;
  /** 解析一个 SSE 事件，保留未知事件的向前兼容性。 */
  function consume(block) {
    const payload = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
    if (!payload || payload === '[DONE]') return;
    let event;
    try { event = JSON.parse(payload); }
    catch { throw agentError('AGENT_MODEL_STREAM', '模型服务返回了无效的流式事件。'); }
    if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') onText(event.delta);
    if (event.type === 'response.completed') completed = event.response;
    if (['error', 'response.failed', 'response.incomplete'].includes(event.type)) {
      throw agentError('AGENT_MODEL_FAILED', '模型请求未完整完成，请检查模型配置或稍后重试。');
    }
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength) onActivity();
      received += value.byteLength;
      if (received > 4 * 1024 * 1024) throw agentError('AGENT_RESPONSE_LIMIT', '模型响应超过大小限制。');
      buffer += decoder.decode(value, { stream: true });
      // 先完整拼接再归一换行，兼容 CR 与 LF 分处两个网络块。
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        consume(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) consume(buffer);
    if (!completed || completed.status !== 'completed' || !Array.isArray(completed.output)) {
      throw agentError('AGENT_MODEL_INTERRUPTED', '模型连接在完成前中断，本轮工具尚未执行。');
    }
    return validateCompletedResponse(completed);
  } finally { await reader.cancel().catch(() => {}); }
}

/** 调用用户配置的 Responses 服务，凭据不进入输出和错误正文。 */
async function requestModelResponse({ settings, input, tools, instructions, signal, onText, fetchImpl = globalThis.fetch, timeoutMs = 240000 }) {
  assertModelInputCompatibility(settings, input);
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  let timer;
  /** 只在连接或响应持续静默时中止；流式活动会重新计时。 */
  function refreshTimeout() {
    if (controller.signal.aborted) return;
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(agentError('AGENT_MODEL_TIMEOUT', '模型服务连续 4 分钟未返回数据，请检查网络、服务地址或所选模型。')), timeoutMs);
  }
  refreshTimeout();
  try {
    const requestBody = JSON.stringify({ model: settings.model, instructions, input, tools, stream: true, store: false,
      include: ['reasoning.encrypted_content'], parallel_tool_calls: false, max_output_tokens: 16000 });
    let response;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetchImpl(`${settings.baseUrl}/responses`, {
        method: 'POST', redirect: 'error', signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${settings.apiKey}` },
        body: requestBody,
      });
      refreshTimeout();
      if (![502, 503, 504].includes(response.status) || attempt === 2) break;
      await response.body?.cancel().catch(() => {});
      await waitForModelRetry(attempt === 0 ? 500 : 1500, controller.signal);
    }
    if (!response.ok) {
      throw await modelHttpError(response, settings.baseUrl, refreshTimeout);
    }
    if (response.headers.get('content-type')?.includes('text/event-stream')) return await readResponseStream(response, onText, refreshTimeout);
    let result;
    try { result = JSON.parse(await readBoundedText(response, 4 * 1024 * 1024, refreshTimeout)); }
    catch (error) { throw error.code ? error : agentError('AGENT_MODEL_RESPONSE', '模型服务返回的响应格式无效。'); }
    validateCompletedResponse(result);
    for (const item of result.output) for (const content of item.content || []) {
      if (content.type === 'output_text') onText?.(content.text || '');
    }
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason || agentError('AGENT_CANCELLED', '任务已停止。');
    if (error.code?.startsWith('AGENT_')) throw error;
    throw modelNetworkError(error);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

module.exports = { normalizeModelSettings, requestModelResponse, readResponseStream, validateCompletedResponse };
