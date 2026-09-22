import { describe, expect, it } from 'vitest';
import { collectAgentTasks, createAgentViewState, isTaskBusy, reduceAgentView } from './agentState';

/** 生成包含指定会话与任务的最小权威快照。 */
function stateEvent({ conversationId = 'conversation-a', status = 'running', messages = [], tasks = [], taskId = 'task-a' } = {}) {
  return { type: 'state', state: {
    conversation: { id: conversationId, messages, tasks },
    activeTask: { id: taskId, conversationId, status, steps: [], proposals: [] },
    attachments: [], settings: { baseUrl: 'https://api.openai.com/v1', model: 'test', hasApiKey: true },
  } };
}

describe('Agent 权威快照与流式回答', () => {
  it('保留步骤状态更新间尚未提交的流式正文', () => {
    let state = reduceAgentView(createAgentViewState(), stateEvent());
    state = reduceAgentView(state, { type: 'text.delta', taskId: 'task-a', delta: '已查询' });
    state = reduceAgentView(state, stateEvent());
    state = reduceAgentView(state, { type: 'text.delta', taskId: 'task-a', delta: '设备状态' });
    expect(state.drafts['task-a'].text).toBe('已查询设备状态');
  });

  it('最终消息替换流式草稿，完成后迟到片段不重复追加', () => {
    let state = reduceAgentView(createAgentViewState(), stateEvent());
    state = reduceAgentView(state, { type: 'text.delta', taskId: 'task-a', delta: '已完成' });
    state = reduceAgentView(state, stateEvent({ status: 'succeeded', messages: [{ id: 'answer', role: 'assistant', taskId: 'task-a', text: '已完成查询。' }] }));
    expect(state.drafts).toEqual({});
    expect(state.snapshot.conversation.messages[0].text).toBe('已完成查询。');
    expect(reduceAgentView(state, { type: 'text.delta', taskId: 'task-a', delta: '迟到' })).toBe(state);
  });

  it('切换会话清除草稿并拒绝原会话的片段', () => {
    let state = reduceAgentView(createAgentViewState(), stateEvent());
    state = reduceAgentView(state, { type: 'text.delta', taskId: 'task-a', delta: '旧会话' });
    state = reduceAgentView(state, stateEvent({ conversationId: 'conversation-b', taskId: 'task-b' }));
    expect(state.drafts).toEqual({});
    expect(reduceAgentView(state, { type: 'text.delta', taskId: 'task-a', delta: '不可显示' })).toBe(state);
  });

  it('新任务不会恢复同一会话中已结束任务的草稿', () => {
    const event = stateEvent({ taskId: 'task-b', tasks: [{ id: 'task-a', status: 'cancelled' }] });
    const state = reduceAgentView(createAgentViewState(), event);
    expect(reduceAgentView(state, { type: 'text.delta', taskId: 'task-a', delta: '不可显示' })).toBe(state);
  });

  it('同任务已落盘的回答即使仍在核验，也替换草稿', () => {
    let state = reduceAgentView(createAgentViewState(), stateEvent());
    state = reduceAgentView(state, { type: 'text.delta', taskId: 'task-a', delta: '生成方案' });
    state = reduceAgentView(state, stateEvent({ status: 'verifying', messages: [{ id: 'answer', role: 'assistant', taskId: 'task-a', text: '方案已生成' }] }));
    expect(state.drafts).toEqual({});
    expect(reduceAgentView(state, { type: 'text.delta', taskId: 'task-a', delta: '迟到片段' })).toBe(state);
  });

  it('初始状态失败及运行进程错误可见，不冒充正常结果', () => {
    const initial = reduceAgentView(createAgentViewState(), { type: 'error', message: '连接失败' });
    expect(initial.loading).toBe(false);
    expect(initial.error).toBe('连接失败');
    const crashed = reduceAgentView(initial, { type: 'runtime.error', error: { message: '运行进程中断' } });
    expect(crashed.error).toBe('运行进程中断');
  });

  it('最新活动任务覆盖历史副本，其他会话的活动任务不进入历史', () => {
    const snapshot = stateEvent({ tasks: [{ id: 'task-a', status: 'running' }], status: 'verifying' }).state;
    expect(collectAgentTasks(snapshot)).toHaveLength(1);
    expect(collectAgentTasks(snapshot)[0].status).toBe('verifying');
    snapshot.activeTask.conversationId = 'other-conversation';
    expect(collectAgentTasks(snapshot)[0].status).toBe('running');
  });

  it('应用和恢复均阻止重复执行，待应用方案不占用执行器', () => {
    expect(isTaskBusy({ status: 'awaiting_action', proposals: [{ status: 'pending' }] })).toBe(false);
    expect(isTaskBusy({ status: 'awaiting_action', proposals: [{ status: 'applying' }] })).toBe(true);
    expect(isTaskBusy({ status: 'succeeded', proposals: [{ status: 'restoring' }] })).toBe(true);
    expect(isTaskBusy({ status: 'uncertain' })).toBeFalsy();
  });
});
