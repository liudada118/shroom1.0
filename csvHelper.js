/**
 * csvHelper.js
 * CSV 导出工具模块
 *
 * 将 server.js 中 30 处 csvWriter 相关的重复逻辑统一封装，
 * 提供标准化的 CSV 导出接口。
 */

const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const logger = require('./logger');

/**
 * 创建标准的传感器数据 CSV 写入器
 * @param {string} filePath - CSV 文件保存路径
 * @param {string[]} extraHeaders - 额外的列头（除 time 和 data 外）
 * @returns {object} csv-writer 实例
 */
function createSensorCsvWriter(filePath, extraHeaders = []) {
  const header = [
    { id: 'time', title: 'time' },
    { id: 'data', title: 'data' },
    ...extraHeaders.map((h) => ({ id: h, title: h })),
  ];

  return createCsvWriter({ path: filePath, header });
}

/**
 * 将数据库中的帧数据导出为 CSV 文件
 * @param {Array} rows - 数据库查询结果（每行包含 data, timestamp 字段）
 * @param {string} outputPath - 输出 CSV 文件路径
 * @param {object} options - 导出选项
 * @param {string[]} [options.extraFields] - 额外字段名
 * @param {function} [options.transform] - 行数据转换函数
 * @returns {Promise<string>} 导出的文件路径
 */
async function exportFramesToCsv(rows, outputPath, options = {}) {
  const { extraFields = [], transform } = options;

  const writer = createSensorCsvWriter(outputPath, extraFields);

  const records = rows.map((row) => {
    const base = {
      time: row.timestamp,
      data: row.data,
    };
    return transform ? transform(base, row) : base;
  });

  try {
    await writer.writeRecords(records);
    logger.info(`CSV 导出完成: ${outputPath} (${records.length} 条记录)`);
    return outputPath;
  } catch (err) {
    logger.error('CSV 导出失败', err);
    throw err;
  }
}

/**
 * 创建带有完整压力统计信息的 CSV 写入器
 * 用于汽车座椅场景下的综合数据导出
 * @param {string} filePath - CSV 文件保存路径
 * @returns {object} csv-writer 实例
 */
function createPressureStatsCsvWriter(filePath) {
  return createCsvWriter({
    path: filePath,
    header: [
      { id: 'time', title: 'time' },
      { id: 'sitTotal', title: 'sit_total' },
      { id: 'sitMean', title: 'sit_mean' },
      { id: 'sitMax', title: 'sit_max' },
      { id: 'sitMin', title: 'sit_min' },
      { id: 'sitArea', title: 'sit_area' },
      { id: 'sitPoints', title: 'sit_points' },
      { id: 'backTotal', title: 'back_total' },
      { id: 'backMean', title: 'back_mean' },
      { id: 'backMax', title: 'back_max' },
      { id: 'backMin', title: 'back_min' },
      { id: 'backArea', title: 'back_area' },
      { id: 'backPoints', title: 'back_points' },
      { id: 'sitData', title: 'sit_data' },
      { id: 'backData', title: 'back_data' },
    ],
  });
}

/**
 * 生成 CSV 导出文件名
 * @param {string} sensorType - 传感器类型
 * @param {string} dateLabel - 采集标签
 * @param {string} [suffix=''] - 文件名后缀
 * @returns {string} 文件名
 */
function generateCsvFileName(sensorType, dateLabel, suffix = '') {
  const safeDateLabel = dateLabel.replace(/[:/\\]/g, '-');
  return `${sensorType}_${safeDateLabel}${suffix}.csv`;
}

module.exports = {
  createSensorCsvWriter,
  exportFramesToCsv,
  createPressureStatsCsvWriter,
  generateCsvFileName,
};
