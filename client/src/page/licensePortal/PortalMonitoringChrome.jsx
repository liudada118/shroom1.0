import React from 'react';
import { AppstoreOutlined, LineChartOutlined, SlidersOutlined, ToolOutlined, ApiOutlined, PlayCircleOutlined, PauseCircleOutlined, HistoryOutlined, RadarChartOutlined, CloseOutlined } from '@ant-design/icons';
import './PortalUtilityPanel.css';

/** 会话栏直接显示串口下拉；回放仍打开记录弹窗，不模拟连接或采集状态。 */
export function PortalSessionBar({ mode, onMode, controlsOpen, onControls, deviceControls, selectedPorts, collecting, onStart, onStop, busy = false, elapsed = 0 }) {
  return <div className="portal-session-bar" aria-label="监测控制">
    <div className="portal-session-modes">
      <button type="button" aria-label="实时" className={mode === 'now' ? 'is-active' : ''} aria-pressed={mode === 'now'} disabled={busy} onClick={() => onMode('now')}><RadarChartOutlined aria-hidden="true" />实时</button>
      <button type="button" aria-label="回放" className={mode !== 'now' ? 'is-active' : ''} aria-pressed={mode !== 'now'} disabled={busy || collecting} title={collecting ? '请先结束采集' : '选择回放数据或批量下载'} onClick={() => onMode('playback')}><HistoryOutlined aria-hidden="true" />回放</button>
    </div>
    {mode === 'now' && deviceControls ? deviceControls : <button type="button" className="portal-device-launch" disabled={busy} aria-haspopup="dialog" aria-expanded={controlsOpen} onClick={onControls}>
      <ApiOutlined /><span>{mode === 'now' ? '连接设备' : '选择回放'}</span><small>{mode === 'now' ? selectedPorts ? '串口已选择' : '未选择串口' : '单选回放 · 多选下载'}</small><i aria-hidden="true" />
    </button>}
    <div className="portal-capture-actions">
      <button type="button" aria-label="开始采集" disabled={busy || collecting || mode !== 'now'} onClick={onStart}><PlayCircleOutlined />开始采集</button>
      <button type="button" aria-label="结束采集" disabled={busy || !collecting || mode !== 'now'} onClick={onStop}><PauseCircleOutlined />{collecting ? `${Math.floor(elapsed)}s · 停止` : '结束采集'}</button>
    </div>
  </div>;
}

/** 左侧拉手与抽屉一同平移，外层高度不变；GSAP 仍只控制内层入场。 */
export function PortalQuickTools({ chartsVisible, onCharts, algorithmsOpen, onAlgorithms, settingsOpen, onSettings, toolsOpen, onTools, collapsed = false, onCollapse }) {
  return <div className="portal-quick-tools-anchor"><div className={`portal-quick-tools-slide${collapsed ? ' is-collapsed' : ''}`}>
    <button type="button" className="portal-quick-tools-handle" aria-label={collapsed ? '展开快捷工具' : '收起快捷工具'}
      title={collapsed ? '展开快捷工具' : '收起快捷工具'} aria-expanded={!collapsed} aria-controls="portal-quick-tools-content" onClick={() => onCollapse?.(!collapsed)}>
      <span className="portal-drawer-grip" aria-hidden="true"><i /><i /></span><span>工具</span>
    </button>
    <aside className="portal-quick-tools" aria-label="快捷显示工具" aria-hidden={collapsed} inert={collapsed}>
    <header>
      <span className="portal-quick-tools-heading"><small>VISUAL TOOLS</small><strong>快捷工具</strong></span><i aria-hidden="true" />
    </header>
    <div id="portal-quick-tools-content" className="portal-quick-tools-grid" aria-hidden={collapsed} inert={collapsed}>
      <button type="button" className={algorithmsOpen ? 'is-active' : ''} aria-label="算法" title="算法超市" aria-expanded={Boolean(algorithmsOpen)} aria-controls="portal-algorithm-market" onClick={onAlgorithms}><AppstoreOutlined /><span>算法</span><small>超市</small></button>
      <button type="button" className={chartsVisible ? 'is-active' : ''} aria-label="图表" aria-pressed={chartsVisible} onClick={onCharts}><LineChartOutlined /><span>图表</span><small>{chartsVisible ? '显示' : '隐藏'}</small></button>
      <button type="button" className={settingsOpen ? 'is-active' : ''} aria-label="调节" aria-expanded={settingsOpen} onClick={onSettings}><SlidersOutlined /><span>调节</span><small>VISUAL</small></button>
      <button type="button" className={toolsOpen ? 'is-active' : ''} aria-label="工具" title="实用工具" aria-expanded={Boolean(toolsOpen)} aria-controls="portal-utility-panel" onClick={onTools}><ToolOutlined aria-hidden="true" /><span>工具</span><small>工具箱</small></button>
    </div>
    <footer aria-hidden={collapsed}><span><small>VIEW</small><strong>3D CENTER</strong></span><output>HOST DATA</output></footer>
  </aside></div></div>;
}

/** 设备弹层保留原生的多串口、渲染模式、语言和下载选项。 */
export function PortalControlsHeading({ onClose }) {
  return <header className="portal-controls-heading"><span>设备与显示设置</span><button type="button" aria-label="关闭设备设置" onClick={onClose}><CloseOutlined /></button></header>;
}
