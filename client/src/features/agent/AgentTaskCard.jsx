import { useTranslation } from 'react-i18next';
import { agentUiText as tr, agentKnownLabel } from './agentUi';
import React, { useEffect, useRef } from 'react';
import { trackUsage } from '../../services/usageAnalytics';
import { TASK_LABELS, TOOL_LABELS, agentErrorMessage, proposalPreview } from './agentState';
import AgentTrainingReport from './AgentTrainingReport';
import AgentHistoryReport from './AgentHistoryReport';

/** 展示任务的真实步骤、配置预览和应用后的恢复入口。 */
export default function AgentTaskCard({ task, disabled, pendingAction, onProposalAction, algorithmDataContent }) {
  useTranslation();
  const exposed = useRef(new Set());
  const rootRef = useRef(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver !== 'function') return undefined;
    /** Hidden drawers and collapsed history never count as a viewed proposal. */
    const report = (entries) => {
      if (root.closest('[aria-hidden="true"]')) return;
      for (const entry of entries) if (entry.isIntersecting && entry.target.getBoundingClientRect().height && !exposed.current.has(entry.target.dataset.proposalId)) {
        exposed.current.add(entry.target.dataset.proposalId);
        trackUsage('feature_exposed', { featureId: 'agent_proposal', action: `view_${entry.target.dataset.proposalKind}` });
      }
    };
    const observer = new IntersectionObserver(report);
    for (const proposal of root.querySelectorAll('[data-proposal-id]')) observer.observe(proposal);
    return () => observer.disconnect();
  }, [task.proposals]);
  return <section ref={rootRef} className="shroom-agent-task" aria-label={tr('taskExecution')}>
    <div className="shroom-agent-task-heading">
      <strong>{tr('executionLog')}</strong>
      <span className="shroom-agent-status" data-status={task.status}>{agentKnownLabel(TASK_LABELS[task.status]) || task.status}</span>
    </div>
    {task.steps?.length > 0 && <ol className="shroom-agent-steps">{task.steps.map((step) => <li key={step.id} data-status={step.status}>
      <span className="shroom-agent-step-marker" aria-hidden="true" />
      <div><strong>{agentKnownLabel(TOOL_LABELS[step.name]) || step.name}</strong>{step.message && <p>{step.message}</p>}</div>
      <span>{agentKnownLabel(TASK_LABELS[step.status]) || step.status}</span>
    </li>)}</ol>}
    {task.error && <p className="shroom-agent-inline-error" role="alert">{agentErrorMessage(task.error)}</p>}
    {task.status === 'uncertain' && <p className="shroom-agent-hint">{tr('uncertain')}</p>}
    {algorithmDataContent}
    {(task.analysisRuns || []).map((report) => <AgentHistoryReport key={report.id} report={report} />)}
    {(task.proposals || []).map((proposal) => {
      const key = `${task.id}:${proposal.id}`;
      const pending = pendingAction === key;
      return <article className="shroom-agent-proposal" key={proposal.id} data-proposal-id={proposal.id} data-proposal-kind={proposal.kind}>
        <div className="shroom-agent-task-heading"><strong>{proposal.kind === 'algorithm_package' ? tr('saveAlgorithm') : proposal.kind === 'delete_native_system' ? tr('deleteSystem') : proposal.kind === 'update_native_system' ? tr('editSystem') : proposal.kind === 'update_manifest_algorithms' ? tr('bindAlgorithm') : proposal.kind === 'builtin_system' ? tr('createTemplate') : proposal.kind === 'create_system' ? tr('createSystem') : proposal.kind === 'duplicate_system' ? tr('duplicateSystem') : proposal.kind === 'connect_device' ? tr('connectDevice') : tr('editDisplay')}</strong>
          <span className="shroom-agent-status" data-status={proposal.status}>{agentKnownLabel(TASK_LABELS[proposal.status]) || proposal.status}</span></div>
        <p>{proposal.summary || proposal.systemId}</p>
        {proposal.kind === 'create_system' && proposal.mappingPreview?.map((mapping) => <p className="shroom-agent-hint" key={mapping.sensorId}>
          {tr('mappingPreview', { sensor: mapping.sensorId, raw: mapping.rawPoints, rows: mapping.matrix.rows, cols: mapping.matrix.cols,
            mapped: mapping.mappedPoints, first: mapping.first.join(', '), firstEnd: mapping.firstRowEnd,
            second: mapping.secondRowStart == null ? '' : tr('secondRow', { value: mapping.secondRowStart }), last: mapping.last.join(', ') })}
        </p>)}
        {proposal.kind === 'algorithm_package' && proposal.after?.report && (proposal.after.language === 'cpu-classifier-v1'
          ? <AgentTrainingReport report={proposal.after.report} modelSummary={proposal.after.modelSummary} /> : <div className="shroom-agent-algorithm-report">
          <p><strong>{proposal.after.report.split === 'validation' ? tr('independentValidation') : tr('developmentOnly')}</strong> · {tr('windowResult', proposal.after.report)}</p>
          <p>{tr('accuracy', { value: (proposal.after.report.accuracy * 100).toFixed(1) })}{proposal.after.report.split === 'development' ? tr('unvalidated') : tr('selectedOnly')}</p>
          <details><summary>{tr('viewSource')}</summary><pre>{proposal.after.source}</pre></details>
          <p className="shroom-agent-hint">{tr('savedAlgorithmHint')}</p>
        </div>)}
        {proposal.after != null && <details><summary>{tr('viewConfig')}</summary><pre>{proposalPreview(proposal.after)}</pre></details>}
        {proposal.before != null && <details><summary>{tr('viewPrevious')}</summary><pre>{proposalPreview(proposal.before)}</pre></details>}
        {proposal.result != null && <details><summary>{tr('viewExecution')}</summary><pre>{proposalPreview(proposal.result)}</pre></details>}
        {proposal.error && <p className="shroom-agent-inline-error" role="alert">{agentErrorMessage(proposal.error)}</p>}
        <div className="shroom-agent-proposal-actions">
          {proposal.status === 'pending' && <button className="shroom-agent-primary" type="button" disabled={disabled || pending}
            onClick={() => onProposalAction('applyProposal', task.id, proposal.id)}>{pending ? tr('applying') : tr('applyProposal')}</button>}
          {proposal.status === 'applied' && ['update_display', 'update_native_system', 'update_manifest_algorithms'].includes(proposal.kind) && <button type="button" disabled={disabled || pending}
            onClick={() => onProposalAction('restoreProposal', task.id, proposal.id)}>{pending ? tr('restoring') : tr('restoreChange')}</button>}
        </div>
        {proposal.status === 'applied' && <p className="shroom-agent-hint">{proposal.kind === 'connect_device'
          ? proposal.result?.liveVerified ? tr('liveVerified')
            : proposal.result?.connected ? tr('portOpened')
              : tr('connectionRequested')
          : proposal.kind === 'algorithm_package' ? proposal.result?.realtimePackageId ? tr('algorithmRegistered') : tr('algorithmLegacy')
            : proposal.kind === 'delete_native_system' ? tr('systemRemoved') : tr('configurationApplied')}</p>}
      </article>;
    })}
  </section>;
}
