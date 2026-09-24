import React, { useRef, useState } from 'react';
import { DEFAULT_AGENT_SETTINGS, agentErrorMessage } from './agentState';
import AgentSyncSettings from './AgentSyncSettings';

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
const DEEPSEEK_MODELS = [
  { value: 'deepseek-flash', label: 'DeepSeek Flash' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
];
const OFFICIAL_URLS = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
};

/** 从已保存地址识别官方服务，其他地址保留为自定义连接。 */
function providerFromUrl(value) {
  const normalized = String(value || '').replace(/\/+$/, '');
  return Object.keys(OFFICIAL_URLS).find((provider) => OFFICIAL_URLS[provider] === normalized) || 'custom';
}

/** 只给当前服务商显示适合的模型预设，仍允许手动输入其他 ID。 */
function modelGroupsFor(provider) {
  if (provider === 'deepseek') return [{ label: 'DeepSeek 官方', models: DEEPSEEK_MODELS }];
  if (provider === 'openai') return [{ label: 'OpenAI', models: OPENAI_MODELS }];
  return [
    { label: 'Codex（RelaxyCode）', models: CODEX_MODELS },
    { label: 'OpenAI 兼容模型', models: OPENAI_MODELS },
    { label: 'DeepSeek 兼容模型', models: DEEPSEEK_MODELS },
  ];
}

/** 编辑模型连接；密钥只存在于输入框生命周期并通过桌面桥提交。 */
export default function AgentSettings({ settings = DEFAULT_AGENT_SETTINGS, onSave, onClose, disabled, chatSync, onSaveSync, onRetrySync }) {
  const initialBaseUrl = settings.baseUrl || DEFAULT_AGENT_SETTINGS.baseUrl;
  const initialProvider = providerFromUrl(initialBaseUrl);
  const [provider, setProvider] = useState(initialProvider);
  const [customBaseUrl, setCustomBaseUrl] = useState(initialProvider === 'custom' ? initialBaseUrl : '');
  const baseUrl = provider === 'custom' ? customBaseUrl : OFFICIAL_URLS[provider];
  const initialModel = settings.model?.trim() || (initialProvider === 'deepseek' ? 'deepseek-flash' : 'gpt-5-mini');
  const isPreset = modelGroupsFor(initialProvider).some((group) => group.models.some((option) => option.value === initialModel));
  const [modelChoice, setModelChoice] = useState(isPreset ? initialModel : 'custom');
  const [customModel, setCustomModel] = useState(isPreset ? '' : initialModel);
  const previousModels = useRef({ [initialProvider]: initialModel });
  const model = modelChoice === 'custom' ? customModel : modelChoice;
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef(null);
  const hasCurrentKey = Boolean(settings.hasApiKey && providerFromUrl(settings.baseUrl) === provider
    && String(settings.baseUrl || '').replace(/\/+$/, '') === baseUrl.trim().replace(/\/+$/, ''));

  /** 切换服务商时回填官方地址，并恢复该服务商在本次表单中的模型选择。 */
  const changeProvider = (nextProvider) => {
    previousModels.current[provider] = model;
    const nextModel = previousModels.current[nextProvider]
      || (nextProvider === 'deepseek' ? 'deepseek-flash' : nextProvider === 'openai' ? 'gpt-5-mini' : 'gpt-6-astra');
    const preset = modelGroupsFor(nextProvider).some((group) => group.models.some((option) => option.value === nextModel));
    setProvider(nextProvider);
    setModelChoice(preset ? nextModel : 'custom');
    setCustomModel(preset ? '' : nextModel);
    setApiKey('');
    setError('');
  };

  /** 校验必要字段后提交设置，失败时保持表单方便修正。 */
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!model.trim()) { setError('请输入要使用的模型名称。'); return; }
    if (!apiKey.trim() && !hasCurrentKey) { setError('切换模型服务后，请填写该服务商的 API 密钥。'); return; }
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
    <p className="shroom-agent-hint">DeepSeek 官方直连使用 Responses API 和工具调用。密钥不会写入聊天记录或浏览器存储。</p>
    <form onSubmit={submit}>
      <label htmlFor="shroom-agent-provider">模型服务商</label>
      <select id="shroom-agent-provider" value={provider} onChange={(event) => changeProvider(event.target.value)} disabled={saving || disabled}>
        <option value="deepseek">DeepSeek 官方 API</option>
        <option value="openai">OpenAI 官方 API</option>
        <option value="custom">自定义地址／中转站</option>
      </select>
      <label htmlFor="shroom-agent-base-url">服务地址</label>
      <input id="shroom-agent-base-url" type="url" value={baseUrl} onChange={(event) => setCustomBaseUrl(event.target.value)} required readOnly={provider !== 'custom'} disabled={saving || disabled} autoComplete="url" spellCheck={false} />
      <label htmlFor="shroom-agent-model">模型名称</label>
      <select id="shroom-agent-model" value={modelChoice} onChange={(event) => setModelChoice(event.target.value)} disabled={saving || disabled} aria-describedby="shroom-agent-model-hint">
        {modelGroupsFor(provider).map((group) => <optgroup key={group.label} label={group.label}>
          {group.models.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </optgroup>)}
        <option value="custom">其他模型（手动填写）</option>
      </select>
      {modelChoice === 'custom' && <>
        <label htmlFor="shroom-agent-custom-model">自定义模型 ID</label>
        <input id="shroom-agent-custom-model" value={customModel} onChange={(event) => setCustomModel(event.target.value)} required disabled={saving || disabled} placeholder="填写服务商提供的模型 ID" autoComplete="off" spellCheck={false} />
      </>}
      <p id="shroom-agent-model-hint" className="shroom-agent-hint">按所用服务选择模型，或手动填写模型 ID。可用模型以当前 API 密钥所属分组的授权为准。</p>
      {provider === 'deepseek' && <p className="shroom-agent-hint">图片任务请选择 DeepSeek Flash；V4 Pro 官方暂不支持图片输入。</p>}
      <label htmlFor="shroom-agent-api-key">API 密钥{hasCurrentKey && <span> · 已配置</span>}</label>
      <input id="shroom-agent-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={saving || disabled}
        placeholder={hasCurrentKey ? '留空以保留当前密钥' : '输入当前服务商的 API 密钥'} autoComplete="off" spellCheck={false} aria-describedby="shroom-agent-key-hint" />
      <p id="shroom-agent-key-hint" className="shroom-agent-hint">首次使用请填写自己的密钥。密钥由系统加密保存在本机，同一电脑和账号升级后继续保留；更换服务地址时需要重新填写。</p>
      {error && <p className="shroom-agent-inline-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
      <button className="shroom-agent-primary" type="submit" disabled={saving || disabled}>{saving ? '正在保存…' : '保存连接设置'}</button>
    </form>
    <AgentSyncSettings sync={chatSync} onSave={onSaveSync} onRetry={onRetrySync} />
  </section>;
}
