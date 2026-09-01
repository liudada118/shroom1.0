/**
 * 展示系统写接口的前端客户端。
 *
 * 只有两个动作：把草稿层固化进自己的 manifest（保存），或者复制成一个新模块
 * （另存为）。Builder 那条 `POST /api/display-systems` 不在这里 —— 它写的是
 * 整份 manifest，调用方只有 Builder 一个，就留在那个文件里。
 */

import {
  normalizeAgentRendererApps,
  resolveAgentRendererEntryUrl,
} from './agentRendererBridge.js';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:19245';

/**
 * 展示系统写接口的错误。
 *
 * 带 `code` 是因为调用方要按错误类型给不同的提示：`DISPLAY_SYSTEM_READ_ONLY`
 * 该说"这是自带展示系统，请用另存为"，`DISPLAY_SYSTEM_EXISTS` 该说"换个名字"，
 * 两者都不是"参数有误"。
 */
export class DisplaySystemApiError extends Error {
  constructor(message, { code = 'DISPLAY_SYSTEM_REQUEST_FAILED', status = 0, details = [] } = {}) {
    super(message);
    this.name = 'DisplaySystemApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function requestJson(path, options) {
  const requestOptions = options || {};
  const headers = requestOptions.body
    ? { 'content-type': 'application/json', ...(requestOptions.headers || {}) }
    : requestOptions.headers;
  const response = await fetch(`${API_BASE}${path}`, {
    ...requestOptions,
    ...(headers ? { headers } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(payload.details) ? payload.details : [];
    throw new DisplaySystemApiError(
      `${payload.error || payload.msg || payload.message || `HTTP ${response.status}`}${details.length ? `：${details.join('；')}` : ''}`,
      { code: payload.code, status: response.status, details },
    );
  }
  return payload;
}

/**
 * 读取可作为展示系统渲染器的 Agent 应用。HttpResult 在桥接 helper 中统一解包；相对
 * entryUrl 必须以控制后端为基准，不能错误地落到 Vite/Electron 页面自身。
 */
export async function listAgentRendererApps() {
  const payload = await requestJson('/api/agent-apps');
  return normalizeAgentRendererApps(payload).flatMap((app) => {
    const entryUrl = resolveAgentRendererEntryUrl(app.entryUrl, `${API_BASE}/`, app.appId);
    return entryUrl ? [{ ...app, entryUrl, apiBase: API_BASE }] : [];
  });
}

/**
 * 把草稿层的三段写进这个展示系统自己的 manifest（保存）。
 *
 * @param {string} id 展示系统 id。
 * @param {{canvas?: object, chartAppearance?: object, chartCards?: object[]}} patch 要写入的三段。
 * @returns {Promise<object>} 后端返回的 `result`。
 */
export async function saveDisplaySection(id, patch) {
  const payload = await requestJson(
    `/api/display-systems/${encodeURIComponent(id)}/display`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
  return payload?.result || null;
}

/**
 * 把整个展示系统目录复制成一个新模块，并写进草稿层的三段（另存为）。
 *
 * @param {string} id 源展示系统 id。
 * @param {{id: string, name?: string, canvas?: object, chartAppearance?: object,
 *          chartCards?: object[]}} options 新模块的身份与要写入的三段。
 * @returns {Promise<object>} 后端返回的 `result`。
 */
export async function duplicateDisplaySystem(id, options) {
  const payload = await requestJson(
    `/api/display-systems/${encodeURIComponent(id)}/duplicate`,
    { method: 'POST', body: JSON.stringify(options) },
  );
  return payload?.result || null;
}
