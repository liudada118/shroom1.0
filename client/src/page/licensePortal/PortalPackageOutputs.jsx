import React, { useState } from 'react';
import { packageMetricValue } from './portalPackageRuntime';

/** 真实算法标量队列；当前包任意已声明指标可选择，异常时留空而不是回退压力。 */
export default function PortalPackageOutputs({ item, instance, channelLabel, onDisable, busy, offline, chart, onRemove }) {
  const [metricId, setMetricId] = useState(item.metricDefinitions[0]?.id || '');
  const metric = item.metricDefinitions.find((entry) => entry.id === (chart?.metricId || metricId)) || (!chart && item.metricDefinitions[0]);
  if (!metric) return null;
  const points = instance.history.map((point) => ({ timestamp: point.timestamp, ...packageMetricValue(item.id, metric.id, point.metrics) }));
  const current = points.at(-1);
  const category = metric.values && current?.value != null ? metric.values[String(current.value)] : null;
  const values = points.map((point) => point.value).filter(Number.isFinite);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || Math.max(Math.abs(max) * .1, 1);
  const span = (points.at(-1)?.timestamp - points[0]?.timestamp) || 1;
  let pen = false;
  const path = points.map((point) => {
    if (point.value === null) { pen = false; return ''; }
    const x = 12 + (point.timestamp - points[0].timestamp) / span * 256;
    const y = 100 - (point.value - min) / range * 76;
    const segment = pen && metric.values ? `H${x}V${y}` : `${pen ? 'L' : 'M'}${x},${y}`;
    pen = true; return segment;
  }).join(' ');
  const waiting = offline || instance.status !== 'running';
  const status = offline ? '算法服务未连接' : instance.error || (instance.status === 'waiting' ? '等待实时数据' : instance.status === 'error' ? '算法异常' : current?.label);
  const statusClass = offline || instance.status === 'error' ? 'is-error' : instance.error?.includes('已暂停识别') ? 'is-paused' : '';
  return <section className="portal-package-output" aria-label={`${chart?.name || item.name}输出`}>
    <header><div><small>{channelLabel}</small><strong>{chart?.name || item.name}</strong></div><button type="button" disabled={busy} onClick={chart ? onRemove : onDisable} aria-label={chart ? `删除${chart.name}` : `停用${item.name}`}>{chart ? '删除图表' : '停用'}</button></header>
    {chart ? <p>{item.name} · {metric.label}</p> : <label>显示指标<select aria-label={`${item.name}显示指标`} value={metric.id} onChange={(event) => setMetricId(event.target.value)}>{item.metricDefinitions.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>}
    <div className="portal-package-value">{!waiting && current?.value != null ? category ?? current.value.toFixed(Math.min(6, Math.max(0, chart?.decimals ?? metric.decimals ?? 0))) : '—'} <small>{metric.unit}</small></div>
    <svg viewBox="0 0 280 125" role="img" aria-label={`${metric.label}真实算法输出趋势，最近 ${Math.round(span / 1000)} 秒`}>
      <path d="M12 24H268 M12 62H268 M12 100H268" className="portal-package-grid" />
      <path d={path} className="portal-package-line" style={chart?.color ? { stroke: chart.color } : undefined} />
      <text x="12" y="119">{points.length ? new Date(points[0].timestamp).toLocaleTimeString() : '等待数据'}</text><text x="268" y="119" textAnchor="end">{points.length ? new Date(points.at(-1).timestamp).toLocaleTimeString() : ''}</text>
    </svg>
    <p className={statusClass}>{status || `${metric.label} · 算法标量趋势`}</p>
    <small>{metric.values ? Object.entries(metric.values).map(([code, label]) => `${code}：${label}`).join(' · ') : values.length ? `范围 ${min.toFixed(1)} – ${max.toFixed(1)} ${metric.unit || ''}` : '尚无有效算法数值'}{instance.dropped > 0 ? ` · 已合并 ${instance.dropped} 帧` : ''}</small>
  </section>;
}
