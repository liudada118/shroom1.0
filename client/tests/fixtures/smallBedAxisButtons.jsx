import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SmallBed from '../../src/components/three/smallBed';
import PortalWorkspaceTools, { readWorkspaceToolSupport } from '../../src/page/licensePortal/PortalWorkspaceTools';
import WorkspaceViewPersistence from '../../src/components/title/WorkspaceViewPersistence';

/** 挂载小床和真实视角按钮；测试不接触设备、算法服务或客户数据。 */
function SmallBedAxisButtons() {
  const renderer = useRef(null);
  const stats = useRef({ changeData() {}, handleCharts() {}, handleChartsArea() {} });
  const [visible, setVisible] = useState(true), [open, setOpen] = useState(true);
  const query = new URLSearchParams(window.location.search);
  const is12B = query.get('layout') === '12B';
  const systemId = query.get('system') || (is12B ? 'smallBed12B' : 'smallBedNoAlg');
  useEffect(() => {
    window.__smallBedAxisButtons = {
      setVisible, setOpen,
      /** 只读场景诊断由临时 Vite 插桩提供，生产构建没有该入口。 */
      snapshot() {
        return { available: Boolean(readWorkspaceToolSupport(renderer.current).view), ...window.__readSmallBedAxisScene?.() };
      },
    };
  }, []);
  return <main className="fiber-portal">
    {visible && <><SmallBed ref={renderer} index={0} matrixName={is12B ? 'smallBed12B' : 'smallBedNoAlg'}
      matrixWidth={is12B ? 16 : undefined} matrixHeight={is12B ? 64 : undefined}
      data={stats} local changeSelect={() => {}} changeStateData={() => {}}
      handleChartsBody={() => {}} handleChartsBody1={() => {}} />
    {query.get('persist') === '1' && <WorkspaceViewPersistence rendererRef={renderer} systemId={systemId} mode="normal" history="now" />}
    <PortalWorkspaceTools open={open} rendererRef={renderer} onClose={() => setOpen(false)} systemKey={systemId} /></>}
  </main>;
}

createRoot(document.getElementById('root')).render(<SmallBedAxisButtons />);
