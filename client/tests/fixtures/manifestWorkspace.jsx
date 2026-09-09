import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ManifestDisplayRenderer from '../../src/extensions/display-system/ManifestDisplayRenderer.jsx';
import ManifestSidebarOverlay from '../../src/extensions/display-system/ManifestSidebarOverlay.jsx';
import '../../src/components/aside/aside.scss';

/** 无设备副作用的布局夹具：挂载真实原生点图，以合成帧验证布局而非硬件接通。 */
function WorkspaceFixture() {
  const rendererRef = useRef();
  const [presentation, setPresentation] = useState('workspace');
  const definition = {
    displaySystemId: 'layout-fixture', type: 'layout-fixture', matrix: { rows: 32, cols: 32 },
    sensors: [{ id: 'mat', sensorId: 'mat', outputChannel: 'mat', matrix: { rows: 32, cols: 32 } }],
    page: {
      layout: { columns: 12, presentation },
      renderers: [{ id: 'pointGrid', type: 'pointGrid', label: '3D 点图', params: {
        sit: { num1: 32, num2: 32, interp: 1, order: 0 },
        back: { num1: 32, num2: 32, interp: 1, order: 0 },
      } }],
      widgets: [{ id: 'main', type: 'pointGrid', source: 'mat', columnSpan: 12 }],
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
  return (
    <>
      <header className="title" style={{ position: 'absolute', inset: '0 0 auto', height: 60, background: '#1b1b35', color: 'white', zIndex: 50 }}>
        Shroom 布局测试（合成数据）
        <select aria-label="布局" value={presentation} onChange={(e) => setPresentation(e.target.value)}>
          {['standard', 'immersive', 'workspace'].map((id) => <option key={id}>{id}</option>)}
        </select>
      </header>
      <ManifestSidebarOverlay enabled={presentation !== 'immersive'}>
        <div className="aside">
          <input aria-label="图表状态保留测试" defaultValue="保留" />
          {['压力', '呼吸波形', '重心轨迹'].map((label) => (
            <section key={label} style={{ height: 260, background: '#1b1b35', borderRadius: 20, marginBottom: 20, padding: 20 }}>
              {label}（布局占位，非算法结果）
            </section>
          ))}
        </div>
      </ManifestSidebarOverlay>
      <ManifestDisplayRenderer ref={rendererRef} definition={definition} enabled={false} />
    </>
  );
}

createRoot(document.getElementById('root')).render(<WorkspaceFixture />);
