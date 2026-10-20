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
  const [selectionActive, setSelectionActive] = useState(false);
  const portal = window.location.search.includes('portal');
  const query = new URLSearchParams(window.location.search);
  const legacy = query.get('legacy');
  const rendererType = legacy || query.get('renderer') || 'pointGrid';
  const side = legacy ? 23 : Math.max(1, Number(query.get('side')) || 32);
  const rows = legacy ? side : Math.max(1, Number(query.get('rows')) || side);
  const cols = legacy ? side : Math.max(1, Number(query.get('cols')) || side);
  const rendererIds = query.has('orientation') ? ['pointGrid', 'blobHeatmap', 'numMatrix', 'webglHeatmap']
    : query.has('multi') ? ['pointGrid', 'webglHeatmap', 'numMatrix2d'] : [rendererType];
  const definition = {
    displaySystemId: 'layout-fixture', type: 'layout-fixture', matrix: { rows, cols },
    sensors: [{ id: 'mat', sensorId: 'mat', outputChannel: 'mat', matrix: { rows, cols } }],
    page: {
      layout: { columns: 12, presentation },
      renderers: rendererIds.map((id) => ({ id, type: id === 'numMatrix2d' ? 'numMatrix' : id, params: {
        sit: { num1: rows, num2: cols, interp: 1, order: 0 },
        back: { num1: rows, num2: cols, interp: 1, order: 0 },
        ...(id === 'numMatrix2d' && query.has('legacy2dStyle') ? {
          backend: 'webgl', frameInput: 'raw',
          webgl: { variant: 'original', rawTranspose: false, indexRow: false, overlayPad: 0 },
        } : {}),
      } })),
      profiles: rendererIds.map((id, index) => ({ id: index === 0 ? 'default' : `display-${id}`,
        renderer: id, widgets: ['main'] })),
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
  /** 用可见按钮发送右上亮点，只验证绘图方向，不模拟设备连接。 */
  function injectDirectionFrame() {
    const values = Array(rows * cols).fill(10);
    values[cols - 1] = 600;
    rendererRef.current?.sitValue?.({ valuej: rendererRef.current?.getDisplayControls?.().value === 'pointGrid' ? 6000 : 600,
      valueg: 0, valuel: 1, value: 0.001, valuef: 0, valuelInit: 0 });
    rendererRef.current?.pushFrames([{
      channelId: 'layout-fixture:mat', outputChannel: 'mat',
      renderValues: values, normalizedValues: values, timestamp: Date.now(),
    }]);
  }
  /** 发送连续压力分布，用真实插点和平滑管线观察显示密度，不连接设备。 */
  function injectSmoothFrame() {
    const values = Array.from({ length: rows * cols }, (_, index) => {
      const x = (index % cols) / Math.max(1, cols - 1);
      const y = Math.floor(index / cols) / Math.max(1, rows - 1);
      return Math.round(400 * Math.exp(-((x - 0.35) ** 2 + (y - 0.45) ** 2) / 0.04)
        + 300 * Math.exp(-((x - 0.7) ** 2 + (y - 0.6) ** 2) / 0.03));
    });
    rendererRef.current?.sitValue?.({ valuej: 8000, valueg: 2, valuel: 1, value: 0.001,
      valuef: 0, valuelInit: 0 });
    rendererRef.current?.pushFrames([{ channelId: 'layout-fixture:mat', outputChannel: 'mat',
      renderValues: values, normalizedValues: values, timestamp: Date.now() }]);
  }
  /** 复用正式工具区的框选开关，隔离测试不下发设备命令。 */
  function toggleSelection(next) {
    rendererRef.current?.changeSelectFlag?.(!next);
    setSelectionActive(next);
  }
  const surface = (
    <>
      <header className="title" style={{ position: 'absolute', inset: '0 0 auto', height: 60, background: '#1b1b35', color: 'white', zIndex: 50 }}>
        Shroom 布局测试（合成数据）
        <select aria-label="布局" value={presentation} onChange={(e) => setPresentation(e.target.value)}>
          {['standard', 'immersive', 'workspace'].map((id) => <option key={id}>{id}</option>)}
        </select>
        {query.has('orientation') && <>
          <button type="button" onClick={injectDirectionFrame}>注入方向测试帧（右上亮点）</button>
          <button type="button" onClick={() => rendererRef.current?.sitValue?.({ valuef: 1000 })}>过滤全部</button>
          <button type="button" onClick={() => rendererRef.current?.sitValue?.({ valuef: 0 })}>恢复过滤</button>
          <button type="button" onClick={() => rendererRef.current?.sitValue?.({ value: 0 })}>高度归零</button>
        </>}
        {query.has('density') && <button type="button" onClick={injectSmoothFrame}>注入平滑压力帧（合成数据）</button>}
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
          selectionActive={selectionActive} onSelectionChange={toggleSelection} systemKey="layout-fixture"
          displayContent={<PortalRendererControls rendererRef={rendererRef} active={toolsOpen} />} />
      </div>
    </>
  );
  return portal ? <div className="fiber-portal" style={{ height: '100vh' }}><div className="portal-runtime-monitor" style={{ height: '100%' }}><div className="home">{surface}</div></div></div> : surface;
}

createRoot(document.getElementById('root')).render(<WorkspaceFixture />);
