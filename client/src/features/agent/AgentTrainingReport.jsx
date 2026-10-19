import React from 'react';

const MODELS = { linear: '线性分类器', tree: '决策树', forest: '随机森林' };
const EVALUATIONS = { 'group-cross-validation': '按采集分组交叉验证', 'development-only': '仅开发集评估', 'independent-validation': '独立采集验证' };

/** 显示本机训练的真实比较、各类表现和有限错例，区分训练与独立验证。 */
export default function AgentTrainingReport({ report, modelSummary }) {
  const records = new Map((report.records || []).map((record) => [record.id, record.date]));
  return <div className="shroom-agent-algorithm-report shroom-agent-training-report">
    <p><strong>{EVALUATIONS[report.evaluation] || '训练评估'}</strong></p>
    <p>推荐模型：{MODELS[modelSummary?.kind] || modelSummary?.kind} · {report.windows} 个窗口</p>
    <p>正确率 {(report.accuracy * 100).toFixed(1)}% · 未识别 {report.unknown} 个窗口</p>
    {report.evaluation !== 'independent-validation' && <p className="shroom-agent-hint">尚未通过另一批独立采集验证，不能据此保证新数据的识别效果。</p>}
    {(report.warnings || []).map((warning, index) => <p className="shroom-agent-hint" key={index}>{warning}</p>)}
    {report.candidates?.length > 0 && <details><summary>查看模型比较</summary><div className="shroom-agent-training-table"><table>
      <thead><tr><th>模型</th><th>综合评分 F1</th><th>正确率</th></tr></thead>
      <tbody>{report.candidates.map((candidate, index) => <tr key={index}><td>{MODELS[candidate.kind] || candidate.name || candidate.kind}</td>
        <td>{Number.isFinite(candidate.macroF1) ? candidate.macroF1.toFixed(3) : '—'}</td>
        <td>{Number.isFinite(candidate.accuracy) ? `${(candidate.accuracy * 100).toFixed(1)}%` : '—'}</td></tr>)}</tbody>
    </table></div></details>}
    {Array.isArray(report.perClass) && report.perClass.length > 0 && <details><summary>查看各类别效果</summary><ul>
      {report.perClass.map((item) => <li key={item.label}>{item.label}：识别出率 {Number.isFinite(item.recall) ? `${(item.recall * 100).toFixed(1)}%` : '—'}，共 {item.support} 个窗口</li>)}
    </ul></details>}
    {report.mistakes?.length > 0 && <details><summary>查看误判片段（最多 10 条）</summary><ul>
      {report.mistakes.map((item, index) => <li key={index}>{records.get(item.recordId) || '所选记录'}，第 {item.startFrame + 1} 帧起：{item.expected} → {item.predicted}</li>)}
    </ul></details>}
    <p className="shroom-agent-hint">保存后可绑定当前系统；首次启用需核验实际传感器输入。</p>
  </div>;
}
