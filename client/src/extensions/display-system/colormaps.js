/**
 * colormaps.js - re-export 壳
 *
 * 实现已搬到 `@shroom/frontend/core/colormaps.js`。
 *
 * 同目录的 `colormaps.test.js` **没跟着搬**：它 import 的是 `util.js` 那份
 * `jetRound`（主应用侧的原实现），留在这边它就从单元测试变成了边界测试 ——
 * 经这个壳把 SDK 里的实现真跑一遍，两边不一致立刻红。
 *
 * ⚠️ 2026-08-06 起 `jetRound` 在包里也有了一份（`core/frameMath.js`，canvas2d
 * 后端每个数字都走它），所以这条测试现在同时是两份实现的对账。`util.js` 那份
 * 已经没有生产调用点了 —— 删它是另一件事（要连着 `util.jet.test.js` 一起动）。
 */

export * from '@shroom/frontend/core/colormaps.js';
