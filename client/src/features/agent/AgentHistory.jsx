import React, { useEffect, useState } from 'react';

/** 按最近活动展示已保存会话，打开后仍由运行层恢复完整记录。 */
export default function AgentHistory({ invoke, disabled, onOpen, onClose }) {
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
  return <section className="shroom-agent-history" aria-label="历史会话列表">
    <div className="shroom-agent-history-heading"><h3>历史会话</h3><button type="button" onClick={onClose}>返回聊天</button></div>
    <label className="shroom-agent-sr-only" htmlFor="agent-history-search">搜索历史会话</label>
    <input id="agent-history-search" type="search" placeholder="搜索会话内容标题" value={query} onChange={(event) => setQuery(event.target.value)} />
    {disabled && <p className="shroom-agent-send-hint">当前操作结束后可切换会话。</p>}
    {loading ? <p role="status">正在读取历史会话…</p> : failed ? <button type="button" onClick={() => setAttempt((value) => value + 1)}>重新读取历史会话</button> : filtered.length === 0 ? <p>没有匹配的会话。</p> :
      <ul>{filtered.map((item) => <li key={item.id}><button type="button" className={item.current ? 'is-current' : ''} aria-current={item.current ? 'true' : undefined} disabled={disabled || item.unavailable} onClick={() => onOpen(item.id)}>
        <strong>{item.title}</strong><span>{item.current ? '当前会话 · ' : ''}{item.messageCount} 条消息{item.updatedAt && ` · ${new Date(item.updatedAt).toLocaleString('zh-CN', { hour12: false })}`}{item.unavailable && ' · 记录无法读取'}</span>
      </button></li>)}</ul>}
  </section>;
}
