import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import SmallBed from '../../src/components/three/smallBed';
import PortalWorkspaceTools, { readWorkspaceToolSupport } from '../../src/page/licensePortal/PortalWorkspaceTools';

/** 挂载小床和真实视角按钮；测试不接触设备、算法服务或客户数据。 */
function SmallBedAxisButtons() {
  const renderer = useRef(null);
  const stats = useRef({ changeData() {}, handleCharts() {}, handleChartsArea() {} });
  const is12B = new URLSearchParams(window.location.search).get('layout') === '12B';
  useEffect(() => {
    window.__smallBedAxisButtons = {
      /** 只读场景诊断由临时 Vite 插桩提供，生产构建没有该入口。 */
      snapshot() {
        return { available: Boolean(readWorkspaceToolSupport(renderer.current).view), ...window.__readSmallBedAxisScene?.() };
      },
    };
  }, []);
  return <main className="fiber-portal">
    <SmallBed ref={renderer} index={0} matrixName={is12B ? 'smallBed12B' : 'smallBedNoAlg'}
      matrixWidth={is12B ? 16 : undefined} matrixHeight={is12B ? 64 : undefined}
      data={stats} local changeSelect={() => {}} changeStateData={() => {}}
      handleChartsBody={() => {}} handleChartsBody1={() => {}} />
    <PortalWorkspaceTools open rendererRef={renderer} onClose={() => {}} systemKey="smallBedNoAlg" />
  </main>;
}

createRoot(document.getElementById('root')).render(<SmallBedAxisButtons />);
