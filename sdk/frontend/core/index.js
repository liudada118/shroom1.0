/**
 * core/index.js - 零依赖层的总出口
 *
 * ## 这一层的定义
 *
 * **没有 React、没有 three、没有 DOM。** 这条线不是审美，它同时决定两件事：
 *
 * 1. **谁能消费** —— 后端脚本、Node 工具、别的框架（Vue / Svelte / 原生）都能用。
 * 2. **能不能在裸 Node 里 import** —— `scripts/smoke-core.mjs` 每次都验证这条，
 *    无 `localStorage` 垫片、无打包器、无 loader。
 *
 * 所以这一层的两条硬规矩，破了 smoke 就红：
 *
 * - **相对 import 一律写全 `.js` 扩展名。** Node 的 ESM 解析不做扩展名补全，
 *   打包器做 —— 少写一个字符的代价是「在 client 里跑得好，装到新项目里就崩」。
 * - **模块顶层不读 `localStorage`。** `displayThresholds.js` 用
 *   `globalThis.localStorage?.` 正是为了这个（见该文件头部）；`util.js` 顶层那句
 *   `initValue` 是反例，也正是它进不来这一层的原因。
 *
 * ## 出口构成
 *
 * | 组 | 内容 |
 * | :--- | :--- |
 * | 契约与注册表 | `RENDERER_PROPS` / `RENDERER_METHODS` / `RENDERER_CAPABILITIES` / `registerRenderer` … |
 * | 帧通路 | `frameBus` 的收发、`buildSceneFrame`、`SCENE_CHANNELS` |
 * | 配色 | `COLORMAPS` 七条 + `sampleColormap*`；`jetRgb` / `jet` 是 18 处老通路的原样出口 |
 * | 阈值 | `createThresholdState` 与三组默认值（替掉了 47 个模块级声明块） |
 * | 布局与数学 | `buildCoordinatePointLayout`、`findMax` / `press` |
 * | numMatrix | `numMatrix.*` 命名空间 + 四个常用符号的顶层别名 |
 *
 * `numMatrix` 用命名空间而不是全部铺平：`LEGACY_PRESETS` 这种名字在
 * pointGrid 进来（第二轮）之后会撞车，现在就分好命名空间比到时候改出口便宜。
 *
 * @see ../react/index.js React + three 那一层（`RendererHost` 在那边）
 */

/* ── 契约 ───────────────────────────────────────────────────────── */
export {
  RENDERER_CAPABILITIES,
  RENDERER_METHODS,
  RENDERER_PROPS,
  validateRendererDescriptor,
} from './contract.js';

/* ── 渲染器注册表 ────────────────────────────────────────────────── */
export {
  getRendererDescriptor,
  listRegistrationFailures,
  listRenderers,
  loadRenderer,
  normalizeRendererParams,
  registerRenderer,
  resetRendererRegistry,
  resolveRendererFromDefinition,
} from './registry.js';

/* ── 帧总线与场景帧 ──────────────────────────────────────────────── */
export {
  clearLastFrame,
  getLastFrame,
  publishFrame,
  resetFrameBus,
  subscribeFrames,
} from './frameBus.js';

export {
  SCENE_CHANNELS,
  buildSceneFrame,
  padThumbGap,
  toRaw256,
} from './sceneFrame.js';

/* ── 配色 ───────────────────────────────────────────────────────── */
export {
  COLORMAPS,
  DEFAULT_COLORMAP_ID,
  colormapPreviewCss,
  getColormap,
  isClassicColormap,
  isKnownColormapId,
  sampleColormap,
  sampleColormapRgb,
} from './colormaps.js';

export { jetRgb } from './jetLadder.js';

/* ── 阈值 ───────────────────────────────────────────────────────── */
export {
  DUAL_CHANNEL_DEFAULTS,
  SECOND_CHANNEL_DEFAULTS,
  SINGLE_CHANNEL_DEFAULTS,
  STORAGE_KEYS,
  createThresholdState,
} from './displayThresholds.js';

export { bed4096numParams } from './bed4096numParams.js';

/* ── 布局与帧数学 ────────────────────────────────────────────────── */
export {
  buildCoordinatePointLayout,
  buildCoordinateWorldLayout,
} from './coordinatePointLayout.js';

export { findMax, jet, press } from './frameMath.js';

/* ── numMatrix（命名空间 + 四个常用别名） ────────────────────────── */
export * as numMatrix from './numMatrix/index.js';

export {
  LEGACY_PRESETS as NUM_MATRIX_PRESETS,
  normalizeNumMatrixParams,
} from './numMatrix/params.js';

export { computeFrameStats, quantizeFrame } from './numMatrix/pipeline.js';
