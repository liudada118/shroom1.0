/**
 * builtins.js - 内置渲染器注册
 *
 * 单独成文件而不是放在 index.js，是为了让 RendererHost 能直接依赖它
 * 而不必反向引用聚合入口。
 *
 * 注册只写描述符，不 import 渲染器本体——load 在真正需要时才执行。
 * 这是把 Home.jsx 那 959KB chunk 拆开的关键：目前 55 个场景组件全部
 * 静态导入，运行时却只会用到其中一个。
 */

import { RENDERER_CAPABILITIES } from './contract';
import { registerRenderer } from './registry';
import { LEGACY_PRESETS, normalizePointGridParams } from './pointGrid/params';

/**
 * 注册全部内置渲染器。
 *
 * 幂等：重复调用不会产生副作用，注册表按 id 覆盖。
 *
 * @returns {number} 成功注册的渲染器数量。
 */
export function registerBuiltinRenderers() {
  const results = [
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
      // 旧场景组件 matCol.jsx / carCol.jsx 的参数原样搬过来。这两个文件
      // 逐行 diff 只差 sit.num1（16 / 9）与 sit.order（2 / 4）两个数字，
      // 所以它们不是两个渲染器，是同一个渲染器的两条预设。
      presets: LEGACY_PRESETS,
    }),
  ];

  return results.filter(Boolean).length;
}
