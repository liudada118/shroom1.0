/**
 * HandPointsDemo.jsx - 手部点云：最短可跑路径
 *
 * 与 `PointGridDemo.jsx` 一比就能看出契约的价值：换一个 `rendererId`、换一份
 * `params`，喂数据的代码一行都不动。
 *
 * 三处**手部点云独有**的地方：
 *
 * 1. **喂的是 32×32 的原始矩阵**（`sit.num1 × sit.num2` = 1024 个数），插值 /
 *    补边 / 高斯由渲染器内部跑。`deriveGridSize()` 算出来的 72×72 = 5184
 *    （147 预设是 140×140 = 19600）是**顶点数**，不是要喂的长度。
 * 2. **`modelUrl` 传空串。** 默认值 `'./model/hand1.glb'` 是**运行期相对 URL**，
 *    指的是主应用 `client/public/model/` 下那个手模；文档站没有那个文件，
 *    不关掉就是一条 404。传空串则完全不加载模型，只剩点云 —— 关节命令
 *    （`changeHandAngle` / `calibration` / `handZero`）随之变成空操作。
 *    **这正是二开者要知道的第一件事**：手模得自己 serve。
 * 3. **不传 `pointSprite`。** 走包内自带的 `react/three/circle.png`（打包资源），
 *    与 `pointGrid` 共用同一张图。传字符串才是换图。
 */

import { HAND_POINTS_PRESETS, normalizeHandPointsParams } from '@shroom/frontend/core';
import { RendererHost } from '@shroom/frontend/react';
import React from 'react';

import { useSyntheticFrames } from '../lib/syntheticFrame.js';

/**
 * @param {object} props 组件属性。
 * @param {'hand0205'|'hand0205Alt'|'hand0205_147'} [props.presetId] 预设 id。
 * @returns {JSX.Element} 手部点云预览。
 */
export default function HandPointsDemo({ presetId = 'hand0205' }) {
  const params = React.useMemo(
    // 手模是运行期相对 URL，文档站没有 —— 见文件头第 2 条。
    () => normalizeHandPointsParams({ ...HAND_POINTS_PRESETS[presetId], modelUrl: '' }),
    [presetId],
  );

  // 取的是 num1 / num2 本身，不是 deriveGridSize 的结果 —— 见文件头第 1 条。
  const frame = useSyntheticFrames(params.sit.num2, params.sit.num1);

  return (
    <RendererHost
      rendererId="handPoints"
      label="手部点云"
      params={params}
      values={frame}
      channel="sit"
    />
  );
}
