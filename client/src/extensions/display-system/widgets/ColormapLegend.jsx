import React from 'react';
import { colormapPreviewCss } from '../colormaps';

/**
 * 配色图例。overlays 里带 legend 时显示在 widget 底部，
 * 色带直接用 colormaps 预生成的渐变，不再逐点采样。
 *
 * @param {{colormap: {id: string, reverse?: boolean}, min: number, max: number}} props 图例参数。
 */
export default function ColormapLegend({ colormap, min = 0, max = 0 }) {
  return (
    <div className="manifest-widget-legend">
      <span>{Number(min).toFixed(1)}</span>
      <i style={{ background: colormapPreviewCss(colormap?.id, colormap) }} />
      <span>{Number(max).toFixed(1)}</span>
    </div>
  );
}
