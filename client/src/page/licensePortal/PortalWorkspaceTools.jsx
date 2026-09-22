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
  const unavailable = '当前渲染器尚未接入此视角工具。';
  const canSelect = support.select && !support.flipX && !support.flipY;
  /** 仅在当前原生渲染器确实支持框选时启用，量尺和框选互斥。 */
  const select = () => {
    const current = readWorkspaceToolSupport(rendererRef?.current);
    if (!current.select || current.flipX || current.flipY) return;
    setRuler(false); onSelectionChange?.(!selectionActive);
  };
  const viewItems = [
    { id: 'rotate-x', label: 'X 轴 +30°', icon: <RotateRightOutlined />, description: '绕模型 X 轴旋转 30°。', method: 'rotate', args: ['x', 1] },
    { id: 'rotate-y', label: 'Y 轴 +30°', icon: <RotateRightOutlined />, description: '绕模型 Y 轴旋转 30°。', method: 'rotate', args: ['y', 1] },
    { id: 'rotate-back', label: 'Y 轴 −30°', icon: <RotateLeftOutlined />, description: '绕模型 Y 轴反向旋转 30°。', method: 'rotate', args: ['y', -1] },
    { id: 'top', label: '俯视', icon: <AimOutlined />, description: '从垫面上方观察。', method: 'top' },
    { id: 'zoom-in', label: '放大', icon: <ZoomInOutlined />, description: '拉近观察距离，不改变数据值。', method: 'zoom', args: [1] },
    { id: 'zoom-out', label: '缩小', icon: <ZoomOutOutlined />, description: '拉远观察距离，不改变数据值。', method: 'zoom', args: [-1] },
    { id: 'view-reset', label: '恢复视角', icon: <ReloadOutlined />, description: '恢复初始视角，撤销展示旋转与翻转。', method: 'reset' },
  ].map((item) => ({ ...item, category: 'view', disabled: !support.view,
    description: support.view ? item.description : unavailable, onClick: () => act(item.method, ...(item.args || [])) }));
  return <div className="portal-workspace-tools" data-native-view={Boolean(support.view)}><PortalUtilityPanel open={open} onClose={onClose} displayContent={displayContent} items={[
    ...viewItems,
    { id: 'select', category: 'analysis', label: '框选分析', icon: <SelectOutlined />, active: Boolean(selectionActive), disabled: !canSelect,
      description: canSelect ? '在画布拖出矩形，使用原生框选统计；再次点击退出并清除选区。' : typeof rendererRef?.current?.changeSelectFlag === 'function' ? '旋转或镜像视图暂不支持原生框选，请先恢复视角。' : '当前渲染器未提供原生区域统计接口。', onClick: select },
    { id: 'ruler', category: 'analysis', label: '传感点量尺', icon: <ColumnWidthOutlined />, active: ruler, disabled: !selectionApi?.getSensorPoints,
      description: selectionApi?.getSensorPoints ? '填写横纵点距后测量传感点中心距离，单位 mm；最多保留 8 条，可拖动线或端点。' : '当前布局尚未提供物理点位映射，请切换到规则矩阵原始数据或点图。',
      onClick: () => { if (selectionActive) onSelectionChange?.(false); setRuler(!ruler); } },
    { id: 'flip-x', category: 'processing', label: '水平翻转', icon: <SwapOutlined />, active: support.flipX, disabled: !support.view,
      description: support.view ? '沿模型 X 轴镜像展示，不改变原始数据、采集或导出。再次点击恢复。' : unavailable, onClick: () => act('flip', 'x') },
    { id: 'flip-y', category: 'processing', label: '纵向翻转', icon: <VerticalAlignMiddleOutlined />, active: support.flipY, disabled: !support.view,
      description: support.view ? '沿垫面 Z 轴镜像展示，压力高度不变，不改采集或导出。再次点击恢复。' : unavailable, onClick: () => act('flip', 'y') },
    ...items,
  ]} /><PortalScreenRuler active={ruler} api={selectionApi} systemKey={systemKey} onClose={() => setRuler(false)} />
    {selectionActive && selectionApi && <PortalSelectionTools api={selectionApi} onClose={() => onSelectionChange?.(false)} />}</div>;
}
