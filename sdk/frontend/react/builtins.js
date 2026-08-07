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
 * ## 现在是两个：numMatrix + pointGrid
 *
 * 第一轮（2026-08-03）只搬了数字矩阵；第二轮（2026-08-05）把点阵热力也搬了进来，
 * 连同它依赖的 `SelectionHelper` 与 `threeUtil1` 里那 3 个函数（现在是
 * `./three/SelectionHelper.js` 与 `./three/pointPick.js`）。
 * `client/src/renderers/builtins.js` 随之退化成只转调本函数的壳。
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
import {
  LEGACY_PRESETS as POINT_GRID_PRESETS,
  normalizePointGridParams,
} from '../core/pointGrid/params.js';

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
      // 没有框选。ROTATE 是 2026-08-06 接 `canvas2d` 后端时加的 ——
      // `num3D` 那条通路有 `changePointRotation` / `changeGroupRotate` /
      // `reset` / `setFrontView` 四个视角命令。**它依赖 backend 参数**，
      // 走 `sprite3d` 时没有；见下面 `optionalMethods` 那段说明。
      // 滚轮缩放与拖拽平移不算 —— 那是相机操作，不在 capabilities 的语汇里。
      capabilities: [RENDERER_CAPABILITIES.SIT, RENDERER_CAPABILITIES.ROTATE],
      // 三个后端暴露面的**并集**：前四个人人都有，后十一个看 `backend` 参数。
      methods: [
        'sitData',
        'sitValue',
        'changeWsData',
        'changeWsDataRaw',
        'changeWsData147',
        'changeWsData147R',
        'changeWsData256',
        'changeWsDatafinger',
        'changeWsDatapalm',
        'drawContent',
        'changeType',
        'changePointRotation',
        'changeGroupRotate',
        'reset',
        'setFrontView',
      ],
      /**
       * 走 `sprite3d` 后端时缺席的那十一个。见
       * `RendererHost.jsx` 的 `auditRendererContract` 文档。
       *
       * **可选是按后端算的，不是按渲染器算的**：`canvas2d` 有其中 10 个、
       * `webgl` 有其中 4 个（`changeWsData147` / `changeWsData147R` /
       * `changeWsData256` / `drawContent`），`sprite3d` 一个都没有。契约审计
       * 只能表达「这个渲染器 id 可能缺哪些」，表达不了「哪个后端缺哪些」——
       * 这条限制记在 `sdk/frontend/README.md` 的积压里。
       *
       * 这份名单与两个后端的 `commandNames` 是同一组名字 ——
       * **没有从那里 import 过来是刻意的**：`builtins.js` 一旦静态 import 任何
       * 后端，`load: () => import(...)` 的懒加载 chunk 就会塌回主包（Rollup
       * 只发 warning 不报错）。宁可两处各写一遍，也不要静默塌包。
       */
      optionalMethods: [
        'changeWsData147',
        'changeWsData147R',
        'changeWsData256',
        'changeWsDatafinger',
        'changeWsDatapalm',
        'drawContent',
        'changeType',
        'changePointRotation',
        'changeGroupRotate',
        'reset',
        'setFrontView',
      ],
      normalizeParams: normalizeNumMatrixParams,
      // 三份 NumThreeColor 的常量原样搬过来。它们的布局公式代数等价
      // （逐点验算见 core/numMatrix/pipeline.test.js），所以不是三个渲染器，
      // 是同一个渲染器的三条预设；smallBed12B 是第四条，原来靠
      // `matrixName === 'smallBed12B'` 的字符串分支实现。
      // `num3dDefault` / `num3dCarCol` 是第五、六条，走 `canvas2d` 后端。
      presets: NUM_MATRIX_PRESETS,
    }),
    registerRenderer({
      id: 'pointGrid',
      label: '点阵热力（3D）',
      description: '压力点阵的三维高度图，支持框选与视角旋转',
      load: () => import('./pointGrid/PointGridRenderer.jsx'),
      capabilities: [
        RENDERER_CAPABILITIES.SIT,
        RENDERER_CAPABILITIES.BOX_SELECT,
        RENDERER_CAPABILITIES.ROTATE,
      ],
      methods: [
        'sitData',
        'sitValue',
        'sitRenew',
        'backData',
        'backValue',
        'changeDataFlag',
        'changeSelectFlag',
        'changeGroupRotate',
        'reset',
      ],
      normalizeParams: normalizePointGridParams,
      // matCol 与 carCol 两条。它们 953 行代码的净差异只有两个数字
      // （`sit.num1` 16 vs 9、`sit.order` 2 vs 4），所以不是两个渲染器，
      // 是同一个渲染器的两条预设 —— 逐帧一致性见 core/pointGrid/pipeline.test.js。
      presets: POINT_GRID_PRESETS,
    }),
  ];

  return results.filter(Boolean).length;
}

export default registerBuiltinRenderers;
