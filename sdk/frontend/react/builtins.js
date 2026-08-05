/**
 * react/builtins.js - 本包 ships 的渲染器注册
 *
 * ## 为什么在 react/ 而不在 core/
 *
 * 下面那句 `load: () => import('./numMatrix/NumMatrixRenderer.jsx')` 会把 JSX
 * 与 three 拉进依赖图。放进 `core/` 就毁掉那一层「零依赖 + 裸 Node 可加载」的
 * 性质（`scripts/smoke-core.mjs` 会立刻红）。注册表本体（`registerRenderer`）
 * 是纯的，所以它在 core；**注册哪些实现**这件事带实现，所以在 react。
 *
 * ## 为什么只有 numMatrix
 *
 * 本轮拆包只搬了数字矩阵。`pointGrid` 仍留在主应用
 * （`client/src/renderers/builtins.js`），它额外拖进 `SelectionHelper` 与
 * `threeUtil1`，留到第二轮。注册表按 id 覆盖且幂等，所以两侧各注册自己的那份
 * 不会互相踩 —— 主应用同时调两边是合法的，也正是它现在的做法。
 *
 * ## 注册只写描述符，不 import 本体
 *
 * `load` 到真正要画的时候才执行。这是把 `Home.jsx` 那 959KB chunk 拆开的关键：
 * 55 个场景组件全部静态导入，运行时却只用到其中一个。
 *
 * ⚠️ 这条性质很容易被构建配置悄悄毁掉：混淆器的 `stringArray` / `splitStrings`
 * 会重写 `import()` 里的字符串字面量，动态 chunk 就塌回主包。主应用的
 * `client/vite.config.js` 因此把 sdk/frontend 整个目录列进了混淆器 `exclude`
 * —— 那条 glob 匹配的是 symlink 解析后的真实路径，不是 `node_modules/`。
 */

import { RENDERER_CAPABILITIES } from '../core/contract.js';
import { registerRenderer } from '../core/registry.js';
import {
  LEGACY_PRESETS as NUM_MATRIX_PRESETS,
  normalizeNumMatrixParams,
} from '../core/numMatrix/params.js';

/**
 * 注册本包内置的渲染器。
 *
 * 幂等：重复调用不产生副作用，注册表按 id 覆盖。`RendererHost.jsx` 在模块加载
 * 时已经调过一次，所以消费者通常不用自己调 —— 显式暴露出来是给「只用注册表、
 * 不用 RendererHost」的场景（比如先 `listRenderers()` 出一个下拉框）。
 *
 * @returns {number} 成功注册的渲染器数量。
 */
export function registerBuiltinRenderers() {
  const results = [
    registerRenderer({
      id: 'numMatrix',
      label: '数字矩阵',
      description: '每格显示压力数值，背景按配色着色；一次 draw call 画完整片矩阵',
      load: () => import('./numMatrix/NumMatrixRenderer.jsx'),
      // 只有 SIT：它没有框选，也没有 group 旋转。滚轮缩放与拖拽平移是
      // 相机操作，不在 capabilities 的语汇里（那几项描述的是数据通道与选取能力）。
      capabilities: [RENDERER_CAPABILITIES.SIT],
      methods: ['sitData', 'sitValue', 'changeWsData', 'changeWsDataRaw'],
      normalizeParams: normalizeNumMatrixParams,
      // 三份 NumThreeColor 的常量原样搬过来。它们的布局公式代数等价
      // （逐点验算见 core/numMatrix/pipeline.test.js），所以不是三个渲染器，
      // 是同一个渲染器的三条预设；smallBed12B 是第四条，原来靠
      // `matrixName === 'smallBed12B'` 的字符串分支实现。
      presets: NUM_MATRIX_PRESETS,
    }),
  ];

  return results.filter(Boolean).length;
}

export default registerBuiltinRenderers;
