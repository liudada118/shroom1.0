/**
 * params.js - re-export 壳
 *
 * 实现已搬到 `@shroom/frontend/core/numMatrix/params.js`。
 *
 * 数字矩阵的其余部分也一起搬走了：
 *
 * | 原路径 | 新位置 |
 * | :--- | :--- |
 * | `numMatrix/params.js` | `@shroom/frontend/core/numMatrix/params.js` ← 本壳 |
 * | `numMatrix/pipeline.js` | `@shroom/frontend/core/numMatrix/pipeline.js` |
 * | `numMatrix/NumMatrixRenderer.jsx` | `@shroom/frontend/react/numMatrix/NumMatrixRenderer.jsx` |
 * | `numMatrix/backends/sprite3d.js` | `@shroom/frontend/react/numMatrix/backends/sprite3d.js` |
 *
 * 后两个**刻意没留壳**（它们原本也没有 client 侧引用方）。原因：渲染器本体只能
 * 经注册表的 `load: () => import(...)` 到达，在这里留一个静态 re-export 等于给人
 * 递一把静态 import 的刀 —— 一旦有人用，动态 chunk 就塌回主包，懒加载白做。
 * 要拿组件请用 `loadRenderer('numMatrix')`。
 */

export * from '@shroom/frontend/core/numMatrix/params.js';
