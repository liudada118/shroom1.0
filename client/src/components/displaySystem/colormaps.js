/**
 * colormaps.js - re-export 壳
 *
 * 实现已搬到 `@shroom/frontend/core/colormaps.js`。
 *
 * 同目录的 `colormaps.test.js` **没跟着搬**：它 import 了 `util.js` 的
 * `jetRound`，而 `jetRound` 只有主应用在用，不属于包的公开面。留在这边它就从
 * 单元测试变成了边界测试 —— 经这个壳把 SDK 里的实现真跑一遍。
 */

export * from '@shroom/frontend/core/colormaps.js';
