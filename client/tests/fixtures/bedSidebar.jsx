import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from '../../src/i18n';
import TranslatedAside from '../../src/components/aside/Aside';
import '../../src/App.css';
import '../../src/page/licensePortal/FiberPortal.css';
import '../../src/page/licensePortal/PortalMonitoring.css';

const Aside = TranslatedAside.render({}, null).type.WrappedComponent;

/** 使用真实侧栏和门户样式，只通过显式合成状态检查空卡和风险提示。 */
function BedSidebarFixture() {
  const [system, setSystem] = useState('smallBed');
  const aside = useRef(null);
  window.__bedSidebar = {
    setSystem,
    setState: (input) => aside.current.setState(input),
  };
  return <main className="fiber-portal" style={{ minHeight: '100vh', background: '#06121e' }}>
    <section className="portal-runtime-monitor"><div className="home">
      <div className="portal-observatory" style={{ top: 24, bottom: 24 }}>
        <header className="portal-observatory-heading"><small>DATA OBSERVATORY</small><strong>压力数据 / 传感监测</strong></header>
        <div className="manifest-sidebar-content"><Aside key={system} ref={aside} matrixName={system} i18n={i18n} t={i18n.t.bind(i18n)} /></div>
      </div>
    </div></section>
  </main>;
}

createRoot(document.getElementById('root')).render(<BedSidebarFixture />);
