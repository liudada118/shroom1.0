/**
 * NumWs.jsx - 壳文件：`Num3D` 的实现已搬进 `@shroom/frontend`
 *
 * 原来这里是 517 行的 Canvas 2D 渲染实现（导出名叫 `Num3D`，但它**不是 WebGL
 * 也不是 three** —— 是 2D canvas 逐格 `fillText` + 一层 CSS `perspective` 造出来
 * 的伪三维）。现在它是 `numMatrix` 渲染器的第二个后端：
 *
 * | 原位置 | 新位置 |
 * | :--- | :--- |
 * | `render3DCanvas` + RAF 调度 + 10 个命令式方法 | `@shroom/frontend/react/numMatrix/backends/canvas2d.js` |
 * | 写死的 32×32 / carCol 10×9、格尺寸、字号、色标上限 | `core/numMatrix/params.js` 的 `num3dDefault` / `num3dCarCol` 两条预设 |
 * | `rotate90CW` / `gaussBlur_2` / `jetRound` | `@shroom/frontend/core/frameMath.js`（各自的第 N 份合并掉了） |
 *
 * ## 为什么是适配器而不是一行 re-export
 *
 * 这个壳有两件事必须自己做，`export { default } from ...` 都做不到：
 *
 * 1. **`matrixName` → 预设的映射。** 原实现用 `props.matrixName == 'carCol'` 在
 *    组件内部改网格；搬进包之后网格是参数，映射得有人做。
 * 2. **默认参数。** `App.jsx` 的 `/3Dnum` 路由是 `<Num3D />`，一个 prop 都不传。
 *    直接透传给 `RendererHost` 会拿到 `normalizeNumMatrixParams()` 的空缺省
 *    （sprite3d 后端），画出来是另一个东西。
 *
 * 唯一的引用方就是那条路由（`Home.jsx` 的两个渲染点已经直接换成
 * `RendererHost`）。等那条路由也改掉，这个文件可以整个删掉。
 *
 * 三处死代码随搬家一并删除，**都与画面无关**：
 * - `insertInterpFlat`（37 行纯函数）全仓零调用点；
 * - `import hand from 'hand(1).png'`（314 KB）全文再无引用；
 * - `pressData` / `interp` / `rotate90` 三个 import 同样零引用。
 */

import React from 'react';

import { LEGACY_PRESETS as NUM_MATRIX_PRESETS } from '../../renderers/numMatrix/params';
import RendererHost from '../../renderers/RendererHost.jsx';

/**
 * 3D 数字（Canvas 2D + CSS 透视）。
 *
 * @param {object} props 组件属性，除 `matrixName` 外原样透传给 `RendererHost`。
 * @param {string} [props.matrixName] 只用来选预设：`carCol` 走 10×9，其余 32×32。
 * @param {React.Ref} refs 命令式句柄，转成 `rendererRef`。
 * @returns {JSX.Element} 渲染结果。
 */
const Num3D = React.forwardRef(({ matrixName, ...rest }, refs) => (
  <RendererHost
    rendererId="numMatrix"
    params={matrixName === 'carCol'
      ? NUM_MATRIX_PRESETS.num3dCarCol
      : NUM_MATRIX_PRESETS.num3dDefault}
    label="3D 数字"
    rendererRef={refs}
    {...rest}
  />
));

Num3D.displayName = 'Num3D';

export default Num3D;
