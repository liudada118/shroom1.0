import React, { useEffect, useState } from 'react';
import { requestJson } from '../../extensions/display-system/api';

/** Configure the employee-only submission token without exposing it in chat history. */
export default function AgentSystemSubmissionSettings() {
  const [configured, setConfigured] = useState(false);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    requestJson('/api/system-packages/staff-credential').then((status) => setConfigured(status.configured)).catch(() => {});
  }, []);

  /** Persist an OS-encrypted token in the local service, never in renderer storage. */
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const status = await requestJson('/api/system-packages/staff-credential', { method: 'PUT', body: JSON.stringify({ token: token.trim() }) });
      setConfigured(status.configured); setToken(''); setMessage('员工提交令牌已保存，可以从系统成果卡片直接提交审核。');
    } catch (error) { setMessage(error.message || '员工令牌保存失败'); }
    finally { setBusy(false); }
  };

  /** Clear only the local copy; the management site can revoke an issued token. */
  const clear = async () => {
    setBusy(true); setMessage('');
    try { await requestJson('/api/system-packages/staff-credential', { method: 'DELETE' }); setConfigured(false); setToken(''); setMessage('本机员工令牌已清除。'); }
    catch (error) { setMessage(error.message || '清除失败'); }
    finally { setBusy(false); }
  };

  return <section className="shroom-agent-settings-section" aria-label="公司系统提交">
    <h3>公司系统提交</h3>
    <p className="shroom-agent-hint">员工先在管理网站“公司系统库”生成提交令牌。令牌仅能提交待审核系统，管理员批准后才会交付给客户。</p>
    <form onSubmit={save}>
      <label htmlFor="shroom-agent-package-token">员工提交令牌{configured ? ' · 已配置' : ''}</label>
      <input id="shroom-agent-package-token" type="password" value={token} onChange={(event) => setToken(event.target.value)}
        placeholder={configured ? '填写新令牌以更换' : '粘贴 sps_ 开头的令牌'} autoComplete="off" spellCheck={false} disabled={busy} />
      <button type="submit" disabled={busy || !token.trim()}>保存提交令牌</button>
      {configured && <button type="button" disabled={busy} onClick={clear}>清除本机令牌</button>}
    </form>
    {message && <p role="status" className="shroom-agent-hint">{message}</p>}
  </section>;
}
