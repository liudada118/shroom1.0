import React from 'react';
import { createRoot } from 'react-dom/client';
import AgentWorkspace from '../AgentWorkspace';

// 独立开发夹具不进入 App 或生产路由，所有按钮都只操作内存测试数据。
const listeners = new Set();
const archives = new Map();
let sequence = 0;
let snapshot = { settings: { baseUrl: 'https://api.openai.com/v1', model: '', hasApiKey: false }, conversation: { id: 'fixture-0', messages: [], tasks: [] }, activeTask: null, attachments: [] };

/** 复制内存快照，模拟跨进程结构化复制而不是共享对象。 */
function copy(value) { return JSON.parse(JSON.stringify(value)); }

/** 广播夹具状态。 */
function emitState() { listeners.forEach((listener) => listener({ type: 'state', state: copy(snapshot) })); }

/** 推进到可审阅配置，用于检查流式转最终消息及应用恢复。 */
function complete() {
  const task = snapshot.activeTask;
  if (!task) return;
  task.status = 'awaiting_action';
  task.steps = [{ id: 'lookup', name: '查询展示能力', status: 'succeeded', message: '已找到矩阵热力图和重心曲线。' }];
  task.proposals = [{ id: 'proposal-1', kind: 'update_display', systemId: 'fixture-system', summary: '将主画面改为热力图，并保留重心轨迹。', status: 'pending', before: { renderer: 'matrix' }, after: { renderer: 'heatmap', charts: ['重心轨迹'] } }];
  snapshot.conversation.messages.push({ id: `assistant-${sequence}`, taskId: task.id, role: 'assistant', text: '方案已经准备好。查看配置内容后，可以应用此方案。' });
  emitState();
}

const bridge = {
  /** 订阅测试事件并返回清理函数。 */
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  /** 用内存数据实现桥契约，任何操作都不会访问真实服务和文件。 */
  async invoke(action, payload = {}) {
    if (action === 'getState') return { ok: true, data: copy(snapshot) };
    if (action === 'listAlgorithmRecords') return { ok: true, data: { systemId: 'fixture-system', offset: 0, nextOffset: null,
      records: ['达_抚摸', '达_拍打', '达_拍打', '达_平躺_2', '', ...Array.from({ length: 6 }, (_, index) => `对象${index}_抚摸`)].map((name, index) => ({
        id: `record-${index}`, date: name ? `${name}_2026-9-21-19-23-${String(index).padStart(2, '0')}-42 ${1789989780042 + index * 1000}` : '1789989834042', channel: '压力', count: 512,
      })) } };
    if (action === 'listConversations') {
      const records = new Map(archives);
      records.set(snapshot.conversation.id, snapshot);
      return { ok: true, data: [...records.values()].map((item) => ({ id: item.conversation.id, title: item.conversation.messages[0]?.text || '新会话', messageCount: item.conversation.messages.length, current: item.conversation.id === snapshot.conversation.id })) };
    }
    let data = null;
    if (action === 'saveSettings') {
      snapshot.settings = { baseUrl: payload.baseUrl, model: payload.model, hasApiKey: Boolean(payload.apiKey) || snapshot.settings.hasApiKey };
      data = snapshot.settings;
    } else if (action === 'setAlgorithmSelection') {
      if (payload.selection && payload.selection.records.some((item) => !item.label.trim())) return { ok: false, error: { message: '请填写类别。' } };
      snapshot.conversation.algorithmSelection = payload.selection; data = payload.selection;
    } else if (action === 'importFiles') {
      data = [{ id: 'attachment-1', name: '示例点位表.xlsx', size: 2800 }];
      snapshot.attachments = data;
    } else if (action === 'importAttachments') {
      if (payload.files.some((file) => file.name.endsWith('.pdf'))) return { ok: false, error: { message: '暂不支持 PDF 附件，请转换为文本或图片。' } };
      data = payload.files.map((file) => ({ id: `attachment-${++sequence}`, name: file.name, size: atob(file.base64).length,
        ...(file.name.endsWith('.png') ? { kind: 'image', thumbnail: `data:image/png;base64,${file.base64}` } : {}) }));
      snapshot.attachments.push(...data);
    } else if (action === 'importClipboard') {
      data = [{ id: `clipboard-${++sequence}`, name: '剪贴板文件.csv', size: 100 }];
      snapshot.attachments.push(...data);
    } else if (action === 'startTask') {
      sequence += 1;
      snapshot.conversation.messages.push({ id: `user-${sequence}`, taskId: `task-${sequence}`, role: 'user', text: payload.text, attachmentIds: payload.attachmentIds });
      snapshot.activeTask = { id: `task-${sequence}`, conversationId: snapshot.conversation.id, status: 'running', steps: [{ id: 'lookup', name: '查询展示能力', status: 'running' }], proposals: [] };
      snapshot.conversation.tasks.push(snapshot.activeTask);
      data = snapshot.activeTask;
    } else if (action === 'cancelTask') {
      snapshot.activeTask.status = 'cancelled';
      snapshot.activeTask.steps[0].status = 'cancelled';
    } else if (action === 'newConversation') {
      archives.set(snapshot.conversation.id, copy(snapshot));
      snapshot.conversation = { id: `fixture-${++sequence}`, messages: [], tasks: [] };
      snapshot.activeTask = null; snapshot.attachments = [];
    } else if (action === 'openConversation') {
      if (payload.conversationId !== snapshot.conversation.id) {
        archives.set(snapshot.conversation.id, copy(snapshot));
        snapshot = { ...copy(archives.get(payload.conversationId)), settings: snapshot.settings, activeTask: null };
      }
    } else if (action === 'applyProposal' || action === 'restoreProposal') {
      snapshot.activeTask.proposals[0].status = action === 'applyProposal' ? 'applied' : 'restored';
      snapshot.activeTask.status = 'succeeded';
    }
    emitState();
    if (action === 'startTask') listeners.forEach((listener) => listener({ type: 'text.delta', taskId: snapshot.activeTask.id, delta: '正在查询当前系统可用的图表。' }));
    return { ok: true, data: copy(data) };
  },
};

/** 挂载可人工和浏览器自动化操作的隔离测试入口。 */
function Fixture() {
  return <><main style={{ padding: 24, maxWidth: 580 }}><h1>Agent 界面本地测试</h1><p>仅使用内存测试数据，不连接模型、设备和文件。</p><p>发送任务后先关闭抽屉，再使用以下按钮推进状态。</p><button onClick={complete}>测试：完成方案生成</button><button onClick={() => listeners.forEach((listener) => listener({ type: 'runtime.error', error: { code: 'FIXTURE_CRASH', message: '测试运行进程中断，请刷新状态。' } }))}>测试：进程错误</button></main><AgentWorkspace bridge={bridge} initiallyOpen /></>;
}

createRoot(document.getElementById('root')).render(<Fixture />);
