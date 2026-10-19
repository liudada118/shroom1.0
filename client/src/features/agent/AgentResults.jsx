import React from 'react';

const SYSTEM_KINDS = new Set(['create_system', 'builtin_system', 'duplicate_system']);

/** 不把开发集、折外预测或未注明的历史报告标成独立验证。 */
function evaluationLabel(report) {
  const labels = { 'group-cross-validation': '按采集分组交叉验证', 'development-only': '仅开发集', 'independent-validation': '独立采集验证' };
  return labels[report.evaluation] || (report.split === 'development' ? '开发集' : report.split === 'validation' ? '独立记录' : '验证方式未注明');
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
  if (!results.length) return null;
  const systems = results.filter((item) => item.kind === 'system').length;
  const algorithms = results.length - systems;
  return <section className="shroom-agent-results" aria-label="Agent 创建成果">
    <button className="shroom-agent-results-toggle" type="button" aria-expanded={expanded} onClick={onToggle}>
      <span className="shroom-agent-results-icon" aria-hidden="true">✓</span>
      <span><strong>已创建的成果</strong><small>{systems ? `${systems} 个系统` : ''}{systems && algorithms ? ' · ' : ''}{algorithms ? `${algorithms} 个算法` : ''} · 最近：{results.slice(0, 2).map((item) => item.name).join('、')}</small></span>
      <span className="shroom-agent-results-chevron" aria-hidden="true">{expanded ? '收起' : '查看'}</span>
    </button>
    {expanded && <div className="shroom-agent-results-list">
      {results.map((item) => <article className="shroom-agent-result" key={item.key}>
        <span className="shroom-agent-result-kind">{item.kind === 'system' ? '展示系统' : '分类算法'}</span>
        <strong>{item.name}</strong>
        <small>{item.kind === 'system' ? `系统 ID：${item.systemId}` : item.packageId ? `实时包：${item.packageId}` : `所属系统：${item.systemId}`}</small>
        <p>{item.kind === 'system' ? '已加入系统列表。连接设备和实际画面仍需验证。'
          : item.packageId ? '已保存到实时算法目录；可在实时连接启用，或绑定到系统自动启用。' : '已保存到离线算法库，尚不能实时启用。'}</p>
        {item.kind === 'algorithm' && Number.isFinite(item.report?.accuracy) && <p className="shroom-agent-result-report">测试：{item.report.windows} 个窗口 · 正确率 {(item.report.accuracy * 100).toFixed(1)}%（{evaluationLabel(item.report)}）</p>}
        {actionFeedback?.key === item.key && <p className={`shroom-agent-result-feedback ${actionFeedback.error ? 'is-error' : ''}`} role={actionFeedback.error ? 'alert' : 'status'}>{actionFeedback.message}</p>}
        {item.kind === 'system' && actionFeedback?.key === item.key && actionFeedback.updateBaseVersion
          && <button type="button" onClick={() => onSubmitPackage(item, actionFeedback.updateBaseVersion)}>
            确认作为版本 #{actionFeedback.updateBaseVersion} 的更新提交
          </button>}
        <div className="shroom-agent-result-actions">
          {item.kind === 'system' ? <><button className="shroom-agent-primary" type="button" onClick={() => onOpenSystem(item, true)}>进入系统</button>
            <button type="button" onClick={() => onOpenSystem(item, false)}>在系统列表中查看</button>
            <button type="button" onClick={() => onSubmitPackage(item)}>提交公司审核</button>
            <button type="button" onClick={() => onExportPackage(item)}>导出审核包</button></>
            : <><button className="shroom-agent-primary" type="button" disabled={!item.packageId || Boolean(pendingAlgorithm)} onClick={() => onUseAlgorithm(item)}>{pendingAlgorithm === item.key ? '正在启用…' : '直接使用算法'}</button>
              <button type="button" onClick={() => onOpenSystem(item, true)}>进入所属系统</button>
              <button type="button" onClick={() => onPrepareAlgorithm(item)}>{item.packageId ? '绑定到系统' : '完善实时算法'}</button></>}
        </div>
      </article>)}
    </div>}
  </section>;
}
