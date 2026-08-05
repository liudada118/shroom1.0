/**
 * RendererHost.jsx - 薄包装，不是普通的 re-export 壳
 *
 * 组件本体已搬到 `@shroom/frontend/react/RendererHost.jsx`。这里之所以不能只写
 * 一行 `export { default } from ...`，是因为原文件带着一个**模块加载副作用**：
 * 它在加载时就 `registerBuiltinRenderers()`，把内置渲染器注册进注册表。
 *
 * SDK 侧那份只注册它自己 ships 的 `numMatrix`。而主应用还有一个没搬的
 * `pointGrid`（第二轮再搬），且 `page/home/Home.jsx` 是**直接 import
 * `RendererHost` 与 `registry` 的，从不经 `renderers/index.js`** —— 所以如果这里
 * 只做透传，运行时注册表里就只有 numMatrix，`matCol` / `carCol` 会静默失效
 * （`resolveRendererFromDefinition` 解析不出来时返回 null，老通路接着跑，
 * 不报错、只是新通路白配了）。
 *
 * 因此这里补一句本地注册。注册是幂等的、按 id 覆盖，所以 numMatrix 被注册两次
 * 无害。
 */

import RendererHost from '@shroom/frontend/react/RendererHost.jsx';

import { registerBuiltinRenderers } from './builtins';

// 主应用侧的渲染器（pointGrid）。SDK 那份在它自己的模块加载时已注册 numMatrix。
registerBuiltinRenderers();

export {
  auditRendererContract,
  resetContractAudit,
} from '@shroom/frontend/react/RendererHost.jsx';

export default RendererHost;
