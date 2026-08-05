/**
 * displayThresholds.js - re-export 壳
 *
 * 实现已搬到 `@shroom/frontend/core/displayThresholds.js`（`sdk/frontend/core/`）。
 *
 * 这里留壳而不是改那 **52 个引用方**的 import 路径，是本轮拆包的第一原则：
 * 搬家不改调用点。做法与 `assets/util/util.js` re-export `jetRgb` 一样
 * （见那边 549 行的注释），已经验证过一次。
 *
 * 新代码请直接写 `from '@shroom/frontend/core'`；这个壳不会删，它是那 52 处的
 * 兼容层，不是过渡期临时物。
 */

export * from '@shroom/frontend/core/displayThresholds.js';
