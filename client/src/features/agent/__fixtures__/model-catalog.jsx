import React from 'react';
import { createRoot } from 'react-dom/client';
import AgentWorkspace from '../AgentWorkspace';
import DEFAULT_CATALOG from '../../../../../shared/agent-model-catalog.json';

// 独立夹具只使用内存目录、连接和合成密钥，不调用任何真实模型或授权服务。
const listeners = new Set();
const controls = { delay: 0, fail: false, result: { ...DEFAULT_CATALOG, source: 'remote', updatedAt: 1 } };
const calls = [];
const snapshot = { settings: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-5-mini', hasApiKey: true },
  conversation: { id: 'catalog-fixture', messages: [], tasks: [] }, attachments: [], activeTask: null };

/** 模拟跨进程复制，避免组件修改测试控制对象。 */
function copy(value) { return JSON.parse(JSON.stringify(value)); }

/** 仅调整下一次目录请求，不改变表单已保存连接。 */
window.__modelCatalogControl = (patch) => Object.assign(controls, patch);
/** 读取合成桥调用，确认目录更新没有隐式保存连接。 */
window.__modelCatalogState = () => copy({ calls, settings: snapshot.settings });
const bridge = {
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  /** 使用内存响应实现桌面桥，不发送模型请求或读取本机密钥。 */
  async invoke(action, payload = {}) {
    calls.push({ action, payload: copy(payload) });
    if (action === 'getState') return { ok: true, data: copy(snapshot) };
    if (action === 'getModelCatalog') {
      const pending = copy(controls);
      if (pending.delay) await new Promise((resolve) => setTimeout(resolve, pending.delay));
      return pending.fail ? { ok: false, error: { message: '合成目录服务暂不可用' } } : { ok: true, data: pending.result };
    }
    if (action === 'saveSettings') {
      snapshot.settings = { baseUrl: payload.baseUrl, model: payload.model, hasApiKey: Boolean(payload.apiKey || snapshot.settings.hasApiKey) };
      listeners.forEach((listener) => listener({ type: 'state', state: copy(snapshot) }));
      return { ok: true, data: copy(snapshot.settings) };
    }
    return { ok: true, data: {} };
  },
};

createRoot(document.getElementById('root')).render(<AgentWorkspace bridge={bridge} initiallyOpen />);
