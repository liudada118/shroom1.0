import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { packageDisabledReason, usePortalPackageRuntime } from './portalPackageRuntime';
import PortalPackageOutputs from './PortalPackageOutputs';
import { AppstoreOutlined, CheckOutlined, CloseOutlined, LineChartOutlined, HolderOutlined, SettingOutlined } from '@ant-design/icons';
import { addFormulaChartFromTemplate, findChartByTemplate, FORMULA_CHART_LIMIT, loadFormulaCharts, subscribeFormulaCharts } from '../../components/aside/formulaChartStore';
import { buildPortalAlgorithmTemplates, PORTAL_ALGORITHM_DRAG_TYPE, readPortalAlgorithmDrop } from './portalAlgorithmCatalog';
import './PortalAlgorithmMarket.css';

/** 参考式底部算法卡片栏；添加结果写入宿主图表 store，不建立第二套数据队列。 */
export default function PortalAlgorithmMarket({ open, matrixName, metricDefinitions, inputKind = 'matrix', dropTargetRef, onClose, onShowCharts, onConfigure }) {
  const rootRef = useRef(null);
  const openerRef = useRef(null);
  const callbacksRef = useRef({ onClose, onShowCharts });
  callbacksRef.current = { onClose, onShowCharts };
  const templates = useMemo(() => buildPortalAlgorithmTemplates(metricDefinitions, inputKind), [metricDefinitions, inputKind]);
  const [definitions, setDefinitions] = useState(() => loadFormulaCharts(matrixName));
  const [announcement, setAnnouncement] = useState('点击卡片，或拖入左侧图表区');
  const [dragging, setDragging] = useState(null);
  const [category, setCategory] = useState('charts');
  const [selectedChannel, setSelectedChannel] = useState('');
  const packages = usePortalPackageRuntime(matrixName, open);
  const channel = packages.snapshot.channels.find((entry) => entry.channelId === selectedChannel) || packages.snapshot.channels[0];

  useEffect(() => subscribeFormulaCharts((system, next) => {
    if (system === matrixName) {
      setDefinitions(next);
      setAnnouncement('图表清单已更新，点击卡片或拖入图表区继续添加');
    }
  }), [matrixName]);

  /** 重复添加不删除用户编辑，达到上限时保持原清单并给出明确反馈。 */
  const add = (template) => {
    if (!dropTargetRef.current) {
      setAnnouncement('当前系统未提供图表区，无法添加算法图表');
      return;
    }
    const result = addFormulaChartFromTemplate(matrixName, template);
    if (result.ok || result.reason === 'exists') callbacksRef.current.onShowCharts?.();
    setAnnouncement(result.ok ? `已添加「${template.name}」，接收真实数据后显示趋势`
      : result.reason === 'exists' ? `「${template.name}」已在图表区`
        : result.reason === 'limit' ? `最多显示 ${FORMULA_CHART_LIMIT} 张附加图表，请先在图表区删除一张` : '无法添加此算法图表');
  };
  const addRef = useRef(add);
  addRef.current = add;

  useEffect(() => {
    if (!open) return undefined;
    openerRef.current = document.activeElement;
    rootRef.current?.querySelector('button')?.focus({ preventScroll: true });
    /** 超市是非模态工作区，Escape 只在本栏内关闭，不抢设备弹窗的键盘事件。 */
    const keydown = (event) => {
      if (event.key !== 'Escape' || !rootRef.current?.contains(event.target)) return;
      event.preventDefault(); event.stopPropagation();
      callbacksRef.current.onClose();
    };
    const root = rootRef.current;
    root.addEventListener('keydown', keydown);
    return () => {
      root.removeEventListener('keydown', keydown);
      const focused = document.activeElement;
      if ((root.contains(focused) || focused === document.body) && openerRef.current?.isConnected) openerRef.current.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    const target = dropTargetRef.current;
    if (!open || !target) return undefined;
    /** 只处理本栏的拖放，保留画布零件栏原有 MIME 协议。 */
    const over = (event) => {
      if (!Array.from(event.dataTransfer.types).includes(PORTAL_ALGORITHM_DRAG_TYPE)) return;
      event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
      target.classList.add('is-algorithm-drop-active');
    };
    /** 离开整个观测面板时去掉落点提示，子元素切换不闪烁。 */
    const leave = (event) => {
      if (!target.contains(event.relatedTarget)) target.classList.remove('is-algorithm-drop-active');
    };
    /** 释放后再次校验当前系统与模板，避免拖动途中换系统导致串用。 */
    const drop = (event) => {
      const template = readPortalAlgorithmDrop(event.dataTransfer, matrixName, templates);
      target.classList.remove('is-algorithm-drop-active'); setDragging(null);
      if (!template) return;
      event.preventDefault(); addRef.current(template);
    };
    target.addEventListener('dragover', over);
    target.addEventListener('dragleave', leave);
    target.addEventListener('drop', drop);
    return () => {
      target.removeEventListener('dragover', over); target.removeEventListener('dragleave', leave); target.removeEventListener('drop', drop);
      target.classList.remove('is-algorithm-drop-active');
    };
  }, [open, matrixName, templates, dropTargetRef]);

  const addedCount = templates.filter((template) => findChartByTemplate(definitions, template)).length;
  const outputTarget = dropTargetRef.current?.querySelector('.aside');
  return <><aside ref={rootRef} id="portal-algorithm-market" className={`portal-algorithm-market ${open ? 'is-open' : ''}`}
    aria-label="算法超市" aria-hidden={!open} inert={!open}>
    <header className="portal-algorithm-market-head">
      <span className="portal-algorithm-market-title"><AppstoreOutlined aria-hidden="true" /><span><small>ALGORITHM MARKET</small><strong>算法超市</strong></span></span>
      <span className="portal-algorithm-market-count">{category === 'packages' ? '已启用' : '已添加'} <b>{category === 'packages' ? packages.snapshot.instances.length : addedCount}</b> / {category === 'packages' ? packages.snapshot.packages.length : templates.length}</span>
      <button type="button" onClick={onConfigure} className="portal-algorithm-configure"><SettingOutlined aria-hidden="true" />算法包设置</button>
      <button type="button" aria-label="收起算法超市" onClick={onClose}><CloseOutlined aria-hidden="true" /></button>
    </header>
    <div className="portal-algorithm-categories" aria-label="算法分类">
      <button type="button" aria-pressed={category === 'charts'} onClick={() => setCategory('charts')}>指标图表 · {templates.length}</button>
      <button type="button" aria-pressed={category === 'packages'} onClick={() => setCategory('packages')}>Python 算法包 · {packages.snapshot.packages.length}</button>
      {category === 'packages' && <select aria-label="算法输入传感器" value={channel?.channelId || ''} onChange={(event) => setSelectedChannel(event.target.value)}>
        {!packages.snapshot.channels.length && <option value="">等待传感器数据</option>}
        {packages.snapshot.channels.map((entry) => <option key={entry.channelId} value={entry.channelId}>{entry.label} · {entry.matrix ? `${entry.matrix.rows}×${entry.matrix.cols}` : '尺寸未知'}{entry.live ? '' : ' · 数据已中断'}</option>)}
      </select>}
    </div>
    <p className="portal-algorithm-market-status" role="status">{category === 'charts' ? announcement : packages.error || packages.snapshot.reason || '点击启用当前传感器算法；再次点击停用。结果进入左侧，切换系统后需重新选择。'}</p>
    <div className="portal-algorithm-market-track">
      {category === 'packages' ? packages.snapshot.packages.map((item) => {
        const instance = packages.snapshot.instances.find((entry) => entry.id === item.id);
        const reason = packageDisabledReason(item, channel, packages.snapshot);
        const enabled = Boolean(instance);
        return <button type="button" key={item.id} title={reason || item.description} className={`portal-algorithm-card is-package ${enabled || item.reserved ? 'is-added' : ''}`}
          aria-pressed={enabled || item.reserved} aria-label={`${enabled ? '停用' : '启用'}${item.name}`}
          disabled={Boolean(packages.busy) || (!enabled && Boolean(reason))}
          onClick={async () => { if (await packages.toggle(item.id, instance?.channelId || channel?.channelId, !enabled)) onShowCharts?.(); }}>
          <span className="portal-algorithm-card-top"><AppstoreOutlined aria-hidden="true" /><small>Python · {item.sampleRateHz || '—'} Hz 参考输入</small></span>
          <strong>{item.name}</strong><span className="portal-algorithm-card-description">{item.description}</span>
          <span className="portal-algorithm-card-output"><span>{enabled ? `${item.metricDefinitions.length} 个可选输出` : reason || `${item.metricDefinitions.length} 个输出`}</span><b>{packages.busy === item.id ? '处理中…' : enabled ? '停用' : item.reserved ? '系统内置' : reason ? '不可启用' : '启用 +'}</b></span>
        </button>;
      }) : templates.map((template) => {
        const added = Boolean(findChartByTemplate(definitions, template));
        return <button type="button" key={template.id} className={`portal-algorithm-card ${added ? 'is-added' : ''} ${dragging === template.id ? 'is-dragging' : ''}`}
          aria-label={`${added ? '已添加' : '添加'}${template.name}`} aria-pressed={added} draggable={!added}
          onClick={() => add(template)}
          onDragStart={(event) => {
            event.dataTransfer.setData(PORTAL_ALGORITHM_DRAG_TYPE, JSON.stringify({ matrixName, templateId: template.id }));
            event.dataTransfer.effectAllowed = 'copy'; setDragging(template.id); onShowCharts?.();
          }}
          onDragEnd={() => { setDragging(null); dropTargetRef.current?.classList.remove('is-algorithm-drop-active'); }}>
          <span className="portal-algorithm-card-top"><LineChartOutlined aria-hidden="true" /><small>{template.group}</small><HolderOutlined aria-hidden="true" /></span>
          <strong>{template.name}</strong><span className="portal-algorithm-card-description">{template.description}</span>
          <span className="portal-algorithm-card-output"><span>{template.unit || (template.group === '算法输出' ? '算法输出值' : template.group === '实时统计' ? '当前视图统计' : '原始点值')}</span><b>{added ? <><CheckOutlined aria-hidden="true" />已添加</> : '添加 +'}</b></span>
        </button>;
      })}
    </div>
  </aside>{outputTarget && createPortal(packages.snapshot.instances.map((instance) => {
    const item = packages.snapshot.packages.find((entry) => entry.id === instance.id);
    return item ? <PortalPackageOutputs key={`${instance.id}:${instance.token}`} item={item} instance={instance}
      channelLabel={packages.snapshot.channels.find((entry) => entry.channelId === instance.channelId)?.label || instance.channelId}
      busy={Boolean(packages.busy)} offline={Boolean(packages.error)} onDisable={() => packages.toggle(instance.id, instance.channelId, false)} /> : null;
  }), outputTarget)}</>;
}
