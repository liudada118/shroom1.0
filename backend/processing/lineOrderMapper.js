/**
 * 通用线序映射工具。
 *
 * 这里放可复用的执行逻辑，具体传感器的 ADC 顺序和展示坐标放在
 * `lineOrderDefinitions/*` 中，避免 `lineOrders.js` 再次变成点位表仓库。
 */

/**
 * 按 1 基点位顺序从原始数组中抽取数据。
 *
 * @param {Array} source 原始数据。
 * @param {number[]} oneBasedOrder 1 基点位顺序。
 * @returns {Array} 抽取后的数据。
 */
function mapOneBasedOrder(source, oneBasedOrder) {
  return oneBasedOrder.map((pointIndex) => source[pointIndex - 1]);
}

/**
 * 把采样值落到一维矩阵的指定坐标上。
 *
 * @param {Array} values 采样值。
 * @param {number[][]} points `[row, col]` 坐标列表。
 * @param {object} options 矩阵参数。
 * @param {number} options.rows 行数。
 * @param {number} options.cols 列数。
 * @returns {Array} 填点后的矩阵。
 */
function paintPoints(values, points, { rows, cols }) {
  const matrix = new Array(rows * cols).fill(0);
  points.forEach(([row, col], index) => {
    matrix[row * cols + col] = values[index];
  });
  return matrix;
}

module.exports = {
  mapOneBasedOrder,
  paintPoints,
};
