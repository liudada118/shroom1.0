/**
 * 插值和基础平滑算法。
 *
 * 这里承接旧 `openWeb.js` 中已经确认无外部状态依赖的算法实现。
 * 函数签名和原地写入行为保持不变，避免影响旧实时链路。
 */

/**
 * 将小矩阵采样点写入放大后的矩阵中心位置。
 *
 * @param {number[]} smallMat 原始小矩阵。
 * @param {number[]} bigMat 目标大矩阵，按旧行为原地写入。
 * @param {number} length 小矩阵边长。
 * @param {number} num 放大倍数。
 */
function interp(smallMat, bigMat, length, num) {
  for (let x = 1; x <= length; x += 1) {
    for (let y = 1; y <= length; y += 1) {
      bigMat[
        length * num * (num * (y - 1))
        + (length * num * num) / 2
        + num * (x - 1)
        + num / 2
      ] = smallMat[length * (y - 1) + x - 1] * 10;
    }
  }
}

/**
 * 将非正方形矩阵采样点写入放大后的矩阵中心位置。
 *
 * @param {number[]} smallMat 原始矩阵。
 * @param {number[]} bigMat 目标矩阵，按旧行为原地写入。
 * @param {number} height 原始高度。
 * @param {number} width 原始宽度。
 * @param {number} num 放大倍数。
 */
function interp1016(smallMat, bigMat, height, width, num) {
  for (let x = 1; x <= height; x += 1) {
    for (let y = 1; y <= width; y += 1) {
      bigMat[
        width * num * (num * (x - 1))
        + (width * num) * Math.floor(num / 2)
        + num * (y - 1)
        + Math.floor(num / 2)
      ] = smallMat[height * (y - 1) + x - 1] * 10;
    }
  }
}

/**
 * 给矩阵四周补边。
 *
 * @param {number[]} arr 原始矩阵。
 * @param {number} width 原始宽度。
 * @param {number} height 原始高度。
 * @param {number} wnum 左右补边列数。
 * @param {number} hnum 上下补边行数。
 * @param {number} sideNum 补边值，负数时沿用旧默认值 1。
 * @returns {number[]} 补边后的矩阵。
 */
function addSide(arr, width, height, wnum, hnum, sideNum) {
  const rows = new Array(height);
  const body = [];
  const fillValue = sideNum >= 0 ? sideNum : 1;

  for (let i = 0; i < height; i += 1) {
    rows[i] = [];
    for (let j = 0; j < width; j += 1) {
      if (j === 0) {
        rows[i].push(...new Array(wnum).fill(fillValue), arr[i * width + j]);
      } else if (j === width - 1) {
        rows[i].push(arr[i * width + j], ...new Array(wnum).fill(fillValue));
      } else {
        rows[i].push(arr[i * width + j]);
      }
    }
  }

  for (let i = 0; i < height; i += 1) {
    body.push(...rows[i]);
  }

  return [
    ...new Array(hnum * (width + 2 * wnum)).fill(fillValue),
    ...body,
    ...new Array(hnum * (width + 2 * wnum)).fill(fillValue),
  ];
}

/**
 * 高斯模糊，保持旧实现的原地写入目标数组行为。
 *
 * @param {number[]} source 源矩阵。
 * @param {number[]} target 目标矩阵，按旧行为原地写入。
 * @param {number} width 宽度。
 * @param {number} height 高度。
 * @param {number} radius 模糊半径。
 */
function gaussBlur_1(source, target, width, height, radius) {
  const significantRadius = Math.ceil(radius * 2.57);
  for (let i = 0; i < height; i += 1) {
    for (let j = 0; j < width; j += 1) {
      let value = 0;
      let weightSum = 0;
      for (let iy = i - significantRadius; iy < i + significantRadius + 1; iy += 1) {
        for (let ix = j - significantRadius; ix < j + significantRadius + 1; ix += 1) {
          const x = Math.min(width - 1, Math.max(0, ix));
          const y = Math.min(height - 1, Math.max(0, iy));
          const distanceSquared = (ix - j) * (ix - j) + (iy - i) * (iy - i);
          const weight = Math.exp(-distanceSquared / (2 * radius * radius))
            / (Math.PI * 2 * radius * radius);
          value += source[y * width + x] * weight;
          weightSum += weight;
        }
      }
      target[i * width + j] = Math.round(value / weightSum);
    }
  }
}

module.exports = {
  addSide,
  gaussBlur_1,
  interp,
  interp1016,
};
