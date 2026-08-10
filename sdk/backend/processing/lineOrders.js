const {
  FOOT_L_ADC_ORDER,
  FOOT_R_ADC_ORDER,
  FOOT_VIDEO_POINTS,
} = require('./lineOrderDefinitions/foot');
const {
  HAND_L_ADC_ORDER,
  HAND_R_ADC_ORDER,
  HAND_R_VIDEO_POINTS,
  HAND_R_VIDEO_SINGLE_ROW_INDEXES,
  HAND_R_VIDEO_SKIP_INDEXES,
} = require('./lineOrderDefinitions/hand');
const {
  GLOVES_GRID_POINTS,
  GLOVES_POINTS,
} = require('./lineOrderDefinitions/gloves');
const {
  mapOneBasedOrder,
  paintPoints,
} = require('./lineOrderMapper');
const { zeroLine } = require('./matrixTransforms');
const {
  carCol,
  footArrToNormal,
  footVideo1,
  gloves0123Res,
  handBlue,
  handSinglePoint,
  handVideo1_0416_0506,
  handVideoRealPoint_0506_3,
  matColLine,
} = require('./videoPointMappings');
const { press } = require('./pressureTransforms');

const TEMP_FULL_BED_TEMPERATURE_K = Number(process.env.TEMP_FULL_BED_TEMPERATURE_K || 1);
const TEMP_FULL_BED_PRESSURE_THRESHOLD = 20;

/**
 * 温度床 ADC 原始值转换。
 *
 * @param {number} adcRaw 原始 ADC 值。
 * @param {number} k 温度系数。
 * @returns {number} 转换后的温度值。
 */
function convertTempFullBedTemperature(adcRaw, k = TEMP_FULL_BED_TEMPERATURE_K) {
  const raw = Number(adcRaw) || 0;
  const coefficient = Number.isFinite(Number(k)) ? Number(k) : 1;
  return ((10 / 6) * raw + (2 / 3)) * coefficient;
}

/**
 * 温度床压力阈值过滤。
 *
 * @param {number} value 原始压力值。
 * @returns {number} 过滤后的压力值。
 */
function normalizeTempFullBedPressure(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < TEMP_FULL_BED_PRESSURE_THRESHOLD) return 0;
  return numberValue;
}

/**
 * 逆时针旋转正方矩阵 90 度。
 *
 * 保持旧 openWeb.js 的索引行为，`height` 和 `width` 参数仍按旧签名保留。
 *
 * @param {number[]} arr 一维矩阵。
 * @param {number} height 矩阵行数。
 * @param {number} width 矩阵列数。
 * @returns {number[]} 旋转后的一维矩阵。
 */
function rotate90(arr, height, width) {
  const matrix = [];
  for (let i = 0; i < height; i += 1) {
    matrix[i] = [];
    for (let j = 0; j < width; j += 1) {
      matrix[i].push(arr[i * height + j]);
    }
  }

  const temp = [];
  const len = matrix.length;
  for (let i = 0; i < len; i += 1) {
    for (let j = 0; j < len; j += 1) {
      const k = len - 1 - j;
      if (!temp[k]) {
        temp[k] = [];
      }
      temp[k][i] = matrix[i][j];
    }
  }

  let res = [];
  for (let i = 0; i < temp.length; i += 1) {
    res = res.concat(temp[i]);
  }
  return res;
}

/**
 * jqbed 32x32 主矩阵线序转换。
 *
 * 保持旧 openWeb.js 行为：先交换 1-15 行，再把前 15 行移动到数组尾部。
 *
 * @param {number[]} arr 原始 32x32 压力矩阵。
 * @returns {number[]} 转换后的 32x32 压力矩阵。
 */
/**
 * 按旧系统规则逆时针旋转矩阵。
 *
 * @param {number[]} matrix 一维矩阵数据。
 * @param {number} m 行数。
 * @param {number} n 列数。
 * @returns {number[]} 旋转后的矩阵数据。
 */
function rotateMatrix(matrix, m, n) {
  const rotatedMatrix = [];
  for (let i = 0; i < n; i += 1) {
    rotatedMatrix[i] = [];
    for (let j = 0; j < m; j += 1) {
      rotatedMatrix[i][j] = matrix[(m - 1 - j) * n + i];
    }
  }
  return rotatedMatrix.flat();
}

/**
 * 对孤立异常低值做邻域补点。
 *
 * 旧算法只补 32x32 内部点：当前点小于 10 且左右或上下邻居都大于 10 时，用邻居均值替换。
 *
 * @param {number[]} arr 32x32 一维矩阵。
 * @returns {number[]} 补点后的矩阵。
 */
function getLineOk(arr) {
  const result = [...arr];
  for (let i = 1; i < 31; i += 1) {
    for (let j = 1; j < 31; j += 1) {
      const currentIndex = i * 32 + j;
      if (result[currentIndex] < 10 && result[currentIndex + 1] > 10 && result[currentIndex - 1] > 10) {
        result[currentIndex] = parseInt((result[currentIndex + 1] + result[currentIndex - 1]) / 2, 10);
      } else if (result[currentIndex] < 10 && result[currentIndex + 32] > 10 && result[currentIndex - 32] > 10) {
        result[currentIndex] = parseInt((result[currentIndex + 32] + result[currentIndex - 32]) / 2, 10);
      }
    }
  }
  return result;
}

/**
 * 按旧车背显示规则做 180 度翻转。
 *
 * @param {number[]} matrix 一维矩阵。
 * @param {number} m 行数。
 * @param {number} n 列数。
 * @returns {number[]} 翻转后的矩阵。
 */
function rotateMatrixback180(matrix, m, n) {
  const rotatedMatrix = [...matrix];
  for (let i = 0; i < m; i += 1) {
    for (let j = 0; j < n / 2; j += 1) {
      [rotatedMatrix[i * m + j], rotatedMatrix[i * m + n - 1 - j]] = [
        rotatedMatrix[i * m + n - 1 - j],
        rotatedMatrix[i * m + j],
      ];
    }
  }
  for (let i = 0; i < m / 2; i += 1) {
    for (let j = 0; j < n; j += 1) {
      [rotatedMatrix[i * m + j], rotatedMatrix[(m - 1 - i) * m + j]] = [
        rotatedMatrix[(m - 1 - i) * m + j],
        rotatedMatrix[i * m + j],
      ];
    }
  }
  return rotatedMatrix;
}

/**
 * 按旧车座显示规则做横向翻转。
 *
 * @param {number[]} matrix 一维矩阵。
 * @param {number} m 行数。
 * @param {number} n 列数。
 * @returns {number[]} 翻转后的矩阵。
 */
function rotateMatrixsit180(matrix, m, n) {
  const rotatedMatrix = [...matrix];
  for (let i = 0; i < m; i += 1) {
    for (let j = 0; j < n / 2; j += 1) {
      [rotatedMatrix[i * m + j], rotatedMatrix[i * m + n - 1 - j]] = [
        rotatedMatrix[i * m + n - 1 - j],
        rotatedMatrix[i * m + j],
      ];
    }
  }
  return rotatedMatrix;
}

function expandCoordinateAxis(axis) {
  const result = [];
  axis.forEach((item) => {
    if (Array.isArray(item)) {
      const step = item[0] > item[1] ? -1 : 1;
      for (let value = item[0]; step > 0 ? value <= item[1] : value >= item[1]; value += step) {
        result.push(value);
      }
    } else {
      result.push(item);
    }
  });
  return result;
}

function arrToRealLine(arr, arrX, arrY, matrixLength) {
  const realX = expandCoordinateAxis(arrX);
  const realY = expandCoordinateAxis(arrY);
  const result = [];
  for (let i = 0; i < realY.length; i += 1) {
    for (let j = 0; j < realX.length; j += 1) {
      result.push(arr[realY[i] * matrixLength + realX[j]]);
    }
  }
  return result;
}

function sit10Line(arr) {
  const wsPointData = [...arr];
  let result = [];
  for (let i = 0; i < 10; i += 1) {
    for (let j = 22; j < 32; j += 1) result.push(wsPointData[i * 32 + j]);
  }

  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      [result[i * 10 + j], result[(4 - i) * 10 + j]] = [
        result[(4 - i) * 10 + j],
        result[i * 10 + j],
      ];
    }
  }
  return rotate90(result, 10, 10);
}

function sit100Line(wsPointData) {
  const left = [];
  const center = [];
  const right = [];
  for (let i = 0; i < 3; i += 1) {
    for (let j = 1; j >= 0; j -= 1) left.push(wsPointData[i * 32 + j]);
  }

  for (let i = 3; i < 13; i += 1) {
    for (let j = 7; j >= 2; j -= 1) center.push(wsPointData[i * 32 + j]);
  }

  for (let i = 15; i >= 13; i -= 1) {
    for (let j = 9; j >= 8; j -= 1) right.push(wsPointData[i * 32 + j]);
  }

  for (let i = 0; i < 6; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      [center[(j + 5) * 6 + i], center[(4 - j + 5) * 6 + i]] = [
        center[(4 - j + 5) * 6 + i],
        center[(j + 5) * 6 + i],
      ];
    }
  }
  return [...right, ...left, ...center];
}

function endiSit1024(arr) {
  return arrToRealLine(arr, [[0, 22]], [[11, 22], [10, 0]], 32);
}

function yanfeng10sit(arr) {
  let data = [];
  for (let i = 6; i < 16; i += 1) {
    for (let j = 0; j < 10; j += 1) data.push(arr[i * 32 + j]);
  }

  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      [data[(5 + i) * 10 + j], data[(9 - i) * 10 + j]] = [
        data[(9 - i) * 10 + j],
        data[(5 + i) * 10 + j],
      ];
    }
  }
  data = rotate90(data, 10, 10);

  for (let i = 0; i < 10; i += 1) {
    for (let j = 0; j < 5; j += 1) {
      [data[i * 10 + j], data[i * 10 + 9 - j]] = [
        data[i * 10 + 9 - j],
        data[i * 10 + j],
      ];
    }
  }
  return data;
}

function wowhead(arr) {
  let data = [];
  for (let i = 6; i < 16; i += 1) {
    for (let j = 0; j < 10; j += 1) data.push(arr[i * 32 + j]);
  }

  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      [data[(5 + i) * 10 + j], data[(9 - i) * 10 + j]] = [
        data[(9 - i) * 10 + j],
        data[(5 + i) * 10 + j],
      ];
    }
  }
  return rotate90(data, 10, 10);
}

function yanfeng10back(arr) {
  let data = [];
  for (let i = 6; i < 16; i += 1) {
    for (let j = 0; j < 10; j += 1) data.push(arr[i * 32 + j]);
  }

  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 10; j += 1) {
      [data[i * 10 + j], data[(4 - i) * 10 + j]] = [
        data[(4 - i) * 10 + j],
        data[i * 10 + j],
      ];
    }
  }
  return rotate90(data, 10, 10);
}

function xiyueReal1(arr) {
  const wsPointData = [...arr];
  for (let i = 0; i < 6; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[(10 - i) * 32 + j]] = [
        wsPointData[(10 - i) * 32 + j],
        wsPointData[i * 32 + j],
      ];
    }
  }
  return wsPointData;
}

function handLine(arr, flag) {
  let wsPointData = [...arr];
  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 9; j += 1) {
      [wsPointData[i * 32 + 15 + j], wsPointData[i * 32 + 31 - j]] = [
        wsPointData[i * 32 + 31 - j],
        wsPointData[i * 32 + 15 + j],
      ];
    }
  }

  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[(15 - i) * 32 + j]] = [
        wsPointData[(15 - i) * 32 + j],
        wsPointData[i * 32 + j],
      ];
    }
  }

  if (flag) wsPointData = press(wsPointData);
  return rotateMatrixsit180(wsPointData, 32, 32);
}

/**
 * 顺时针旋转正方形矩阵 90 度。
 *
 * @param {number[]} array 一维正方形矩阵。
 * @returns {number[]|undefined} 旋转后的矩阵；输入不是正方形时返回 undefined。
 */
function rotateArray90Degrees(array) {
  const rows = Math.sqrt(array.length);
  const cols = rows;
  if (!Number.isInteger(rows)) {
    console.error('Array length must be a perfect square');
    return undefined;
  }

  const originalMatrix = [];
  for (let i = 0; i < rows; i += 1) {
    originalMatrix.push(array.slice(i * cols, (i + 1) * cols));
  }

  const rotatedMatrix = new Array(cols).fill().map(() => []);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      rotatedMatrix[col][rows - 1 - row] = originalMatrix[row][col];
    }
  }

  return rotatedMatrix.flat();
}

/**
 * 逆时针旋转矩阵 90 度。
 *
 * @param {number[]} array 一维矩阵。
 * @param {number} rows 行数。
 * @param {number} cols 列数。
 * @returns {number[]|undefined} 旋转后的矩阵；尺寸不匹配时返回 undefined。
 */
function rotateArrayCounter90Degrees(array, rows, cols) {
  if (array.length !== rows * cols) {
    console.error('Array length does not match the specified dimensions.');
    return undefined;
  }

  const originalMatrix = [];
  for (let i = 0; i < rows; i += 1) {
    originalMatrix.push(array.slice(i * cols, (i + 1) * cols));
  }

  const rotatedMatrix = new Array(rows).fill().map(() => []);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      rotatedMatrix[cols - 1 - col][row] = originalMatrix[row][col];
    }
  }

  return rotatedMatrix.flat();
}

function jqbed(arr) {
  const wsPointData = [...arr];
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[(14 - i) * 32 + j]] = [
        wsPointData[(14 - i) * 32 + j],
        wsPointData[i * 32 + j],
      ];
    }
  }

  const shiftedRows = wsPointData.splice(0, 15 * 32);
  return wsPointData.concat(shiftedRows);
}

/**
 * 温度床线序转换和温度/压力数据抽取。
 *
 * 保持旧 openWeb.js 行为：先按 jqbed 类似规则重排 32x32 原始矩阵，再抽取
 * 15x12 展示压力区域和 3 个温度采样点。
 *
 * @param {number[]} arr 原始 32x32 压力/温度矩阵。
 * @returns {object} 温度床展示帧。
 */
/**
 * 车座 32x32 线序转换。
 *
 * 保持旧系统行为：先翻转前 16 行，再翻转指定列段，补孤立点，最后横向翻转显示。
 *
 * @param {number[]} arr 原始 32x32 压力矩阵。
 * @returns {number[]} 车座显示矩阵。
 */
function carSitLine(arr) {
  let wsPointData = [...arr];
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[(15 - i) * 32 + j]] = [
        wsPointData[(15 - i) * 32 + j],
        wsPointData[i * 32 + j],
      ];
    }
  }

  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 8; j += 1) {
      [wsPointData[i * 32 + j + 15], wsPointData[i * 32 + 16 - j + 15]] = [
        wsPointData[i * 32 + 16 - j + 15],
        wsPointData[i * 32 + j + 15],
      ];
    }
  }

  wsPointData = getLineOk(wsPointData);
  return rotateMatrixsit180(wsPointData, 32, 32);
}

/**
 * 车背 32x32 线序转换。
 *
 * 保持旧系统行为：行翻转、列段翻转、前 15 行移尾、旋转、补点、再做车背 180 度显示翻转。
 *
 * @param {number[]} arr 原始 32x32 压力矩阵。
 * @returns {number[]} 车背显示矩阵。
 */
function carBackLine(arr) {
  let wsPointData = [...arr];
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[(14 - i) * 32 + j]] = [
        wsPointData[(14 - i) * 32 + j],
        wsPointData[i * 32 + j],
      ];
    }
  }

  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 8; j += 1) {
      [wsPointData[i * 32 + j + 15], wsPointData[i * 32 + 16 - j + 15]] = [
        wsPointData[i * 32 + 16 - j + 15],
        wsPointData[i * 32 + j + 15],
      ];
    }
  }

  const shiftedRows = wsPointData.splice(0, 15 * 32);
  wsPointData = wsPointData.concat(shiftedRows);
  wsPointData = rotateMatrix(wsPointData, 32, 32);
  wsPointData = getLineOk(wsPointData);
  return rotateMatrixback180(wsPointData, 32, 32);
}

/**
 * wow 座垫 32x32 线序转换。
 *
 * @param {number[]} arr 原始 32x32 压力矩阵。
 * @returns {number[]} wow 座垫显示矩阵。
 */
function wowSitLine(arr) {
  let wsPointData = [...arr];
  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 8; j += 1) {
      [wsPointData[i * 32 + 15 - j], wsPointData[i * 32 + j]] = [
        wsPointData[i * 32 + j],
        wsPointData[i * 32 + 15 - j],
      ];
    }
    for (let j = 0; j < 16; j += 1) {
      [wsPointData[i * 32 + j + 16], wsPointData[i * 32 + j]] = [
        wsPointData[i * 32 + j],
        wsPointData[i * 32 + j + 16],
      ];
    }
  }

  for (let i = 0; i < 9; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[(17 - i) * 32 + j]] = [
        wsPointData[(17 - i) * 32 + j],
        wsPointData[i * 32 + j],
      ];
    }
  }

  wsPointData = zeroLine(wsPointData);
  wsPointData = rotateArray90Degrees(wsPointData, 32, 32);

  for (let i = 0; i < 16; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[(31 - i) * 32 + j]] = [
        wsPointData[(31 - i) * 32 + j],
        wsPointData[i * 32 + j],
      ];
    }
  }

  return wsPointData;
}

/**
 * wow 靠背 32x32 线序转换。
 *
 * @param {number[]} arr 原始 32x32 压力矩阵。
 * @returns {number[]} wow 靠背显示矩阵。
 */
function wowBackLine(arr) {
  let wsPointData = [...arr];
  for (let i = 0; i < 32; i += 1) {
    for (let j = 0; j < 8; j += 1) {
      [wsPointData[i * 32 + 15 - j], wsPointData[i * 32 + j]] = [
        wsPointData[i * 32 + j],
        wsPointData[i * 32 + 15 - j],
      ];
    }
    for (let j = 0; j < 16; j += 1) {
      [wsPointData[i * 32 + j + 16], wsPointData[i * 32 + j]] = [
        wsPointData[i * 32 + j],
        wsPointData[i * 32 + j + 16],
      ];
    }
  }

  for (let i = 0; i < 9; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      [wsPointData[i * 32 + j], wsPointData[(17 - i) * 32 + j]] = [
        wsPointData[(17 - i) * 32 + j],
        wsPointData[i * 32 + j],
      ];
    }
  }

  wsPointData = zeroLine(wsPointData);
  return rotateArrayCounter90Degrees(wsPointData, 32, 32);
}

/**
 * 按 ADC 顺序表抽取脚部 60 个采样点。
 *
 * @param {number[]} arr 原始 ADC 数据。
 * @param {number[]} adcOrder 1 基 ADC 点位顺序。
 * @returns {number[]} 抽取后的脚部采样点。
 */
function mapFootAdcOrder(arr, adcOrder) {
  return mapOneBasedOrder(arr, adcOrder);
}

/**
 * 右脚 60 点线序转换。
 *
 * @param {number[]} arr 原始 ADC 数据。
 * @returns {number[]} 右脚采样点。
 */
function footR(arr) {
  return mapFootAdcOrder(arr, FOOT_R_ADC_ORDER);
}

/**
 * 左脚 60 点线序转换。
 *
 * @param {number[]} arr 原始 ADC 数据。
 * @returns {number[]} 左脚采样点。
 */
function footL(arr) {
  return mapFootAdcOrder(arr, FOOT_L_ADC_ORDER);
}

/**
 * 从 16x16 原始矩阵中抽取脚底 60 个展示点。
 *
 * @param {number[]} arr 原始 16x16 矩阵。
 * @returns {number[]} 脚底采样点。
 */
function extractFootVideoSamples(arr) {
  const footArr = [];
  for (let i = 0; i < 10; i += 1) {
    for (let j = 0; j < 6; j += 1) {
      footArr.push(arr[(13 - j) * 16 + 15 - i]);
    }
  }
  return footArr;
}

/**
 * 脚底视频展示矩阵生成。
 *
 * 先把 60 个采样点落到 64x32 展示矩阵，再对横向和纵向间隔做线性插值。
 *
 * @param {number[]} arr 原始 16x16 矩阵。
 * @returns {number[]} 64x32 展示矩阵。
 */
function footVideo(arr) {
  const footArr = extractFootVideoSamples(arr);
  const newArr = paintPoints(footArr, FOOT_VIDEO_POINTS, { rows: 64, cols: 32 });

  for (let i = 0; i < 10; i += 1) {
    for (let j = 1; j < 6; j += 1) {
      const col = FOOT_VIDEO_POINTS[i * 6 + j][0];
      const length = FOOT_VIDEO_POINTS[i * 6 + j][1] - FOOT_VIDEO_POINTS[i * 6 + j - 1][1];
      const firstIndex = FOOT_VIDEO_POINTS[i * 6 + j - 1][1];
      const lastIndex = FOOT_VIDEO_POINTS[i * 6 + j][1];
      const firstValue = newArr[col * 32 + firstIndex];
      const lastValue = newArr[col * 32 + lastIndex];
      const cha = lastValue - firstValue;
      for (let k = 1; k < length; k += 1) {
        newArr[col * 32 + firstIndex + k] = firstValue + Math.floor((cha * 10) / length) / 10;
      }
    }
  }

  for (let i = 0; i < 9; i += 1) {
    const col = FOOT_VIDEO_POINTS[i * 6][0];
    const nextCol = FOOT_VIDEO_POINTS[(i + 1) * 6][0];
    const firstIndex = FOOT_VIDEO_POINTS[i * 6][1];
    const lastIndex = FOOT_VIDEO_POINTS[i * 6 + 5][1];
    for (let j = firstIndex; j <= lastIndex; j += 1) {
      newArr[(col + 1) * 32 + j] = newArr[col * 32 + j]
        + Math.floor((newArr[nextCol * 32 + j] - newArr[col * 32 + j]) * 10 * 1 / 5) / 10;
      newArr[(col + 2) * 32 + j] = newArr[col * 32 + j]
        + Math.floor((newArr[nextCol * 32 + j] - newArr[col * 32 + j]) * 10 * 2 / 5) / 10;
      newArr[(col + 3) * 32 + j] = newArr[col * 32 + j]
        + Math.floor((newArr[nextCol * 32 + j] - newArr[col * 32 + j]) * 10 * 3 / 5) / 10;
      newArr[(col + 4) * 32 + j] = newArr[col * 32 + j]
        + Math.floor((newArr[nextCol * 32 + j] - newArr[col * 32 + j]) * 10 * 4 / 5) / 10;
    }
  }

  return newArr;
}

/**
 * 根据手部 ADC 顺序生成 147 点手部数据。
 *
 * @param {number[]} arr 原始 ADC 数据。
 * @param {number[]} adcOrder 1 基 ADC 点位顺序。
 * @returns {number[]} 147 点手部数据。
 */
function buildHand147FromAdcOrder(arr, adcOrder) {
  const zeroBasedOrder = adcOrder.map((pointIndex) => pointIndex - 1);
  const finger1 = zeroBasedOrder.slice(0, 12);
  const finger2 = zeroBasedOrder.slice(12, 24);
  const finger3 = zeroBasedOrder.slice(24, 36);
  const finger4 = zeroBasedOrder.slice(36, 48);
  const finger5 = zeroBasedOrder.slice(48, 60);
  const fingerArr = [finger1, finger2, finger3, finger4, finger5];
  const res = new Array(147).fill(0);

  for (let i = 0; i < 4; i += 1) {
    for (let k = 0; k < 5; k += 1) {
      for (let j = 0; j < 3; j += 1) {
        res[i * 15 + k * 3 + j] = arr[fingerArr[k][i * 3 + j]];
      }
    }
  }

  const fingerMiddleHand = zeroBasedOrder.slice(60, 65);
  for (let i = 0; i < 5; i += 1) {
    res[15 * 4 + 1 + i * 3] = arr[fingerMiddleHand[i]];
  }

  const handArr = zeroBasedOrder.slice(65, 137);
  for (let i = 0; i < handArr.length; i += 1) {
    res[15 * 5 + i] = arr[handArr[i]];
  }

  return res;
}

/**
 * 右手 147 点线序转换。
 *
 * @param {number[]} arr 原始 ADC 数据。
 * @returns {number[]} 右手 147 点数据。
 */
function handR(arr) {
  return buildHand147FromAdcOrder(arr, HAND_R_ADC_ORDER);
}

/**
 * 左手 147 点线序转换。
 *
 * @param {number[]} arr 原始 ADC 数据。
 * @returns {number[]} 左手 147 点数据。
 */
function handL(arr) {
  const res = buildHand147FromAdcOrder(arr, HAND_L_ADC_ORDER);
  const mirrored = [];
  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 15; j += 1) {
      mirrored.push(res[i * 15 + 14 - j]);
    }
  }
  for (let i = 75 + 12 - 1; i >= 75; i -= 1) {
    mirrored.push(res[i]);
  }
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 15; j += 1) {
      mirrored.push(res[75 + 12 + i * 15 + 14 - j]);
    }
  }
  return mirrored;
}

/**
 * 生成右手 32x32 视频展示矩阵。
 *
 * @param {number[]} arr 原始 ADC 数据。
 * @returns {number[]} 32x32 展示矩阵。
 */
function handRVideo1470506(arr) {
  const handArr = handR(arr);
  const points = HAND_R_VIDEO_POINTS.map(([row, col]) => [row, col]);

  for (let i = 0; i < 5; i += 1) {
    for (let j = 0; j < 5; j += 1) {
      for (let k = 0; k < 3; k += 1) {
        if (j === 0 || j === 3 || j === 4) {
          points[i * 15 + j * 3 + k][1] -= 1;
        }
      }
    }
  }

  const shiftedPoints = points.map(([row, col]) => [row + 1, col]);
  const matrix = new Array(1024).fill(0);
  shiftedPoints.forEach(([row, col], index) => {
    if (HAND_R_VIDEO_SKIP_INDEXES.includes(index)) return;
    const targetIndex = row * 32 + 31 - col;
    matrix[targetIndex] = handArr[index];
    if (!HAND_R_VIDEO_SINGLE_ROW_INDEXES.includes(index)) {
      matrix[(row + 1) * 32 + 31 - col] = handArr[index];
    }
  });

  return rotate90(matrix, 32, 32);
}

/**
 * 旧手套 32x32 采样顺序。
 *
 * @param {number[]} wsPointData 原始 32x32 矩阵。
 * @returns {number[]} 手套采样值。
 */
function collectGlovesForwardSamples(wsPointData) {
  const handData = [];
  for (let j = 0; j < 3; j += 1) {
    for (let i = 6; i < 16; i += 1) handData.push(wsPointData[i * 32 + j]);
  }
  for (let j = 3; j < 5; j += 1) {
    for (let i = 6; i < 14; i += 1) handData.push(wsPointData[i * 32 + j]);
  }
  for (let j = 9; j >= 5; j -= 1) {
    for (let i = 6; i < 16; i += 1) handData.push(wsPointData[i * 32 + j]);
  }
  return handData;
}

/**
 * 反向手套 32x32 采样顺序。
 *
 * @param {number[]} wsPointData 原始 32x32 矩阵。
 * @returns {number[]} 手套采样值。
 */
function collectGlovesReverseSamples(wsPointData) {
  const handData = [];
  for (let j = 9; j >= 7; j -= 1) {
    for (let i = 15; i >= 6; i -= 1) handData.push(wsPointData[i * 32 + j]);
  }
  for (let j = 6; j >= 5; j -= 1) {
    for (let i = 15; i >= 8; i -= 1) handData.push(wsPointData[i * 32 + j]);
  }
  for (let j = 0; j < 5; j += 1) {
    for (let i = 15; i >= 6; i -= 1) handData.push(wsPointData[i * 32 + j]);
  }
  return handData;
}

/**
 * 10x10 手套采样顺序。
 *
 * @param {number[]} wsPointData 原始 10x10 矩阵。
 * @returns {number[]} 手套采样值。
 */
function collectGloves0123Samples(wsPointData) {
  const handData = [];
  for (let j = 9; j >= 7; j -= 1) {
    for (let i = 0; i < 10; i += 1) handData.push(wsPointData[i * 10 + j]);
  }
  for (let j = 6; j >= 5; j -= 1) {
    for (let i = 2; i < 10; i += 1) handData.push(wsPointData[i * 10 + j]);
  }
  for (let j = 4; j >= 0; j -= 1) {
    for (let i = 0; i < 10; i += 1) handData.push(wsPointData[i * 10 + j]);
  }
  return handData;
}

/**
 * 把手套采样值映射到 32x32 展示矩阵。
 *
 * @param {number[]} handData 手套采样值。
 * @param {number[][]} points 展示坐标。
 * @returns {number[]} 32x32 展示矩阵。
 */
function paintGloves(handData, points) {
  let matrix = new Array(1024).fill(0);
  for (let i = 0; i < 3 * 10 + 2 * 8; i += 1) {
    matrix[points[i][0] * 32 + points[i][1]] = handData[i];
    matrix[(points[i][0] + 1) * 32 + points[i][1]] = handData[i];
  }
  for (let i = 3 * 10 + 2 * 8; i < 3 * 10 + 2 * 8 + 5 * 10; i += 1) {
    matrix[points[i][0] * 32 + points[i][1]] = handData[i];
  }
  matrix = rotate90(matrix, 32, 32);
  return matrix;
}

/**
 * 手套线序转换。
 *
 * @param {number[]} wsPointData 原始 32x32 矩阵。
 * @returns {number[]} 32x32 展示矩阵。
 */
function gloves(wsPointData) {
  return paintGloves(collectGlovesForwardSamples(wsPointData), GLOVES_POINTS);
}

/**
 * 手套线序转换 1。
 *
 * @param {number[]} wsPointData 原始 32x32 矩阵。
 * @returns {number[]} 32x32 展示矩阵。
 */
function gloves1(wsPointData) {
  return paintGloves(collectGlovesForwardSamples(wsPointData), GLOVES_GRID_POINTS);
}

/**
 * 手套线序转换 2。
 *
 * @param {number[]} wsPointData 原始 32x32 矩阵。
 * @returns {number[]} 32x32 展示矩阵。
 */
function gloves2(wsPointData) {
  return paintGloves(collectGlovesReverseSamples(wsPointData), GLOVES_GRID_POINTS);
}

/**
 * 10x10 手套线序转换。
 *
 * @param {number[]} wsPointData 原始 10x10 矩阵。
 * @returns {number[]} 32x32 展示矩阵。
 */
function gloves0123(wsPointData) {
  return paintGloves(collectGloves0123Samples(wsPointData), GLOVES_GRID_POINTS);
}

/**
 * 温度床线序转换和温度/压力数据抽取。
 *
 * 保持旧 openWeb.js 行为：先按 jqbed 类似规则重排 32x32 原始矩阵，再抽取 15x12 展示压力区域和 3 个温度采样点。
 *
 * @param {number[]} arr 原始 32x32 压力/温度矩阵。
 * @returns {object} 温度床展示帧。
 */
function tempFullBed(arr) {
  const ordered = [...arr];
  for (let i = 0; i < 8; i += 1) {
    for (let j = 0; j < 32; j += 1) {
      [ordered[i * 32 + j], ordered[(14 - i) * 32 + j]] = [
        ordered[(14 - i) * 32 + j],
        ordered[i * 32 + j],
      ];
    }
  }
  const shiftedRows = ordered.splice(0, 15 * 32);
  ordered.push(...shiftedRows);

  const pointRows = [20, 31];
  const pointCols = [[13, 19], [21, 28]];
  const pointColIndexes = pointCols.flatMap(([startCol, endCol]) => {
    const indexes = [];
    for (let col = startCol; col <= endCol; col += 1) indexes.push(col);
    return indexes;
  });
  const temperatureRows = [14, 15, 16];
  const temperatureCol = 20;
  const basePointData = [];

  for (let row = pointRows[0]; row <= pointRows[1]; row += 1) {
    pointColIndexes.forEach((col) => {
      basePointData.push(normalizeTempFullBedPressure(ordered[row * 32 + col]));
    });
  }

  const temperatureRawData = temperatureRows.map((row) => ordered[row * 32 + temperatureCol] || 0);
  const temperatureData = temperatureRawData.map((value) => convertTempFullBedTemperature(value));

  return {
    sitData: basePointData,
    rawSitData: basePointData,
    matrixWidth: 15,
    matrixHeight: 12,
    matrixOrientation: 'row-major',
    realArr: ordered,
    pressureThreshold: TEMP_FULL_BED_PRESSURE_THRESHOLD,
    temperatureRawData,
    temperatureData,
    temperatureAvg: temperatureData.reduce((sum, value) => sum + value, 0) / temperatureData.length,
    temperatureK: TEMP_FULL_BED_TEMPERATURE_K,
  };
}

/**
 * 新手部矩阵线序转换。
 *
 * 从 32x32 原始矩阵中抽取固定手部点位，再映射回 32x32 展示矩阵并旋转。
 *
 * @param {number[]} wsPointData 原始 32x32 压力矩阵。
 * @returns {number[]} 手部展示矩阵。
 */
function newHand(wsPointData) {
  const sourceRows = [0, 17, 18, 19, 20, 21];
  const compactHandValues = [];
  for (let i = 0; i < sourceRows.length; i += 1) {
    if (i < 3) {
      for (let j = 22; j < 32; j += 1) {
        compactHandValues.push(wsPointData[sourceRows[i] * 32 + j]);
      }
    } else {
      for (let j = 24; j < 32; j += 1) {
        compactHandValues.push(wsPointData[sourceRows[i] * 32 + j]);
      }
    }
  }

  const handPointArr = [
    [4, 5], [4, 6], [2, 8], [2, 9], [1, 12], [1, 13], [2, 16], [2, 17], [14, 25], [14, 26],
    [8, 5], [8, 6], [6, 9], [6, 10], [6, 12], [6, 13], [6, 16], [6, 17], [18, 24], [18, 25],
    [11, 6], [11, 7], [10, 9], [10, 10], [10, 12], [10, 13], [10, 15], [10, 16], [22, 23], [22, 24],
    [18, 8], [18, 9], [18, 10], [18, 11], [18, 12], [18, 13], [18, 14], [18, 15],
    [21, 8], [21, 9], [21, 10], [21, 11], [21, 12], [21, 13], [21, 14], [21, 15],
    [24, 8], [24, 9], [24, 10], [24, 11], [24, 12], [24, 13], [24, 14], [24, 15],
  ];

  const matrix = new Array(1024).fill(0);
  handPointArr.forEach((point, index) => {
    matrix[point[0] * 32 + point[1]] = compactHandValues[index];
    matrix[(point[0] + 1) * 32 + point[1]] = compactHandValues[index];
    matrix[(point[0] + 2) * 32 + point[1]] = compactHandValues[index];
  });

  return rotate90(matrix, 32, 32);
}

// 传感器线序和点位映射入口。
// 当前文件已断开对旧 openWeb.js 的依赖，点位表继续向 definitions 目录迁移。
module.exports = {
  carBackLine,
  carCol,
  carSitLine,
  convertTempFullBedTemperature,
  endiSit1024,
  footArrToNormal,
  footL,
  footR,
  footVideo,
  footVideo1,
  gloves,
  gloves1,
  gloves2,
  gloves0123,
  gloves0123Res,
  handBlue,
  handL,
  handLine,
  handR,
  handRVideo1470506,
  handSinglePoint,
  handVideo1_0416_0506,
  handVideoRealPoint_0506_3,
  jqbed,
  matColLine,
  newHand,
  normalizeTempFullBedPressure,
  rotate90,
  sit10Line,
  sit100Line,
  tempFullBed,
  TEMP_FULL_BED_PRESSURE_THRESHOLD,
  TEMP_FULL_BED_TEMPERATURE_K,
  wowBackLine,
  wowSitLine,
  wowhead,
  xiyueReal1,
  yanfeng10back,
  yanfeng10sit,
};
