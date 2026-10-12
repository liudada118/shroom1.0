import React, { useEffect, useRef, useState } from 'react';
import { RendererHost } from '@shroom/frontend/react';
import { clearLastFrame, publishFrame } from '@shroom/frontend/core';
import { createPressureBridge, installPressureBridge } from './pressureBridge.js';
import { createDemoPressureFrame, mobileDisplayConfig } from './displayConfig.js';
import MobileStreamStatus from './MobileStreamStatus.jsx';
import './mobile.css';

/** 用已有桌面渲染器显示移动压力帧；不挂载桌面服务、授权或网络连接。 */
export default function MobilePressureApp() {
  const [mode, setMode] = useState('heatmap');
  const [epoch, setEpoch] = useState(0);
  const [demoRunning, setDemoRunning] = useState(false);
  const bridgeRef = useRef(null);
  const demoTimerRef = useRef(null);
  const [snapshot, setSnapshot] = useState({ source: null, status: 'waiting',
    acceptedFrames: 0, rejectedFrames: 0, peak: 0, active: 0, fps: 0, error: null });
  const isNative = Boolean(window.ReactNativeWebView);

  useEffect(() => {
    clearLastFrame();
    const bridge = createPressureBridge({
      onFrame: (frame) => publishFrame({ channels: { sit: frame.values } }),
      onReset: (next) => {
        clearLastFrame();
        setEpoch((value) => value + 1);
        setSnapshot(next);
      },
      postMessage: (message) => window.ReactNativeWebView?.postMessage(JSON.stringify(message)),
    });
    bridgeRef.current = bridge;
    const removeBridge = installPressureBridge(window, bridge);
    const statusTimer = setInterval(() => setSnapshot(bridge.snapshot()), 250);
    return () => {
      clearInterval(statusTimer);
      clearInterval(demoTimerRef.current);
      bridgeRef.current = null;
      clearLastFrame();
      removeBridge();
    };
  }, []);

  /** 仅独立网页提供显式演示开关；RN 宿主负责自身的演示数据源。 */
  function toggleDemo() {
    if (demoTimerRef.current) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
      bridgeRef.current?.receive({ type: 'stream.reset', version: 1, source: null });
      setDemoRunning(false);
      return;
    }
    bridgeRef.current?.receive({ type: 'stream.reset', version: 1, source: 'demo' });
    let sequence = 0;
    demoTimerRef.current = setInterval(() => {
      bridgeRef.current?.receive(createDemoPressureFrame(sequence++));
    }, 50);
    setDemoRunning(true);
  }

  const display = mobileDisplayConfig(mode);
  return <main className="shroom-mobile">
    <header className="mobile-header">
      <div className="mobile-identity"><small>SHROOM</small><h1>压力矩阵</h1><span>32 × 32 · 1024 点</span></div>
      <MobileStreamStatus snapshot={snapshot} />
    </header>
    <section className="mobile-workspace" aria-label="压力展示">
      <div className="mobile-workspace-toolbar">
        <div className="mobile-view-switch" role="group" aria-label="展示方式">
          <button type="button" aria-pressed={mode === 'heatmap'} onClick={() => setMode('heatmap')}>热力图</button>
          <button type="button" aria-pressed={mode === 'numbers'} onClick={() => setMode('numbers')}>原始数字</button>
        </div>
        {!isNative && <button type="button" className="mobile-demo-button" aria-pressed={demoRunning} onClick={toggleDemo}>
          {demoRunning ? '停止演示' : '开启演示数据'}
        </button>}
      </div>
      <div className={`mobile-matrix-stage is-${mode}`} data-stream-state={snapshot.status}>
        <div className="mobile-renderer" key={`${mode}-${epoch}`}>
          <RendererHost {...display} frameChannel="sit" local />
        </div>
        {snapshot.status === 'waiting' && <div className="mobile-waiting" role="status">
          <strong>等待 32 × 32 压力数据</strong>
          <span>{isNative ? '连接状态请查看上方设备栏' : '可开启演示数据检查展示'}</span>
        </div>}
        {snapshot.status === 'stale' && <div className="mobile-stale-notice">数据已暂停 · 保留最后一帧</div>}
      </div>
      <div className="mobile-scale"><span>原始读数</span><span>0</span><i aria-hidden="true" /><span>255</span></div>
    </section>
    <section className="mobile-metrics" aria-label="数据统计">
      <div><span>峰值 · 原始值</span><strong>{snapshot.peak}</strong></div>
      <div><span>受压点数</span><strong>{snapshot.active}<small> / 1024</small></strong></div>
      <div><span>已接收帧</span><strong>{snapshot.acceptedFrames}</strong></div>
      <div><span>接收帧率</span><strong>{snapshot.fps}<small> Hz</small></strong></div>
    </section>
    {snapshot.error && <div className="mobile-protocol-error" role="alert">
      <strong>数据协议错误</strong><span>{snapshot.error}</span><small>已拒绝 {snapshot.rejectedFrames} 帧，保留最近合法数据</small>
    </div>}
  </main>;
}
