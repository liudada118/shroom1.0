/**
 * heatBarsParams.js - 第三方渲染器的参数层（不含 React / canvas）
 *
 * ## 为什么参数要单独一个文件
 *
 * 因为**打包器的懒加载切分是按静态 import 图算的**。参数归一化函数要给三个地方用：
 *
 * ```
 * registerHeatBars.js   normalizeParams: 挂在描述符上（注册在首屏）
 * CustomRenderer.jsx    宿主侧算 PARAMS
 * HeatBarsRenderer.jsx  自己兜底
 * ```
 *
 * 如果它写在 `HeatBarsRenderer.jsx` 里，前两个文件就得
 * `import { normalizeHeatBarsParams } from './HeatBarsRenderer.jsx'` ——
 * 那是一条**静态**边。于是 `load: () => import('./HeatBarsRenderer.jsx')` 那句
 * 动态 import 失效，Rollup 直接告诉你：
 *
 * ```
 * (!) HeatBarsRenderer.jsx is dynamically imported by registerHeatBars.js
 *     but also statically imported by CustomRenderer.jsx,
 *     dynamic import will not move module into another chunk.
 * ```
 *
 * 现象不是报错，是**懒加载 chunk 塌回主包**：本来只在真要画时才下载的 canvas
 * 绘制代码，变成首屏就下。这个站第一版就踩了这个坑，构建告警抓出来的。
 *
 * ## 这就是包自己的分层
 *
 * `@shroom/frontend` 是同一个形状：`core/numMatrix/params.js`（零依赖、纯函数）
 * 与 `react/numMatrix/`（React + three）分开。分界线是**「有没有 React / three / DOM」**。
 * 参数归一化在线的左边，所以它跟渲染实现分家不是洁癖，是切 chunk 的前提。
 */

/** 参数取值范围。和包内两个渲染器一样，归一化时用它夹住乱填的值。 */
export const PARAM_RANGES = {
  rows: { min: 1, max: 64 },
  cols: { min: 1, max: 64 },
  valueMax: { min: 1, max: 4095 },
  gap: { min: 0, max: 12 },
};

/**
 * 夹一个整数进范围。
 *
 * @param {*} value 原始值，什么都可能。
 * @param {number} fallback 非法时的默认值。
 * @param {{min: number, max: number}} range 范围。
 * @returns {number} 归一化后的整数。
 */
function clampInt(value, fallback, range) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(range.max, Math.max(range.min, parsed));
}

/**
 * 归一化本渲染器的参数。
 *
 * 挂在描述符的 `normalizeParams` 上，注册表会在 `normalizeRendererParams()` 里
 * 调它。**任何非法输入都退回默认值而不是抛错** —— 用户手填的 manifest 出错时
 * 应当降级渲染，而不是整块白屏。这条是跟包内两个渲染器学的。
 *
 * @param {object} [params] 原始参数。
 * @returns {{rows: number, cols: number, valueMax: number, gap: number}} 归一化结果。
 */
export function normalizeHeatBarsParams(params = {}) {
  return {
    rows: clampInt(params.rows, 16, PARAM_RANGES.rows),
    cols: clampInt(params.cols, 24, PARAM_RANGES.cols),
    valueMax: clampInt(params.valueMax, 255, PARAM_RANGES.valueMax),
    gap: clampInt(params.gap, 1, PARAM_RANGES.gap),
  };
}
