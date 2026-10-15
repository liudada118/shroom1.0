import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RendererHost } from '@shroom/frontend/react';
import { ApiOutlined, ArrowLeftOutlined, UsbOutlined } from '@ant-design/icons';
import { PortalSessionBar, PortalQuickTools } from '../page/licensePortal/PortalMonitoringChrome.jsx';
import PortalControlDialog from '../page/licensePortal/PortalControlDialog.jsx';
import PortalWorkspaceTools from '../page/licensePortal/PortalWorkspaceTools.jsx';
import MobileStreamStatus from './MobileStreamStatus.jsx';
import MobileMatrix3D from './MobileMatrix3D.jsx';
import MobileViewControls from './MobileViewControls.jsx';
import { createMobileViewParameters, mobileRendererParameters } from './mobileViewParameters.js';
import { mobileDisplayConfig } from './displayConfig.js';

const MODES = [['points', '三维点图'], ['heatmap', '热力图'], ['numbers', '原始数字']];

/** 用原会话栏、观测区、设备弹窗和工具壳显示移动实时流。 */
export default function MobileMonitor({ system, session, onBack }) {
  const { host, snapshot, epoch, command } = session;
  const [mode, setMode] = useState('points');
  const [parameters, setParameters] = useState(createMobileViewParameters);
  const [rendererApi, setRendererApi] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [charts, setCharts] = useState(true);
  const [tools, setTools] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [selection, setSelection] = useState(false);
  const [device, setDevice] = useState(host.selectedDevice);
  const [baud, setBaud] = useState(String(host.baudRate));
  const rendererRef = useRef(null);
  const connected = host.source === 'usb';
  const display = useMemo(() => mobileDisplayConfig(mode, parameters[mode]), [mode, parameters]);
  /** 等待懒加载画布就绪，再应用参数，避免首次挂载时命令被丢弃。 */
  const attachRenderer = useCallback((instance) => { rendererRef.current = instance; setRendererApi(instance); }, []);
  useEffect(() => { setDevice(host.selectedDevice); }, [host.selectedDevice]);
  useEffect(() => { setBaud(String(host.baudRate)); }, [host.baudRate]);
  useEffect(() => { setSelection(false); }, [mode, epoch]);
  useEffect(() => {
    if (mode === 'numbers') rendererApi?.sitValue(mobileRendererParameters(mode, parameters[mode]));
  }, [mode, parameters, rendererApi]);

  /** 只更换画布，真实USB会话和压力桥保持运行。 */
  function changeMode(next) { setMode(next); setSelection(false); }
  /** 原版点图接口接收关闭标志，页面状态仍表示是否开启框选。 */
  function selectRegion(next) { rendererRef.current?.changeSelectFlag?.(!next); setSelection(next); }

  return <main className={`portal-runtime-monitor mobile-monitor is-data-view ${charts ? '' : 'is-chart-hidden'}`} data-handoff="ready">
    <nav className="portal-monitor-navigation" aria-label="系统视图"><div className="portal-monitor-identity-group">
      <button type="button" onClick={onBack}><ArrowLeftOutlined /> 系统列表</button>
      <div className="portal-monitor-identity"><small>SHROOM VISION / LIVE</small><strong>{system.label}</strong></div>
    </div><button className="portal-monitor-close" type="button" aria-label="退出监测返回系统列表" onClick={onBack}>×</button></nav>
    <div className="home">
      <header className="title"><PortalSessionBar mode="now" onMode={() => {}} captureAvailable={false} playbackAvailable={false}
        controlsOpen={dialog === 'device'} onControls={() => setDialog('device')} busy={host.busy}
        deviceControls={<button type="button" className="portal-device-launch" onClick={() => setDialog('device')} aria-label="连接设备" aria-expanded={dialog === 'device'}>
          <ApiOutlined /><span>{connected ? host.busy ? '正在连接 CH340' : 'CH340 已连接' : '连接设备'}</span><small>{host.status}</small><i /></button>} /></header>
      <section className={`portal-data-renderer mobile-data-stage is-${mode}`} aria-label="压力展示">
        <div className="mobile-renderer" key={`${mode}-${epoch}`}>
          {mode === 'points' ? <MobileMatrix3D rendererRef={rendererRef} parameters={parameters.points} /> : <RendererHost {...display} rendererRef={attachRenderer} frameChannel="sit" local />}
        </div>
        {snapshot.status === 'waiting' && <div className="mobile-waiting" role="status"><strong>等待 32 × 32 压力数据</strong><span>打开“连接设备”，选择 CH340 后连接 USB</span></div>}
        {snapshot.status === 'stale' && <div className="mobile-stale-notice">数据已暂停 · 保留最后一帧</div>}
      </section>
      <aside className="portal-observatory" hidden={!charts} aria-label="实时观测"><header className="portal-observatory-header"><span>实时观测</span><small>LIVE DATA</small></header>
        <MobileStreamStatus snapshot={snapshot} />
        <div className="mobile-metrics"><div><span>峰值 · 原始值</span><strong>{snapshot.peak}</strong></div><div><span>受压点数</span><strong>{snapshot.active}<small> / 1024</small></strong></div>
          <div><span>已接收帧</span><strong>{snapshot.acceptedFrames}</strong></div><div><span>接收帧率</span><strong>{snapshot.fps}<small> Hz</small></strong></div></div>
        <div className="mobile-observation-note">32 × 32 · 原始读数 0–255<br />实时展示 · 尚未保存为采集文件</div>
        <div className="mobile-scale"><span>0</span><i /><span>{parameters[mode].colorMax}</span></div>
      </aside>
      <PortalQuickTools chartsVisible={charts} onCharts={() => setCharts(!charts)} algorithmsOpen={dialog === 'algorithms'} onAlgorithms={() => setDialog('algorithms')}
        settingsOpen={dialog === 'display'} onSettings={() => setDialog('display')} toolsOpen={tools} onTools={() => setTools(!tools)} collapsed={collapsed} onCollapse={setCollapsed} />
      <div className="mobile-view-switch" role="group" aria-label="展示方式">{MODES.map(([id, title]) =>
        <button type="button" key={id} aria-pressed={mode === id} onClick={() => changeMode(id)}>{title}</button>)}</div>
      {(host.error || snapshot.error) && <div className="mobile-protocol-error" role="alert">{host.error || snapshot.error}</div>}
      <PortalWorkspaceTools open={tools} onClose={() => setTools(false)} rendererRef={rendererRef} selectionActive={selection} onSelectionChange={selectRegion} systemKey="mobile-hand" />
    </div>
    <PortalControlDialog open={dialog === 'device'} title="设备与显示设置" description="选择真实 CH340 设备后连接 USB。连接用于实时展示，采集保存将在后续接入。" onClose={() => setDialog(null)}>
      <div className="mobile-device-form"><label>USB 设备<select aria-label="USB 设备" value={device} disabled={host.busy || connected} onChange={(event) => setDevice(event.target.value)}>
        {!host.devices.length && <option value="">请先刷新 USB</option>}{host.devices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <button type="button" onClick={() => command('refresh')} disabled={host.busy || connected}>刷新 USB</button>
        <label>波特率<input aria-label="串口波特率" inputMode="numeric" value={baud} disabled={host.busy || connected} onChange={(event) => setBaud(event.target.value)} /></label>
        <div className="mobile-device-actions"><button type="button" aria-label="连接 USB" onClick={() => command('connect', { deviceId: device || undefined, baudRate: Number(baud) })} disabled={host.busy || connected || !device}><UsbOutlined aria-hidden="true" />连接 USB</button>
          <button type="button" onClick={() => command('disconnect')}>停止</button></div>
        <p className="mobile-host-status" role="status">{host.status} · {host.frameCount} 帧已接入</p>
        {host.error && <p className="mobile-device-error">{host.error}</p>}
        <details><summary>展示检查</summary><p>演示数据不会显示为 USB 数据。</p><button type="button" disabled={host.busy} onClick={() => command('demo')}>演示数据</button></details>
      </div>
    </PortalControlDialog>
    <PortalControlDialog open={dialog === 'display'} title="显示调节" onClose={() => setDialog(null)} description="调节当前视图的参数，暂停收数后也能调整最后一帧。">
      <MobileViewControls mode={mode} values={parameters[mode]}
        onChange={(next) => setParameters((current) => ({ ...current, [mode]: next }))}
        onReset={() => setParameters((current) => ({ ...current, [mode]: createMobileViewParameters()[mode] }))} />
    </PortalControlDialog>
    <PortalControlDialog open={dialog === 'algorithms'} title="算法超市" onClose={() => setDialog(null)} description="iPad 版算法功能将在后续接入。当前实时观测显示原始压力统计，不代表已启用桌面算法。" />
  </main>;
}
