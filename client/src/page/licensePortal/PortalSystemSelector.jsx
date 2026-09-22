import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { PORTAL_CATEGORIES, filterPortalSystems, getAuthorizedPortalSystems } from './portalSystems';
import { getPortalAccent, getPortalScene } from './scene/sceneCatalog';
import { useSelectorMotion, useSceneCopyMotion } from './usePortalMotion';

const CATEGORY_LABELS = { all: '全部', care: '康养', vehicle: '座椅', embodied: '触觉', custom: '定制' };

/** 参考项目的列表与粒子场景弹层；目录、密钥和进入操作使用 Shroom 真实链路。 */
export default function PortalSystemSelector({ open, systems, category, selectedId, scope, phase,
  error, loading, catalogError, accessKey, onKeyChange, onCategory, onSelect, onBack, onEnter, onReload, onValidate,
  sceneStatus, onPreview, onHost, expanded = false, onReturnToSelector, monitoring = false, dataView = false, directEntry = false, runtime }) {
  const [query, setQuery] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const headingRef = useRef(null);
  const keyInputRef = useRef(null);
  const panelRef = useRef(null);
  const backdropRef = useRef(null);
  const returnButtonRef = useRef(null);
  const wasExpanded = useRef(false);
  const authorized = useMemo(() => getAuthorizedPortalSystems(systems, scope), [systems, scope]);
  const visible = useMemo(() => filterPortalSystems(authorized, category, query), [authorized, category, query]);
  const selected = (expanded || monitoring ? authorized : visible).find((item) => item.value === selectedId) || visible[0];
  useSelectorMotion(backdropRef, open, visible.map((item) => item.value).join('|'));
  useSceneCopyMotion(panelRef, selected?.value, open && !expanded);
  const busy = phase !== 'idle';
  const showKeyEditor = scope === undefined || editingKey;
  const categoryInfo = PORTAL_CATEGORIES.find((item) => item.key === selected?.category);
  const sceneKey = getPortalScene(selected);
  const status = sceneStatus.state === 'unavailable' ? '3D 预览不可用，仍可进入系统'
    : sceneStatus.key !== sceneKey || sceneStatus.state === 'loading' ? '正在加载粒子场景…'
      : sceneStatus.state === 'morphing' ? '粒子场景切换中'
      : sceneStatus.state === 'error' ? '模型加载失败，仍可进入系统' : '粒子场景预览 · 非实时数据';

  useEffect(() => { onPreview(selected || null); }, [selected, onPreview]);
  useEffect(() => { if (editingKey) keyInputRef.current?.focus({ preventScroll: true }); }, [editingKey]);
  useEffect(() => {
    setQuery('');
    // ⚠️ 等弹层从 visibility:hidden 变为可见再聚焦，否则键盘焦点会留在背景。
    const frame = requestAnimationFrame(() => { if (open) headingRef.current?.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    const changed = wasExpanded.current !== expanded;
    wasExpanded.current = expanded;
    if (!changed) return undefined;
    if (expanded) setQuery('');
    const frame = requestAnimationFrame(() => {
      const target = expanded ? returnButtonRef.current : panelRef.current?.querySelector('.system-option.is-active');
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [expanded]);

  /** 弹层内循环焦点；Escape 从放大视图返回列表，验证中不重复提交。 */
  const handleKeyDown = (event) => {
    // ⚠️ 监测页的配置、采集和授权弹窗有自己的焦点管理，不能被外层选择器抢走。
    if (monitoring && (!directEntry || dataView)) return;
    if (event.key === 'Escape' && directEntry) { event.preventDefault(); onReturnToSelector(); return; }
    if (event.key === 'Escape') { event.preventDefault(); if (expanded) onReturnToSelector(); else if (!busy) onBack(); return; }
    if (event.key !== 'Tab') return;
    const nodes = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')]
      .filter((node) => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
    const first = nodes[0];
    const last = nodes.at(-1);
    if (!first) { event.preventDefault(); headingRef.current?.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    // ⚠️ 刷新按钮禁用时浏览器可能把焦点退到 body，Escape 和 Tab 仍须由弹层接管。
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  /** 提交验证后由授权状态决定是否继续显示密钥编辑区。 */
  const validateKey = () => { setEditingKey(false); onValidate(); };

  return <div ref={backdropRef} style={{ '--system-accent': getPortalAccent(selected) }} className={`system-selector-backdrop ${open ? 'is-open' : ''} ${expanded ? 'is-system-active' : ''} ${dataView ? 'is-data-view' : ''} ${directEntry ? 'is-direct-entry' : ''}`} inert={!open} aria-hidden={!open}
    onMouseDown={(event) => { if (!busy && !expanded && event.target === event.currentTarget) onBack(); }}>
    <div className="system-selector-dust" aria-hidden="true" />
    <section ref={panelRef} className={`system-selector-panel ${expanded ? 'is-scene-expanded' : ''}`} role={monitoring ? 'region' : 'dialog'}
      aria-modal={monitoring ? undefined : true} aria-label={monitoring ? `${selected?.label || ''}监测` : undefined} aria-labelledby={monitoring ? undefined : 'portal-selector-heading'}
      aria-busy={busy} inert={directEntry && dataView} aria-hidden={directEntry && dataView}>
      <aside className="system-selector-list" inert={expanded}>
        <div className="system-selector-heading">
          <span className="system-selector-kicker">SHROOM SYSTEM INDEX</span>
          <h2 id="portal-selector-heading" tabIndex={-1} ref={headingRef}>选择你的展示系统</h2>
          <p>按密钥授权展示，单击预览后进入。</p>
        </div>
        <div className="portal-filter-tabs" aria-label="系统分类">
          {[{ key: 'all', title: '全部' }, ...PORTAL_CATEGORIES].map((item) => <button key={item.key}
            type="button" aria-label={item.title} aria-pressed={category === item.key} disabled={busy}
            onClick={() => { setQuery(''); onCategory(item.key); }}>{CATEGORY_LABELS[item.key]}</button>)}
        </div>
        <label className="portal-system-search"><SearchOutlined aria-hidden="true" />
          <input aria-label="搜索系统" placeholder="搜索系统名称" value={query} disabled={busy} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="portal-directory-status" role="status">
          <span>{phase === 'validating' ? '正在验证密钥…' : scope === undefined ? '请先验证访问密钥' : loading ? '正在读取本机系统…' : `${visible.length} 个可用系统`}</span>
          <button type="button" className="portal-text-button" onClick={onReload} disabled={loading || busy} aria-label="刷新系统列表"><ReloadOutlined aria-hidden="true" /> 刷新</button>
        </div>
        {catalogError && <p className="portal-catalog-error" role="alert">自定义系统读取失败，已授权的内置系统仍可使用。请刷新重试。</p>}
        <div className="system-options" aria-label="系统列表">
          {visible.map((system, index) => <button type="button" className={`system-option portal-system-option ${selected?.value === system.value ? 'is-active' : ''}`}
            key={system.value} style={{ '--system-accent': getPortalAccent(system) }} data-system={system.value} aria-pressed={selected?.value === system.value} disabled={busy} onClick={() => onSelect(system.value)}>
            <span className="system-option-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="system-option-copy"><small>{system.source === 'manifest' ? '自定义系统' : '系统内置'}</small><strong>{system.label}</strong></span>
            <ArrowRightOutlined className="system-option-arrow" aria-hidden="true" />
          </button>)}
          {!visible.length && <div className="portal-no-systems"><strong>{scope === undefined ? '验证密钥后显示系统' : '没有找到可用系统'}</strong><p>{scope === undefined ? '输入访问密钥并点击“验证密钥”。' : '试试其他名称、切换到“全部”，或更换密钥。'}</p></div>}
        </div>
        <form id="portal-entry-form" className="portal-entry-form" onSubmit={(event) => { event.preventDefault(); if (busy) return; setEditingKey(false); if (scope === undefined) onValidate(); else if (selected) onEnter(selected); }}>
          {showKeyEditor ? <>
            <div className="portal-license-summary">
              <label htmlFor="portal-system-key">访问密钥</label>
              {scope !== undefined && <button type="button" className="portal-text-button" disabled={busy} onClick={() => setEditingKey(false)}>收起</button>}
            </div>
            <div className="portal-entry-controls">
              <input ref={keyInputRef} id="portal-system-key" value={accessKey} onChange={(event) => onKeyChange(event.target.value)} disabled={busy}
                placeholder="请输入访问密钥" autoComplete="off" aria-describedby={error ? 'portal-entry-error' : undefined} />
              <button type="button" className="portal-validate-button" onClick={validateKey} disabled={busy || !accessKey.trim()}>{phase === 'validating' ? '正在验证…' : '验证密钥'}</button>
            </div>
          </> : <div className="portal-license-summary">
            <span className="portal-license-valid"><span aria-hidden="true" />密钥已验证</span>
            <button type="button" className="portal-text-button" onClick={() => setEditingKey(true)} disabled={busy}>更换密钥</button>
          </div>}
          {error && <p id="portal-entry-error" className="portal-entry-error" role="alert">{error}</p>}
        </form>
      </aside>
      <section className="system-selector-scene" aria-label="系统粒子预览">
        <div ref={onHost} className="system-scene-particle-host" aria-hidden="true" />
        {expanded && !monitoring && <div className="portal-expanded-toolbar">
          <button ref={returnButtonRef} type="button" onClick={onReturnToSelector}>← 返回系统列表</button><strong>{selected?.label}</strong>
        </div>}
        {expanded && !monitoring && <span className="portal-entry-transition-status" role="status">正在进入 {selected?.label}…</span>}
        {expanded && !directEntry && runtime}
        <div className="system-scene-chrome">
        <div className="system-scene-grid" aria-hidden="true" /><div className="system-scene-vignette" aria-hidden="true" />
        <span className="system-scene-status" role="status">{status}</span>
        <div className="system-scene-copy" style={{ '--system-accent': getPortalAccent(selected) }}>
          <span className="system-scene-scan" aria-hidden="true" />
          <span data-scene-copy className="system-scene-eyebrow">{categoryInfo?.title || 'SYSTEM LIBRARY'}</span>
          <h3 data-scene-copy>{selected?.label || '从左侧选择系统'}</h3>
          <p data-scene-copy>{selected?.source === 'manifest' ? '使用已安装的协议、算法、渲染和图表配置。' : '进入现有监测界面，连接设备后查看实时数据。'}</p>
          <button data-scene-copy type="submit" form="portal-entry-form" className="system-scene-enter" disabled={!selected || busy} title="进入时切换系统并关闭旧串口，不会自动连接设备">
            {phase === 'validating' ? '正在验证密钥…' : phase === 'switching' ? '正在进入系统…' : phase === 'entering' ? '正在准备监测画布…' : '进入该系统'} <ArrowRightOutlined aria-hidden="true" />
          </button>
          {directEntry && phase === 'entering' && <button type="button" className="portal-text-button" onClick={onReturnToSelector}>取消进入</button>}
        </div>
        </div>
      </section>
      <button type="button" className="system-selector-close" onClick={onBack} disabled={busy} aria-label="返回首页">
        <span className="system-close-ring" aria-hidden="true" />
        <span className="system-close-line system-close-line-a" aria-hidden="true" />
        <span className="system-close-line system-close-line-b" aria-hidden="true" />
      </button>
    </section>
    {directEntry && runtime}
  </div>;
}
