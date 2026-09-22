import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import './PortalSelectionTools.css';

/** 以原始矩阵坐标编辑选区；输入提供拖拽之外的等效操作。 */
function RegionEditor({ api, region, columns, rows }) {
  const [form, setForm] = useState(region || { name: '', x: 0, y: 0, width: 4, height: 4 });
  return <form className="portal-region-editor" onSubmit={(event) => { event.preventDefault(); api.save(form, region?.id); }}>
    <label className="portal-region-name">名称<input aria-label={region ? `${region.name}名称` : '新选区名称'} maxLength={24}
      value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="自动命名" /></label>
    <div className="portal-region-coordinates">{[['x', 'X'], ['y', 'Y'], ['width', '列数'], ['height', '行数']].map(([key, label]) =>
      <label key={key}>{label}<input type="number" required min={key === 'x' || key === 'y' ? 0 : 1}
        max={key === 'x' || key === 'width' ? columns : rows} step={1} value={form[key]}
        aria-label={`${region?.name || '新选区'}${label}`} onChange={(event) => setForm({ ...form, [key]: event.target.value === '' ? '' : Number(event.target.value) })} /></label>)}</div>
    <button type="submit">{region ? '应用坐标' : '添加选区'}</button>
  </form>;
}

/** 参考旧项目的格点建框、八向缩放和键盘操作，统计在提交后更新。 */
export default function PortalSelectionTools({ api, onClose }) {
  const state = useSyncExternalStore(api.subscribe, api.getSnapshot, api.getSnapshot);
  const gesture = useRef(null);
  const layerRef = useRef(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [screenRegions, setScreenRegions] = useState([]);
  useEffect(() => {
    /** 跟随当前相机和压力投影，保留矩阵坐标身份。 */
    const refresh = () => setScreenRegions(api.getScreenRegions());
    refresh(); const timer = setInterval(refresh, 100);
    return () => clearInterval(timer);
  }, [api, state.regions]);

  /** 记录手势起始投影，整框平移与缩放由同一格点算法计算。 */
  const begin = (event, region, mode = 'create', dir) => {
    if (event.button !== 0 || gesture.current) return;
    const start = { x: event.clientX, y: event.clientY };
    const resolve = api.beginGesture({ region, mode, start, dir });
    if (!resolve) return;
    event.preventDefault(); event.stopPropagation();
    if (mode === 'create') layerRef.current?.focus({ preventScroll: true });
    else event.currentTarget.focus({ preventScroll: true });
    setActiveId(region?.id || null);
    gesture.current = { region, mode, dir, start, last: start, resolve, pointerId: event.pointerId, moved: false };
  };
  const beginRef = useRef(begin); beginRef.current = begin;
  useEffect(() => {
    /** 只有画布上的左键可开始新框，已有框及表单由各自控件处理。 */
    const down = (event) => {
      if (event.target === api.canvas) beginRef.current(event, null);
    };
    /** 即时预览格点边界和尺寸，不把任意像素框提交给统计。 */
    const move = (event) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      event.preventDefault();
      current.last = { x: event.clientX, y: event.clientY };
      current.moved ||= Math.hypot(current.last.x - current.start.x, current.last.y - current.start.y) >= 1;
      const next = current.resolve(current.last);
      if (!next || !current.moved) return;
      current.next = next;
      setDraft({ ...next, id: current.region?.id || 'draft', name: current.region?.name || '新选区' });
    };
    /** 松手仅提交吸附后的矩阵区域，空白命中保留原有统计。 */
    const up = (event) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      gesture.current = null; setDraft(null);
      if (current.moved && current.next) {
        if (api.save(current.next, current.region?.id)) setActiveId(current.region?.id || api.getSnapshot().regions.at(-1)?.id);
      } else if (current.moved && current.mode === 'create') {
        api.selectScreen({ x1: current.start.x, y1: current.start.y, x2: current.last.x, y2: current.last.y });
      }
    };
    /** 失焦和取消只撤销未提交预览。 */
    const cancel = () => { gesture.current = null; setDraft(null); };
    /** 与旧项目相同：方向键操作最后一框，按住拖动时操作当前框并重设拖动基准。 */
    const keydown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        if (gesture.current) cancel(); else closeRef.current();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.target?.closest?.('input, textarea, select, button, [contenteditable="true"], [role="tab"], [role="combobox"]')) return;
      const current = gesture.current?.mode === 'move' ? gesture.current : null;
      const region = current?.next || current?.region || api.getSnapshot().regions.at(-1);
      if (!region) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault(); event.stopPropagation(); cancel(); api.remove(region.id); return;
      }
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction) return;
      event.preventDefault(); event.stopPropagation();
      const { columns, rows } = api.getSnapshot();
      const next = { ...region, x: Math.max(0, Math.min(columns - region.width, region.x + direction[0])),
        y: Math.max(0, Math.min(rows - region.height, region.y + direction[1])) };
      api.save(next, region.id); setActiveId(region.id);
      if (current) {
        current.region = next; current.start = current.last; current.next = null; current.moved = false;
        current.resolve = api.beginGesture({ region: next, mode: 'move', start: current.last });
        setDraft(null);
      }
    };
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', keydown, true);
    return () => {
      window.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel); window.removeEventListener('keydown', keydown, true);
      gesture.current = null;
    };
  }, [api]);
  const visible = screenRegions.map((region) => region.id === draft?.id ? draft : region);
  if (draft?.id === 'draft') visible.push(draft);
  const host = api.canvas.closest('.portal-monitor-content') || document.body;
  const origin = host.getBoundingClientRect();
  return createPortal(<div ref={layerRef} tabIndex={-1} className="portal-selection-layer" onKeyDown={(event) => event.stopPropagation()} onKeyUp={(event) => event.stopPropagation()}>
    {visible.filter((region) => region.rect).map((region, index) => {
      const { x1, y1, x2, y2 } = region.rect;
      const isDraft = region.id === 'draft';
      return <div key={region.id} className={`brushSelectBox portal-selection-box${isDraft ? ' is-draft' : ''}${region.id === activeId ? ' is-active' : ''}`}
        role="group" aria-label={`${region.name}选区`} tabIndex={isDraft ? -1 : 0}
        style={{ left: Math.min(x1, x2) - origin.left, top: Math.min(y1, y2) - origin.top, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), '--region-color': region.color }}
        onPointerDown={(event) => begin(event, region, 'move')}>
        <span className="portal-selection-label">{isDraft ? '新' : index + 1}</span>
        <span className="portal-selection-measure">X {region.x}–{region.x + region.width} / Y {region.y}–{region.y + region.height} · {region.width} × {region.height}</span>
        {!isDraft && <>
          <button type="button" className="portal-selection-delete" aria-label={`删除${region.name}`}
            onPointerDown={(event) => event.stopPropagation()} onClick={() => api.remove(region.id)}>×</button>
          {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((dir) => <span key={dir} className={`portal-selection-handle ${dir}`} aria-hidden="true"
            onPointerDown={(event) => begin(event, region, 'resize', dir)} />)}
        </>}
      </div>;
    })}
    <aside className="portal-selection-panel" aria-label="框选区域管理">
      <header><strong>框选区域 <small>{state.regions.length}/4</small></strong><button type="button" onClick={onClose}>退出框选</button></header>
      <p>拖动建框，八向缩放；移动保持行列数。方向键移动最后一框，按住框时移动当前框；Delete 删除。坐标从 0 开始。</p>
      {state.error && <p role="alert" className="portal-selection-error">{state.error}</p>}
      {state.regions.map((region) => <section key={region.id} style={{ '--region-color': region.color }}>
        <div className="portal-region-heading"><strong>{region.name}</strong><button type="button" onClick={() => setEditing(editing === region.id ? null : region.id)}>编辑</button>
          <button type="button" aria-label={`移除${region.name}`} onClick={() => api.remove(region.id)}>删除</button></div>
        <div className="portal-region-stats"><span>选中 <b>{region.stats.selectedPoints}</b> 点</span><span>受压 <b>{region.stats.point}</b> 点</span>
          <span>总压力 <b>{region.stats.totalPres.toFixed(2)}</b></span><span>最大 <b>{region.stats.maxPres.toFixed(2)}</b></span>
          <span>平均 <b>{region.stats.meanPres.toFixed(2)}</b></span></div>
        {editing === region.id && <RegionEditor key={`${region.id}:${region.name}:${region.x}:${region.y}:${region.width}:${region.height}`}
          api={api} region={region} columns={state.columns} rows={state.rows} />}
      </section>)}
      {state.regions.length === 0 && <p>在点图上框选，或输入坐标添加区域。</p>}
      <details><summary>输入坐标添加</summary><RegionEditor api={api} columns={state.columns} rows={state.rows} /></details>
      <p className="portal-selection-note">侧栏显示所有选区的合计，重叠点只计算一次；无选区时显示全图。</p>
    </aside>
  </div>, host);
}
