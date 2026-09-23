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

/** 配置独立的聊天留档服务；凭证只提交给桌面主进程。 */
export default function AgentSyncSettings({ sync, onSave, onRetry }) {
  const settings = sync?.settings || {};
  const [enabled, setEnabled] = useState(Boolean(settings.enabled));
  const [endpoint, setEndpoint] = useState(settings.endpoint || '');
  const [token, setToken] = useState('');
  const [clearToken, setClearToken] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
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
      setMessage(enabled ? '同步设置已保存，待上传内容会在后台发送。' : '同步已关闭，未完成队列和本机聊天继续保留。');
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

  return <section className="shroom-agent-sync-settings" aria-labelledby="shroom-agent-sync-title">
    <h3 id="shroom-agent-sync-title">聊天同步</h3>
    <p className="shroom-agent-hint" id="shroom-agent-sync-notice">开启后，会把当前会话和之后的聊天正文、附件名称、任务状态上传到下方服务器。打开旧会话时也会同步该会话。正文中引用的采集信息会随消息上传；附件原文件、采集数据库和模型密钥配置不上传。</p>
    <form onSubmit={submit}>
      <label className="shroom-agent-check"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} disabled={pending} aria-describedby="shroom-agent-sync-notice" />开启聊天同步</label>
      <label htmlFor="shroom-agent-sync-endpoint">服务器接口地址</label>
      <input id="shroom-agent-sync-endpoint" type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} disabled={pending} required={enabled} placeholder="https://你的服务器/api/agent/conversations" autoComplete="off" spellCheck={false} />
      <label htmlFor="shroom-agent-sync-token">上传凭证{licenseAuthAvailable && <span>（可选）</span>}{settings.hasToken && <span> · 已配置</span>}</label>
      <input id="shroom-agent-sync-token" type="password" value={token} onChange={(event) => { setToken(event.target.value); setClearToken(false); }} disabled={pending} autoComplete="off" spellCheck={false} placeholder={savedTokenAvailable ? '留空以保留上传凭证' : licenseAuthAvailable ? '留空使用软件密钥' : '填写服务器签发的上传凭证'} />
      <p className="shroom-agent-hint">{licenseAuthAvailable ? '默认使用本机软件密钥，仅有效密钥可上传。绑定公司的记录显示公司名；无需填写独立凭证。' : '自定义接口需要独立上传凭证，不会自动发送软件密钥。'}</p>
      {settings.hasToken && <label className="shroom-agent-check"><input type="checkbox" checked={clearToken} onChange={(event) => { setClearToken(event.target.checked); if (event.target.checked) { setToken(''); if (!licenseAuthAvailable) setEnabled(false); } }} disabled={pending} />清除已保存的上传凭证</label>}
      {error && <p role="alert" tabIndex={-1} ref={errorRef} className="shroom-agent-inline-error">{error}</p>}
      <button type="submit" className="shroom-agent-primary" disabled={pending || !onSave}>{pending ? '正在处理…' : '保存同步设置'}</button>
    </form>
    {message && <p role="status" className="shroom-agent-hint">{message}</p>}
    <div className="shroom-agent-sync-status" role="status" aria-live="polite">
      <strong>{describeChatSync(sync)}</strong>
      {sync?.status?.unsyncedCount > 0 && <span>{sync.status.unsyncedCount} 个会话尚未写入上传队列，请处理上方错误。</span>}
      {sync?.status?.lastSuccessAt && <span>上次成功：{new Date(sync.status.lastSuccessAt).toLocaleString()}</span>}
      {sync?.status?.nextRetryAt && <span>下次重试：{new Date(sync.status.nextRetryAt).toLocaleString()}</span>}
      {sync?.status?.installationId && <span>安装标识：{sync.status.installationId}</span>}
    </div>
    {(statusError || settings.warning) && <p className="shroom-agent-inline-error" role="alert">{statusError || settings.warning}</p>}
    <button type="button" onClick={retry} disabled={pending || !settings.enabled || !onRetry}>立即重试</button>
    <p className="shroom-agent-hint">同步失败不影响本机聊天。关闭同步会停止发送并保留待上传队列；服务器上的记录需在服务端管理。</p>
  </section>;
}
