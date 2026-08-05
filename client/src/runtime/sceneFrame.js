/**
 * sceneFrame.js - re-export 壳
 *
 * 实现已搬到 `@shroom/frontend/core/sceneFrame.js`。
 *
 * `export *` 不带 default，所以 default 要单独写一行 —— 原模块把
 * `buildSceneFrame` 同时作为 default 导出，漏这一行的话
 * `import buildSceneFrame from '...'` 会拿到 undefined 而不报错。
 */

export * from '@shroom/frontend/core/sceneFrame.js';
export { default } from '@shroom/frontend/core/sceneFrame.js';
