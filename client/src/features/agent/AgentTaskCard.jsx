import React from 'react';
import { TASK_LABELS, TOOL_LABELS, agentErrorMessage, proposalPreview } from './agentState';

/** 展示任务的真实步骤、配置预览和应用后的恢复入口。 */
export default function AgentTaskCard({ task, disabled, pendingAction, onProposalAction }) {
  return <section className="shroom-agent-task" aria-label="任务执行情况">
    <div className="shroom-agent-task-heading">
      <strong>执行记录</strong>
      <span className="shroom-agent-status" data-status={task.status}>{TASK_LABELS[task.status] || task.status}</span>
    </div>
    {task.steps?.length > 0 && <ol className="shroom-agent-steps">{task.steps.map((step) => <li key={step.id} data-status={step.status}>
      <span className="shroom-agent-step-marker" aria-hidden="true" />
      <div><strong>{TOOL_LABELS[step.name] || step.name}</strong>{step.message && <p>{step.message}</p>}</div>
      <span>{TASK_LABELS[step.status] || step.status}</span>
    </li>)}</ol>}
    {task.error && <p className="shroom-agent-inline-error" role="alert">{agentErrorMessage(task.error)}</p>}
    {task.status === 'uncertain' && <p className="shroom-agent-hint">执行中断，部分更改可能已生效。请先检查系统现状，再决定下一步。</p>}
    {(task.proposals || []).map((proposal) => {
      const key = `${task.id}:${proposal.id}`;
      const pending = pendingAction === key;
      return <article className="shroom-agent-proposal" key={proposal.id}>
        <div className="shroom-agent-task-heading"><strong>{proposal.kind === 'algorithm_package' ? '保存分类算法' : proposal.kind === 'delete_native_system' ? '删除独立系统（保留采集数据）' : proposal.kind === 'update_native_system' ? '修改独立系统' : proposal.kind === 'builtin_system' ? '以内置模板创建系统' : proposal.kind === 'create_system' ? '创建展示系统' : proposal.kind === 'duplicate_system' ? '复制展示系统' : proposal.kind === 'connect_device' ? '连接设备' : '修改展示配置'}</strong>
          <span className="shroom-agent-status" data-status={proposal.status}>{TASK_LABELS[proposal.status] || proposal.status}</span></div>
        <p>{proposal.summary || proposal.systemId}</p>
        {proposal.kind === 'algorithm_package' && proposal.after?.report && <div className="shroom-agent-algorithm-report">
          <p><strong>{proposal.after.report.split === 'validation' ? '独立记录验证' : '仅开发集测试'}</strong> · {proposal.after.report.windows} 个窗口 · 正确 {proposal.after.report.correct} · 未知 {proposal.after.report.unknown}</p>
          <p>本次窗口正确率：{(proposal.after.report.accuracy * 100).toFixed(1)}%。{proposal.after.report.split === 'development' ? '尚未验证对新采集数据的识别效果。' : '只反映所选记录的结果。'}</p>
          <details><summary>查看算法源码</summary><pre>{proposal.after.source}</pre></details>
          <p className="shroom-agent-hint">保存后可继续离线测试，也可绑定当前系统启用实时分类。</p>
        </div>}
        {proposal.after != null && <details><summary>查看配置内容</summary><pre>{proposalPreview(proposal.after)}</pre></details>}
        {proposal.before != null && <details><summary>查看修改前配置</summary><pre>{proposalPreview(proposal.before)}</pre></details>}
        {proposal.result != null && <details><summary>查看实际执行与核验结果</summary><pre>{proposalPreview(proposal.result)}</pre></details>}
        {proposal.error && <p className="shroom-agent-inline-error" role="alert">{agentErrorMessage(proposal.error)}</p>}
        <div className="shroom-agent-proposal-actions">
          {proposal.status === 'pending' && <button className="shroom-agent-primary" type="button" disabled={disabled || pending}
            onClick={() => onProposalAction('applyProposal', task.id, proposal.id)}>{pending ? '正在应用…' : '应用此方案'}</button>}
          {proposal.status === 'applied' && ['update_display', 'update_native_system'].includes(proposal.kind) && <button type="button" disabled={disabled || pending}
            onClick={() => onProposalAction('restoreProposal', task.id, proposal.id)}>{pending ? '正在恢复…' : '恢复此项更改'}</button>}
        </div>
        {proposal.status === 'applied' && <p className="shroom-agent-hint">{proposal.kind === 'connect_device'
          ? proposal.result?.liveVerified ? '已连接指定端口并观察到有效实时数据；实际画面与物理标定仍需检查。'
            : proposal.result?.connected ? '串口已打开，但尚未验证有效实时数据，请继续检查设备。'
              : '连接请求已发出，尚未确认端口打开，请查询设备状态。'
          : proposal.kind === 'algorithm_package' ? proposal.result?.realtimePackageId ? '已保存并登记到实时算法目录，可在当前系统绑定启用。' : '已保存算法；旧版本需重新测试以补齐实时输入契约。'
            : proposal.kind === 'delete_native_system' ? '系统配置已移除，采集数据保留。' : '配置已应用，设备数据是否正常以连接后的检查结果为准。'}</p>}
      </article>;
    })}
  </section>;
}
