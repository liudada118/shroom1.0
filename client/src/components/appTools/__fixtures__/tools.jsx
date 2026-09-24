import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import '@ant-design/v5-patch-for-react-19';
import AppTools from '../AppTools';
import { FeedbackWidget } from '../../../page/licensePortal/LicensePortalWidgets';
import '../../../page/licensePortal/PortalFeedback.css';
import '../../../App.css';
import i18n from '../../../i18n';

const agentListeners = new Set();
const updateListeners = new Set();
const calls = [];
const snapshot = { settings: { baseUrl: 'https://example.invalid', model: 'fixture', hasApiKey: true },
  conversation: { id: 'layout-fixture', messages: [], tasks: [] }, attachments: [], activeTask: null };
window.electronAPI = {
  /** 返回合成版本，覆盖长版本号布局。 */
  async getVersion() { return new URLSearchParams(location.search).get('version') || '1.1.37'; },
  /** 更新订阅只接收本页合成事件。 */
  on(_channel, listener) { updateListeners.add(listener); return () => updateListeners.delete(listener); },
  /** 只记录点击行为，不连接更新服务器。 */
  async invoke(channel, payload) { calls.push({ channel, ...payload }); },
  agent: {
    /** 订阅内存 Agent 状态。 */
    subscribe(listener) { agentListeners.add(listener); return () => agentListeners.delete(listener); },
    /** 返回界面需要的只读合成快照。 */
    async invoke() { return { ok: true, data: structuredClone(snapshot) }; },
  },
};
window.appToolsFixture = {
  calls,
  /** 模拟更新进度，不触发下载或安装。 */
  update(data) { updateListeners.forEach((listener) => listener(data)); },
  /** 检查任务状态圆点不会改变工具组尺寸。 */
  busy() {
    snapshot.activeTask = { id: 'task-fixture', status: 'running', steps: [], proposals: [] };
    agentListeners.forEach((listener) => listener({ type: 'state', state: structuredClone(snapshot) }));
  },
  /** 在同一个页面核对已有的三种语言。 */
  language(value) { return i18n.changeLanguage(value); },
};

/** 用真实组件检查首页反馈与全局工具的组合及卸载。 */
function Fixture() {
  const [feedback, setFeedback] = useState(true);
  return <AntdApp>
    <main style={{ padding: 24, color: '#edf5ff' }}><h1>应用工具布局检查</h1><p>版本、更新、反馈与 Agent · 隔离测试数据</p>
      <button onClick={() => setFeedback((value) => !value)}>切换首页反馈</button>
    </main>
    <div className="fiber-portal">{feedback && <FeedbackWidget />}</div>
    <AppTools />
  </AntdApp>;
}

createRoot(document.getElementById('root')).render(<Fixture />);
