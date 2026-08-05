/**
 * core/numMatrix/index.js - 数字矩阵渲染器的纯逻辑出口
 *
 * 参数 schema 与帧管线都在这一层，**没有 React、没有 three、没有 DOM**，
 * 所以它能在裸 Node 里被 import（`scripts/smoke-core.mjs` 守着这条性质）。
 * 真正画画的那部分在 `../../react/numMatrix/`。
 *
 * 这个划分不是审美：`pipeline.js` 之所以能和三份原实现做 785 点逐点比对
 * （`pipeline.test.js`），正因为它是纯的。同一个性质让它能进零依赖层 ——
 * 一个性质两个收益。
 */

export {
  BACKENDS,
  LEGACY_PRESETS,
  PARAM_RANGES,
  TEXTURE_CELL_SIZE,
  deriveGrid,
  normalizeNumMatrixParams,
  paramsFromManifest,
} from './params.js';

export {
  applyFloorFilter,
  cellUvOffset,
  classicTint,
  clampTextureValue,
  computeFrameStats,
  createRollingWindow,
  deriveCellPlaneSize,
  deriveWorldCellSize,
  formatDisplayValue,
  getTextureCanvasSize,
  getTextureFontSize,
  getTextureRange,
  instanceWorldPosition,
  quantizeFrame,
  resolveCanvasSize,
} from './pipeline.js';
