import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AgentConversation from './AgentConversation';
import AgentHistoryReport from './AgentHistoryReport';

describe('历史描述分析的对话交付', () => {
  it('聊天内单条无标签选数入口不显示分类窗口或标签要求', () => {
    const task = { id: 'task', conversationId: 'conversation', status: 'awaiting_data', steps: [], proposals: [],
      algorithmDataRequest: { id: 'request', kind: 'history', systemId: 'fixture', status: 'pending', message: '选择这次采集' } };
    const html = renderToStaticMarkup(<AgentConversation snapshot={{ conversation: { id: 'conversation', messages: [], tasks: [task] } }} invoke={() => {}} />);
    expect(html).toContain('历史分析数据选择');
    expect(html).toContain('单条记录也可以分析');
    expect(html).not.toContain('每个识别窗口');
    expect(html).not.toContain('两类');
  });
  it('计算结果和完整来源在原任务中可查看，未知矩阵不会伪装成当前配置', () => {
    const html = renderToStaticMarkup(<AgentHistoryReport report={{ id: 'run', computedAt: '2026-10-19T04:00:00Z', version: 'history-statistics-v1',
      evaluation: { notice: '描述性统计，不代表舒适度。' }, comparisons: [], warnings: ['配置版本未知'], results: [{
        source: { recordId: 'record', recordName: '记录一', firstFrameId: 1, lastFrameId: 2, maxId: 8, matrix: null, dataStage: 'data' },
        statistics: { frames: 2, average: 1.5, maximum: 4, activeRatio: 0.5 },
      }] }} />);
    expect(html).toContain('历史矩阵未知');
    expect(html).toContain('平均值 1.50');
    expect(html).toContain('maxId');
    expect(html).toContain('配置版本未知');
  });
});
