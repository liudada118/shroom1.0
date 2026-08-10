/**
 * BlobHeatmapDemo.jsx - 斑点热力（Canvas 2D）：最短可跑路径
 *
 * 全包里**唯一不碰 three、也不碰 WebGL** 的渲染器 —— 每个数据点画一个带阴影的圆，
 * 按 alpha 分桶叠加，再查一条 6 段渐变上色。所以它不占 WebGL 上下文额度，
 * 同页想挂多少块都行（本站的舞台限流对它是多余的）。
 *
 * ⚠️ 两个坑，都是从原实现继承下来的，参数化了但**默认值一个没动**：
 *
 * 1. **`max` 默认 600，全仓唯一。** 别处同名的满值阈值都是 200。合成帧峰值只有
 *    220，用 `default` 预设就是一片偏冷的图 —— 那**就是**主应用现在的样子。
 * 2. **`alphaFloor` 默认 0.7。** 所有落进色带的像素 alpha 都被抬到 0.7 以上，
 *    于是整张图没有真正的淡色区。这是「这张热力图看着发糊」的来源。
 *
 * 铺点坐标那条公式也照抄了原件的错位（行下标配画布宽、列下标配画布高），
 * 见 `core/blobHeatmap/pipeline.js` 的 `buildBlobPoints`。
 */

import { BLOB_HEATMAP_PRESETS, normalizeBlobHeatmapParams } from '@shroom/frontend/core';
import { RendererHost } from '@shroom/frontend/react';
import React from 'react';

import { useSyntheticFrames } from '../lib/syntheticFrame.js';

/**
 * @param {object} props 组件属性。
 * @param {'default'|'carCol'} [props.presetId] 预设 id。
 * @returns {JSX.Element} Canvas 2D 斑点热力预览。
 */
export default function BlobHeatmapDemo({ presetId = 'default' }) {
  const params = React.useMemo(
    () => normalizeBlobHeatmapParams(BLOB_HEATMAP_PRESETS[presetId]),
    [presetId],
  );

  const frame = useSyntheticFrames(params.dataWidth, params.dataHeight);

  return (
    <RendererHost
      rendererId="blobHeatmap"
      label="斑点热力（Canvas 2D）"
      params={params}
      values={frame}
      channel="sit"
    />
  );
}
