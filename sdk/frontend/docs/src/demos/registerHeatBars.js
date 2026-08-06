/**
 * registerHeatBars.js - 把第三方渲染器登记进平台（四步里的第 2、3 步）
 *
 * 单独成文件有两个理由：
 *
 * 1. **`load` 里那句动态 import 是切 chunk 的依据。** 注册这一层永远在首屏，
 *    渲染器本体（`HeatBarsRenderer.jsx`，会拉进 canvas 绘制代码）只在真要画时
 *    才下载。写在同一个文件里就切不开。
 * 2. **有两个页面要用它**（「写自己的渲染器」和「帧总线」）。注册是模块级副作用，
 *    放在某个 demo 组件文件里，另一个页面就得 `import './那个 demo'` 只为触发
 *    副作用 —— 那种写法早晚被人当成无用 import 删掉。
 *
 * 注册**幂等**（注册表按 id 覆盖），所以这个模块被 import 多少次都无所谓。
 *
 * ⚠️ `normalizeHeatBarsParams` 从 `heatBarsParams.js` 引，**不能**从
 * `HeatBarsRenderer.jsx` 引 —— 那会在这里和渲染器本体之间连出一条静态边，
 * 下面那句动态 import 随即失效，懒加载 chunk 塌回主包。这不是假想：本站第一版
 * 就是那么写的，被 Rollup 的构建告警抓了出来。
 */

import {
  RENDERER_CAPABILITIES,
  listRegistrationFailures,
  registerRenderer,
} from '@shroom/frontend/core';

import { normalizeHeatBarsParams } from './heatBarsParams.js';

/** 渲染器 id。两个页面都从这里引，不各自写字符串字面量。 */
export const HEAT_BARS_ID = 'heatBars';

const registered = registerRenderer({
  id: HEAT_BARS_ID,
  label: '热力格（Canvas 2D 示例）',
  description: '文档站的第三方渲染器示例，不属于 @shroom/frontend',
  // 动态 import —— 本体单独成 chunk，不进首屏。
  load: () => import('./HeatBarsRenderer.jsx'),
  capabilities: [RENDERER_CAPABILITIES.SIT],
  // 两条约束：
  // 1. 名字必须是 core/contract.js 的 RENDERER_METHODS 的键 —— 写个不存在的，
  //    registerRenderer 直接拒绝注册（返回 false 并打错误），不会等到渲染才崩。
  // 2. 必须与 HeatBarsRenderer 实际暴露的方法**逐字一致** —— 少了会 console.error，
  //    多了会 console.warn（`auditRendererContract`）。
  methods: ['sitData', 'sitValue', 'reset'],
  normalizeParams: normalizeHeatBarsParams,
});

// 第 3 步：自查。`registerRenderer` 内部已经跑过 `validateRendererDescriptor`，
// 校验失败只打日志、返回 false，**不抛错** —— 一个坏插件不该让整个应用起不来。
// 代价是不看返回值的话失败是静默的，现象只是「这个渲染器怎么不在列表里」。
if (!registered) {
  console.error(`[docs] ${HEAT_BARS_ID} 注册失败：`, listRegistrationFailures());
}

export default registered;
