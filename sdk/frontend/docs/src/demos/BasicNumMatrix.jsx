/**
 * BasicNumMatrix.jsx - 数字矩阵：最短可跑路径
 *
 * 这份文件被显示在「数字矩阵」页上，所以它是**给人抄的**。除了合成帧那个
 * import（文档站没有硬件），其余每一句都是消费者项目里真要写的。
 *
 * 三个要点：
 *
 * 1. **`params` 必须先过 `normalizeNumMatrixParams`。** 不是为了防御性编程 ——
 *    渲染器读的是归一化后的完整字段（`canvasHeightRatio`、`textureValueMax` …），
 *    直接把预设字面量丢进去会缺字段。归一化同时把越界值夹回范围，乱填不会崩。
 * 2. **网格尺寸从 `deriveGrid(params)` 反推，不要另写一份。** 合成帧的行列数和
 *    渲染器认的必须是同一个数，两处各写死就会出现「画面只有左上角有数据」。
 * 3. **`values` 每帧换新数组。** `RendererHost` 的推送 effect 依赖数组身份。
 */

import { NUM_MATRIX_PRESETS, normalizeNumMatrixParams, numMatrix } from '@shroom/frontend/core';
import { RendererHost } from '@shroom/frontend/react';
import React from 'react';

import { useSyntheticFrames } from '../lib/syntheticFrame.js';

/**
 * @param {object} props 组件属性。
 * @param {string} [props.presetId] 预设 id，见 `NUM_MATRIX_PRESETS`。
 * @param {string} [props.colormapId] 配色 id，见 `COLORMAPS`。
 * @returns {JSX.Element} 数字矩阵预览。
 */
export default function BasicNumMatrix({ presetId = 'fast1024', colormapId = 'classic' }) {
  const params = React.useMemo(
    () => normalizeNumMatrixParams(NUM_MATRIX_PRESETS[presetId]),
    [presetId],
  );
  const grid = React.useMemo(() => numMatrix.deriveGrid(params), [params]);

  const frame = useSyntheticFrames(grid.gridWidth, grid.gridHeight);

  // 配色走 props 而不是 params：它是"用户随时可改的视图状态"，
  // 换配色不该触发场景重建。对象要 memo，否则每次渲染都是新引用。
  const colormap = React.useMemo(() => ({ id: colormapId }), [colormapId]);

  return (
    <RendererHost
      rendererId="numMatrix"
      label="数字矩阵"
      params={params}
      values={frame}
      channel="sit"
      colormap={colormap}
    />
  );
}
