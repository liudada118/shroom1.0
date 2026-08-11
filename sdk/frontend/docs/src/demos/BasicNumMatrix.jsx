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
 * @param {object} [props.params] 页面直接编辑后的完整参数。
 * @param {number[]} [props.values] 页面直接编辑的一帧数据。
 * @param {number|null} [props.floor] 下限过滤值；文档方向校验使用 0 保留数字 1。
 * @returns {JSX.Element} 数字矩阵预览。
 */
export default function BasicNumMatrix({
  presetId = 'fast1024',
  colormapId = 'classic',
  params: paramsOverride,
  values,
  floor = null,
}) {
  const params = React.useMemo(
    () => normalizeNumMatrixParams(paramsOverride || NUM_MATRIX_PRESETS[presetId]),
    [paramsOverride, presetId],
  );
  const grid = React.useMemo(() => numMatrix.deriveGrid(params), [params]);

  const syntheticFrame = useSyntheticFrames(grid.gridWidth, grid.gridHeight);
  const frame = Array.isArray(values) ? values : syntheticFrame;

  // 配色走 props 而不是 params：它是"用户随时可改的视图状态"，
  // 换配色不该触发场景重建。对象要 memo，否则每次渲染都是新引用。
  const colormap = React.useMemo(() => ({ id: colormapId }), [colormapId]);

  // RendererHost 的声明式 values 会覆盖常规数据流。文档方向校验还要把历史默认
  // 下限从 2 调到 0，否则第 1 个点会被过滤。ref 挂载发生在后端 effect 之前，
  // 因此延后一帧再设阈值并重推当前帧。
  const handleRenderer = React.useCallback((api) => {
    if (!api || floor === null) return;
    requestAnimationFrame(() => {
      api.sitValue?.({ valuef: floor });
      api.sitData?.({ wsPointData: frame });
    });
  }, [floor, frame]);

  return (
    <RendererHost
      rendererId="numMatrix"
      label="数字矩阵"
      params={params}
      values={frame}
      channel="sit"
      colormap={colormap}
      rendererRef={handleRenderer}
    />
  );
}
