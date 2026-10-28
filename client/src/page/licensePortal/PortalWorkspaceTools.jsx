import i18n from '../../i18n';
import React, { useEffect, useRef, useState } from 'react';
import { RotateLeftOutlined, RotateRightOutlined, ZoomInOutlined, ZoomOutOutlined, AimOutlined, ReloadOutlined, SelectOutlined, ColumnWidthOutlined, SwapOutlined, VerticalAlignMiddleOutlined } from '@ant-design/icons';
import PortalUtilityPanel from './PortalUtilityPanel';
import PortalScreenRuler from './PortalScreenRuler';
import PortalSelectionTools from './PortalSelectionTools';

/** 读取当前已挂载的画布能力；未接入的渲染器不能冒充支持旋转或框选。 */
export function readWorkspaceToolSupport(renderer) {
  const view = renderer?.getViewTools?.();
  const state = view?.getState?.();
  return { view: state?.available ? view : null, flipX: Boolean(state?.flipX), flipY: Boolean(state?.flipY),
    select: typeof renderer?.changeSelectFlag === 'function' && state?.selectionSafe !== false
      && (typeof renderer?.getSelectionTools !== 'function' || Boolean(renderer.getSelectionTools())) };
}

/** 组合真正的视角、分析与数据处理入口；关闭工具箱不阻止画布操作。 */
export default function PortalWorkspaceTools({ open, onClose, rendererRef, selectionActive, onSelectionChange, items = [], displayContent, systemKey }) {
  const [support, setSupport] = useState(() => readWorkspaceToolSupport(rendererRef?.current));
  const [ruler, setRuler] = useState(false);
  const [selectionApi, setSelectionApi] = useState(null);
  const rendererSeen = useRef(rendererRef?.current);
  useEffect(() => {
    if (!open && !ruler && !selectionActive) return undefined;
    /** 异步场景挂载/模式切换时及时撤销旧能力，不轮询传感器数据。 */
    const refresh = () => {
      const current = rendererRef?.current;
      if (current !== rendererSeen.current) {
        rendererSeen.current = current;
        setRuler(false);
      }
      const next = readWorkspaceToolSupport(current);
      setSelectionApi(current?.getSelectionTools?.() || null);
      setSupport((previous) => Object.keys(next).every((key) => next[key] === previous[key]) ? previous : next);
    };
    refresh(); const timer = setInterval(refresh, 250);
    return () => clearInterval(timer);
  }, [open, ruler, selectionActive, rendererRef]);

  /** 变换前退出分析手势，避免旧屏幕框或量尺被误当作变换后的测量。 */
  const act = (method, ...args) => {
    setRuler(false);
    if (selectionActive) onSelectionChange?.(false);
    const current = readWorkspaceToolSupport(rendererRef?.current);
    current.view?.[method]?.(...args);
    setSupport(readWorkspaceToolSupport(rendererRef?.current));
  };
  const unavailable = i18n.t('monitorUi.viewUnavailable');
  const canSelect = support.select && !support.flipX && !support.flipY;
  /** 仅在当前原生渲染器确实支持框选时启用，量尺和框选互斥。 */
  const select = () => {
    const current = readWorkspaceToolSupport(rendererRef?.current);
    if (!current.select || current.flipX || current.flipY) return;
    setRuler(false); onSelectionChange?.(!selectionActive);
  };
  const viewItems = [
    { id: 'rotate-x', label: i18n.t('monitorUi.rotateXPositive'), icon: <RotateRightOutlined />, description: i18n.t('monitorUi.rotateXHint'), method: 'rotate', args: ['x', 1] },
    { id: 'rotate-back', label: i18n.t('monitorUi.rotateXNegative'), icon: <RotateLeftOutlined />, description: i18n.t('monitorUi.rotateXBackHint'), method: 'rotate', args: ['x', -1] },
    { id: 'top', label: i18n.t('monitorUi.topView'), icon: <AimOutlined />, description: i18n.t('monitorUi.topViewHint'), method: 'top' },
    { id: 'zoom-in', label: i18n.t('monitorUi.zoomIn'), icon: <ZoomInOutlined />, description: i18n.t('monitorUi.zoomInHint'), method: 'zoom', args: [1] },
    { id: 'zoom-out', label: i18n.t('monitorUi.zoomOut'), icon: <ZoomOutOutlined />, description: i18n.t('monitorUi.zoomOutHint'), method: 'zoom', args: [-1] },
    { id: 'view-reset', label: i18n.t('monitorUi.resetView'), icon: <ReloadOutlined />, description: i18n.t('monitorUi.resetViewHint'), method: 'reset' },
  ].map((item) => ({ ...item, category: 'view', disabled: !support.view,
    description: support.view ? item.description : unavailable, onClick: () => act(item.method, ...(item.args || [])) }));
  return <div className="portal-workspace-tools" data-native-view={Boolean(support.view)}><PortalUtilityPanel open={open} onClose={onClose} displayContent={displayContent} items={[
    ...viewItems,
    { id: 'select', category: 'analysis', label: i18n.t('monitorUi.regionAnalysis'), icon: <SelectOutlined />, active: Boolean(selectionActive), disabled: !canSelect,
      description: canSelect ? i18n.t('monitorUi.regionAnalysisHint') : typeof rendererRef?.current?.changeSelectFlag === 'function' ? i18n.t('monitorUi.resetBeforeSelecting') : i18n.t('monitorUi.regionStatsUnavailable'), onClick: select },
    { id: 'ruler', category: 'analysis', label: i18n.t('monitorUi.sensorRuler'), icon: <ColumnWidthOutlined />, active: ruler, disabled: !selectionApi?.getSensorPoints,
      description: selectionApi?.getSensorPoints ? i18n.t('monitorUi.sensorRulerHint') : i18n.t('monitorUi.sensorRulerUnavailable'),
      onClick: () => { if (selectionActive) onSelectionChange?.(false); setRuler(!ruler); } },
    { id: 'flip-x', category: 'processing', label: i18n.t('monitorUi.flipHorizontal'), icon: <SwapOutlined />, active: support.flipX, disabled: !support.view,
      description: support.view ? i18n.t('monitorUi.flipHorizontalHint') : unavailable, onClick: () => act('flip', 'x') },
    { id: 'flip-y', category: 'processing', label: i18n.t('monitorUi.flipVertical'), icon: <VerticalAlignMiddleOutlined />, active: support.flipY, disabled: !support.view,
      description: support.view ? i18n.t('monitorUi.flipVerticalHint') : unavailable, onClick: () => act('flip', 'y') },
    ...items,
  ]} /><PortalScreenRuler active={ruler} api={selectionApi} systemKey={systemKey} onClose={() => setRuler(false)} />
    {selectionActive && selectionApi && <PortalSelectionTools api={selectionApi} onClose={() => onSelectionChange?.(false)} />}</div>;
}
