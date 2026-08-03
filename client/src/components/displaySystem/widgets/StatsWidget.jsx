import React from 'react';
import './widgets.css';

/**
 * 压力统计卡片。数据来自 calculatePressureMetrics，始终基于映射后的原始矩阵，
 * 不受配色和叠加层影响。
 *
 * @param {{metrics: object, label: string, columnSpan?: number}} props 卡片参数。
 */
export default function StatsWidget({ metrics, label, columnSpan }) {
  const items = [
    ['Total', metrics.totalPressure.toFixed(2)],
    ['Maximum', metrics.maxPressure.toFixed(2)],
    ['Average', metrics.averagePressure.toFixed(2)],
    ['Active Points', metrics.activePoints],
  ];
  return (
    <section className="manifest-widget manifest-stats-widget" style={{ gridColumn: `span ${columnSpan || 4}` }}>
      <h3>{label}</h3>
      <div className="manifest-stats-grid">
        {items.map(([name, value]) => (
          <div key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
