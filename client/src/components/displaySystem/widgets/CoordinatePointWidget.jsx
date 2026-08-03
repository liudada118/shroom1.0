import React from 'react';
import { sampleColormap } from '../colormaps';
import ColormapLegend from './ColormapLegend.jsx';
import './widgets.css';

const EMPTY_OVERLAYS = new Set();

/**
 * 使用传感器的真实物理坐标绘制点图，避免把长条形或异形传感器拉伸成方形。
 *
 * @param {object} props widget 参数。
 * @param {{points: object[], viewBox: string, radius: number, aspectRatio: number}} props.layout
 *        由 buildCoordinatePointLayout 生成的点布局。
 * @param {Set<string>} props.overlays 生效的叠加层 id 集合。
 */
export default function CoordinatePointWidget({
  values,
  layout,
  label,
  showValues = false,
  columnSpan,
  colormap,
  overlays = EMPTY_OVERLAYS,
}) {
  const numericValues = layout.points.map((point) => Number(values[point.index]) || 0);
  const max = Math.max(1, ...numericValues.filter(Number.isFinite));
  const min = numericValues.length ? Math.min(...numericValues) : 0;
  const showPointValues = (showValues || overlays.has('valueLabels')) && layout.pointCount <= 1024;
  const peakValue = numericValues.length ? Math.max(...numericValues) : null;
  const peakIndex = overlays.has('peakMarker') && peakValue != null
    ? layout.points[numericValues.indexOf(peakValue)]?.index
    : -1;
  const showAxes = overlays.has('axes');

  return (
    <section className="manifest-widget manifest-matrix-widget" style={{ gridColumn: `span ${columnSpan || 8}` }}>
      <h3>{label}</h3>
      <div
        className={overlays.has('gridLines') ? 'manifest-coordinate-plot has-grid-lines' : 'manifest-coordinate-plot'}
        style={{
          aspectRatio: String(layout.aspectRatio),
          width: `min(100%, ${layout.aspectRatio * 66}vh)`,
        }}
      >
        <svg viewBox={layout.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
          {layout.points.map((point) => {
            const value = Number(values[point.index]) || 0;
            const ratio = Math.max(0, value) / max;
            return (
              <g key={point.index}>
                <circle
                  className={point.index === peakIndex ? 'is-peak' : undefined}
                  cx={point.displayX}
                  cy={point.displayY}
                  r={layout.radius}
                  fill={sampleColormap(colormap?.id, ratio, colormap)}
                >
                  <title>{`[${point.row}, ${point.col}] (${point.x}, ${point.y}): ${value}`}</title>
                </circle>
                {showPointValues ? (
                  <text
                    x={point.displayX}
                    y={point.displayY}
                    fontSize={layout.radius * 0.72}
                  >
                    {Number.isInteger(value) ? value : value.toFixed(1)}
                  </text>
                ) : null}
                {/* 坐标轴叠加层只在首行首列各标一次，点数多时不会糊成一片。 */}
                {showAxes && point.col === 0 ? (
                  <text
                    className="manifest-axis-label"
                    x={point.displayX - layout.radius * 2}
                    y={point.displayY}
                    fontSize={layout.radius * 0.8}
                  >
                    {point.row}
                  </text>
                ) : null}
                {showAxes && point.row === 0 ? (
                  <text
                    className="manifest-axis-label"
                    x={point.displayX}
                    y={point.displayY - layout.radius * 2}
                    fontSize={layout.radius * 0.8}
                  >
                    {point.col}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      {overlays.has('legend') ? <ColormapLegend colormap={colormap} min={min} max={max} /> : null}
    </section>
  );
}
