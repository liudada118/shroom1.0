/**
 * 修补 32x32 矩阵中疑似整行或整列断线的零值。
 *
 * 旧 openWeb.js 版本默认用相邻行/列总压判断断线：当前行/列低于 min，
 * 上下或左右相邻行/列高于 max 时，用相邻两行/列均值替换。
 *
 * @param {number[]} arr 32x32 压力矩阵。
 * @param {number} max 相邻行/列判断阈值。
 * @param {number} min 当前行/列判断阈值。
 * @returns {number[]} 修补后的新矩阵。
 */
function zeroLine(arr, max = 100, min = 40) {
  const wsPointData = [...arr];
  const colArr = [];
  const rowArr = [];

  for (let i = 0; i < 32; i += 1) {
    let coltotal = 0;
    let rowtotal = 0;
    for (let j = 0; j < 32; j += 1) {
      coltotal += wsPointData[j * 32 + i];
      rowtotal += wsPointData[i * 32 + j];
    }
    colArr.push(coltotal);
    rowArr.push(rowtotal);
  }

  for (let i = 1; i < 31; i += 1) {
    if (rowArr[i + 1] > max && rowArr[i] < min && rowArr[i - 1] > max) {
      for (let j = 0; j < 32; j += 1) {
        wsPointData[i * 32 + j] = (
          wsPointData[(i - 1) * 32 + j] + wsPointData[(i + 1) * 32 + j]
        ) / 2;
      }
    }
  }

  for (let i = 1; i < 31; i += 1) {
    if (colArr[i + 1] > max && colArr[i] < min && colArr[i - 1] > max) {
      for (let j = 0; j < 32; j += 1) {
        wsPointData[j * 32 + i] = (
          wsPointData[j * 32 + i - 1] + wsPointData[j * 32 + i + 1]
        ) / 2;
      }
    }
  }

  return wsPointData;
}

/**
 * 修补任意正方矩阵中疑似整行或整列断线的零值。
 *
 * 保持旧 openWeb.js 行为：虽然函数签名保留 max/min 参数，实际判断阈值固定为
 * 100/40，避免迁移时改变历史数据处理结果。
 *
 * @param {number[]} arr 压力矩阵。
 * @param {number} matrixLength 矩阵边长。
 * @returns {number[]} 修补后的新矩阵。
 */
function zeroLineMatrix(arr, matrixLength) {
  const wsPointData = [...arr];
  const colArr = [];
  const rowArr = [];

  for (let i = 0; i < matrixLength; i += 1) {
    let coltotal = 0;
    let rowtotal = 0;
    for (let j = 0; j < matrixLength; j += 1) {
      coltotal += wsPointData[j * matrixLength + i];
      rowtotal += wsPointData[i * matrixLength + j];
    }
    colArr.push(coltotal);
    rowArr.push(rowtotal);
  }

  for (let i = 1; i < matrixLength - 1; i += 1) {
    if (rowArr[i + 1] > 100 && rowArr[i] < 40 && rowArr[i - 1] > 100) {
      for (let j = 0; j < matrixLength; j += 1) {
        wsPointData[i * matrixLength + j] = (
          wsPointData[(i - 1) * matrixLength + j]
          + wsPointData[(i + 1) * matrixLength + j]
        ) / 2;
      }
    }
  }

  for (let i = 1; i < matrixLength - 1; i += 1) {
    if (colArr[i + 1] > 100 && colArr[i] < 40 && colArr[i - 1] > 100) {
      for (let j = 0; j < matrixLength; j += 1) {
        wsPointData[j * matrixLength + i] = (
          wsPointData[j * matrixLength + i - 1]
          + wsPointData[j * matrixLength + i + 1]
        ) / 2;
      }
    }
  }

  return wsPointData;
}

/**
 * 修补小床 32x32 矩阵中的固定坏列。
 *
 * 保持旧 openWeb.js 行为：第 20 列按左右相邻列均值替换。
 *
 * @param {number[]} arr 小床压力矩阵。
 * @returns {number[]} 修补后的新矩阵。
 */
function smallBedZero(arr) {
  const wsPointData = [...arr];
  for (let i = 0; i < 32; i += 1) {
    wsPointData[20 + i * 32] = (
      wsPointData[20 - 1 + i * 32] + wsPointData[20 + 1 + i * 32]
    ) / 2;
  }
  return wsPointData;
}

/**
 * 矩阵修正、清零和形状变换入口。
 */
module.exports = {
  smallBedZero,
  zeroLine,
  zeroLineMatrix,
};
