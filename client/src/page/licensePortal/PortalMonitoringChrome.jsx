import i18n from '../../i18n';
import React from 'react';
import { AppstoreOutlined, LineChartOutlined, SlidersOutlined, ToolOutlined, ApiOutlined, PlayCircleOutlined, PauseCircleOutlined, HistoryOutlined, RadarChartOutlined, CloseOutlined } from '@ant-design/icons';
import './PortalUtilityPanel.css';

/** 语言与显示选择随快捷工具收回，保留控件状态并禁用折叠后的交互。 */
export function PortalDisplayPanel({ languageControl, children, collapsed = false }) {
  return <section id="portal-display-panel" className="portal-display-panel" aria-labelledby="portal-display-title"
    aria-hidden={collapsed} inert={collapsed}>
    <header><SlidersOutlined aria-hidden="true" /><strong id="portal-display-title">{i18n.t('monitorUi.renderDisplay')}</strong></header>
    <div className="portal-display-fields">
      <label className="portal-display-language"><span>{i18n.t('monitorUi.language')}</span>{languageControl}</label>
      {children}
    </div>
  </section>;
}

/** 会话栏直接显示串口下拉；回放仍打开记录弹窗，不模拟连接或采集状态。 */
export function PortalSessionBar({ mode, onMode, controlsOpen, onControls, deviceControls, selectedPorts, collecting, onStart, onStop, busy = false, elapsed = 0, canAcquire = true }) {
  return <div className="portal-session-bar" aria-label={i18n.t('monitorUi.monitorControls')}>
    <div className="portal-session-modes">
      <button type="button" aria-label={i18n.t('monitorUi.realtime')} className={mode === 'now' ? 'is-active' : ''} aria-pressed={mode === 'now'} disabled={busy || !canAcquire} onClick={() => onMode('now')}><RadarChartOutlined aria-hidden="true" />{i18n.t('monitorUi.realtime')}</button>
      <button type="button" aria-label={i18n.t('monitorUi.playback')} className={mode !== 'now' ? 'is-active' : ''} aria-pressed={mode !== 'now'} disabled={busy || collecting} title={collecting ? i18n.t('monitorUi.stopFirst') : i18n.t('monitorUi.playbackHint')} onClick={() => onMode('playback')}><HistoryOutlined aria-hidden="true" />{i18n.t('monitorUi.playback')}</button>
    </div>
    {mode === 'now' && deviceControls ? deviceControls : <button type="button" className="portal-device-launch" disabled={busy} aria-haspopup="dialog" aria-expanded={controlsOpen} onClick={onControls}>
      <ApiOutlined /><span>{mode === 'now' ? i18n.t('monitorUi.connectDevice') : i18n.t('monitorUi.choosePlayback')}</span><small>{mode === 'now' ? selectedPorts ? i18n.t('monitorUi.portSelected') : i18n.t('monitorUi.portNotSelected') : i18n.t('monitorUi.playDownloadHint')}</small><i aria-hidden="true" />
    </button>}
    <div className="portal-capture-actions">
      <button type="button" aria-label={i18n.t('monitorUi.startCollection')} disabled={!canAcquire || busy || collecting || mode !== 'now'} onClick={onStart}><PlayCircleOutlined />{i18n.t('monitorUi.startCollection')}</button>
      <button type="button" aria-label={i18n.t('monitorUi.stopCollection')} disabled={busy || !collecting || mode !== 'now'} onClick={onStop}><PauseCircleOutlined />{collecting ? i18n.t('monitorUi.stopElapsed', { value0: Math.floor(elapsed) }) : i18n.t('monitorUi.stopCollection')}</button>
    </div>
  </div>;
}

/** 左侧拉手与抽屉一同平移，外层高度不变；GSAP 仍只控制内层入场。 */
export function PortalQuickTools({ chartsVisible, onCharts, algorithmsOpen, onAlgorithms, settingsOpen, onSettings, toolsOpen, onTools, collapsed = false, onCollapse, sceneOnlyControl }) {
  return <div className="portal-quick-tools-anchor"><div className={`portal-quick-tools-slide${collapsed ? ' is-collapsed' : ''}`}>
    <button type="button" className="portal-quick-tools-handle" aria-label={collapsed ? i18n.t('monitorUi.expandTools') : i18n.t('monitorUi.collapseTools')}
      title={collapsed ? i18n.t('monitorUi.expandTools') : i18n.t('monitorUi.collapseTools')} aria-expanded={!collapsed} aria-controls="portal-quick-tools-content portal-display-panel" onClick={() => onCollapse?.(!collapsed)}>
      <span className="portal-drawer-grip" aria-hidden="true"><i /><i /></span><span>{i18n.t('monitorUi.tools')}</span>
    </button>
    <aside className="portal-quick-tools" aria-label={i18n.t('monitorUi.quickDisplayTools')} aria-hidden={collapsed} inert={collapsed}>
    <header>
      <span className="portal-quick-tools-heading"><small>VISUAL TOOLS</small><strong>{i18n.t('monitorUi.quickTools')}</strong></span><i aria-hidden="true" />
    </header>
    <div id="portal-quick-tools-content" className="portal-quick-tools-grid" aria-hidden={collapsed} inert={collapsed}>
      <button type="button" className={algorithmsOpen ? 'is-active' : ''} aria-label={i18n.t('monitorUi.algorithms')} title={i18n.t('monitorUi.algorithmMarket')} aria-expanded={Boolean(algorithmsOpen)} aria-controls="portal-algorithm-market" onClick={onAlgorithms}><AppstoreOutlined /><span>{i18n.t('monitorUi.algorithms')}</span><small>{i18n.t('monitorUi.market')}</small></button>
      <button type="button" className={chartsVisible ? 'is-active' : ''} aria-label={i18n.t('monitorUi.charts')} aria-pressed={chartsVisible} onClick={onCharts}><LineChartOutlined /><span>{i18n.t('monitorUi.charts')}</span><small>{chartsVisible ? i18n.t('monitorUi.show') : i18n.t('monitorUi.hide')}</small></button>
      <button type="button" className={settingsOpen ? 'is-active' : ''} aria-label={i18n.t('monitorUi.tuning')} aria-expanded={settingsOpen} onClick={onSettings}><SlidersOutlined /><span>{i18n.t('monitorUi.tuning')}</span><small>VISUAL</small></button>
      <button type="button" className={toolsOpen ? 'is-active' : ''} aria-label={i18n.t('monitorUi.tools')} title={i18n.t('monitorUi.utilities')} aria-expanded={Boolean(toolsOpen)} aria-controls="portal-utility-panel" onClick={onTools}><ToolOutlined aria-hidden="true" /><span>{i18n.t('monitorUi.tools')}</span><small>{i18n.t('monitorUi.toolbox')}</small></button>
      {sceneOnlyControl}
    </div>
    <footer aria-hidden={collapsed}><span><small>VIEW</small><strong>3D CENTER</strong></span><output>HOST DATA</output></footer>
  </aside></div></div>;
}

/** 设备弹层保留原生的多串口、渲染模式、语言和下载选项。 */
export function PortalControlsHeading({ onClose }) {
  return <header className="portal-controls-heading"><span>{i18n.t('monitorUi.deviceDisplaySettings')}</span><button type="button" aria-label={i18n.t('monitorUi.closeDeviceSettings')} onClick={onClose}><CloseOutlined /></button></header>;
}
