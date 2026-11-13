import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../i18n';
import AgentConversation from '../AgentConversation';
import '../AgentWorkspace.css';

const HEADERS = ['hand', '秒数', '矩阵最大值', '时间戳', '有效点数', '压力', '矩阵数据', 'channelId', 'displaySystemId', 'sensorId', 'sensorLabel', 'sensorType', 'outputChannel', 'timestamp', 'schemaVersion', 'serialRole', 'serialPortPath', 'baudRate', 'parserChannel', '清零帧', '四元数', 'littleFinger', 'ringFinger', 'middleFinger', 'indexFinger', 'thumb', 'fingerRoot', 'palm'];
const USER_TEXT = '# 用户原始标题\n**这段用户输入保留星号**\n<script>window.__agentMarkdownUnsafe = true</script>';
const CODE_LINE = 'const sample = "' + 'abcdefghijklmnopqrstuvwxyz0123456789'.repeat(7) + '";';
const FINAL_TEXT = [
  '# 手套采集说明',
  '',
  '这是一段 **重要说明**，可以阅读 `timestamp`，也支持 ~~旧字段~~。',
  '',
  '## 核对步骤',
  '',
  '1. 检查采集记录',
  '   - 确认左手通道',
  '   - 确认数据完整',
  '2. 查看导出结果',
  '',
  '> 每一行代表一帧；下面是 28 列的宽表。',
  '',
  '| ' + HEADERS.join(' | ') + ' |',
  '| ' + HEADERS.map(() => '---').join(' | ') + ' |',
  '| ' + HEADERS.map((name) => name + ' 的合成字段说明').join(' | ') + ' |',
  '',
  '```javascript',
  CODE_LINE,
  'console.log(sample);',
  '```',
  '',
  '[网页说明](https://example.invalid/guide) [邮件](mailto:test@example.invalid)',
  '',
  '[危险脚本](javascript:alert%281%29) [本地文件](file:///C:/private.txt) [数据地址](data:text/html,hello) [相对路由](/settings) [协议相对地址](//blocked.invalid/path)',
  '',
  '![远程图片说明](https://blocked.invalid/markdown-image.png)',
  '',
  '<script>window.__agentMarkdownUnsafe = true</script>',
  '<img src="https://blocked.invalid/raw-image.png" onerror="window.__agentMarkdownUnsafe = true">',
  '<iframe src="https://blocked.invalid/frame"></iframe>',
  '',
  '最终回复完成。',
].join('\n');
const STREAM_TEXT = '## 正在分析\n\n已收到 **第一段数据**。\n\n```javascript\nconst pending = 1;';

/** 创建仅存内存的回复状态，重现流式草稿替换和历史重新加载。 */
function buildSnapshot(phase) {
  const task = { id: 'markdown-task', status: phase === 'stream' ? 'running' : 'succeeded', steps: [], proposals: [] };
  const messages = [{ id: 'question', taskId: task.id, role: 'user', text: USER_TEXT }];
  if (phase !== 'stream') messages.push({ id: 'answer', taskId: task.id, role: 'assistant', text: FINAL_TEXT });
  return { conversation: { id: 'markdown-conversation', messages, tasks: [task] }, activeTask: task, attachments: [] };
}

/** 使用真实对话组件和样式验收，不连接模型、串口或用户历史记录。 */
function MarkdownFixture() {
  const [phase, setPhase] = useState('final');
  const [reload, setReload] = useState(0);
  const snapshot = buildSnapshot(phase);
  const drafts = phase === 'stream' ? { 'markdown-task': { conversationId: snapshot.conversation.id, text: STREAM_TEXT } } : {};
  return <div className="shroom-agent-root">
    <dialog open className="shroom-agent-dialog" aria-label="Agent Markdown 本机验收">
      <div className="shroom-agent-panel">
        <header className="shroom-agent-header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="shroom-agent-identity"><h2>Agent Markdown · 合成数据</h2></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button onClick={() => setPhase('stream')}>流式测试</button>
            <button onClick={() => setPhase('final')}>完成回复</button>
            <button onClick={() => { setPhase('final'); setReload((value) => value + 1); }}>重新载入</button>
          </div>
        </header>
        <div className="shroom-agent-scroll">
          <AgentConversation key={reload} snapshot={snapshot} drafts={drafts} />
        </div>
      </div>
    </dialog>
  </div>;
}

createRoot(document.getElementById('root')).render(<MarkdownFixture />);
