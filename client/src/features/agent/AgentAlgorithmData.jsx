import React, { useEffect, useState } from 'react';
import { collectionLabel } from './collectionLabels';

/** 复用采集标签选择算法数据，确认后才授权读取所选范围。 */
export default function AgentAlgorithmData({ invoke, selection, disabled, onSave, onClose }) {
  const [catalog, setCatalog] = useState(null);
  const [offset, setOffset] = useState(selection?.catalogOffset || 0);
  const [chosen, setChosen] = useState(() => Object.fromEntries((selection?.records || []).map((item) => [item.id, item])));
  const [windowFrames, setWindowFrames] = useState(selection?.windowFrames || 32);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [labelRule, setLabelRule] = useState('last');
  const [labelFilter, setLabelFilter] = useState('all');
  const [bulkLabel, setBulkLabel] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = disabled || saving;
  const rows = (catalog?.records || []).map((record) => ({ ...record, collectionLabel: collectionLabel(record.date, labelRule) }));
  const groups = [...new Set(rows.map((record) => record.collectionLabel))];
  const visible = rows.filter((record) => labelFilter === 'all' || record.collectionLabel === labelFilter.slice(6));
  const selectedCount = Object.keys(chosen).length;
  const visibleSelected = visible.filter((record) => chosen[record.id]);
  const available = visible.filter((record) => !chosen[record.id]);
  const batchCount = Math.min(8 - selectedCount, available.length);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    invoke('listAlgorithmRecords', { offset }).then((result) => { if (alive) setCatalog(result); }, (cause) => { if (alive) setError(cause.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [invoke, offset, attempt]);
  /** 修改本地标签与帧范围，不读取数据直到用户确认。 */
  const update = (id, patch) => setChosen((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }));
  /** 新选择默认沿用采集标签；空值和超长值留给界面校验，不截断类别。 */
  const initialChoice = (record) => ({ id: record.id, label: record.collectionLabel, labelAutomatic: true, split: 'development', startFrame: 0, frameLimit: Math.min(256, record.count) });
  /** 批量勾选当前筛选结果，超过资源上限时明确告知实际选中数。 */
  const chooseVisible = () => {
    const additions = available.slice(0, batchCount);
    setChosen((previous) => ({ ...previous, ...Object.fromEntries(additions.map((record) => [record.id, initialChoice(record)])) }));
    setNotice(`已添加 ${additions.length} 条记录${available.length > additions.length ? `；其余 ${available.length - additions.length} 条未选中，每批最多 8 条` : ''}。`);
  };
  /** 统一调整自动提取规则，已手动修改或已保存的类别保持原值。 */
  const changeRule = (rule) => {
    setLabelRule(rule); setLabelFilter('all');
    setChosen((previous) => Object.fromEntries(Object.entries(previous).map(([id, item]) => {
      const record = catalog.records.find((entry) => entry.id === id);
      return [id, item.labelAutomatic && record ? { ...item, label: collectionLabel(record.date, rule) } : item];
    })));
    setNotice('已更新自动带入的类别；手动修改和已保存的类别保留。');
  };
  /** 将一个类别应用到当前筛选中已勾选的记录，不修改原采集记录。 */
  const applyBulkLabel = () => {
    const label = bulkLabel.trim();
    if (!label || label.length > 40 || label === '未知') { setError('统一类别请填写 1～40 个字符，不能为“未知”。'); return; }
    setChosen((previous) => ({ ...previous, ...Object.fromEntries(visibleSelected.map((record) => [record.id, { ...previous[record.id], label, labelAutomatic: false }])) }));
    setError(''); setNotice(`已将当前筛选中 ${visibleSelected.length} 条已选记录的类别设为“${label}”。`);
  };
  /** 保存失败保留全部输入；成功后由宿主切回聊天。 */
  const save = async (event) => {
    event.preventDefault(); setError('');
    if (Object.values(chosen).some((item) => !item.label.trim() || item.label.trim().length > 40 || item.label.trim() === '未知')) {
      setError('部分已选记录的类别缺失或无效。请显示全部记录后补填，或按采集标签筛选后统一修改。'); return;
    }
    setSaving(true);
    try { await onSave({ systemId: catalog.systemId, catalogOffset: offset, windowFrames, records: Object.values(chosen).map(({ labelAutomatic, ...item }) => item) }); }
    catch (cause) { setError(cause.message); }
    finally { setSaving(false); }
  };
  /** 翻页前清空草稿选择，避免把未显示记录当成当前页授权。 */
  const turnPage = (next) => { setChosen({}); setLabelFilter('all'); setNotice(''); setOffset(next); };
  return <section className="shroom-agent-algorithm-data" aria-label="算法数据选择">
    <div className="shroom-agent-history-heading"><h3>算法数据</h3><button type="button" onClick={onClose} disabled={busy}>返回聊天</button></div>
    <p>勾选要使用的数据即可，自动沿用采集时的标签。需要时可展开“修改标签”自行填写，原采集记录保留。</p>
    <p className="shroom-agent-send-hint">计算在本机进行；开发集特征摘要、标签、生成代码及测试结果会发送给配置的模型服务。完整压力帧不发送给模型。</p>
    {error && <p role="alert" className="shroom-agent-error">{error}</p>}
    {loading ? <p role="status">正在读取采集记录…</p> : !catalog ? <button onClick={() => setAttempt((value) => value + 1)}>重试读取</button> : <form onSubmit={save} noValidate>
      <p>系统：{catalog.systemId}</p>
      <label>按采集标签筛选（当前页）<select disabled={busy} value={labelFilter} onChange={(event) => { setLabelFilter(event.target.value); setNotice(''); }}>
        <option value="all">全部标签 · {rows.length} 条</option>{groups.map((label) => <option key={label} value={`label:${label}`}>{label || '未提取到标签'} · {rows.filter((record) => record.collectionLabel === label).length} 条</option>)}
      </select></label>
      <div className="shroom-agent-data-pages">
        <button type="button" disabled={busy || !batchCount} onClick={chooseVisible}>{selectedCount >= 8 ? '已选满 8 条' : available.length > batchCount ? `选择筛选结果前 ${batchCount} 条` : '全选筛选结果'}</button>
        <button type="button" disabled={busy || !visibleSelected.length} onClick={() => setChosen((previous) => Object.fromEntries(Object.entries(previous).filter(([id]) => !visible.some((record) => record.id === id))))}>取消筛选内选择</button>
      </div>
      <p role="status" className="shroom-agent-data-selection">已选 {selectedCount} / 8 条 · 当前筛选内 {visibleSelected.length} 条{notice && <small>{notice}</small>}</p>
      <details className="shroom-agent-data-label-rule"><summary>批量修改标签（可选）</summary>
      <div className="shroom-agent-data-bulk"><label>统一类别<input disabled={busy} maxLength={40} value={bulkLabel} placeholder="输入要使用的标签" onChange={(event) => setBulkLabel(event.target.value)} /></label>
        <button type="button" disabled={busy || !visibleSelected.length || !bulkLabel.trim()} onClick={applyBulkLabel}>应用到筛选内已选记录</button>
      </div>
        <label>类别来源<select disabled={busy} value={labelRule} onChange={(event) => changeRule(event.target.value)}>
          <option value="last">名称末尾的标签（默认）</option><option value="after-first">去掉名称开头第一段</option><option value="whole">完整采集名称（去掉时间）</option>
        </select></label>
        <p className="shroom-agent-send-hint">旧记录的名称与特征标签用下划线连接。默认取末尾标签，“平躺_2”保留完整文本；若标签本身含下划线，可统一换规则，手动修改的类别会保留。</p>
      </details>
      {!catalog.records.length && <p>当前页没有采集记录。先在目标系统中完成采集，再刷新列表。</p>}
      {catalog.records.length > 0 && !visible.length && <p>当前页没有匹配的标签，请选择“全部标签”。</p>}
      <div className="shroom-agent-data-records">{visible.map((record) => {
        const selected = chosen[record.id];
        return <fieldset key={record.id} disabled={busy}>
          <label className="shroom-agent-data-check"><input type="checkbox" checked={Boolean(selected)} disabled={!selected && selectedCount >= 8} onChange={(event) => {
            if (event.target.checked) update(record.id, initialChoice(record));
            else setChosen((previous) => { const next = { ...previous }; delete next[record.id]; return next; });
          }} /><span>{record.date}<small>{record.channel} · {record.count} 帧</small><small>采集标签：{record.collectionLabel || '未提取到，请补填类别'}</small></span></label>
          {selected && <><p className="shroom-agent-data-selected-label">使用标签：{selected.label || '尚无标签，可自行填写'}</p><details><summary>修改标签或读取范围（可选）</summary><div className="shroom-agent-data-fields">
            <label>类别<input required maxLength={40} value={selected.label} onChange={(event) => update(record.id, { label: event.target.value, labelAutomatic: false })} /></label>
            <label>用途<select value={selected.split} onChange={(event) => update(record.id, { split: event.target.value })}><option value="development">开发与调试</option><option value="validation">独立验证</option></select></label>
            <label>起始帧（从 1 计）<input type="number" min="1" max={record.count} value={selected.startFrame + 1} onChange={(event) => update(record.id, { startFrame: Number(event.target.value) - 1 })} /></label>
            <label>读取帧数<input type="number" min={windowFrames} max={Math.min(2000, record.count - selected.startFrame)} value={selected.frameLimit} onChange={(event) => update(record.id, { frameLimit: Number(event.target.value) })} /></label>
          </div></details></>}
        </fieldset>;
      })}</div>
      <div className="shroom-agent-data-pages"><button type="button" disabled={busy || offset === 0} onClick={() => turnPage(Math.max(0, offset - 30))}>较新记录</button><button type="button" disabled={busy || catalog.nextOffset == null} onClick={() => turnPage(catalog.nextOffset)}>更早记录</button><button type="button" disabled={busy} onClick={() => setAttempt((value) => value + 1)}>刷新</button></div>
      <p className="shroom-agent-send-hint">翻页会清空本页选择。每次 2～8 条记录、至少两类开发数据；独立验证请使用另一次采集的数据，同次采集不能拆分到两组。</p>
      <label>每个识别窗口的帧数<select disabled={busy} value={windowFrames} onChange={(event) => setWindowFrames(Number(event.target.value))}>{[16, 32, 64, 128, 256].map((count) => <option key={count} value={count}>{count} 帧</option>)}</select></label>
      <p className="shroom-agent-send-hint">本次总量最多 200 万个压力数值，超限时请减少帧数。尾部不足一个窗口的帧会在报告中单列。分类算法在本机测试，保存后可绑定当前系统进行实时识别。</p>
      <div className="shroom-agent-data-pages"><button className="shroom-agent-primary" type="submit" disabled={busy || selectedCount < 2}>{saving ? '正在保存…' : '使用所选数据'}</button>{selection && <button type="button" disabled={busy} onClick={() => onSave(null).catch((cause) => setError(cause.message))}>清除选择</button>}</div>
    </form>}
  </section>;
}
