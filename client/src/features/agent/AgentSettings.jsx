import { useTranslation } from 'react-i18next';
import { agentUiText as tr, agentUiMessage, agentKnownLabel } from './agentUi';
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
  useTranslation();
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
      if (!Array.isArray(result?.providers) || !result.providers.some((item) => item.id === 'custom')) throw new Error(tr('catalogUnavailable'));
      setCatalog(result);
      setCatalogWarning(result.warning || '');
    } catch {
      if (catalogRequest.current === request) setCatalogWarning({ key: 'catalogFallback' });
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
    if (!model.trim()) { setError({ key: 'modelRequired' }); return; }
    if (!apiKey.trim() && !hasCurrentKey) { setError({ key: 'providerKeyRequired' }); return; }
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
    <div className="shroom-agent-section-heading"><h3 id="shroom-agent-settings-title">{tr('modelConnection')}</h3><button type="button" onClick={onClose}>{tr('backConversation')}</button></div>
    <p className="shroom-agent-hint">{tr('modelRequirements')}</p>
    <div className="shroom-agent-section-heading"><span>{tr('availableModels')}</span><button type="button" onClick={() => loadCatalog(true)} disabled={catalogLoading || !onLoadModelCatalog || saving || disabled}>{catalogLoading ? tr('refreshing') : tr('refreshModels')}</button></div>
    <p className="shroom-agent-hint" role="status">{catalogLoading ? tr('loadingModels') : catalog.source === 'remote' ? tr('catalogRemote') : catalog.source === 'cache' ? tr('catalogCache') : tr('catalogBuiltIn')}{catalogWarning && <> {agentUiMessage(catalogWarning)}</>}</p>
    <form onSubmit={submit}>
      <label htmlFor="shroom-agent-provider">{tr('provider')}</label>
      <select id="shroom-agent-provider" value={provider} onChange={(event) => changeProvider(event.target.value)} disabled={saving || disabled}>
        {catalog.providers.map((item) => <option key={item.id} value={item.id}>{agentKnownLabel(item.label)}</option>)}
      </select>
      <label htmlFor="shroom-agent-base-url">{tr('baseUrl')}</label>
      <input id="shroom-agent-base-url" type="url" value={baseUrl} onChange={(event) => { setProviderChoice('custom'); setBaseUrl(event.target.value); setApiKey(''); }} required readOnly={provider !== 'custom'} disabled={saving || disabled} autoComplete="url" spellCheck={false} />
      <label htmlFor="shroom-agent-model">{tr('modelName')}</label>
      <select id="shroom-agent-model" value={modelChoice} onChange={(event) => { setManualModel(event.target.value === 'custom'); if (event.target.value !== 'custom') setModel(event.target.value); }} disabled={saving || disabled} aria-describedby="shroom-agent-model-hint">
        {providerInfo.models.map((option) => <option key={option.id} value={option.id}>{agentKnownLabel(option.label)}</option>)}
        <option value="custom">{tr('otherModel')}</option>
      </select>
      {modelChoice === 'custom' && <>
        <label htmlFor="shroom-agent-custom-model">{tr('customModel')}</label>
        <input id="shroom-agent-custom-model" value={model} onChange={(event) => setModel(event.target.value)} required disabled={saving || disabled} placeholder={tr('modelPlaceholder')} autoComplete="off" spellCheck={false} />
      </>}
      <p id="shroom-agent-model-hint" className="shroom-agent-hint">{tr('modelHint')}</p>
      {providerInfo.hint && <p className="shroom-agent-hint">{agentKnownLabel(providerInfo.hint)}</p>}
      <label htmlFor="shroom-agent-api-key">{tr('apiKey')}{hasCurrentKey && <span>{tr('configured')}</span>}</label>
      <input id="shroom-agent-api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} disabled={saving || disabled}
        placeholder={hasCurrentKey ? tr('keepKey') : tr('keyPlaceholder')} autoComplete="off" spellCheck={false} aria-describedby="shroom-agent-key-hint" />
      <p id="shroom-agent-key-hint" className="shroom-agent-hint">{tr('keyHint')}</p>
      {error && <p className="shroom-agent-inline-error" role="alert" tabIndex={-1} ref={errorRef}>{agentUiMessage(error)}</p>}
      <button className="shroom-agent-primary" type="submit" disabled={saving || disabled}>{saving ? tr('saving') : tr('saveConnection')}</button>
    </form>
    <AgentSyncSettings sync={chatSync} onSave={onSaveSync} onRetry={onRetrySync} onClear={onClearSync} onRestore={onRestoreSync} />
    <AgentSystemSubmissionSettings />
  </section>;
}
