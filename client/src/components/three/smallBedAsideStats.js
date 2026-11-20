/**
 * 取出小床侧栏统计要用的有效点：传感器原始点阵里大于阈值的值，框选时只留框内的点。
 * ⚠️ `raw` 必须是原始点阵（32×32 最多 1024 点）。传插值拉伸后的显示网格，「有效点数」会数到 8000 多。
 * ⚠️ 框选范围是显示网格上的坐标，行列和原始点阵是对调的：原始点 (x, y)（下标 y*width+x）
 *   落在显示网格第 interp*x+interp/2 行、第 (interp*y+interp/2)*xStretch 起的 xStretch 列。对调写反了框选统计会选错区域。
 * @param {object} input
 * @param {ArrayLike<number>} input.raw 原始点阵，行优先
 * @param {number} input.width 每行点数
 * @param {number} input.height 行数
 * @param {number} [input.threshold] 大于它才算有效点
 * @param {number[]} [input.selection] 显示网格上的框选范围 [列起, 列止, 行起, 行止]，止不含；空或全 0 表示没有框选
 * @param {number} [input.interp] 显示网格的插值倍数
 * @param {number} [input.xStretch] 显示网格的横向拉伸倍数
 * @returns {number[]} 有效点的原始值，长度就是有效点数
 */
export function collectSmallBedAsidePoints({ raw, width, height, threshold = 0, selection, interp = 2, xStretch = 1 }) {
  const hasSelection = Array.isArray(selection) && selection.length >= 4 && !selection.every((value) => value == 0)
  const points = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = Number(raw[y * width + x]) || 0
      if (!(value > threshold)) continue
      if (hasSelection) {
        const row = interp * x + interp / 2
        const firstColumn = (interp * y + interp / 2) * xStretch
        // 这个点占的列是 [firstColumn, firstColumn + xStretch)，和框选的列范围有交集就算选中
        const columnInside = firstColumn < selection[1] && firstColumn + xStretch > selection[0]
        if (!columnInside || row < selection[2] || row >= selection[3]) continue
      }
      points.push(value)
    }
  }
  return points
}
