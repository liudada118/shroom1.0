/** 按原版点图的半格偏移把方阵写入放大网格，保持行列顺序与十倍显示幅值。 */
export function interp(smallMat, bigMat, length, factor) {
  for (let x = 1; x <= length; x++) {
    for (let y = 1; y <= length; y++) {
      bigMat[length * factor * (factor * (y - 1)) + (length * factor * factor) / 2 + factor * (x - 1) + factor / 2]
        = smallMat[length * (y - 1) + x - 1] * 10;
    }
  }
}
