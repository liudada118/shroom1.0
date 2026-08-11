/**
 * WebglHeatmapDemo.jsx - 斑点热力（WebGL）：最短可跑路径
 *
 * 同样的三句：`rendererId` + `params` + `values`。这一条通路的特别之处只有两点：
 *
 * 1. **帧长门槛。** `bed4096` 预设的 `minFrameLength` 是 **4096**，短于它的帧
 *    **整帧丢弃、静默无画面**。这是原实现（`Canvas4096WebGL`）的行为，那块床垫
 *    正好是 64×64 = 4096。喂 32×32 想看画面，得挑 `plain` 预设（门槛 1）或者
 *    自己把 `minFrameLength` 调下来 —— 这是本渲染器最容易踩的一脚。
 * 2. **`dataWidth × dataHeight` 必须与喂的帧对得上。** 铺点时按
 *    `dataWidth` 折行（`core/webglHeatmap/pipeline.js` 的 `buildHeatPoints`），
 *    对不上不报错，只是画歪。
 *
 * 不改 `displaySize`（默认 `80vh`）：文档站的舞台给的是一个视口大小的容器再整块
 * 缩放，所以这里看到的比例**就是**消费者全屏装出来的那一张。
 */

import { WEBGL_HEATMAP_PRESETS, normalizeWebglHeatmapParams } from '@shroom/frontend/core';
import { RendererHost } from '@shroom/frontend/react';
import React from 'react';

import { useSyntheticFrames } from '../lib/syntheticFrame.js';

/**
 * @param {object} props 组件属性。
 * @param {'bed4096'|'plain'} [props.presetId] 预设 id。
 * @param {object} [props.params] 直接传入的矩阵渲染参数。
 * @param {number[]} [props.values] 直接传入的一帧数据。
 * @returns {JSX.Element} WebGL 斑点热力预览。
 */
export default function WebglHeatmapDemo({ presetId = 'bed4096', params: paramsOverride, values }) {
  const params = React.useMemo(
    () => normalizeWebglHeatmapParams(paramsOverride || WEBGL_HEATMAP_PRESETS[presetId]),
    [paramsOverride, presetId],
  );

  // 帧尺寸跟着参数走 —— 写死 64×64 的话切到 plain 预设就画歪了（见文件头第 2 条）。
  const syntheticFrame = useSyntheticFrames(params.dataWidth, params.dataHeight);
  const frame = Array.isArray(values) ? values : syntheticFrame;

  return (
    <RendererHost
      rendererId="webglHeatmap"
      label="斑点热力（WebGL）"
      params={params}
      values={frame}
      channel="sit"
    />
  );
}
