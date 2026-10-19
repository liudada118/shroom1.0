import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@ant-design/v5-patch-for-react-19';
import UsageSlider from '../UsageSlider';
import AgentTaskCard from '../../../features/agent/AgentTaskCard';
import PortalUtilityPanel from '../../../page/licensePortal/PortalUtilityPanel';
import { setUsageSystemContext } from '../../../services/usageAnalytics';

window.usageFixtureEvents = [];
window.electronAPI = { services: { invoke: async (_action, event) => { window.usageFixtureEvents.push(event); } } };
setUsageSystemContext({ systemType: 'fixture', systemOrigin: 'custom' });
const tools = [
  { id: 'top', label: '查看顶部', onClick: async () => ({ ok: true }) },
  { id: 'select', label: '框选失败', onClick: async () => ({ ok: false }) },
  { id: 'ruler', label: '禁用量尺', disabled: true, onClick: () => { throw new Error('disabled control ran'); } },
];

/** Exercise actual Antd completion, visibility and asynchronous tool callbacks in isolated Chrome. */
function Fixture() {
  const [value, setValue] = useState(30), [open, setOpen] = useState(false);
  return <main style={{ maxWidth: 600, padding: 24 }}>
    <h1>合成使用事件</h1>
    <UsageSlider aria-label="高斯平滑" usageFeature="tuning_gaussian" min={0} max={100} value={value} onChange={setValue} />
    <button onClick={() => setOpen(true)}>打开工具</button>
    <PortalUtilityPanel open={open} items={tools} onClose={() => setOpen(false)} />
    <AgentTaskCard task={{ id: 'visible-task', status: 'awaiting_action', proposals: [{ id: 'visible-proposal', kind: 'create_system', status: 'pending', summary: '可见方案' }] }} />
    <details id="history"><summary>历史方案</summary><AgentTaskCard task={{ id: 'history-task', status: 'awaiting_action',
      proposals: [{ id: 'history-proposal', kind: 'algorithm_package', status: 'pending', summary: '历史算法' }] }} /></details>
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
