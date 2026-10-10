import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ManifestDisplayRenderer from '../../src/extensions/display-system/ManifestDisplayRenderer.jsx';
import ManifestSidebarOverlay from '../../src/extensions/display-system/ManifestSidebarOverlay.jsx';
import PortalWorkspaceTools from '../../src/page/licensePortal/PortalWorkspaceTools.jsx';
import PortalRendererControls from '../../src/page/licensePortal/PortalRendererControls.jsx';
import '../../src/components/aside/aside.scss';
import '../../src/page/licensePortal/PortalLauncher.css';
import '../../src/page/licensePortal/PortalMonitoring.css';
import '../../src/page/licensePortal/PortalUtilityPanel.css';

/** 无设备副作用的布局夹具：挂载真实原生点图，以合成帧验证布局而非硬件接通。 */
function WorkspaceFixture() {
  const rendererRef = useRef();
  const [presentation, setPresentation] = useState('workspace');
  const [toolsOpen, setToolsOpen] = useState(false);
  const portal = window.location.search.includes('portal');
  const query = new URLSearchParams(window.location.search);
  const legacy = query.get('legacy');
  const rendererType = legacy || query.get('renderer') || 'pointGrid';
  const side = legacy ? 23 : Math.max(1, Number(query.get('side')) || 32);
  const definition = {
    displaySystemId: 'layout-fixture', type: 'layout-fixture', matrix: { rows: side, cols: side },
    sensors: [{ id: 'mat', sensorId: 'mat', outputChannel: 'mat', matrix: { rows: side, cols: side } }],
    page: {
      layout: { columns: 12, presentation },
      renderers: [{ id: rendererType, type: rendererType, params: {
        sit: { num1: side, num2: side, interp: 1, order: 0 },
        back: { num1: side, num2: side, interp: 1, order: 0 },
      } }],
      widgets: [{ id: 'main', type: rendererType, source: 'mat', columnSpan: 12 }],
      sidebar: { source: 'mat' },
    },
  };
  useEffect(() => {
    // 测试主动发送单帧，故意留出冷启动无数据阶段，不能用连续帧掩盖首帧丢失。
    window.pushWorkspaceFrame = (values) => rendererRef.current?.pushFrames([{
      channelId: 'layout-fixture:mat', outputChannel: 'mat',
      renderValues: values,
      timestamp: Date.now(),
    }]);
    return () => { delete window.pushWorkspaceFrame; };
  }, []);
  const surface = (
    <>
      <header className="title" style={{ position: 'absolute', inset: '0 0 auto', height: 60, background: '#1b1b35', color: 'white', zIndex: 50 }}>
        Shroom 布局测试（合成数据）
        <select aria-label="布局" value={presentation} onChange={(e) => setPresentation(e.target.value)}>
          {['standard', 'immersive', 'workspace'].map((id) => <option key={id}>{id}</option>)}
        </select>
      </header>
      <ManifestSidebarOverlay portalEmbedded={portal} enabled={!portal && presentation !== 'immersive'}>
        <div className="aside">
          <input aria-label="图表状态保留测试" defaultValue="保留" />
          {['压力', '呼吸波形', '重心轨迹'].map((label) => (
            <section key={label} style={{ height: 260, background: '#1b1b35', borderRadius: 20, marginBottom: 20, padding: 20 }}>
              {label}（布局占位，非算法结果）
            </section>
          ))}
        </div>
      </ManifestSidebarOverlay>
      {portal ? <div className="portal-data-renderer"><ManifestDisplayRenderer ref={rendererRef} definition={definition} enabled={false}
        onSidebarData={(data) => { window.workspaceSidebarData = data; }} /></div>
        : <ManifestDisplayRenderer ref={rendererRef} definition={definition} enabled={false}
          onSidebarData={(data) => { window.workspaceSidebarData = data; }} />}
      <div className="fiber-portal" style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none', '--left-chart-width': '300px', '--right-tools-width': '140px' }}>
        <div className="portal-quick-tools-anchor"><div className="portal-quick-tools"><button type="button" onClick={() => setToolsOpen(true)}>工具区</button></div></div>
        <PortalWorkspaceTools open={toolsOpen} onClose={() => setToolsOpen(false)} rendererRef={rendererRef}
          displayContent={<PortalRendererControls rendererRef={rendererRef} active={toolsOpen} />} />
      </div>
    </>
  );
  return portal ? <div className="fiber-portal" style={{ height: '100vh' }}><div className="portal-runtime-monitor" style={{ height: '100%' }}><div className="home">{surface}</div></div></div> : surface;
}

createRoot(document.getElementById('root')).render(<WorkspaceFixture />);
