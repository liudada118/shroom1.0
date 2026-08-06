/**
 * CustomRenderer.jsx - 用第三方渲染器（四步里的第 4 步）
 *
 * 前三步在另外两个文件：
 *
 * ```
 * 0. 参数归一化（零依赖）                          → heatBarsParams.js
 * 1. forwardRef + useImperativeHandle 暴露方法   → HeatBarsRenderer.jsx
 * 2. registerRenderer({ id, load, … })           → registerHeatBars.js
 * 3. 自查注册结果                                 → registerHeatBars.js
 * 4. <RendererHost rendererId="heatBars" …/>     → 这里
 * ```
 *
 * **这一步和用内置渲染器完全一样** —— 除了 `rendererId` 换了个字符串，一行都不用改。
 * 那就是渲染器契约要证明的全部：宿主不需要认识渲染器叫什么方法、用什么画、
 * 是不是包里自带的。
 *
 * 注意这个文件**没有** import `HeatBarsRenderer.jsx`：宿主根本不需要认识渲染器
 * 组件本身，它只给一个 id。这既是契约的意义，也是懒加载能切开的前提 ——
 * 从这里静态 import 渲染器会把它的 chunk 拉进首屏，见 `heatBarsParams.js` 头部。
 */

import { RendererHost } from '@shroom/frontend/react';
import React from 'react';

import { HEAT_BARS_ID } from './registerHeatBars.js';
import { normalizeHeatBarsParams } from './heatBarsParams.js';
import { useSyntheticFrames } from '../lib/syntheticFrame.js';

/** 参数：16×24 的格子。归一化跟渲染器走，不由宿主决定。 */
const PARAMS = normalizeHeatBarsParams({ rows: 16, cols: 24, valueMax: 255, gap: 1 });

/**
 * @param {object} props 组件属性。
 * @param {string} [props.colormapId] 配色 id，见 `COLORMAPS`。
 * @returns {JSX.Element} 自定义渲染器预览。
 */
export default function CustomRenderer({ colormapId = 'viridis' }) {
  const frame = useSyntheticFrames(PARAMS.cols, PARAMS.rows);
  const colormap = React.useMemo(() => ({ id: colormapId }), [colormapId]);

  return (
    <RendererHost
      rendererId={HEAT_BARS_ID}
      label="热力格"
      params={PARAMS}
      values={frame}
      channel="sit"
      colormap={colormap}
    />
  );
}
