import { gaussBlur_1 } from '../../../core/frameMath.js';

/** 将边缘缓冲宽度限制为 0–16 个显示网格层，0 保留原显示。 */
export function normalizeEdgeBuffer(value, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(16, Math.round(value))) : fallback;
}

/** 对显示副本使用零边界高斯；零保护圈阻止最外层压力被反复复制。 */
export function blurWithZeroBoundary(source, width, height, radius) {
  if (!(radius > 0)) return Array.from(source);
  const paddedWidth = width + 2;
  const padded = new Array(paddedWidth * (height + 2)).fill(0);
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) padded[(row + 1) * paddedWidth + col + 1] = source[row * width + col];
  }
  const blurred = new Array(padded.length).fill(0);
  gaussBlur_1(padded, blurred, paddedWidth, height + 2, radius);
  return Array.from({ length: source.length }, (_, index) => blurred[(Math.floor(index / width) + 1) * paddedWidth + index % width + 1]);
}

/** 在真实矩阵之外延伸压力场并渐降到零；不压低矩阵内的真实边缘样本。 */
export function sampleEdgeBuffer(values, rows, columns, row, column, padding, buffer, rowStretch = 1, repeat = 0) {
  const min = padding;
  const maxRow = rows - padding - 1;
  const maxColumn = columns - padding - 1;
  const sourceRow = Math.max(min, Math.min(maxRow, row));
  const sourceColumn = Math.max(min, Math.min(maxColumn, column));
  const distance = Math.max(Math.abs(row - sourceRow), Math.abs(column - sourceColumn));
  if (distance >= buffer && distance > 0) return 0;
  const value = values[(sourceRow * rowStretch + repeat) * columns + sourceColumn] || 0;
  const t = distance > 0 ? distance / buffer : 0;
  return value * (1 - t * t * (3 - 2 * t));
}

/** 生成外围点的原网格坐标；拉伸只复制行，不改变缓冲层的物理宽度。 */
export function buildEdgeBufferRing(rows, columns, padding, buffer, rowStretch = 1) {
  const extra = Math.max(0, buffer - padding);
  const ring = [];
  for (let row = -extra; row < rows + extra; row += 1) {
    for (let col = -extra; col < columns + extra; col += 1) {
      if (row >= 0 && row < rows && col >= 0 && col < columns) continue;
      for (let repeat = 0; repeat < rowStretch; repeat += 1) ring.push([row, col, row * rowStretch + repeat]);
    }
  }
  return ring;
}
