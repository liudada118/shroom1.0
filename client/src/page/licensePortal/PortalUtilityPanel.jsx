import React, { useEffect, useRef, useState } from 'react';
import { Tooltip } from 'antd';
import { CheckOutlined, CloseOutlined, ToolOutlined } from '@ant-design/icons';
import './PortalUtilityPanel.css';

export const PORTAL_TOOL_CATEGORIES = [
  { id: 'view', label: '视角调节' }, { id: 'analysis', label: '数据分析' },
  { id: 'processing', label: '数据处理' }, { id: 'settings', label: '系统设置' },
];

/** 管理非模态工具箱焦点；只处理栏内 Escape，关闭后不抢其他弹窗焦点。 */
export function bindPortalUtilityPanelFocus(root, onClose, dismissHint) {
  if (!root) return undefined;
  const owner = root.ownerDocument;
  const opener = owner.activeElement;
  root.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  /** 只消费本面板内未被子控件处理的 Escape。 */
  const keydown = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || !root.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (dismissHint?.()) return;
    onClose?.();
  };
  root.addEventListener('keydown', keydown);
  return () => {
    root.removeEventListener('keydown', keydown);
    if ((root.contains(owner.activeElement) || owner.activeElement === owner.body) && opener?.isConnected) {
      opener.focus({ preventScroll: true });
    }
  };
}

/** 用悬停和键盘焦点显示说明；禁用工具保留可聚焦的说明入口。 */
export function PortalUtilityItem({ item, hintOpen, onHintOpenChange }) {
  const card = <button type="button" className={`portal-utility-card${item.active ? ' is-active' : ''}`}
    aria-label={item.label} aria-pressed={typeof item.active === 'boolean' ? item.active : undefined}
    disabled={Boolean(item.disabled)} onClick={item.onClick}>
    <span className="portal-utility-card-icon" aria-hidden="true">{item.icon || <ToolOutlined />}</span>
    <span className="portal-utility-card-content"><strong>{item.label}</strong>
      {(item.disabled || item.active) && <span className="portal-utility-card-status">
        {item.disabled ? '暂不可用' : <><CheckOutlined aria-hidden="true" />已启用</>}
      </span>}
    </span>
  </button>;
  return <Tooltip title={item.description} trigger={['hover', 'focus']} placement="top" color="#102535"
    arrow={false} align={{ offset: [0, -96] }}
    open={hintOpen} onOpenChange={onHintOpenChange} destroyOnHidden
    classNames={{ root: 'portal-utility-tooltip' }}
    getPopupContainer={(trigger) => trigger.ownerDocument.body}>
    {item.disabled ? <span className="portal-utility-disabled-hint" tabIndex={0} role="group"
      aria-label={`${item.label}，暂不可用`}>{card}</span> : card}
  </Tooltip>;
}

/** 展示宿主提供的工具动作，不自行建立设备、算法或数据下载逻辑。 */
export default function PortalUtilityPanel({ open, onClose, items = [], displayContent }) {
  const rootRef = useRef(null);
  const hintRef = useRef(null);
  const [hintId, setHintId] = useState(null);
  const [category, setCategory] = useState('view');
  const categories = displayContent ? [...PORTAL_TOOL_CATEGORIES, { id: 'display', label: '显示与语言' }] : PORTAL_TOOL_CATEGORIES;
  const categorized = Boolean(displayContent) || items.some((item) => item.category);
  const visibleItems = categorized ? items.filter((item) => (item.category || 'settings') === category) : items;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const releaseFocus = bindPortalUtilityPanelFocus(rootRef.current, () => onCloseRef.current?.(), () => {
      if (hintRef.current === null) return false;
      hintRef.current = null;
      setHintId(null);
      return true;
    });
    return () => {
      releaseFocus?.();
      hintRef.current = null;
      setHintId(null);
    };
  }, [open]);

  /** 仅记录当前说明，延迟的关闭事件不影响已切换到另一工具的提示。 */
  const changeHint = (id, visible) => {
    if (!open || (!visible && hintRef.current !== id)) return;
    hintRef.current = visible ? id : null;
    setHintId(hintRef.current);
  };

  /** 分类切换先撤下提示；方向键只在分类栏内切换，不劫持画布快捷键。 */
  const changeCategory = (id) => {
    hintRef.current = null;
    setHintId(null);
    setCategory(id);
  };
  /** 提供标签页的方向键与首尾键导航。 */
  const navigateCategory = (event, index) => {
    const count = categories.length;
    const target = event.key === 'ArrowRight' ? (index + 1) % count : event.key === 'ArrowLeft' ? (index + count - 1) % count
      : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null;
    if (target === null) return;
    event.preventDefault();
    changeCategory(categories[target].id);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[target]?.focus();
  };

  return <aside ref={rootRef} id="portal-utility-panel" className={`portal-utility-panel${categorized ? ' is-categorized' : ''}${open ? ' is-open' : ''}`}
    aria-labelledby="portal-utility-title" aria-hidden={!open} inert={!open}>
    <header className="portal-utility-head">
      <span className="portal-utility-title"><ToolOutlined aria-hidden="true" /><span><small>WORKSPACE TOOLS</small><strong id="portal-utility-title">实用工具</strong></span></span>
      <button type="button" aria-label="收起实用工具" onClick={onClose}><CloseOutlined aria-hidden="true" /></button>
    </header>
    {categorized && <div className="portal-utility-tabs" role="tablist" aria-label="工具分类">
      {categories.map((entry, index) => <button key={entry.id} type="button" role="tab"
        id={`portal-tool-tab-${entry.id}`} aria-selected={category === entry.id} aria-controls="portal-utility-category"
        tabIndex={category === entry.id ? 0 : -1} onClick={() => changeCategory(entry.id)} onKeyDown={(event) => navigateCategory(event, index)}>{entry.label}</button>)}
    </div>}
    <div className={`portal-utility-grid${category === 'display' ? ' portal-utility-display' : ''}`} id="portal-utility-category" role={categorized ? 'tabpanel' : undefined}
      aria-labelledby={categorized ? `portal-tool-tab-${category}` : undefined}>
      {category === 'display' ? displayContent : visibleItems.length ? visibleItems.map((item) => <PortalUtilityItem key={item.id} item={item}
        hintOpen={open && hintId === item.id} onHintOpenChange={(visible) => changeHint(item.id, visible)} />)
        : <p className="portal-utility-empty">当前系统没有可用工具。</p>}
    </div>
  </aside>;
}
