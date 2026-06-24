/**
 * 整椅传感器矩阵归一化模块。
 *
 * 整椅使用 sit/back/head 三个区域的 32x32 原始矩阵，
 * 本模块负责裁剪、翻转、旋转和高斯平滑，输出前端展示矩阵。
 */
const logger = require('../common/logger');
const { gaussBlur_return } = require('../server/modules/mathUtils');

const TYPE = 'wholeChair';
const GAUSS_RADIUS = 0.5;

/**
 * 将正方形矩阵逆时针旋转 90 度。
 * @param {unknown[]} arr 原始矩阵。
 * @param {number} size 矩阵边长。
 * @returns {unknown[]} 旋转后的矩阵。
 */
function rotateSquare90CounterClockwise(arr, size) {
  const matrix = [];
  for (let i = 0; i < size; i++) {
    matrix[i] = [];
    for (let j = 0; j < size; j++) {
      matrix[i].push(arr[i * size + j]);
    }
  }

  const temp = [];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const k = size - 1 - j;
      if (!temp[k]) {
        temp[k] = [];
      }
      temp[k][i] = matrix[i][j];
    }
  }
  return temp.flat();
}

/**
 * 将矩形矩阵顺时针旋转 90 度。
 * @param {unknown[]} arr 原始矩阵。
 * @param {number} height 原始高度。
 * @param {number} width 原始宽度。
 * @returns {unknown[]} 旋转后的矩阵。
 */
function rotateMatrix90Clockwise(arr, height, width) {
  const matrix = Array.from({ length: height }, (_, i) =>
    arr.slice(i * width, i * width + width)
  );

  const newMatrix = [];
  for (let col = 0; col < width; col++) {
    newMatrix[col] = [];
    for (let row = 0; row < height; row++) {
      newMatrix[col][row] = matrix[height - 1 - row][col];
    }
  }
  return newMatrix.flat();
}

/**
 * 将矩阵按垂直方向翻转。
 * @param {unknown[]} arr 原始矩阵。
 * @param {number} height 高度。
 * @param {number} width 宽度。
 * @returns {unknown[]} 翻转后的矩阵。
 */
function flipMatrixVertical(arr, height, width) {
  const result = [];
  for (let row = height - 1; row >= 0; row--) {
    result.push(...arr.slice(row * width, row * width + width));
  }
  return result;
}

/**
 * 对指定尺寸矩阵应用高斯平滑。
 * @param {number[]} arr 原始矩阵。
 * @param {number} width 宽度。
 * @param {number} height 高度。
 * @returns {number[]} 平滑后的矩阵。
 */
function applyGauss(arr, width, height) {
  if (!Array.isArray(arr) || arr.length !== width * height) {
    return arr;
  }
  return gaussBlur_return(arr, width, height, GAUSS_RADIUS);
}

/**
 * 将数组或 JSON 字符串解析为矩阵数组。
 * @param {unknown[] | string} data 原始帧或数据库 JSON 字符串。
 * @returns {unknown[]} 矩阵数组。
 */
function parseFrameArray(data) {
  if (Array.isArray(data)) {
    return [...data];
  }
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      logger.warn('[wholeChair] failed to parse stored frame data', error);
      return [];
    }
  }
  return [];
}

/**
 * 将整椅坐面 32x32 原始矩阵裁剪并转换为前端使用的 16x16 方向。
 *
 * @param {unknown[] | string} rawData 原始帧或数据库 JSON 字符串。
 * @returns {unknown[]} 坐面展示矩阵。
 */
function normalizeSitFrame(rawData) {
  const wsPointData = parseFrameArray(rawData);
  if (wsPointData.length !== 1024) {
    return wsPointData;
  }

  const resArr = [];
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      resArr.push(wsPointData[i * 32 + j]);
    }
  }

  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 4; j++) {
      [resArr[i * 16 + 8 + j], resArr[i * 16 + 8 + 7 - j]] =
        [resArr[i * 16 + 8 + 7 - j], resArr[i * 16 + 8 + j]];
    }
  }
  return applyGauss(rotateSquare90CounterClockwise(resArr, 16), 16, 16);
}

/**
 * 将整椅靠背 32x32 原始矩阵裁剪并转换为前端使用的 16x16 方向。
 *
 * @param {unknown[] | string} rawData 原始帧或数据库 JSON 字符串。
 * @returns {unknown[]} 靠背展示矩阵。
 */
function normalizeBackFrame(rawData) {
  const wsPointData = parseFrameArray(rawData);
  if (wsPointData.length !== 1024) {
    return wsPointData;
  }

  const resArr = [];
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      resArr.push(wsPointData[i * 32 + j]);
    }
  }

  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 4; j++) {
      [resArr[i * 16 + 8 + j], resArr[i * 16 + 8 + 7 - j]] =
        [resArr[i * 16 + 8 + 7 - j], resArr[i * 16 + 8 + j]];
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 16; j++) {
      [resArr[i * 16 + j], resArr[(15 - i) * 16 + j]] =
        [resArr[(15 - i) * 16 + j], resArr[i * 16 + j]];
    }
  }

  return applyGauss(
    flipMatrixVertical(rotateSquare90CounterClockwise(resArr, 16), 16, 16),
    16,
    16
  );
}

/**
 * 将整椅头枕 32x32 原始矩阵裁剪并转换为前端使用的 10x10 方向。
 *
 * @param {unknown[] | string} rawData 原始帧或数据库 JSON 字符串。
 * @returns {unknown[]} 头枕展示矩阵。
 */
function normalizeHeadFrame(rawData) {
  const wsPointData = parseFrameArray(rawData);
  if (wsPointData.length !== 1024) {
    return wsPointData;
  }

  const resArr = [];
  for (let i = 6; i < 16; i++) {
    for (let j = 0; j < 10; j++) {
      resArr.push(wsPointData[i * 32 + j]);
    }
  }

  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 2; j++) {
      [resArr[i * 10 + 5 + j], resArr[i * 10 + 5 + 4 - j]] =
        [resArr[i * 10 + 5 + 4 - j], resArr[i * 10 + 5 + j]];
    }
  }

  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 5; j++) {
      [resArr[i * 10 + j], resArr[i * 10 + 9 - j]] =
        [resArr[i * 10 + 9 - j], resArr[i * 10 + j]];
    }
  }

  return applyGauss(
    flipMatrixVertical(rotateMatrix90Clockwise(resArr, 10, 10), 10, 10),
    10,
    10
  )
    .map((value) => value / 2);
}

/**
 * 按整椅区域归一化原始矩阵。
 *
 * @param {'sit' | 'back' | 'head' | string} section 整椅区域。
 * @param {unknown[] | string} data 原始帧或数据库 JSON 字符串。
 * @returns {unknown[]} 归一化后的区域矩阵。
 */
function normalizeFrame(section, data) {
  if (section === 'sit') return normalizeSitFrame(data);
  if (section === 'back') return normalizeBackFrame(data);
  if (section === 'head') return normalizeHeadFrame(data);
  return parseFrameArray(data);
}

module.exports = {
  TYPE,
  applyGauss,
  normalizeBackFrame,
  normalizeFrame,
  normalizeHeadFrame,
  normalizeSitFrame,
  parseFrameArray,
};
