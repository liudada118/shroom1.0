/**
 * react/index.js - React + three 那一层的出口
 *
 * peer 依赖：`react >=18`、`three >=0.127`。写成 peer 而不是 dependencies 是**必须**的
 * —— 装成自己的依赖会出现第二份 React（hooks 直接崩）与第二份 three
 * （`instanceof` 全部失效）。消费者侧还要配 `resolve.dedupe`，见 README。
 *
 * ## 这里刻意**没有**导出 `NumMatrixRenderer`
 *
 * 它只能经 `builtins.js` 的 `load: () => import(...)` 到达。一旦在这里加一句
 * `export { default as NumMatrixRenderer } from './numMatrix/NumMatrixRenderer.jsx'`，
 * 它就变成静态依赖，动态 chunk 塌回主包，懒加载白做。要直接拿到组件请用
 * `loadRenderer('numMatrix')`（返回 Promise），那是注册表给的正式通路。
 *
 * @see ../core/index.js 零依赖层（契约、注册表、帧管线、配色都在那边）
 */

export {
  default as RendererHost,
  auditRendererContract,
  resetContractAudit,
} from './RendererHost.jsx';

export { useSceneFrame } from './useSceneFrame.js';

export { registerBuiltinRenderers } from './builtins.js';
