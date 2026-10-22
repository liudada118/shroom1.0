import React from 'react';

/** 以原帧序绘制有界标量趋势，不插值或补造传感器帧。 */
function Trend({ points = [] }) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.total), minimum = Math.min(...values), span = Math.max(...values) - minimum || 1;
  const path = points.map((point, index) => `${index * 280 / (points.length - 1)},${60 - (point.total - minimum) * 56 / span}`).join(' ');
  return <figure style={{ margin: '8px 0' }}><figcaption>总读数变化（按帧序抽样）</figcaption><svg viewBox="-4 0 288 68" role="img" aria-label="所选历史记录的总读数趋势" style={{ width: '100%', maxHeight: 90 }}>
    <title>{points.length} 个真实帧统计点；最低 {minimum.toFixed(2)}，最高 {Math.max(...values).toFixed(2)}</title>
    <polyline points={path} fill="none" stroke="#63d5ff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
  </svg></figure>;
}

/** 展示宿主真实计算的历史统计与来源，不由模型编造评分。 */
export default function AgentHistoryReport({ report }) {
  return <article className="shroom-agent-algorithm-report" aria-label="历史数据分析报告">
    <h4>历史数据分析</h4><p>{report.computedAt} · {report.version}</p>
    <p>{report.evaluation.notice}</p>
    {report.results.map(({ source, statistics, trend }) => <section key={source.recordId}>
      <strong>{source.recordName}</strong><p>{statistics.frames} 帧 · 平均值 {statistics.average.toFixed(2)} · 峰值 {statistics.maximum.toFixed(2)} · 有效点比例 {(statistics.activeRatio * 100).toFixed(1)}%</p>
      <p>帧 ID {source.firstFrameId}～{source.lastFrameId} · {source.matrix ? `${source.matrix.rows}×${source.matrix.cols}` : '历史矩阵未知'} · 数据阶段 {source.dataStage}</p>
      <Trend points={trend} />
    </section>)}
    {report.comparisons.length > 0 && <p>已完成 {report.comparisons.length} 组与首条记录的比较，具体差异见本轮回复。</p>}
    {report.warnings.map((warning) => <p key={warning} className="shroom-agent-hint">{warning}</p>)}
    <details><summary>查看数据来源、参数和完整计算报告</summary><pre>{JSON.stringify(report, null, 2)}</pre></details>
  </article>;
}
