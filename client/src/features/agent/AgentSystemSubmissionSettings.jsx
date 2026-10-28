import { useTranslation } from 'react-i18next';
import { agentUiText as tr, agentUiMessage } from './agentUi';
import React, { useEffect, useState } from 'react';
import { requestJson } from '../../extensions/display-system/api';

/** Configure the employee-only submission token without exposing it in chat history. */
export default function AgentSystemSubmissionSettings() {
  useTranslation();
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
      setConfigured(status.configured); setToken(''); setMessage({ key: 'employeeTokenSaved' });
    } catch (error) { setMessage(error.message || { key: 'employeeTokenFailed' }); }
    finally { setBusy(false); }
  };

  /** Clear only the local copy; the management site can revoke an issued token. */
  const clear = async () => {
    setBusy(true); setMessage('');
    try { await requestJson('/api/system-packages/staff-credential', { method: 'DELETE' }); setConfigured(false); setToken(''); setMessage({ key: 'employeeTokenCleared' }); }
    catch (error) { setMessage(error.message || { key: 'clearFailed' }); }
    finally { setBusy(false); }
  };

  return <section className="shroom-agent-settings-section" aria-label={tr('companySubmission')}>
    <h3>{tr('companySubmission')}</h3>
    <p className="shroom-agent-hint">{tr('employeeTokenHint')}</p>
    <form onSubmit={save}>
      <label htmlFor="shroom-agent-package-token">{tr('employeeToken')}{configured ? tr('configured') : ''}</label>
      <input id="shroom-agent-package-token" type="password" value={token} onChange={(event) => setToken(event.target.value)}
        placeholder={configured ? tr('replaceToken') : tr('pasteToken')} autoComplete="off" spellCheck={false} disabled={busy} />
      <button type="submit" disabled={busy || !token.trim()}>{tr('saveToken')}</button>
      {configured && <button type="button" disabled={busy} onClick={clear}>{tr('clearLocalToken')}</button>}
    </form>
    {message && <p role="status" className="shroom-agent-hint">{agentUiMessage(message)}</p>}
  </section>;
}
