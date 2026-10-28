import { useTranslation } from 'react-i18next';
import { agentUiText as tr, agentDate } from './agentUi';
import React, { useEffect, useState } from 'react';

/** 按最近活动展示已保存会话，打开后仍由运行层恢复完整记录。 */
export default function AgentHistory({ invoke, disabled, onOpen, onClose }) {
  useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  useEffect(() => {
    let alive = true;
    setLoading(true); setFailed(false);
    invoke('listConversations').then((result) => { if (alive) setItems(result || []); }, () => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [invoke, attempt]);
  const filtered = items.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="shroom-agent-history" aria-label={tr('historyList')}>
    <div className="shroom-agent-history-heading"><h3>{tr('history')}</h3><button type="button" onClick={onClose}>{tr('backChat')}</button></div>
    <label className="shroom-agent-sr-only" htmlFor="agent-history-search">{tr('searchHistory')}</label>
    <input id="agent-history-search" type="search" placeholder={tr('searchTitle')} value={query} onChange={(event) => setQuery(event.target.value)} />
    {disabled && <p className="shroom-agent-send-hint">{tr('switchAfterOperation')}</p>}
    {loading ? <p role="status">{tr('loadingHistory')}</p> : failed ? <button type="button" onClick={() => setAttempt((value) => value + 1)}>{tr('retryHistory')}</button> : filtered.length === 0 ? <p>{tr('noConversations')}</p> :
      <ul>{filtered.map((item) => <li key={item.id}><button type="button" className={item.current ? 'is-current' : ''} aria-current={item.current ? 'true' : undefined} disabled={disabled || item.unavailable} onClick={() => onOpen(item.id)}>
        <strong>{item.title}</strong><span>{item.current ? tr('currentConversation') : ''}{item.messageCount}{tr('messagesSuffix')}{item.updatedAt && ` · ${agentDate(item.updatedAt)}`}{item.unavailable && tr('unreadable')}</span>
      </button></li>)}</ul>}
  </section>;
}
