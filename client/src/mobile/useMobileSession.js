import { useEffect, useRef, useState } from 'react';
import { clearLastFrame, publishFrame } from '@shroom/frontend/core';
import { createPressureBridge, installPressureBridge } from './pressureBridge.js';
import { createDemoPressureFrame } from './displayConfig.js';
import { createUsbCommand, INITIAL_HOST, readHostState } from './mobileSession.js';
import { createMobileDisplayFrame } from './pressureDisplayFrame.js';

/** 跨三页保持同一压力桥；原生状态和真实帧独立，不以连接回执冒充已收数。 */
export function useMobileSession() {
  const [host, setHost] = useState(INITIAL_HOST);
  const [snapshot, setSnapshot] = useState({ source: null, status: 'waiting', acceptedFrames: 0, rejectedFrames: 0, peak: 0, active: 0, fps: 0, error: null });
  const [epoch, setEpoch] = useState(0);
  const bridgeRef = useRef(null);
  const demoRef = useRef(null);
  const isNative = Boolean(window.ReactNativeWebView);
  useEffect(() => {
    clearLastFrame();
    const bridge = createPressureBridge({
      onFrame: (frame) => publishFrame(createMobileDisplayFrame(frame)),
      onReset: (next) => { clearLastFrame(); setEpoch((value) => value + 1); setSnapshot(next); },
      postMessage: (message) => window.ReactNativeWebView?.postMessage(JSON.stringify(message)),
    });
    bridgeRef.current = bridge;
    const previousHost = window.ShroomMobileHost;
    const hostBridge = { receive(message) { const next = readHostState(message); if (next) setHost(next); return Boolean(next); } };
    window.ShroomMobileHost = hostBridge;
    // ⚠️ ready可能同步触发宿主补发状态，必须先安装host入口再安装压力入口。
    const removeBridge = installPressureBridge(window, bridge);
    const timer = setInterval(() => setSnapshot(bridge.snapshot()), 250);
    return () => {
      clearInterval(timer); clearInterval(demoRef.current); clearLastFrame(); removeBridge(); bridgeRef.current = null;
      if (window.ShroomMobileHost === hostBridge) {
        if (previousHost === undefined) delete window.ShroomMobileHost;
        else window.ShroomMobileHost = previousHost;
      }
    };
  }, []);

  /** 发白名单命令；浏览器预览只允许显式演示，不假装存在USB设备。 */
  function command(action, options = {}) {
    try {
      const message = createUsbCommand(action, options);
      if (isNative) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); return; }
      if (action === 'disconnect' || action === 'demo') {
        clearInterval(demoRef.current); demoRef.current = null;
        bridgeRef.current?.receive({ type: 'stream.reset', version: 1, source: action === 'demo' ? 'demo' : null });
        setHost({ ...INITIAL_HOST, source: action === 'demo' ? 'demo' : null, status: action === 'demo' ? '演示数据 · 非传感器采集' : '等待连接' });
        if (action === 'demo') {
          let sequence = 0;
          demoRef.current = setInterval(() => bridgeRef.current?.receive(createDemoPressureFrame(sequence++)), 50);
        }
      } else setHost((current) => ({ ...current, error: 'USB连接需要在已安装的iPad应用中操作；浏览器可使用演示数据。' }));
    } catch (error) { setHost((current) => ({ ...current, error: error.message })); }
  }
  return { host, snapshot, epoch, command, isNative };
}
