/**
 * index.js - 渲染器插件系统聚合入口
 *
 * 使用方只需从这里导入：注册表 API、契约常量、内置渲染器注册函数，
 * 以及挂载组件 RendererHost。
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
