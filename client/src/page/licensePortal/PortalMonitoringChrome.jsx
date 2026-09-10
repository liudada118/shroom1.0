import React from 'react';
import { AppstoreOutlined, LineChartOutlined, SlidersOutlined, UndoOutlined, ApiOutlined, PlayCircleOutlined, PauseCircleOutlined, HistoryOutlined, RadarChartOutlined, CloseOutlined } from '@ant-design/icons';

/** 最新会话栏调用原生 Title，不模拟连接或采集状态。 */
export function PortalSessionBar({ mode, onMode, controlsOpen, onControls, selectedPorts, collecting, onStart, onStop }) {
  return <div className="portal-session-bar" aria-label="监测控制">
    <div className="portal-session-modes">
      <button type="button" className={mode === 'now' ? 'is-active' : ''} aria-pressed={mode === 'now'} onClick={() => onMode('now')}><RadarChartOutlined />实时</button>
      <button type="button" className={mode !== 'now' ? 'is-active' : ''} aria-pressed={mode !== 'now'} onClick={() => onMode('playback')}><HistoryOutlined />回放</button>
    </div>
    <button type="button" className="portal-device-launch" aria-expanded={controlsOpen} aria-controls="portal-native-controls" onClick={onControls}>
      <ApiOutlined /><span>{mode === 'now' ? '连接设备' : '选择回放'}</span><small>{selectedPorts ? '串口已选择' : '未选择串口'}</small><i aria-hidden="true" />
    </button>
    <div className="portal-capture-actions">
      <button type="button" aria-label="开始采集" disabled={collecting || mode !== 'now'} onClick={onStart}><PlayCircleOutlined />开始采集</button>
      <button type="button" aria-label="结束采集" disabled={!collecting || mode !== 'now'} onClick={onStop}><PauseCircleOutlined />结束采集</button>
    </div>
  </div>;
}

/** 右侧工具卡只隐藏图表不卸载；外层负责定位，内层供 GSAP 淡入。 */
export function PortalQuickTools({ chartsVisible, onCharts, algorithmsOpen, onAlgorithms, settingsOpen, onSettings, onZero }) {
  return <div className="portal-quick-tools-anchor"><aside className="portal-quick-tools" aria-label="快捷显示工具">
    <header><span><small>VISUAL TOOLS</small><strong>快捷工具</strong></span><i aria-hidden="true" /></header>
    <div className="portal-quick-tools-grid">
      <button type="button" className={algorithmsOpen ? 'is-active' : ''} aria-label="算法" title="算法超市" aria-expanded={Boolean(algorithmsOpen)} aria-controls="portal-algorithm-market" onClick={onAlgorithms}><AppstoreOutlined /><span>算法</span><small>超市</small></button>
      <button type="button" className={chartsVisible ? 'is-active' : ''} aria-label="图表" aria-pressed={chartsVisible} onClick={onCharts}><LineChartOutlined /><span>图表</span><small>{chartsVisible ? '显示' : '隐藏'}</small></button>
      <button type="button" className={settingsOpen ? 'is-active' : ''} aria-label="调节" aria-expanded={settingsOpen} onClick={onSettings}><SlidersOutlined /><span>调节</span><small>VISUAL</small></button>
      <button type="button" aria-label="清零" onClick={onZero}><UndoOutlined /><span>清零</span><small>RESET</small></button>
    </div>
    <footer><span><small>VIEW</small><strong>3D CENTER</strong></span><output>HOST DATA</output></footer>
  </aside></div>;
}

/** 设备弹层保留原生的多串口、渲染模式、语言和下载选项。 */
export function PortalControlsHeading({ onClose }) {
  return <header className="portal-controls-heading"><span>设备与显示设置</span><button type="button" aria-label="关闭设备设置" onClick={onClose}><CloseOutlined /></button></header>;
}
