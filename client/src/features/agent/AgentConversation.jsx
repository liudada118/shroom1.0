import React from 'react';
import AgentTaskCard from './AgentTaskCard';
import AgentAlgorithmDataRequest from './AgentAlgorithmDataRequest';
import { buildAgentTurns, TASK_LABELS } from './agentState';
import { attachmentThumbnail } from './agentAttachments';

/** 每轮回复紧接本轮执行记录，历史记录折叠后仍留在所属轮次。 */
export default function AgentConversation({ snapshot, drafts, disabled, pendingAction, onProposalAction, invoke, onSubmitAlgorithmData, onCancelAlgorithmData }) {
  const turns = buildAgentTurns(snapshot, drafts);
  const latestTaskId = turns.reduce((latest, turn) => turn.taskIndex > (latest?.taskIndex ?? -1) ? turn : latest, null)?.task?.id;
  const dataTaskId = turns.filter((turn) => turn.task?.status === 'awaiting_data' && turn.task.algorithmDataRequest?.status === 'pending').at(-1)?.task.id;
  /** 数据选择跟随任务身份，旧卡片不会另起一个算法任务。 */
  const taskCard = (task) => <AgentTaskCard task={task} disabled={disabled} pendingAction={pendingAction} onProposalAction={onProposalAction}
    algorithmDataContent={task.algorithmDataRequest && <AgentAlgorithmDataRequest key={task.algorithmDataRequest.id} task={task}
      expanded={task.id === dataTaskId} disabled={disabled} invoke={invoke} onSubmit={onSubmitAlgorithmData} onCancel={onCancelAlgorithmData} />} />;
  return <div className="shroom-agent-messages" role="log" aria-label="会话消息" aria-live="polite" aria-relevant="additions text">
    {turns.map((turn) => <section className="shroom-agent-turn" key={turn.id} data-task-id={turn.task?.id}>
      {turn.messages.map((message) => <article className={`shroom-agent-message is-${message.role}`} key={message.id}>
        <div className="shroom-agent-message-label">{message.role === 'user' ? '你' : 'Shroom Agent'}</div>
        <div className="shroom-agent-message-text">{message.text}</div>
        {message.attachmentIds?.length > 0 && <ul className="shroom-agent-message-attachments" aria-label="已发送附件">{message.attachmentIds.map((id) => {
          const attachment = snapshot.attachments?.find((item) => item.id === id);
          return attachment && <li key={id}>{attachmentThumbnail(attachment) && <img loading="lazy" src={attachmentThumbnail(attachment)} alt={attachment.name} />}<span>{attachment.name}</span></li>;
        })}</ul>}
      </article>)}
      {turn.draft && <article className="shroom-agent-message is-assistant">
        <div className="shroom-agent-message-label">Shroom Agent <span>正在回复</span></div>
        <div className="shroom-agent-message-text">{turn.draft.text}<span className="shroom-agent-caret" aria-hidden="true" /></div>
      </article>}
      {turn.task && <div className="shroom-agent-task-history">
        {turn.task.id === latestTaskId ? taskCard(turn.task)
          : <details className="shroom-agent-past-task"><summary>任务 {turn.taskIndex + 1} · {TASK_LABELS[turn.task.status] || turn.task.status}</summary>
            {taskCard(turn.task)}
          </details>}
      </div>}
    </section>)}
  </div>;
}
