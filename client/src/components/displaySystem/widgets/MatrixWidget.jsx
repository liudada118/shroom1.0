import React from 'react';
import { sampleColormap } from '../colormaps';
import ColormapLegend from './ColormapLegend.jsx';
import './widgets.css';

const EMPTY_OVERLAYS = new Set();

/**
 * 规则矩阵热力图。
 *
 * 配色由 colormap 决定（默认 classic，即引入配色能力之前的硬编码公式）；
 * overlays 只影响绘制层，不修改 values。
 *
 * @param {object} props widget 参数。
 * @param {number[]} props.values 已经过可视算法和矩阵变换的绘制数据。
 * @param {{rows?: number, cols?: number, width?: number, height?: number}} props.matrix 绘制矩阵。
 * @param {Set<string>} props.overlays 生效的叠加层 id 集合。
 */
export default function MatrixWidget({
  values,
  matrix,
  label,
  showValues = false,
  columnSpan,
  colormap,
  overlays = EMPTY_OVERLAYS,
}) {
  const cols = Number(matrix?.width || matrix?.cols || Math.sqrt(values.length) || 1);
  const rows = Math.max(1, Math.ceil(values.length / Math.max(1, cols)));
  const numeric = values.map((value) => Number(value) || 0);
  const max = Math.max(1, ...numeric.filter(Number.isFinite));
  const min = numeric.length ? Math.min(...numeric) : 0;
  const peakIndex = overlays.has('peakMarker') && numeric.length
    ? numeric.indexOf(Math.max(...numeric))
    : -1;
  const withValues = showValues || overlays.has('valueLabels');
  const showAxes = overlays.has('axes');
  const classNames = [
    'manifest-matrix',
    overlays.has('gridLines') ? 'has-grid-lines' : '',
  ].filter(Boolean).join(' ');

  return (
    <section className="manifest-widget manifest-matrix-widget" style={{ gridColumn: `span ${columnSpan || 8}` }}>
      <h3>{label}</h3>
      <div className={showAxes ? 'manifest-matrix-frame has-axes' : 'manifest-matrix-frame'}>
        {showAxes ? (
          <div className="manifest-axis manifest-axis-row" aria-hidden="true">
            {Array.from({ length: rows }, (_, row) => <span key={row}>{row}</span>)}
          </div>
        ) : null}
        <div
          className={classNames}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {values.map((value, index) => {
            const ratio = Math.max(0, Number(value) || 0) / max;
            return (
              <span
                key={index}
                className={index === peakIndex ? 'is-peak' : undefined}
                title={`${index}: ${value}`}
                style={{ backgroundColor: sampleColormap(colormap?.id, ratio, colormap) }}
              >
                {withValues ? (Number.isInteger(value) ? value : Number(value).toFixed(1)) : ''}
              </span>
            );
          })}
        </div>
        {showAxes ? (
          <div className="manifest-axis manifest-axis-col" aria-hidden="true">
            {Array.from({ length: cols }, (_, col) => <span key={col}>{col}</span>)}
          </div>
        ) : null}
      </div>
      {overlays.has('legend') ? <ColormapLegend colormap={colormap} min={min} max={max} /> : null}
    </section>
  );
}
