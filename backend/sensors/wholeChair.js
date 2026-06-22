const logger = require('../common/logger');
const { gaussBlur_return } = require('../server/modules/mathUtils');

const TYPE = 'wholeChair';
const GAUSS_RADIUS = 0.5;

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

function flipMatrixVertical(arr, height, width) {
  const result = [];
  for (let row = height - 1; row >= 0; row--) {
    result.push(...arr.slice(row * width, row * width + width));
  }
  return result;
}

function applyGauss(arr, width, height) {
  if (!Array.isArray(arr) || arr.length !== width * height) {
    return arr;
  }
  return gaussBlur_return(arr, width, height, GAUSS_RADIUS);
}

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
