/**
 * 数字矩阵文档配置台的纯数据逻辑。
 *
 * 这里不依赖 React 或 DOM，形状解析、帧校验和方向变换可以单独回归测试。
 */

import { buildCoordinatePointLayout } from '../../../core/coordinatePointLayout.js';
import { createDirectionCheckFrame } from '../../../core/matrixDisplayModes.js';

export const DEFAULT_MATRIX_ROWS = 8;
export const DEFAULT_MATRIX_COLS = 8;

/** 生成文档页内置的规则坐标矩阵，真实项目可用自己的坐标 JSON 替换。 */
export function createCoordinateMatrix(rows, cols) {
  return Array.from({ length: rows }, (_, row) => (
    Array.from({ length: cols }, (unused, col) => [col, rows - row - 1])
  ));
}

/**
 * 创建所有通用矩阵文档共用的方向校验样例。
 *
 * 每次调用都会返回新数组，避免某个预览修改数据后污染其它页面。
 */
export function createDefaultMatrixSample() {
  const coordinateMap = createCoordinateMatrix(DEFAULT_MATRIX_ROWS, DEFAULT_MATRIX_COLS);
  const layout = buildCoordinatePointLayout(coordinateMap);
  const values = createDirectionCheckFrame(layout.pointCount);
  return {
    rows: layout.rows,
    cols: layout.cols,
    pointCount: layout.pointCount,
    coordinateMap,
    layout,
    values,
    valueMax: values.at(-1) || 1,
  };
}

/** 校验坐标文件并返回可用于渲染的布局。 */
export function parseCoordinateMap(text) {
  const parsed = JSON.parse(text);
  const coordinateMap = Array.isArray(parsed) ? parsed : parsed?.coordinates;
  const layout = buildCoordinatePointLayout(coordinateMap);
  if (!layout) {
    throw new Error('坐标文件应为 rows × cols × [x, y]，并且每行列数一致');
  }
  return { coordinateMap, layout };
}

/** 接受一维数组或二维矩阵，并严格检查数据点数。 */
export function parseFrameValues(text, expectedCount) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('一帧数据必须是 JSON 数组');
  const values = Array.isArray(parsed[0]) ? parsed.flat() : parsed;
  if (values.length !== expectedCount) {
    throw new Error(`需要 ${expectedCount} 个数，当前是 ${values.length} 个`);
  }
  const normalized = values.map(Number);
  if (normalized.some((value) => !Number.isFinite(value))) {
    throw new Error('数组中只能包含有效数字');
  }
  return normalized;
}

/** 按用户选择的方向重排 row-major 数据，并同步返回新的行列数。 */
export function orientFrame(values, rows, cols, direction) {
  const matrix = Array.from({ length: rows }, (_, row) => (
    values.slice(row * cols, (row + 1) * cols)
  ));
  let output = matrix;

  if (direction === 'flip-x') output = matrix.map((row) => [...row].reverse());
  if (direction === 'flip-y') output = [...matrix].reverse();
  if (direction === 'rotate-180') {
    output = [...matrix].reverse().map((row) => [...row].reverse());
  }
  if (direction === 'rotate-cw') {
    output = Array.from({ length: cols }, (_, row) => (
      Array.from({ length: rows }, (unused, col) => matrix[rows - col - 1][row])
    ));
  }
  if (direction === 'rotate-ccw') {
    output = Array.from({ length: cols }, (_, row) => (
      Array.from({ length: rows }, (unused, col) => matrix[col][cols - row - 1])
    ));
  }

  return {
    rows: output.length,
    cols: output[0]?.length || 0,
    values: output.flat(),
  };
}
