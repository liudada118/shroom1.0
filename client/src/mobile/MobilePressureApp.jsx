import React, { useEffect, useState } from 'react';
import SystemScenePreview from '../page/licensePortal/scene/SystemScenePreview.jsx';
import { getPortalScene } from '../page/licensePortal/scene/sceneCatalog.js';
import { MobileHome, MobileSystemSelector } from './MobilePortalPages.jsx';
import MobileMonitor from './MobileMonitor.jsx';
import { MOBILE_SYSTEMS, canRunMobileSystem } from './mobileSystems.js';
import { useMobileSession } from './useMobileSession.js';
import previewScenes from './previewScenes.json';
import '../page/licensePortal/FiberPortal.css';
import '../page/licensePortal/PortalLauncher.css';
import '../page/licensePortal/PortalMonitoring.css';
import './mobile.css';

/** 三个原版页面共用离线原生会话；USB仅在用户明确连接时启动。 */
export default function MobilePressureApp() {
  const [page, setPage] = useState('home');
  const [category, setCategory] = useState('all');
  const [selectedId, setSelectedId] = useState('hand');
  const [homeHost, setHomeHost] = useState(null);
  const [previewHost, setPreviewHost] = useState(null);
  const [sceneStatus, setSceneStatus] = useState({ state: 'loading' });
  const session = useMobileSession();
  const selected = MOBILE_SYSTEMS.find((system) => system.value === selectedId) || MOBILE_SYSTEMS[0];
  /** 打开分类时选择该分类首项，保持列表与预览的系统身份一致。 */
  function openCategory(next) {
    setCategory(next);
    const first = MOBILE_SYSTEMS.find((system) => next === 'all' || system.category === next);
    if (first) setSelectedId(first.value);
    setPage('selector');
  }
  /** 离开运行页先取消原生会话，回到列表不保留后台连接。 */
  function leaveMonitor() { session.command('disconnect'); setPage('selector'); }
  useEffect(() => {
    /** Escape从系统列表返回首页。 */
    function onKey(event) { if (event.key === 'Escape' && page === 'selector') setPage('home'); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page]);
  return <div className="fiber-portal shroom-mobile" style={{ '--system-accent': '#63d5ff' }}>
    {page === 'home' && <MobileHome onOpen={openCategory} onHost={setHomeHost} sceneStatus={sceneStatus} />}
    {page === 'selector' && <MobileSystemSelector category={category} onCategory={openCategory} selectedId={selectedId} onSelect={setSelectedId}
      onEnter={(system) => { if (canRunMobileSystem(system.value)) { setSelectedId(system.value); setPage('monitor'); } }} onBack={() => setPage('home')} onHost={setPreviewHost} sceneStatus={sceneStatus} />}
    {page === 'monitor' && <MobileMonitor system={selected} session={session} onBack={leaveMonitor} />}
    <SystemScenePreview activeScene={page === 'home' ? 'shroom' : getPortalScene(selected)} host={page === 'home' ? homeHost : previewHost}
      framing={page === 'home' ? 'home' : 'preview'} active={page !== 'monitor'} onStatus={setSceneStatus} preloadedScenes={previewScenes} />
  </div>;
}
