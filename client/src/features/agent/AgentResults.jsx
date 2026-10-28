import { useTranslation } from 'react-i18next';
import { agentUiText as tr, agentUiMessage } from './agentUi';
import React from 'react';

const SYSTEM_KINDS = new Set(['create_system', 'builtin_system', 'duplicate_system']);

/** 不把开发集、折外预测或未注明的历史报告标成独立验证。 */
function evaluationLabel(report) {
  const labels = { 'group-cross-validation': tr('groupValidation'), 'development-only': tr('developmentSetOnly'), 'independent-validation': tr('independentRecording') };
  return labels[report.evaluation] || (report.split === 'development' ? tr('developmentSet') : report.split === 'validation' ? tr('independentRecords') : tr('unspecifiedValidation'));
}

/** 从当前会话的已应用提案提取可直达的系统与算法成果。 */
export function collectAgentResults(tasks = []) {
  return tasks.flatMap((task) => (task.proposals || []).filter((proposal) => (
    proposal.status === 'applied' && (SYSTEM_KINDS.has(proposal.kind) || proposal.kind === 'algorithm_package')
  )).map((proposal) => ({
    key: `${task.id}:${proposal.id}`,
    kind: proposal.kind === 'algorithm_package' ? 'algorithm' : 'system',
    name: proposal.input?.name || proposal.after?.name || proposal.systemId,
    systemId: proposal.result?.systemId || proposal.systemId,
    systemType: proposal.kind === 'builtin_system' ? proposal.systemId
      : proposal.after?.sensor?.type || proposal.after?.sensors?.[0]?.type || proposal.systemId,
    packageId: proposal.result?.realtimePackageId || null,
    report: proposal.after?.report || null,
  }))).reverse();
}

/** 把已保存成果固定在对话上方，并提供明确的下一步操作。 */
export default function AgentResults({ results, expanded, onToggle, onOpenSystem, onExportPackage, onSubmitPackage, onUseAlgorithm, onPrepareAlgorithm, pendingAlgorithm = '', actionFeedback = null }) {
  useTranslation();
  if (!results.length) return null;
  const systems = results.filter((item) => item.kind === 'system').length;
  const algorithms = results.length - systems;
  return <section className="shroom-agent-results" aria-label={tr('createdResults')}>
    <button className="shroom-agent-results-toggle" type="button" aria-expanded={expanded} onClick={onToggle}>
      <span className="shroom-agent-results-icon" aria-hidden="true">✓</span>
      <span><strong>{tr('savedResults')}</strong><small>{systems ? tr('systemCount', { count: systems }) : ''}{systems && algorithms ? ' · ' : ''}{algorithms ? tr('algorithmCount', { count: algorithms }) : ''}{tr('recentResults', { names: results.slice(0, 2).map((item) => item.name).join(', ') })}</small></span>
      <span className="shroom-agent-results-chevron" aria-hidden="true">{expanded ? tr('collapse') : tr('view')}</span>
    </button>
    {expanded && <div className="shroom-agent-results-list">
      {results.map((item) => <article className="shroom-agent-result" key={item.key}>
        <span className="shroom-agent-result-kind">{item.kind === 'system' ? tr('displaySystem') : tr('classifier')}</span>
        <strong>{item.name}</strong>
        <small>{tr(item.kind === 'system' ? 'systemId' : item.packageId ? 'livePackage' : 'ownerSystem', { id: item.kind === 'system' ? item.systemId : item.packageId || item.systemId })}</small>
        <p>{item.kind === 'system' ? tr('systemAdded')
          : item.packageId ? tr('liveAlgorithmSaved') : tr('offlineAlgorithmSaved')}</p>
        {item.kind === 'algorithm' && Number.isFinite(item.report?.accuracy) && <p className="shroom-agent-result-report">{tr('resultTest', { windows: item.report.windows, accuracy: (item.report.accuracy * 100).toFixed(1), evaluation: evaluationLabel(item.report) })}</p>}
        {actionFeedback?.key === item.key && <p className={`shroom-agent-result-feedback ${actionFeedback.error ? 'is-error' : ''}`} role={actionFeedback.error ? 'alert' : 'status'}>{agentUiMessage(actionFeedback.message)}</p>}
        {item.kind === 'system' && actionFeedback?.key === item.key && actionFeedback.updateBaseVersion
          && <button type="button" onClick={() => onSubmitPackage(item, actionFeedback.updateBaseVersion)}>
            {tr('confirmVersion', { version: actionFeedback.updateBaseVersion })}
          </button>}
        <div className="shroom-agent-result-actions">
          {item.kind === 'system' ? <><button className="shroom-agent-primary" type="button" onClick={() => onOpenSystem(item, true)}>{tr('enterSystem')}</button>
            <button type="button" onClick={() => onOpenSystem(item, false)}>{tr('locateSystem')}</button>
            <button type="button" onClick={() => onSubmitPackage(item)}>{tr('submitCompany')}</button>
            <button type="button" onClick={() => onExportPackage(item)}>{tr('exportReview')}</button></>
            : <><button className="shroom-agent-primary" type="button" disabled={!item.packageId || Boolean(pendingAlgorithm)} onClick={() => onUseAlgorithm(item)}>{pendingAlgorithm === item.key ? tr('enabling') : tr('useAlgorithm')}</button>
              <button type="button" onClick={() => onOpenSystem(item, true)}>{tr('enterOwner')}</button>
              <button type="button" onClick={() => onPrepareAlgorithm(item)}>{item.packageId ? tr('bindToSystem') : tr('completeAlgorithm')}</button></>}
        </div>
      </article>)}
    </div>}
  </section>;
}
