/**
 * params.js - 壳文件：点阵参数 schema 已搬进 `@shroom/frontend/core/pointGrid`
 *
 * 实体在 `sdk/frontend/core/pointGrid/params.js`，本文件原样 re-export，
 * 让原路径的三个消费者（`renderers/builtins.js`、`renderers/index.test.js`、
 * `page/home/Home.jsx`）一行都不用改 —— 与第一轮 `util.js` / `value.js`
 * 留壳是同一套做法。
 *
 * 注意同目录下的 `pipeline.js` **没有**留壳：搬走之前它在 client 侧的
 * import 数是 0（只有它自己的测试在用，测试也跟着搬走了）。给一个没人
 * import 的路径留壳，就是凭空造一份要维护的死代码。
 */

export {
  LEGACY_PRESETS,
  PARAM_RANGES,
  deriveGridSize,
  normalizePointGridParams,
  paramsFromManifest,
} from '@shroom/frontend/core/pointGrid';
