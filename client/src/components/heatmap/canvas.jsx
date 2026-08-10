/**
 * heatmap/canvas.jsx - 适配壳
 *
 * 实现搬进了 `@shroom/frontend/react/blobHeatmap/BlobHeatmapRenderer.jsx`
 * （第四轮，2026-08-10）。原来的 460 行里，帧运算、调色板与参数分别落在
 * `core/blobHeatmap/{pipeline,intensity,params}.js`。
 *
 * ## 为什么是**适配**壳而不是一行 `export *`
 *
 * 原路径还有一个引用方：`App.jsx:17` 那条 `lazy(() => import(...))`，它渲染的是
 * **`<Heatmap />`，一个 prop 都不传**（`/heatmap` 这条独立路由）。所以壳必须自己
 * 兜上预设和阈值 —— `export *` 会让那条路由拿到一个没有参数的渲染器。
 *
 * `page/home/Home.jsx` 那个渲染点已经直接换成 `RendererHost` 了，不走这里。
 *
 * ## 阈值为什么在这一层读
 *
 * 原件的 `options.max` 是 `createThresholdState({ valuej1: 600 }).valuej1` ——
 * 「localStorage 里有 `carValuej` 就用存的，没有才 600」。**读存储是主应用的行为，
 * 不是渲染器的**（`core/` 那一层的红线之一就是模块顶层不读 `localStorage`），所以
 * 这一步留在壳里，包里只认一个 `max` 数字。
 *
 * ⚠️ 与原件的一处差异：原件在模块顶层读一次存储，改完阈值要刷新页面才生效；这里
 * 每次挂载读一次。方向是变好，且首屏结果相同。
 */

import React from 'react';

import { LEGACY_PRESETS as BLOB_HEATMAP_PRESETS } from '@shroom/frontend/core/blobHeatmap';

import { createThresholdState } from '../../runtime/displayThresholds';
import RendererHost from '../../renderers/RendererHost.jsx';

/**
 * 按 `matrixName` 挑一条预设，并把 `carValuej` 的存储值盖上去。
 *
 * 原件那句 `if (props.matrixName == 'carCol')` 就是这里的两条分支 —— 区别是它改的
 * 是**模块级** `options` 对象，挂过一次 carCol 之后同一次会话里所有实例都跟着变成
 * max 300 / size 100，直到刷新页面。这里每次算一份新的，那个串味没了。
 *
 * @param {string} [matrixName] 矩阵类型。
 * @returns {object} 传给渲染器的 params。
 */
export function buildBlobHeatmapParams(matrixName) {
  const preset = matrixName === 'carCol'
    ? BLOB_HEATMAP_PRESETS.carCol
    : BLOB_HEATMAP_PRESETS.default;
  // 存储里没有 carValuej 时，createThresholdState 会把传进去的默认值回给我们，
  // 也就是各自预设自己的 max（600 / 300）。
  const { valuej1 } = createThresholdState({ valuej1: preset.max });
  return { ...preset, max: valuej1 };
}

/**
 * 斑点热力（Canvas 2D）。对外形状与原组件一致：`forwardRef` + `matrixName`。
 *
 * 暴露的方法由渲染器给：`bthClickHandle` / `sitValue`（原件那两个）外加一个
 * `sitData` 转调。⚠️ `sitValue` 六个键里只有 `valuej` 真的改画面 —— 另外四个在
 * 原件里就只喂给一段死运算，详见 `core/blobHeatmap/pipeline.js` 文件头。
 */
export const Heatmap = React.forwardRef(function Heatmap(props, refs) {
  return (
    <RendererHost
      rendererId="blobHeatmap"
      params={buildBlobHeatmapParams(props.matrixName)}
      label="斑点热力"
      rendererRef={refs}
      data={props.data}
      local={props.local}
    />
  );
});

export default Heatmap;
