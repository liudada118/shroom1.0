import { useCallback, useEffect, useRef, useState } from 'react';
import { AppstoreOutlined, LeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import UpdateNotifier from '../updater/UpdateNotifier';
import AgentWorkspace from '../../features/agent/AgentWorkspace';
import AppServices from './AppServices';
import './AppTools.css';

/** 将应用入口收进悬停横幅，保留常驻Agent和独立更新状态。 */
export default function AppTools() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [statusContainer, setStatusContainer] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const bannerRef = useRef(null);
  const pointerInside = useRef(false);
  const keyboardInside = useRef(false);
  const restoringFocus = useRef(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  /** 仅识别横幅和折叠入口的真实DOM，排除React Portal内的对话框事件。 */
  const containsTool = useCallback((target) => target instanceof Node
    && (triggerRef.current?.contains(target) || bannerRef.current?.contains(target)), []);
  /** 收起后将弹窗焦点交还常驻入口，不尝试聚焦已经inert的按钮。 */
  const restoreTriggerFocus = useCallback((force = false) => {
    if (expandedRef.current) return;
    const active = document.activeElement;
    if (!force && active && active !== document.body && active.getClientRects().length && !active.closest('[inert]')) return;
    restoringFocus.current = true;
    triggerRef.current?.focus({ preventScroll: true });
    restoringFocus.current = false;
  }, []);
  /** 隐藏按钮立即退出交互，焦点回到有文字提示的入口。 */
  const collapse = useCallback(() => {
    keyboardInside.current = false;
    expandedRef.current = false;
    setExpanded(false);
    restoreTriggerFocus(true);
  }, [restoreTriggerFocus]);

  useEffect(() => {
    const root = rootRef.current;
    /** 用原生DOM边界保持悬停，避免外部React树Portal进来的反馈按钮触发假离开。 */
    const enter = (event) => {
      if (event.pointerType !== 'mouse') return;
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      if (!root.contains(hit) || hit?.closest('dialog, [role="dialog"]')) return;
      pointerInside.current = true;
      setExpanded(true);
    };
    /** 鼠标离开整个真实工具区时收起，键盘正在操作时保持展开。 */
    const leave = (event) => {
      if (event.pointerType !== 'mouse') return;
      pointerInside.current = false;
      if (!keyboardInside.current) setExpanded(false);
    };
    /** 鼠标点击不持有键盘展开状态。 */
    const pointerDown = (event) => {
      if (containsTool(event.target)) keyboardInside.current = false;
    };
    /** Tab进入工具区时提供与悬停相同的入口。 */
    const focusIn = (event) => {
      if (!restoringFocus.current && containsTool(event.target) && event.target.matches(':focus-visible')) {
        keyboardInside.current = true;
        setExpanded(true);
      }
    };
    /** 只按真实DOM焦点离开收回，弹窗Portal不参与横幅持有。 */
    const focusOut = (event) => {
      if (!containsTool(event.target) || containsTool(event.relatedTarget)) return;
      keyboardInside.current = false;
      if (!pointerInside.current) setExpanded(false);
    };
    /** Esc只关闭横幅，不截获Agent或应用设置弹窗的按键。 */
    const keyDown = (event) => {
      if (event.key !== 'Escape' || !expandedRef.current || !containsTool(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      collapse();
    };
    /** 触屏点击其他区域时收回横幅，不拦截原有控件操作。 */
    const outside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        keyboardInside.current = false;
        setExpanded(false);
      }
    };
    root.addEventListener('pointerenter', enter);
    root.addEventListener('pointerleave', leave);
    root.addEventListener('pointerdown', pointerDown, true);
    root.addEventListener('focusin', focusIn);
    root.addEventListener('focusout', focusOut);
    root.addEventListener('keydown', keyDown, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      root.removeEventListener('pointerenter', enter);
      root.removeEventListener('pointerleave', leave);
      root.removeEventListener('pointerdown', pointerDown, true);
      root.removeEventListener('focusin', focusIn);
      root.removeEventListener('focusout', focusOut);
      root.removeEventListener('keydown', keyDown, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [collapse, containsTool]);

  return <div ref={rootRef} className={`shroom-app-tools${expanded ? ' is-expanded' : ''}`}
    role="group" aria-label={t('appTools.label')} data-expanded={expanded}>
    <div className="shroom-app-status-slot" ref={setStatusContainer} />
    <button ref={triggerRef} type="button" className="shroom-app-tool shroom-app-tools-toggle"
      aria-expanded={expanded} aria-controls="shroom-app-tools-banner"
      aria-label={t(expanded ? 'appTools.collapse' : 'appTools.expand')}
      title={t('appTools.description')}
      onClick={() => {
        if (expanded) collapse();
        else setExpanded(true);
      }}>
      <AppstoreOutlined />
      <span className="shroom-app-tools-copy"><strong>{t('appTools.label')}</strong>
        <small className="shroom-app-tools-hover-hint">{t(expanded ? 'appTools.leaveHint' : 'appTools.hoverHint')}</small>
        <small className="shroom-app-tools-tap-hint">{t(expanded ? 'appTools.closeHint' : 'appTools.tapHint')}</small>
      </span>
      <LeftOutlined className="shroom-app-tools-chevron" />
    </button>
    <div ref={bannerRef} id="shroom-app-tools-banner" className="shroom-app-tools-banner"
      inert={!expanded} aria-hidden={!expanded}>
      <div className="shroom-app-tools-banner-inner">
        <UpdateNotifier statusContainer={statusContainer} onAfterDialogClose={restoreTriggerFocus} />
        <AppServices onAfterDialogClose={restoreTriggerFocus} />
        <div id="shroom-app-feedback" className="shroom-app-feedback-slot" />
      </div>
    </div>
    <AgentWorkspace />
  </div>;
}
