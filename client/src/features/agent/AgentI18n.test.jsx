import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import AgentSettings from './AgentSettings';
import AgentSyncSettings, { describeChatSync } from './AgentSyncSettings';
import AgentHistory from './AgentHistory';
import AgentConversation from './AgentConversation';
import AgentTaskCard from './AgentTaskCard';
import AgentResults from './AgentResults';
import AgentAlgorithmDataRequest from './AgentAlgorithmDataRequest';
import { TASK_LABELS, TOOL_LABELS } from './agentState';
import { agentKnownLabel, agentDate, agentUiMessage } from './agentUi';

afterEach(async () => { await i18n.changeLanguage('zh'); });

/** 渲染实际常用面板，合成状态不读取服务器、不上传聊天。 */
function renderPanels() {
  return renderToStaticMarkup(<>
    <AgentSettings settings={{ model: 'gpt-5-mini', baseUrl: 'https://api.openai.com/v1', hasApiKey: true }} />
    <AgentSyncSettings sync={{ settings: { enabled: true, endpoint: 'https://example.invalid/chat', noticePending: true },
      status: { state: 'blocked', pendingCount: 2, pendingRange: { count: 2, oldestAt: '2026-10-01T12:00:00Z', newestAt: '2026-10-02T12:00:00Z' },
        recoverableQueues: [{ queueId: 'fixture', legacy: true, count: 1 }] } }} />
    <AgentHistory />
    <AgentTaskCard task={{ status: 'awaiting_action', steps: [{ id: 'one', name: 'get_capabilities', status: 'succeeded' }],
      proposals: [{ id: 'p', kind: 'create_system', status: 'pending', systemId: 'fixture',
        mappingPreview: [{ sensorId: 'sit', rawPoints: 1024, matrix: { rows: 23, cols: 23 }, mappedPoints: 529, first: [1], firstRowEnd: 23, secondRowStart: 24, last: [529] }] }] }} />
    <AgentResults expanded results={[{ key: 'result', kind: 'algorithm', name: 'Fixture', systemId: 'fixture', packageId: 'fixture-package', report: { accuracy: 0.8, windows: 10, evaluation: 'group-cross-validation' } }]} />
    <AgentAlgorithmDataRequest task={{ status: 'succeeded', algorithmDataRequest: { id: 'request', status: 'submitted' } }} />
  </>);
}

describe('Agent interface language coverage', () => {
  it('renders English settings, sync, task cards, results and history without Chinese UI text', async () => {
    await i18n.changeLanguage('en');
    const html = renderPanels();
    expect(html).toContain('Model connection');
    expect(html).toContain('Restore this queue');
    expect(html).toContain('23×23');
    expect(html).toContain('Cross-validation grouped by recording');
    expect(html).not.toMatch(/[\u3400-\u9fff]/);
    expect(html).not.toContain('agentUi.');
    expect(describeChatSync({ settings: { enabled: true }, status: { state: 'retrying', pendingCount: 2 } })).toBe('Waiting for automatic retry · 2 conversations pending sync');
  });

  it('renders Japanese settings and dynamic sync status using the selected language', async () => {
    await i18n.changeLanguage('ja');
    const html = renderPanels();
    expect(html).toContain('モデル接続');
    expect(html).toContain('今すぐ再試行');
    expect(html).toContain('会話履歴');
    expect(html).toContain('今回のアルゴリズムデータを確認しました');
    expect(html).not.toContain('模型连接');
    expect(html).not.toContain('聊天同步');
    expect(html).not.toContain('agentUi.');
    expect(describeChatSync({ settings: { enabled: true }, status: { state: 'syncing', pendingCount: 2 } })).toBe('アップロード中 · 2 件の会話が同期待ち');
  });

  it('preserves user messages, model replies and attachment names verbatim', async () => {
    await i18n.changeLanguage('en');
    const html = renderToStaticMarkup(<AgentConversation drafts={{}} snapshot={{
      conversation: { id: 'conversation', messages: [{ id: 'user', role: 'user', text: '我的原始问题', attachmentIds: ['attachment'] },
        { id: 'assistant', role: 'assistant', text: '模型的原始回答' }], tasks: [] }, attachments: [{ id: 'attachment', name: '客户点位表.csv' }],
    }} />);
    expect(html).toContain('我的原始问题');
    expect(html).toContain('模型的原始回答');
    expect(html).toContain('客户点位表.csv');
    expect(html).toContain('Conversation messages');
    expect(html).toContain('Sent attachments');
  });

  it('translates every registered task/tool label and formats dates in the application locale', async () => {
    await i18n.changeLanguage('en');
    for (const value of [...Object.values(TASK_LABELS), ...Object.values(TOOL_LABELS)]) {
      expect(agentKnownLabel(value), value).not.toMatch(/[\u3400-\u9fff]/);
    }
    const value = '2026-10-28T01:02:03Z';
    expect(agentDate(value)).toBe(new Date(value).toLocaleString('en-US', { hour12: false }));
    await i18n.changeLanguage('ja');
    expect(agentDate(value)).toBe(new Date(value).toLocaleString('ja-JP', { hour12: false }));
    expect(agentKnownLabel('unknown custom label')).toBe('unknown custom label');
  });

  it('retranslates existing fixed feedback while preserving raw server errors', async () => {
    const feedback = { key: 'retryRequested' };
    await i18n.changeLanguage('zh');
    expect(agentUiMessage(feedback)).toBe('已请求重试，请查看下方同步状态。');
    await i18n.changeLanguage('en');
    expect(agentUiMessage(feedback)).toBe('Retry requested. Check the sync status below.');
    await i18n.changeLanguage('ja');
    expect(agentUiMessage(feedback)).toBe('再試行を要求しました。下の同期状態を確認してください。');
    expect(agentUiMessage('服务端原始错误：设备状态已变化')).toBe('服务端原始错误：设备状态已变化');
  });
});
