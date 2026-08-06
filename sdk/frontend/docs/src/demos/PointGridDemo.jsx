/**
 * PointGridDemo.jsx - 点阵热力（3D）：最短可跑路径
 *
 * 与 `BasicNumMatrix.jsx` 的形状几乎一样 —— 这正是渲染器契约要证明的事：
 * 换一个 `rendererId`，喂数据的方式一行都不用改。
 *
 * 三处**不一样**的地方，都是点阵自己的性质：
 *
 * 1. **喂的是原始矩阵，不是渲染网格。** `sit.num1 × sit.num2`（matCol 是
 *    16×10 = 160 个数），插值 / 补边 / 高斯模糊由渲染器内部跑
 *    （`core/pointGrid/pipeline.js`）。`deriveGridSize()` 算出来的
 *    36×24 = 864 是**顶点数**，不是要喂的数据长度 —— 按 864 喂就全错位了。
 * 2. **幅度给到 4000。** 点阵走的是 12 位量程的老阈值默认值
 *    （`DUAL_CHANNEL_DEFAULTS`），220 的峰值在这里压不出高度。
 * 3. **它是可交互的**：框选（拖拽）、视角旋转（`TrackballControls`）。这两样在
 *    缩放展示模式下是关掉的，理由见 `components/Live.jsx` 的文件头。
 */

import { POINT_GRID_PRESETS, normalizePointGridParams, pointGrid } from '@shroom/frontend/core';
import { RendererHost } from '@shroom/frontend/react';
import React from 'react';

import { useSyntheticFrames } from '../lib/syntheticFrame.js';

/**
 * @param {object} props 组件属性。
 * @param {'matCol'|'carCol'} [props.presetId] 预设 id，见 `POINT_GRID_PRESETS`。
 * @returns {JSX.Element} 点阵热力预览。
 */
export default function PointGridDemo({ presetId = 'matCol' }) {
  const params = React.useMemo(
    () => normalizePointGridParams(POINT_GRID_PRESETS[presetId]),
    [presetId],
  );

  // 注意取的是 num1 / num2 本身，不是 deriveGridSize 的结果 —— 见文件头第 1 条。
  const frame = useSyntheticFrames(params.sit.num2, params.sit.num1, { amplitude: 4000 });

  return (
    <RendererHost
      rendererId="pointGrid"
      label="点阵热力"
      params={params}
      values={frame}
      channel="sit"
    />
  );
}

/**
 * 这一页顺手把网格推导也算给读者看 —— 同一个函数，同一份参数。
 *
 * @param {'matCol'|'carCol'} presetId 预设 id。
 * @returns {{amountX: number, amountY: number, total: number}} 顶点网格尺寸。
 */
export function gridOf(presetId) {
  return pointGrid.deriveGridSize(normalizePointGridParams(POINT_GRID_PRESETS[presetId]).sit);
}
