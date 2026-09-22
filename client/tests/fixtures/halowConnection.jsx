import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import HalowConnection from '../../src/components/title/HalowConnection.jsx';
import '../../src/i18n';

/** 真实控件夹具：HTTP 由浏览器拦截，低频状态仍经过 WebSocket 事件。 */
function HalowFixture() {
  const [status, setStatus] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionEpoch, setConnectionEpoch] = useState(0);
  const [runtime, setRuntime] = useState({ history: 'now', collecting: false });
  useEffect(() => {
    window.setHalowFixtureRuntime = setRuntime;
    const socket = new WebSocket('ws://127.0.0.1:19999');
    socket.onopen = () => { setConnected(true); setConnectionEpoch((value) => value + 1); };
    socket.onclose = () => setConnected(false);
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.halowStatus) setStatus(message.halowStatus);
    };
    return () => { delete window.setHalowFixtureRuntime; socket.close(); };
  }, []);
  return <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
    <h1>HaLow 连接回归（合成设备）</h1>
    <HalowConnection status={status} onStatus={setStatus} connected={connected}
      connectionEpoch={connectionEpoch} {...runtime} />
    <output id="fixture-state" style={{ display: 'none' }}>{JSON.stringify({ status, connected, ...runtime })}</output>
  </main>;
}

createRoot(document.getElementById('root')).render(<HalowFixture />);
