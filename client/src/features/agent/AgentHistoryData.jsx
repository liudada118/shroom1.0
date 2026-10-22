import React, { useEffect, useRef, useState } from 'react';

/** 将毫秒时间转为本机时间输入，避免让客户填写 Unix 时间戳。 */
function localTime(value) {
  if (!Number.isFinite(value)) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(value - date.getTimezoneOffset() * 60000).toISOString().slice(0, 23);
}

/** 在聊天内确认历史分析的只读范围，不要求类别标签或训练窗口。 */
export default function AgentHistoryData({ invoke, expectedSystemId, disabled, onSave, onClose }) {
  const [catalog, setCatalog] = useState(null);
  const [chosen, setChosen] = useState({});
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [useRegion, setUseRegion] = useState(false);
  const [region, setRegion] = useState({ row: 0, column: 0, rows: 1, cols: 1 });
  const lock = useRef(false);
  const busy = disabled || saving;
  useEffect(() => {
    let alive = true;
    setLoading(true); setCatalog(null); setError('');
    invoke('listHistoryRecords', { offset }).then((result) => {
      if (!alive) return;
      if (result.systemId !== expectedSystemId) { setChosen({}); setError('当前系统已变化，请返回目标系统或取消本次选择。'); return; }
      setCatalog(result);
    }, (cause) => { if (alive) setError(cause.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [invoke, offset, attempt, expectedSystemId]);
  /** 只修改本地待确认范围，不在勾选时读取压力帧。 */
  const update = (id, patch) => setChosen((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }));
  /** 确认后由宿主复核目录和边界，失败保留输入供修改。 */
  const save = async (event) => {
    event.preventDefault();
    if (busy || lock.current || !catalog) return;
    const records = Object.values(chosen);
    if (!records.length || records.length > 8) { setError('请选择 1～8 条记录。'); return; }
    for (const item of records) {
      const record = catalog.records.find((entry) => entry.id === item.id), range = item.range;
      if (!Number.isInteger(range.frameLimit) || range.frameLimit < 1 || range.frameLimit > 2000
        || (range.kind === 'frames' && (!Number.isInteger(range.startFrame) || range.startFrame < 0 || range.startFrame + range.frameLimit > record.count))
        || (range.kind === 'time' && (!Number.isFinite(range.startTimestamp) || !Number.isFinite(range.endTimestamp) || range.startTimestamp > range.endTimestamp))) { setError('请填写记录内有效的帧区间或时间区间。'); return; }
    }
    lock.current = true; setSaving(true); setError('');
    try { await onSave({ systemId: catalog.systemId, catalogOffset: offset, records, ...(useRegion ? { region } : {}) }); }
    catch (cause) { setError(cause.message); }
    finally { lock.current = false; setSaving(false); }
  };
  /** 翻页撤销未确认选择，避免看不到的记录被一起授权。 */
  const turnPage = (next) => { setChosen({}); setOffset(next); };
  return <section className="shroom-agent-algorithm-data is-inline" aria-label="历史分析数据选择" aria-busy={loading || saving}>
    <div className="shroom-agent-history-heading"><h3>选择要分析的数据</h3><button type="button" disabled={busy} onClick={onClose}>取消选择</button></div>
    <p>单条记录也可以分析，无需填写标签。确认记录和区间后，统计在本机计算；摘要会发送给模型，完整压力帧留在本机。</p>
    {error && <p role="alert" className="shroom-agent-error">{error}</p>}
    {loading ? <p role="status">正在读取记录…</p> : !catalog ? <button type="button" disabled={busy} onClick={() => setAttempt((value) => value + 1)}>重试读取</button> : <form onSubmit={save} noValidate>
      {!catalog.records.length && <p>当前页没有采集记录。</p>}
      <div className="shroom-agent-data-records">{catalog.records.map((record) => {
        const selected = chosen[record.id], range = selected?.range;
        return <fieldset key={record.id} disabled={busy}>
          <label className="shroom-agent-data-check"><input type="checkbox" checked={Boolean(selected)} disabled={!selected && Object.keys(chosen).length >= 8} onChange={(event) => {
            if (event.target.checked) update(record.id, { id: record.id, range: { kind: 'frames', startFrame: 0, frameLimit: Math.min(256, record.count) } });
            else setChosen((previous) => { const next = { ...previous }; delete next[record.id]; return next; });
          }} /><span>{record.date}<small>{record.channel} · {record.count} 帧</small></span></label>
          {selected && <div className="shroom-agent-data-fields">
            <label>区间方式<select value={range.kind} onChange={(event) => update(record.id, { range: { ...range, kind: event.target.value } })}><option value="frames">按帧选择</option><option value="time">按时间选择</option></select></label>
            {range.kind === 'frames' ? <label>起始帧（从 1 计）<input type="number" min="1" max={record.count} value={range.startFrame + 1} onChange={(event) => update(record.id, { range: { ...range, startFrame: Number(event.target.value) - 1 } })} /></label> : <>
              <label>开始时间（本机时间）<input type="datetime-local" step="0.001" value={localTime(range.startTimestamp)} onChange={(event) => update(record.id, { range: { ...range, startTimestamp: event.target.value === '' ? null : new Date(event.target.value).getTime() } })} /></label>
              <label>结束时间（本机时间）<input type="datetime-local" step="0.001" value={localTime(range.endTimestamp)} onChange={(event) => update(record.id, { range: { ...range, endTimestamp: event.target.value === '' ? null : new Date(event.target.value).getTime() } })} /></label>
            </>}
            <label>{range.kind === 'frames' ? '读取帧数' : '最多读取帧数'}<input type="number" min="1" max={2000} value={range.frameLimit} onChange={(event) => update(record.id, { range: { ...range, frameLimit: Number(event.target.value) } })} /></label>
          </div>}
        </fieldset>;
      })}</div>
      <details><summary>仅分析矩阵中的一个区域（可选）</summary>
        <label><input type="checkbox" disabled={busy} checked={useRegion} onChange={(event) => setUseRegion(event.target.checked)} />启用区域</label>
        {useRegion && <div className="shroom-agent-data-fields">{[['row', '起始行（从 1 计）'], ['column', '起始列（从 1 计）'], ['rows', '区域行数'], ['cols', '区域列数']].map(([key, label]) => <label key={key}>{label}<input type="number" disabled={busy} min="1" max="256" value={region[key] + (['row', 'column'].includes(key) ? 1 : 0)} onChange={(event) => setRegion((previous) => ({ ...previous, [key]: Number(event.target.value) - (['row', 'column'].includes(key) ? 1 : 0) }))} /></label>)}</div>}
      </details>
      <p className="shroom-agent-send-hint">每批 1～8 条记录，每条最多 2000 帧，总量最多 200 万数值；时间区间超过读取上限时只描述已读范围。矩阵与存储阶段不一致时不直接比较。</p>
      <div className="shroom-agent-data-pages"><button type="button" disabled={busy || !offset} onClick={() => turnPage(Math.max(0, offset - 30))}>较新记录</button><button type="button" disabled={busy || catalog.nextOffset == null} onClick={() => turnPage(catalog.nextOffset)}>更早记录</button><button type="button" disabled={busy} onClick={() => setAttempt((value) => value + 1)}>刷新</button></div>
      <button type="submit" className="shroom-agent-primary" disabled={busy || !Object.keys(chosen).length}>{saving ? '正在确认…' : '分析所选数据并继续'}</button>
    </form>}
  </section>;
}
