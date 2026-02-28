/**
 * dbHelper.js
 * 数据库操作工具模块
 *
 * 将 server.js 中分散的 SQLite 操作统一封装为 Promise 风格的工具函数，
 * 消除回调地狱，提升代码可读性和可维护性。
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

/**
 * 以 Promise 方式执行 SQLite run 操作（INSERT / UPDATE / DELETE）
 * @param {sqlite3.Database} db - 数据库实例
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Promise<void>}
 */
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error('[dbRun] SQL Error:', err.message, '\nSQL:', sql);
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

/**
 * 以 Promise 方式执行 SQLite all 操作（SELECT 多行）
 * @param {sqlite3.Database} db - 数据库实例
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Promise<Array>}
 */
function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('[dbAll] SQL Error:', err.message, '\nSQL:', sql);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

/**
 * 以 Promise 方式执行 SQLite get 操作（SELECT 单行）
 * @param {sqlite3.Database} db - 数据库实例
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Promise<object|undefined>}
 */
function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('[dbGet] SQL Error:', err.message, '\nSQL:', sql);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

/**
 * 初始化数据库：若目标文件不存在，则从模板复制后连接
 * @param {string} dbPath - 目标数据库文件路径
 * @param {string} templatePath - 模板数据库文件路径
 * @returns {sqlite3.Database}
 */
function initDatabase(dbPath, templatePath) {
  if (!fs.existsSync(dbPath)) {
    fs.copyFileSync(templatePath, dbPath);
    console.log(`[dbHelper] 数据库已从模板创建: ${path.basename(dbPath)}`);
  }
  return new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[dbHelper] 数据库连接失败:', err.message);
    }
  });
}

/**
 * 向 matrix 表插入一帧压力数据
 * @param {sqlite3.Database} db - 数据库实例
 * @param {string} date - 采集标签（时间戳字符串）
 * @param {number} time - 帧时间戳（ms）
 * @param {Array} dataArr - 压力矩阵数组
 * @returns {Promise<void>}
 */
function insertMatrixFrame(db, date, time, dataArr) {
  const sql = `INSERT INTO matrix (date, time, data) VALUES (?, ?, ?)`;
  return dbRun(db, sql, [date, time, JSON.stringify(dataArr)]);
}

/**
 * 查询指定标签下的所有帧数据
 * @param {sqlite3.Database} db - 数据库实例
 * @param {string} date - 采集标签
 * @returns {Promise<Array>}
 */
function queryFramesByDate(db, date) {
  return dbAll(db, `SELECT * FROM matrix WHERE date = ? ORDER BY time ASC`, [date]);
}

/**
 * 查询所有不重复的采集标签列表
 * @param {sqlite3.Database} db - 数据库实例
 * @returns {Promise<string[]>}
 */
async function queryDateLabels(db) {
  const rows = await dbAll(db, `SELECT DISTINCT date FROM matrix ORDER BY date DESC`);
  return rows.map((r) => r.date);
}

/**
 * 删除指定标签的所有帧数据
 * @param {sqlite3.Database} db - 数据库实例
 * @param {string} date - 采集标签
 * @returns {Promise<void>}
 */
function deleteFramesByDate(db, date) {
  return dbRun(db, `DELETE FROM matrix WHERE date = ?`, [date]);
}

module.exports = {
  dbRun,
  dbAll,
  dbGet,
  initDatabase,
  insertMatrixFrame,
  queryFramesByDate,
  queryDateLabels,
  deleteFramesByDate,
};
