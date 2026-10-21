import React, { useCallback, useEffect, useRef, useState } from 'react';
import DEFAULT_MODEL_CATALOG from '../../../../shared/agent-model-catalog.json';
import { DEFAULT_AGENT_SETTINGS, agentErrorMessage } from './agentState';
import AgentSyncSettings from './AgentSyncSettings';
import AgentSystemSubmissionSettings from './AgentSystemSubmissionSettings';

/** 比较连接地址时忽略结尾斜杠，不改写用户实际填写的地址。 */
function normalizedUrl(value) { return String(value || '').trim().replace(/\/+$/, ''); }

/** 只按完整地址识别目录服务，未登记的当前连接继续作为自定义地址。 */
function providerFromUrl(value, providers) {
  return providers.find((provider) => provider.id !== 'custom' && normalizedUrl(provider.baseUrl) === normalizedUrl(value))?.id || 'custom';
}

/** 编辑模型连接；目录刷新只改变选项，地址、模型和密钥保持当前表单值。 */
export default function AgentSettings({ settings = DEFAULT_AGENT_SETTINGS, onSave, onClose, disabled, onLoadModelCatalog, chatSync, onSaveSync, onRetrySync, onClearSync, onRestoreSync }) {
  const [catalog, setCatalog] = useState({ ...DEFAULT_MODEL_CATALOG, source: 'default', updatedAt: null });
  const initialBaseUrl = settings.baseUrl || DEFAULT_AGENT_SETTINGS.baseUrl;
  const initialProvider = DEFAULT_MODEL_CATALOG.providers.find((item) => item.id === providerFromUrl(initialBaseUrl, DEFAULT_MODEL_CATALOG.providers));
  const [providerChoice, setProviderChoice] = useState(null);
  const [baseUrl, setBaseUrl] = useState(initialBaseUrl);
  const [model, setModel] = useState(settings.model?.trim() || initialProvider.defaultModel);
  const [manualModel, setManualModel] = useState(false);
  const previousModels = useRef({});
  const previousCustomUrl = useRef(initialProvider.id === 'custom' ? initialBaseUrl : '');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogWarning, setCatalogWarning] = useState('');
  const catalogRequest = useRef(0);
  const errorRef = useRef(null);
  const matchedProvider = providerFromUrl(baseUrl, catalog.providers);
  const provider = providerChoice === 'custom' ? 'custom'
    : providerChoice && catalog.providers.some((item) => item.id === providerChoice && normalizedUrl(item.baseUrl) === normalizedUrl(baseUrl)) ? providerChoice
      : providerChoice ? 'custom' : matchedProvider;
  const providerInfo = catalog.providers.find((item) => item.id === provider);
  const isPreset = providerInfo.models.some((option) => option.id === model);
  const modelChoice = manualModel || !isPreset ? 'custom' : model;
  const hasCurrentKey = Boolean(settings.hasApiKey && normalizedUrl(settings.baseUrl) === normalizedUrl(baseUrl));

  /** 后台读取公共模型目录，不提交当前连接或密钥，也不触发设置保存。 */
  const loadCatalog = useCallback(async (refresh = false) => {
    if (!onLoadModelCatalog) return;
    const request = ++catalogRequest.current;
    setCatalogLoading(true);
    setCatalogWarning('');
    try {
      const result = await onLoadModelCatalog({ refresh });
      if (catalogRequest.current !== request) return;
      if (!Array.isArray(result?.providers) || !result.providers.some((item) => item.id === 'custom')) throw new Error('目录不可用');
      setCatalog(result);
      setCatalogWarning(result.warning || '');
    } catch {
      if (catalogRequest.current === request) setCatalogWarning('模型目录暂时无法更新，仍可使用现有选项或手动填写。');
    } finally {
      if (catalogRequest.current === request) setCatalogLoading(false);
    }
  }, [onLoadModelCatalog]);

  useEffect(() => {
    void loadCatalog();
    return () => { catalogRequest.current += 1; };
  }, [loadCatalog]);

  /** 显式切换服务时才回填目录地址，并清空尚未保存的密钥。 */
  const changeProvider = (nextProvider) => {
    const nextInfo = catalog.providers.find((item) => item.id === nextProvider);
    if (!nextInfo) return;
    previousModels.current[`${provider}:${normalizedUrl(baseUrl)}`] = model;
    if (provider === 'custom') previousCustomUrl.current = baseUrl;
    const nextUrl = nextProvider === 'custom' ? previousCustomUrl.current : nextInfo.baseUrl;
    setProviderChoice(nextProvider);
    setBaseUrl(nextUrl);
    setModel(previousModels.current[`${nextProvider}:${normalizedUrl(nextUrl)}`] || nextInfo.defaultModel);
    setManualModel(false);
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
    <p className="shroom-agent-hint">模型服务需支持 Responses API 和工具调用。密钥不会写入聊天记录或浏览器存储。</p>
    <div className="shroom-agent-section-heading"><span>可用服务与模型</span><button type="button" onClick={() => loadCatalog(true)} disabled={catalogLoading || !onLoadModelCatalog || saving || disabled}>{catalogLoading ? '正在刷新…' : '刷新模型列表'}</button></div>
    <p className="shroom-agent-hint" role="status">{catalogLoading ? '正在读取模型目录…' : catalog.source === 'remote' ? '模型目录已从服务器更新。' : catalog.source === 'cache' ? '使用本机缓存的模型目录。' : '使用内置模型目录。'}{catalogWarning && ` ${catalogWarning}`}</p>
    <form onSubmit={submit}>
      <label htmlFor="shroom-agent-provider">模型服务商</label>
      <select id="shroom-agent-provider" value={provider} onChange={(event) => changeProvider(event.target.value)} disabled={saving || disabled}>
        {catalog.providers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      <label htmlFor="shroom-agent-base-url">服务地址</label>
      <input id="shroom-agent-base-url" type="url" value={baseUrl} onChange={(event) => { setProviderChoice('custom'); setBaseUrl(event.target.value); setApiKey(''); }} required readOnly={provider !== 'custom'} disabled={saving || disabled} autoComplete="url" spellCheck={false} />
      <label htmlFor="shroom-agent-model">模型名称</label>
      <select id="shroom-agent-model" value={modelChoice} onChange={(event) => { setManualModel(event.target.value === 'custom'); if (event.target.value !== 'custom') setModel(event.target.value); }} disabled={saving || disabled} aria-describedby="shroom-agent-model-hint">
        {providerInfo.models.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        <option value="custom">其他模型（手动填写）</option>
      </select>
      {modelChoice === 'custom' && <>
        <label htmlFor="shroom-agent-custom-model">自定义模型 ID</label>
        <input id="shroom-agent-custom-model" value={model} onChange={(event) => setModel(event.target.value)} required disabled={saving || disabled} placeholder="填写服务商提供的模型 ID" autoComplete="off" spellCheck={false} />
      </>}
      <p id="shroom-agent-model-hint" className="shroom-agent-hint">按所用服务选择模型，或手动填写模型 ID。可用模型以当前 API 密钥所属分组的授权为准。</p>
      {providerInfo.hint && <p className="shroom-agent-hint">{providerInfo.hint}</p>}
      <label htmlFor="shroom-agent-api-key">API 密钥{hasCurrentKey && <span> · 已配置</span>}</label>
      <input id="shroom-agent-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={saving || disabled}
        placeholder={hasCurrentKey ? '留空以保留当前密钥' : '输入当前服务商的 API 密钥'} autoComplete="off" spellCheck={false} aria-describedby="shroom-agent-key-hint" />
      <p id="shroom-agent-key-hint" className="shroom-agent-hint">首次使用请填写自己的密钥。密钥由系统加密保存在本机，同一电脑和账号升级后继续保留；更换服务地址时需要重新填写。</p>
      {error && <p className="shroom-agent-inline-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
      <button className="shroom-agent-primary" type="submit" disabled={saving || disabled}>{saving ? '正在保存…' : '保存连接设置'}</button>
    </form>
    <AgentSyncSettings sync={chatSync} onSave={onSaveSync} onRetry={onRetrySync} onClear={onClearSync} onRestore={onRestoreSync} />
    <AgentSystemSubmissionSettings />
  </section>;
}
