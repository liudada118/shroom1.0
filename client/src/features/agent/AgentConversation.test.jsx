import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AgentConversation from './AgentConversation';
import { buildAgentTurns } from './agentState';

/** 两轮任务覆盖失败后继续、流式输出和旧版无 taskId 消息。 */
function snapshot(legacy = false) {
  const tasks = [{ id: 'first', status: 'failed' }, { id: 'second', status: 'succeeded' }];
  const messages = tasks.flatMap((task, index) => [
    { id: `u${index}`, role: 'user', text: `请求${index}`, ...(!legacy && { taskId: task.id }) },
    { id: `a${index}`, role: 'assistant', text: `回复${index}`, ...(!legacy && { taskId: task.id }) },
  ]);
  return { conversation: { id: 'conversation', tasks, messages }, activeTask: tasks[1] };
}

describe('每轮 Agent 回复与执行结果', () => {
  it.each([false, true])('按任务排列消息与记录，兼容旧消息：%s', (legacy) => {
    const html = renderToStaticMarkup(<AgentConversation snapshot={snapshot(legacy)} />);
    expect(html.indexOf('回复0')).toBeLessThan(html.indexOf('任务 1'));
    expect(html.indexOf('任务 1')).toBeLessThan(html.indexOf('请求1'));
    expect(html.indexOf('请求1')).toBeLessThan(html.indexOf('回复1'));
    expect(html.indexOf('回复1')).toBeLessThan(html.lastIndexOf('执行记录'));
  });

  it('迟到的回复仍归原任务，当前草稿只显示在当前任务', () => {
    const value = snapshot();
    value.conversation.messages = [value.conversation.messages[0], value.conversation.messages[2], value.conversation.messages[1]];
    value.activeTask = { id: 'second', status: 'running' };
    const turns = buildAgentTurns(value, { second: { conversationId: 'conversation', text: '新回复片段' }, first: { conversationId: 'conversation', text: '旧片段' } });
    expect(turns.map((turn) => turn.messages.map((message) => message.id))).toEqual([['u0', 'a0'], ['u1']]);
    expect(turns[0].draft).toBeNull();
    expect(turns[1].draft.text).toBe('新回复片段');
  });

  it('已落盘的回答替代草稿，无关任务和其他会话草稿不会混入', () => {
    const value = snapshot();
    value.activeTask = { id: 'second', status: 'running' };
    const turns = buildAgentTurns(value, { second: { conversationId: 'conversation', text: '重复片段' }, unknown: { conversationId: 'conversation', text: '未知' } });
    expect(turns.every((turn) => turn.draft === null)).toBe(true);
    value.conversation.messages.pop();
    expect(buildAgentTurns(value, { second: { conversationId: 'other', text: '其他会话' } })[1].draft).toBeNull();
  });
});
