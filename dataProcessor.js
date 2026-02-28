/**
 * dataProcessor.js
 * 传感器数据处理管线模块
 *
 * 将 server.js 中 parser.on('data') 回调里的数据处理逻辑
 * （线序转换、归零、高斯模糊、压力计算等）抽取为独立的处理管线，
 * 使 server.js 只负责调度，不再关心具体的数据变换细节。
 *
 * 核心思想：
 *   rawBuffer → parseFrame → applyLineMapping → applyZero → applySmooth → output
 */

const logger = require('./logger');

/**
 * 将原始 Buffer 解析为 Uint8 数组
 * @param {Buffer} buffer - 串口原始数据帧
 * @param {number} expectedLength - 期望的帧长度（如 1024, 1025）
 * @returns {number[]|null} 解析后的数组，长度不匹配时返回 null
 */
function parseFrame(buffer, expectedLength = 1024) {
  if (buffer.length !== expectedLength) {
    logger.debug(`帧长度不匹配: 期望 ${expectedLength}, 实际 ${buffer.length}`);
    return null;
  }
  const arr = new Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    arr[i] = buffer.readUInt8(i);
  }
  return arr;
}

/**
 * 应用归零校正
 * @param {number[]} data - 当前帧数据
 * @param {number[]} zeroRef - 零点参考数据
 * @returns {number[]} 归零后的数据（负值归零为 0）
 */
function applyZero(data, zeroRef) {
  if (!zeroRef || zeroRef.length === 0) return data;
  return data.map((val, i) => Math.max(0, val - (zeroRef[i] || 0)));
}

/**
 * 应用高斯模糊平滑
 * @param {number[]} data - 输入数据
 * @param {number} width - 矩阵宽度
 * @param {number} height - 矩阵高度
 * @param {number} radius - 模糊半径
 * @returns {number[]} 平滑后的数据
 */
function applyGaussianBlur(data, width, height, radius = 1) {
  if (radius <= 0) return data;

  const result = new Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            sum += data[ny * width + nx];
            count++;
          }
        }
      }
      result[y * width + x] = Math.round(sum / count);
    }
  }
  return result;
}

/**
 * 计算压力统计信息
 * @param {number[]} data - 压力矩阵数据
 * @param {number} [threshold=0] - 有效点阈值
 * @returns {{ total: number, mean: number, max: number, min: number, points: number, area: number }}
 */
function calculateStats(data, threshold = 0) {
  const activePoints = data.filter((v) => v > threshold);
  const points = activePoints.length;

  if (points === 0) {
    return { total: 0, mean: 0, max: 0, min: 0, points: 0, area: 0 };
  }

  const total = activePoints.reduce((a, b) => a + b, 0);
  const mean = Math.round(total / points);
  const max = Math.max(...activePoints);
  const min = Math.min(...activePoints);
  const area = points; // 面积 = 有效点数（可乘以单点面积系数）

  return { total, mean, max, min, points, area };
}

/**
 * 负值归零工具函数
 * @param {number} val
 * @returns {number}
 */
function clampToZero(val) {
  return val < 0 ? 0 : val;
}

/**
 * 矩阵旋转 90 度（逆时针）
 * @param {number[]} arr - 输入矩阵（一维数组）
 * @param {number} rows - 行数
 * @param {number} cols - 列数
 * @returns {number[]} 旋转后的矩阵
 */
function rotateCounter90(arr, rows, cols) {
  const result = new Array(arr.length);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[(cols - 1 - j) * rows + i] = arr[i * cols + j];
    }
  }
  return result;
}

/**
 * 矩阵旋转 180 度
 * @param {number[]} arr - 输入矩阵
 * @returns {number[]} 旋转后的矩阵
 */
function rotate180(arr) {
  return [...arr].reverse();
}

/**
 * 矩阵水平翻转
 * @param {number[]} arr - 输入矩阵
 * @param {number} width - 矩阵宽度
 * @param {number} height - 矩阵高度
 * @returns {number[]} 翻转后的矩阵
 */
function flipHorizontal(arr, width, height) {
  const result = new Array(arr.length);
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      result[i * width + j] = arr[i * width + (width - 1 - j)];
    }
  }
  return result;
}

/**
 * 数据处理管线构建器
 * 允许以链式调用的方式组装数据处理步骤
 *
 * 使用示例：
 *   const pipeline = new DataPipeline()
 *     .addStep('lineMapping', (data) => car10Sit(data))
 *     .addStep('zero', (data) => applyZero(data, zeroRef))
 *     .addStep('smooth', (data) => applyGaussianBlur(data, 32, 32, 2));
 *   const result = pipeline.process(rawData);
 */
class DataPipeline {
  constructor() {
    this._steps = [];
  }

  /**
   * 添加处理步骤
   * @param {string} name - 步骤名称（用于日志）
   * @param {function} fn - 处理函数 (data) => data
   * @returns {DataPipeline}
   */
  addStep(name, fn) {
    this._steps.push({ name, fn });
    return this;
  }

  /**
   * 执行处理管线
   * @param {number[]} data - 输入数据
   * @returns {number[]} 处理后的数据
   */
  process(data) {
    let result = data;
    for (const step of this._steps) {
      try {
        result = step.fn(result);
      } catch (err) {
        logger.error(`数据处理步骤 [${step.name}] 失败`, err);
        return result; // 出错时返回上一步的结果
      }
    }
    return result;
  }

  /**
   * 清空所有步骤
   */
  clear() {
    this._steps = [];
    return this;
  }
}

module.exports = {
  parseFrame,
  applyZero,
  applyGaussianBlur,
  calculateStats,
  clampToZero,
  rotateCounter90,
  rotate180,
  flipHorizontal,
  DataPipeline,
};
