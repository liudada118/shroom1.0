import { useTranslation } from 'react-i18next';
import { agentUiText as tr, agentUiMessage, agentDate } from './agentUi';
import React, { useRef, useState } from 'react';
import { agentErrorMessage } from './agentState';

/** 用明确状态区分本机保存与服务器已接收。 */
export function describeChatSync(sync) {
  if (!sync?.settings?.enabled) return tr('syncDisabled');
  const status = sync.status || {};
  const labels = { syncing: tr('uploading'), retrying: tr('retrying'), blocked: tr('syncBlocked'), error: tr('syncError') };
  if (labels[status.state]) return `${labels[status.state]} · ${tr('pendingConversations', { count: status.pendingCount || 0 })}`;
  if (status.pendingCount) return tr('pendingConversations', { count: status.pendingCount });
  return status.lastSuccessAt ? tr('synced') : tr('waitingChat');
}

/** State the actual destination without rendering a URL that may identify a private server. */
function receiverLabel(endpoint) {
  try { return new URL(endpoint).host; } catch { return tr('receiverMissing'); }
}

/** Give a readable scope before resuming historical pending conversations. */
function pendingRangeLabel(range) {
  if (!range?.count) return tr('noPending');
  const dates = range.oldestAt && range.newestAt && range.newestAt !== range.oldestAt
    ? tr('dateRange', { oldest: agentDate(range.oldestAt), newest: agentDate(range.newestAt) })
    : range.oldestAt ? agentDate(range.oldestAt) : '';
  return `${tr('conversationCount', { count: range.count })}${dates ? ` · ${dates}` : ''}`;
}

/** The notice records awareness separately from the existing default-on upload preference. */
export function ChatUploadNotice({ settings = {}, onAcknowledge, disabled }) {
  useTranslation();
  if (!settings.noticePending) return null;
  return <div className="shroom-agent-inline-notice" role="status">
    <strong>{tr('uploadNotice')}</strong>
    <p>{tr('syncReceiver')}{receiverLabel(settings.endpoint)}。{settings.enabled ? tr('autoSyncOn') : tr('autoSyncOff')}{tr('uploadScope')}</p>
    <button type="button" onClick={onAcknowledge} disabled={disabled || !onAcknowledge}>{tr('acknowledgeScope')}</button>
  </div>;
}

/** 配置独立的聊天留档服务；凭证只提交给桌面主进程。 */
export default function AgentSyncSettings({ sync, onSave, onRetry, onClear, onRestore }) {
  useTranslation();
  const settings = sync?.settings || {};
  const [enabled, setEnabled] = useState(Boolean(settings.enabled));
  const [endpoint, setEndpoint] = useState(settings.endpoint || '');
  const [token, setToken] = useState('');
  const [clearToken, setClearToken] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [advanced, setAdvanced] = useState(Boolean(settings.warning || (settings.endpoint && settings.endpoint !== 'https://shroom.jq-industries.com/api/agent/conversations')));
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [clearConfirmed, setClearConfirmed] = useState(false);
  const actionLock = useRef(false);
  const errorRef = useRef(null);
  const savedTokenAvailable = settings.hasToken && endpoint.trim() === settings.endpoint && !clearToken;
  const licenseAuthAvailable = endpoint.trim() === 'https://shroom.jq-industries.com/api/agent/conversations';
  const statusError = sync?.status?.lastError?.message;

  /** 保存后保留面板，便于核对上传状态或继续修正接口。 */
  async function submit(event) {
    event.preventDefault();
    if (actionLock.current) return;
    setError(''); setMessage('');
    if (enabled && (!endpoint.trim() || (!token.trim() && !savedTokenAvailable && !licenseAuthAvailable))) {
      setError({ key: 'syncRequired' });
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    actionLock.current = true; setPending(true);
    try {
      await onSave({ enabled, endpoint: endpoint.trim(), ...(token ? { token } : {}), clearToken });
      setToken(''); setClearToken(false);
      setMessage(enabled ? { key: 'syncSaved' } : { key: 'syncPaused' });
    } catch (cause) {
      setError(agentErrorMessage(cause));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { actionLock.current = false; setPending(false); }
  }

  /** 手动重试只唤醒本地队列，不重复创建聊天消息。 */
  async function retry() {
    if (actionLock.current) return;
    actionLock.current = true; setPending(true); setError(''); setMessage('');
    try { await onRetry(); setMessage({ key: 'retryRequested' }); }
    catch (cause) { setError(agentErrorMessage(cause)); }
    finally { actionLock.current = false; setPending(false); }
  }

  /** Keep destructive queue cleanup and ownership recovery explicit and serialized. */
  async function queueAction(action, input, successMessage) {
    if (actionLock.current) return;
    actionLock.current = true; setPending(true); setError(''); setMessage('');
    try {
      await action(input);
      setMessage(successMessage || (input?.queueId ? { key: 'queueRestored' } : { key: 'queueCleared' }));
      setOwnershipConfirmed(false); setClearConfirmed(false);
    } catch (cause) { setError(agentErrorMessage(cause)); }
    finally { actionLock.current = false; setPending(false); }
  }

  return <section className="shroom-agent-sync-settings" aria-labelledby="shroom-agent-sync-title">
    <h3 id="shroom-agent-sync-title">{tr('chatSync')}</h3>
    <ChatUploadNotice settings={settings} disabled={pending} onAcknowledge={() => queueAction(onSave, { acknowledgeNotice: true }, { key: 'noticeRecorded' })} />
    <p className="shroom-agent-hint" id="shroom-agent-sync-notice">{tr('chatReceiver')}{receiverLabel(settings.endpoint)}。{licenseAuthAvailable ? tr('officialCredential') : tr('customCredential')}{tr('syncScope')}</p>
    <details open={advanced} onToggle={event => setAdvanced(event.currentTarget.open)}>
      <summary>{tr('advancedSync')}</summary>
      <form onSubmit={submit}>
      <label className="shroom-agent-check"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} disabled={pending} aria-describedby="shroom-agent-sync-notice" />{tr('autoSync')}</label>
      <label htmlFor="shroom-agent-sync-endpoint">{tr('serverUrl')}</label>
      <input id="shroom-agent-sync-endpoint" type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} disabled={pending} required={enabled} placeholder={tr('endpointPlaceholder')} autoComplete="off" spellCheck={false} />
      <label htmlFor="shroom-agent-sync-token">{tr('uploadCredential')}{licenseAuthAvailable && <span>{tr('optional')}</span>}{settings.hasToken && <span>{tr('configured')}</span>}</label>
      <input id="shroom-agent-sync-token" type="password" value={token} onChange={(event) => { setToken(event.target.value); setClearToken(false); }} disabled={pending} autoComplete="off" spellCheck={false} placeholder={savedTokenAvailable ? tr('keepToken') : licenseAuthAvailable ? tr('useLicense') : tr('tokenPlaceholder')} />
      <p className="shroom-agent-hint">{licenseAuthAvailable ? tr('licenseHint') : tr('customTokenHint')}</p>
      {settings.hasToken && <label className="shroom-agent-check"><input type="checkbox" checked={clearToken} onChange={(event) => { setClearToken(event.target.checked); if (event.target.checked) { setToken(''); if (!licenseAuthAvailable) setEnabled(false); } }} disabled={pending} />{tr('clearToken')}</label>}
      <button type="submit" className="shroom-agent-primary" disabled={pending || !onSave}>{pending ? tr('processing') : tr('saveSync')}</button>
      </form>
    </details>
    {error && <p role="alert" tabIndex={-1} ref={errorRef} className="shroom-agent-inline-error">{agentUiMessage(error)}</p>}
    {message && <p role="status" className="shroom-agent-hint">{agentUiMessage(message)}</p>}
    <div className="shroom-agent-sync-status" role="status" aria-live="polite">
      <strong>{describeChatSync(sync)}</strong>
      {sync?.status?.unsyncedCount > 0 && <span>{sync.status.unsyncedCount}{tr('unsyncedSuffix')}</span>}
      {sync?.status?.lastSuccessAt && <span>{tr('lastSuccess')}{agentDate(sync.status.lastSuccessAt)}</span>}
      {sync?.status?.nextRetryAt && <span>{tr('nextRetry')}{agentDate(sync.status.nextRetryAt)}</span>}
      {sync?.status?.installationId && <span>{tr('installation')}{sync.status.installationId}</span>}
      <span>{tr('pendingRange')}{pendingRangeLabel(sync?.status?.pendingRange)}</span>
    </div>
    {(statusError || settings.warning) && <p className="shroom-agent-inline-error" role="alert">{statusError || settings.warning}</p>}
    <button type="button" onClick={retry} disabled={pending || !settings.enabled || !onRetry}>{tr('retryNow')}</button>
    <fieldset disabled={pending}>
      <legend>{tr('queue')}</legend>
      <p>{tr('queueHint')}</p>
      <label className="shroom-agent-check"><input type="checkbox" checked={clearConfirmed} onChange={event => setClearConfirmed(event.target.checked)} />{tr('confirmClear')}</label>
      <button type="button" onClick={() => queueAction(onClear, { includeLegacy: true })} disabled={!onClear || !clearConfirmed}>{tr('clearQueue')}</button>
      {sync?.status?.recoverableQueues?.length > 0 && <>
        <p role="status">{tr('otherQueues')}</p>
        <label className="shroom-agent-check"><input type="checkbox" checked={ownershipConfirmed} onChange={event => setOwnershipConfirmed(event.target.checked)} />{tr('confirmOwnership')}</label>
        {sync.status.recoverableQueues.map(item => <div key={item.queueId}>
          <span>{item.legacy ? tr('legacyQueue') : tr('otherQueue')} · {pendingRangeLabel(item)}</span>
          <button type="button" onClick={() => queueAction(onRestore, { queueId: item.queueId, confirmed: true })} disabled={!settings.enabled || !ownershipConfirmed || !onRestore}>{tr('restoreQueue')}</button>
        </div>)}
      </>}
    </fieldset>
    <p className="shroom-agent-hint">{tr('syncFailureHint')}</p>
    <p className="shroom-agent-hint">{tr('retentionHint')}</p>
  </section>;
}
