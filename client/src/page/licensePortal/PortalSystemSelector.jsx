import i18n from '../../i18n';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { PORTAL_CATEGORIES, canSubmitPortalSystem, filterPortalSystems, getAuthorizedPortalSystems } from './portalSystems';
import { getPortalAccent, getPortalScene } from './scene/sceneCatalog';
import { useSelectorMotion, useSceneCopyMotion } from './usePortalMotion';

const CATEGORY_LABELS = { all: 'all', care: 'care', vehicle: 'seat', embodied: 'tactile', custom: 'custom' };

/** 参考项目的列表与粒子场景弹层；目录、密钥和进入操作使用 Shroom 真实链路。 */
export default function PortalSystemSelector({ open, systems, category, selectedId, scope, managedIds = [], syncStatus = '', phase,
  error, loading, catalogError, accessKey, onKeyChange, onCategory, onSelect, onBack, onEnter, onRevise, onSubmit, onReload, onValidate,
  sceneStatus, onPreview, onHost, expanded = false, onReturnToSelector, monitoring = false, dataView = false, directEntry = false, runtime }) {
  const [query, setQuery] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const headingRef = useRef(null);
  const keyInputRef = useRef(null);
  const panelRef = useRef(null);
  const backdropRef = useRef(null);
  const returnButtonRef = useRef(null);
  const wasExpanded = useRef(false);
  const authorized = useMemo(() => getAuthorizedPortalSystems(systems, scope, managedIds), [systems, scope, managedIds]);
  const visible = useMemo(() => filterPortalSystems(authorized, category, query), [authorized, category, query]);
  const selected = (expanded || monitoring ? authorized : visible).find((item) => item.value === selectedId) || visible[0];
  useSelectorMotion(backdropRef, open, visible.map((item) => item.value).join('|'));
  useSceneCopyMotion(panelRef, selected?.value, open && !expanded);
  const busy = phase !== 'idle';
  const showKeyEditor = scope === undefined || editingKey;
  const categoryInfo = PORTAL_CATEGORIES.find((item) => item.key === selected?.category);
  const sceneKey = getPortalScene(selected);
  const status = sceneStatus.state === 'unavailable' ? i18n.t('monitorUi.previewUnavailable')
    : sceneStatus.key !== sceneKey || sceneStatus.state === 'loading' ? i18n.t('monitorUi.loadingParticles')
      : sceneStatus.state === 'morphing' ? i18n.t('monitorUi.transitioningParticles')
      : sceneStatus.state === 'error' ? i18n.t('monitorUi.previewFailed') : i18n.t('monitorUi.previewOnly');

  useEffect(() => { onPreview(selected || null); }, [selected, onPreview]);
  useEffect(() => {
    if (!open || expanded || !selectedId) return;
    const selectedButton = [...(panelRef.current?.querySelectorAll('.system-option') || [])]
      .find((button) => button.dataset.system === selectedId);
    selectedButton?.scrollIntoView?.({ block: 'nearest' });
  }, [open, expanded, selectedId, visible]);
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
      aria-modal={monitoring ? undefined : true} aria-label={monitoring ? i18n.t('monitorUi.monitorSystem', { value0: selected?.label || '' }) : undefined} aria-labelledby={monitoring ? undefined : 'portal-selector-heading'}
      aria-busy={busy} inert={directEntry && dataView} aria-hidden={directEntry && dataView}>
      <aside className="system-selector-list" inert={expanded}>
        <div className="system-selector-heading">
          <span className="system-selector-kicker">SHROOM SYSTEM INDEX</span>
          <h2 id="portal-selector-heading" tabIndex={-1} ref={headingRef}>{i18n.t('monitorUi.chooseSystemTitle')}</h2>
          <p>{i18n.t('monitorUi.chooseSystemHint')}</p>
        </div>
        <div className="portal-filter-tabs" aria-label={i18n.t('monitorUi.systemCategories')}>
          {[{ key: 'all', title: i18n.t('monitorUi.all') }, ...PORTAL_CATEGORIES].map((item) => <button key={item.key}
            type="button" aria-label={item.key === 'all' ? i18n.t('monitorUi.all') : i18n.t(`monitorUi.${item.key}Title`)} aria-pressed={category === item.key} disabled={busy}
            onClick={() => { setQuery(''); onCategory(item.key); }}>{i18n.t(`monitorUi.${CATEGORY_LABELS[item.key]}`)}</button>)}
        </div>
        <label className="portal-system-search"><SearchOutlined aria-hidden="true" />
          <input aria-label={i18n.t('monitorUi.searchSystems')} placeholder={i18n.t('monitorUi.searchSystemsPlaceholder')} value={query} disabled={busy} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <div className="portal-directory-status" role="status">
          <span>{phase === 'validating' ? i18n.t('monitorUi.validatingKey') : scope === undefined ? i18n.t('monitorUi.verifyFirst') : loading ? i18n.t('monitorUi.loadingSystems') : i18n.t('monitorUi.availableSystems', { value0: visible.length })}</span>
          <button type="button" className="portal-text-button" onClick={onReload} disabled={loading || busy} aria-label={i18n.t('monitorUi.refreshSystems')}><ReloadOutlined aria-hidden="true" />{i18n.t('monitorUi.refresh')}</button>
        </div>
        {catalogError && <p className="portal-catalog-error" role="alert">{i18n.t('monitorUi.catalogFailed')}</p>}
        {syncStatus && scope !== undefined && <p className="portal-directory-note" role="status">{syncStatus}</p>}
        <div className="system-options" aria-label={i18n.t('monitorUi.systemList')}>
          {visible.map((system, index) => <button type="button" className={`system-option portal-system-option ${selected?.value === system.value ? 'is-active' : ''}`}
            key={system.value} style={{ '--system-accent': getPortalAccent(system) }} data-system={system.value} aria-pressed={selected?.value === system.value} disabled={busy} onClick={() => onSelect(system.value)}>
            <span className="system-option-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="system-option-copy"><small>{system.managed ? i18n.t('monitorUi.companySystem') : system.editable ? i18n.t('monitorUi.localSystem') : i18n.t('monitorUi.builtInSystem')}</small><strong>{system.label}</strong></span>
            <ArrowRightOutlined className="system-option-arrow" aria-hidden="true" />
          </button>)}
          {!visible.length && <div className="portal-no-systems"><strong>{scope === undefined ? i18n.t('monitorUi.verifyToShow') : i18n.t('monitorUi.noSystems')}</strong><p>{scope === undefined ? i18n.t('monitorUi.verifyInstruction') : i18n.t('monitorUi.searchSystemsAgain')}</p></div>}
        </div>
        <form id="portal-entry-form" className="portal-entry-form" onSubmit={(event) => { event.preventDefault(); if (busy) return; setEditingKey(false); if (scope === undefined) onValidate(); else if (selected) onEnter(selected); }}>
          {showKeyEditor ? <>
            <div className="portal-license-summary">
              <label htmlFor="portal-system-key">{i18n.t('monitorUi.accessKey')}</label>
              {scope !== undefined && <button type="button" className="portal-text-button" disabled={busy} onClick={() => setEditingKey(false)}>{i18n.t('monitorUi.collapse')}</button>}
            </div>
            <div className="portal-entry-controls">
              <input ref={keyInputRef} id="portal-system-key" value={accessKey} onChange={(event) => onKeyChange(event.target.value)} disabled={busy}
                placeholder={i18n.t('monitorUi.accessKeyPlaceholder')} autoComplete="off" aria-describedby={error ? 'portal-entry-error' : undefined} />
              <button type="button" className="portal-validate-button" onClick={validateKey} disabled={busy || !accessKey.trim()}>{phase === 'validating' ? i18n.t('monitorUi.validating') : i18n.t('monitorUi.validateKey')}</button>
            </div>
          </> : <div className="portal-license-summary">
            <span className="portal-license-valid"><span aria-hidden="true" />{i18n.t('monitorUi.keyValid')}</span>
            <button type="button" className="portal-text-button" onClick={() => setEditingKey(true)} disabled={busy}>{i18n.t('monitorUi.changeKey')}</button>
          </div>}
          {error && <p id="portal-entry-error" className="portal-entry-error" role="alert">{error}</p>}
        </form>
      </aside>
      <section className="system-selector-scene" aria-label={i18n.t('monitorUi.systemPreview')}>
        <div ref={onHost} className="system-scene-particle-host" aria-hidden="true" />
        {expanded && !monitoring && <div className="portal-expanded-toolbar">
          <button ref={returnButtonRef} type="button" onClick={onReturnToSelector}>{i18n.t('monitorUi.backSystems')}</button><strong>{selected?.label}</strong>
        </div>}
        {expanded && !monitoring && <span className="portal-entry-transition-status" role="status">{i18n.t('monitorUi.enteringNamedSystem', { name: selected?.label })}</span>}
        {expanded && !directEntry && runtime}
        <div className="system-scene-chrome">
        <div className="system-scene-grid" aria-hidden="true" /><div className="system-scene-vignette" aria-hidden="true" />
        <span className="system-scene-status" role="status">{status}</span>
        <div className="system-scene-copy" style={{ '--system-accent': getPortalAccent(selected) }}>
          <span className="system-scene-scan" aria-hidden="true" />
          <span data-scene-copy className="system-scene-eyebrow">{categoryInfo ? i18n.t(`monitorUi.${categoryInfo.key}Title`) : 'SYSTEM LIBRARY'}</span>
          <h3 data-scene-copy>{selected?.label || i18n.t('monitorUi.chooseFromLeft')}</h3>
          <p data-scene-copy>{selected?.source === 'manifest' ? i18n.t('monitorUi.manifestDescription') : i18n.t('monitorUi.nativeDescription')}</p>
          <button data-scene-copy type="submit" form="portal-entry-form" className="system-scene-enter" disabled={!selected || busy} title={i18n.t('monitorUi.entryHint')}>
            {phase === 'validating' ? i18n.t('monitorUi.validatingKey') : phase === 'switching' ? i18n.t('monitorUi.enteringSystem') : phase === 'entering' ? i18n.t('monitorUi.preparingCanvas') : i18n.t('monitorUi.enterSystem')} <ArrowRightOutlined aria-hidden="true" />
          </button>
          {canSubmitPortalSystem(selected) && <button data-scene-copy type="button" className="portal-system-submit" disabled={busy}
            onClick={() => onSubmit?.(selected)}>{i18n.t('monitorUi.submitReview')}</button>}
          {selected?.managed && onRevise && <button data-scene-copy type="button" className="portal-text-button" disabled={busy}
            onClick={() => onRevise(selected)}>{i18n.t('monitorUi.createRevision')}</button>}
          {directEntry && phase === 'entering' && <button type="button" className="portal-text-button" onClick={onReturnToSelector}>{i18n.t('monitorUi.cancelEntry')}</button>}
        </div>
        </div>
      </section>
      <button type="button" className="system-selector-close" onClick={onBack} disabled={busy} aria-label={i18n.t('monitorUi.backHome')}>
        <span className="system-close-ring" aria-hidden="true" />
        <span className="system-close-line system-close-line-a" aria-hidden="true" />
        <span className="system-close-line system-close-line-b" aria-hidden="true" />
      </button>
    </section>
    {directEntry && runtime}
  </div>;
}
