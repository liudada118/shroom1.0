/**
 * useSceneFrame.js - re-export 壳
 *
 * 实现已搬到 `@shroom/frontend/react/useSceneFrame.js`（react 层，需要 React）。
 *
 * 主应用目前 0 个引用方 —— 场景组件都还在自己订阅总线。壳仍然留着：它是
 * SDK 侧给二开者消费帧的正式入口，主应用早晚要收敛到它上面。
 */

export * from '@shroom/frontend/react/useSceneFrame.js';
export { default } from '@shroom/frontend/react/useSceneFrame.js';
