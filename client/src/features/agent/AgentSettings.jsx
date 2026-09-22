import React, { useRef, useState } from 'react';
import { DEFAULT_AGENT_SETTINGS, agentErrorMessage } from './agentState';

// 常用模型预设；实际调用权限由 API 账户决定，未列出的模型可手动填写。
const OPENAI_MODELS = [
  { value: 'gpt-5-mini', label: 'GPT-5 mini' },
  { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
  { value: 'gpt-5.4', label: 'GPT-5.4' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
];
// 用户当前服务商提供的 Codex 模型 ID；此清单不代表其他服务的可用模型。
const CODEX_MODELS = [
  { value: 'gpt-6-astra', label: 'ChatGPT-6-Astra' },
  { value: 'gpt-5.6-sol', label: 'ChatGPT-5.6-Sol' },
  { value: 'gpt-5.6-terra', label: 'ChatGPT-5.6-Terra' },
  { value: 'gpt-5.5', label: 'ChatGPT-5.5' },
  { value: 'gpt-5.5-openai-compact', label: 'ChatGPT-5.5-OpenAI-Compact' },
];

/** 编辑模型连接；密钥只存在于输入框生命周期并通过桌面桥提交。 */
export default function AgentSettings({ settings = DEFAULT_AGENT_SETTINGS, onSave, onClose, disabled }) {
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl || DEFAULT_AGENT_SETTINGS.baseUrl);
  const initialModel = settings.model?.trim() || 'gpt-5-mini';
  const isPreset = [...CODEX_MODELS, ...OPENAI_MODELS].some((option) => option.value === initialModel);
  const [modelChoice, setModelChoice] = useState(isPreset ? initialModel : 'custom');
  const [customModel, setCustomModel] = useState(isPreset ? '' : initialModel);
  const model = modelChoice === 'custom' ? customModel : modelChoice;
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef(null);

  /** 校验必要字段后提交设置，失败时保持表单方便修正。 */
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!model.trim()) { setError('请输入要使用的模型名称。'); return; }
    setSaving(true);
    try {
      await onSave({ baseUrl: baseUrl.trim(), model: model.trim(), ...(apiKey ? { apiKey } : {}) });
      setApiKey('');
      onClose();
    } catch (cause) {
      setError(agentErrorMessage(cause));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { setSaving(false); }
  };

  return <section className="shroom-agent-settings" aria-labelledby="shroom-agent-settings-title">
    <div className="shroom-agent-section-heading"><h3 id="shroom-agent-settings-title">模型连接</h3><button type="button" onClick={onClose}>返回对话</button></div>
    <p className="shroom-agent-hint">填写支持 Responses API 和工具调用的模型服务。密钥不会写入聊天记录或浏览器存储。</p>
    <form onSubmit={submit}>
      <label htmlFor="shroom-agent-base-url">服务地址</label>
      <input id="shroom-agent-base-url" type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} required disabled={saving || disabled} autoFocus autoComplete="url" spellCheck={false} />
      <label htmlFor="shroom-agent-model">模型名称</label>
      <select id="shroom-agent-model" value={modelChoice} onChange={(event) => setModelChoice(event.target.value)} disabled={saving || disabled} aria-describedby="shroom-agent-model-hint">
        <optgroup label="Codex（RelaxyCode）">
          {CODEX_MODELS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </optgroup>
        <optgroup label="OpenAI">
          {OPENAI_MODELS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </optgroup>
        <option value="custom">其他模型（手动填写）</option>
      </select>
      {modelChoice === 'custom' && <>
        <label htmlFor="shroom-agent-custom-model">自定义模型 ID</label>
        <input id="shroom-agent-custom-model" value={customModel} onChange={(event) => setCustomModel(event.target.value)} required disabled={saving || disabled} placeholder="填写服务商提供的模型 ID" autoComplete="off" spellCheck={false} />
      </>}
      <p id="shroom-agent-model-hint" className="shroom-agent-hint">按所用服务选择模型，或手动填写模型 ID。可用模型以当前 API 密钥所属分组的授权为准。</p>
      <label htmlFor="shroom-agent-api-key">API 密钥{settings.hasApiKey && <span> · 已配置</span>}</label>
      <input id="shroom-agent-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={saving || disabled}
        placeholder={settings.hasApiKey ? '留空以保留当前密钥' : '输入 API 密钥'} autoComplete="off" spellCheck={false} aria-describedby="shroom-agent-key-hint" />
      <p id="shroom-agent-key-hint" className="shroom-agent-hint">密钥由系统加密保存在本机。更换服务地址时需要重新填写密钥。</p>
      {error && <p className="shroom-agent-inline-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
      <button className="shroom-agent-primary" type="submit" disabled={saving || disabled}>{saving ? '正在保存…' : '保存连接设置'}</button>
    </form>
  </section>;
}
