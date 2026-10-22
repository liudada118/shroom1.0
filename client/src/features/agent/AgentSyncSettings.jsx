import React, { useRef, useState } from 'react';
import { agentErrorMessage } from './agentState';

/** 用明确状态区分本机保存与服务器已接收。 */
export function describeChatSync(sync) {
  if (!sync?.settings?.enabled) return '聊天同步未开启';
  const status = sync.status || {};
  const labels = { syncing: '正在上传', retrying: '等待自动重试', blocked: '需要处理同步问题', error: '同步遇到问题' };
  if (labels[status.state]) return `${labels[status.state]} · ${status.pendingCount || 0} 个会话待同步`;
  if (status.pendingCount) return `${status.pendingCount} 个会话待同步`;
  return status.lastSuccessAt ? '聊天已同步' : '等待聊天内容';
}

/** State the actual destination without rendering a URL that may identify a private server. */
function receiverLabel(endpoint) {
  try { return new URL(endpoint).host; } catch { return '尚未配置的接收方'; }
}

/** Give a readable scope before resuming historical pending conversations. */
function pendingRangeLabel(range) {
  if (!range?.count) return '没有待传会话';
  return `${range.count} 个会话${range.oldestAt ? ` · ${new Date(range.oldestAt).toLocaleString()}` : ''}${range.newestAt && range.newestAt !== range.oldestAt ? ` 至 ${new Date(range.newestAt).toLocaleString()}` : ''}`;
}

/** The notice records awareness separately from the existing default-on upload preference. */
export function ChatUploadNotice({ settings = {}, onAcknowledge, disabled }) {
  if (!settings.noticePending) return null;
  return <div className="shroom-agent-inline-notice" role="status">
    <strong>聊天上传说明</strong>
    <p>聊天同步接收方：{receiverLabel(settings.endpoint)}。{settings.enabled ? '当前自动同步已开启。' : '当前同步已暂停。'}上传聊天正文、任务状态和附件名称，附件原文件及采集数据库不随此通道上传。外部模型请求和使用统计有各自的设置，暂停聊天同步不影响它们。</p>
    <button type="button" onClick={onAcknowledge} disabled={disabled || !onAcknowledge}>已了解上传范围</button>
  </div>;
}

/** 配置独立的聊天留档服务；凭证只提交给桌面主进程。 */
export default function AgentSyncSettings({ sync, onSave, onRetry, onClear, onRestore }) {
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
      setError('开启同步前，请填写服务器接口地址和上传凭证。');
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    actionLock.current = true; setPending(true);
    try {
      await onSave({ enabled, endpoint: endpoint.trim(), ...(token ? { token } : {}), clearToken });
      setToken(''); setClearToken(false);
      setMessage(enabled ? '同步设置已保存，当前凭据的待传内容会在后台发送；其他凭据的队列需单独核对。' : '同步已暂停，待传队列和本机聊天继续保留。');
    } catch (cause) {
      setError(agentErrorMessage(cause));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { actionLock.current = false; setPending(false); }
  }

  /** 手动重试只唤醒本地队列，不重复创建聊天消息。 */
  async function retry() {
    if (actionLock.current) return;
    actionLock.current = true; setPending(true); setError(''); setMessage('');
    try { await onRetry(); setMessage('已请求重试，请查看下方同步状态。'); }
    catch (cause) { setError(agentErrorMessage(cause)); }
    finally { actionLock.current = false; setPending(false); }
  }

  /** Keep destructive queue cleanup and ownership recovery explicit and serialized. */
  async function queueAction(action, input, successMessage) {
    if (actionLock.current) return;
    actionLock.current = true; setPending(true); setError(''); setMessage('');
    try {
      await action(input);
      setMessage(successMessage || (input?.queueId ? '已恢复确认属于当前客户的待传队列。' : '待传队列已清理，本机聊天保留；以后更新或打开会话时仍可能形成新快照。'));
      setOwnershipConfirmed(false); setClearConfirmed(false);
    } catch (cause) { setError(agentErrorMessage(cause)); }
    finally { actionLock.current = false; setPending(false); }
  }

  return <section className="shroom-agent-sync-settings" aria-labelledby="shroom-agent-sync-title">
    <h3 id="shroom-agent-sync-title">聊天同步</h3>
    <ChatUploadNotice settings={settings} disabled={pending} onAcknowledge={() => queueAction(onSave, { acknowledgeNotice: true }, '已记录上传范围说明，原同步开关保持不变。')} />
    <p className="shroom-agent-hint" id="shroom-agent-sync-notice">聊天接收方：{receiverLabel(settings.endpoint)}。{licenseAuthAvailable ? '官方接口默认使用软件密钥，无需另填上传凭证。' : '自定义接口使用独立上传凭证。'}同步当前会话和之后的聊天正文、附件名称、任务状态；打开旧会话时也会同步该会话。正文中引用的采集信息会随消息上传；附件原文件、采集数据库和模型密钥配置不上传。</p>
    <details open={advanced} onToggle={event => setAdvanced(event.currentTarget.open)}>
      <summary>高级同步设置</summary>
      <form onSubmit={submit}>
      <label className="shroom-agent-check"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} disabled={pending} aria-describedby="shroom-agent-sync-notice" />自动同步聊天（取消后暂停并保留待传）</label>
      <label htmlFor="shroom-agent-sync-endpoint">服务器接口地址</label>
      <input id="shroom-agent-sync-endpoint" type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} disabled={pending} required={enabled} placeholder="https://你的服务器/api/agent/conversations" autoComplete="off" spellCheck={false} />
      <label htmlFor="shroom-agent-sync-token">上传凭证{licenseAuthAvailable && <span>（可选）</span>}{settings.hasToken && <span> · 已配置</span>}</label>
      <input id="shroom-agent-sync-token" type="password" value={token} onChange={(event) => { setToken(event.target.value); setClearToken(false); }} disabled={pending} autoComplete="off" spellCheck={false} placeholder={savedTokenAvailable ? '留空以保留上传凭证' : licenseAuthAvailable ? '留空使用软件密钥' : '填写服务器签发的上传凭证'} />
      <p className="shroom-agent-hint">{licenseAuthAvailable ? '默认使用本机软件密钥，仅有效密钥可上传。绑定公司的记录显示公司名；无需填写独立凭证。' : '自定义接口需要独立上传凭证，不会自动发送软件密钥。'}</p>
      {settings.hasToken && <label className="shroom-agent-check"><input type="checkbox" checked={clearToken} onChange={(event) => { setClearToken(event.target.checked); if (event.target.checked) { setToken(''); if (!licenseAuthAvailable) setEnabled(false); } }} disabled={pending} />清除已保存的上传凭证</label>}
      <button type="submit" className="shroom-agent-primary" disabled={pending || !onSave}>{pending ? '正在处理…' : '保存同步设置'}</button>
      </form>
    </details>
    {error && <p role="alert" tabIndex={-1} ref={errorRef} className="shroom-agent-inline-error">{error}</p>}
    {message && <p role="status" className="shroom-agent-hint">{message}</p>}
    <div className="shroom-agent-sync-status" role="status" aria-live="polite">
      <strong>{describeChatSync(sync)}</strong>
      {sync?.status?.unsyncedCount > 0 && <span>{sync.status.unsyncedCount} 个会话尚未写入上传队列，请处理上方错误。</span>}
      {sync?.status?.lastSuccessAt && <span>上次成功：{new Date(sync.status.lastSuccessAt).toLocaleString()}</span>}
      {sync?.status?.nextRetryAt && <span>下次重试：{new Date(sync.status.nextRetryAt).toLocaleString()}</span>}
      {sync?.status?.installationId && <span>安装标识：{sync.status.installationId}</span>}
      <span>当前凭据待传范围：{pendingRangeLabel(sync?.status?.pendingRange)}</span>
    </div>
    {(statusError || settings.warning) && <p className="shroom-agent-inline-error" role="alert">{statusError || settings.warning}</p>}
    <button type="button" onClick={retry} disabled={pending || !settings.enabled || !onRetry}>立即重试</button>
    <fieldset disabled={pending}>
      <legend>待传队列</legend>
      <p>暂停会保留队列；重新开启会恢复当前凭据的待传内容。清理不删除本机聊天，也不撤回已送达的数据。</p>
      <label className="shroom-agent-check"><input type="checkbox" checked={clearConfirmed} onChange={event => setClearConfirmed(event.target.checked)} />确认清理当前及待核对的历史待传队列</label>
      <button type="button" onClick={() => queueAction(onClear, { includeLegacy: true })} disabled={!onClear || !clearConfirmed}>清理待传队列</button>
      {sync?.status?.recoverableQueues?.length > 0 && <>
        <p role="status">发现其他凭据或旧版未标明归属的待传内容，已留在本机，不会自动上传。</p>
        <label className="shroom-agent-check"><input type="checkbox" checked={ownershipConfirmed} onChange={event => setOwnershipConfirmed(event.target.checked)} />我已核对这些内容属于当前客户和当前接收方</label>
        {sync.status.recoverableQueues.map(item => <div key={item.queueId}>
          <span>{item.legacy ? '旧版归属待核对' : '其他凭据队列'} · {pendingRangeLabel(item)}</span>
          <button type="button" onClick={() => queueAction(onRestore, { queueId: item.queueId, confirmed: true })} disabled={!settings.enabled || !ownershipConfirmed || !onRestore}>恢复此队列</button>
        </div>)}
      </>}
    </fieldset>
    <p className="shroom-agent-hint">同步失败不影响本机聊天。关闭同步会停止发送并保留待上传队列；服务器上的记录需在服务端管理。</p>
    <p className="shroom-agent-hint">约定的聊天保存目标为 180 天；实际服务端保存与删除执行状态请向管理员确认。</p>
  </section>;
}
