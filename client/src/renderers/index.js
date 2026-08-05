/**
 * index.js - 渲染器插件系统聚合入口
 *
 * 使用方只需从这里导入：注册表 API、契约常量、内置渲染器注册函数，
 * 以及挂载组件 RendererHost。
 *
 * 下面每一条的实现都已经在 `@shroom/frontend` 里（`sdk/frontend/`），这里经的是
 * 同目录的 re-export 壳 —— 主应用的 import 路径一行没改。新写的代码可以直接
 * `from '@shroom/frontend/core'` / `'@shroom/frontend/react'`，两条路等价。
 *
 * 只有 `pointGrid` 还没进包（第二轮），所以 `registerBuiltinRenderers` 仍在
 * `./builtins`：它注册主应用自带的那份，再转调包里的注册函数。
 */

export { RENDERER_CAPABILITIES, RENDERER_METHODS, RENDERER_PROPS } from './contract';
export { registerBuiltinRenderers } from './builtins';
export { default as RendererHost } from './RendererHost.jsx';
export {
  getRendererDescriptor,
  listRegistrationFailures,
  listRenderers,
  loadRenderer,
  normalizeRendererParams,
  registerRenderer,
  resetRendererRegistry,
  resolveRendererFromDefinition,
} from './registry';
