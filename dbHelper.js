/**
 * dbHelper.js
 * 数据库操作工具模块
 *
 * 将 server.js 中分散的 26 处 SQLite 操作（16 处 db.all + 10 处 db.run）
 * 统一封装为 Promise 风格的工具函数，消除回调地狱。
 * 同时封装了多数据库初始化逻辑（sit/back/head 三库模式）。
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// ─── 基础 Promise 封装 ──────────────────────────────────────────────────────

/**
 * 以 Promise 方式执行 SQLite run 操作（INSERT / UPDATE / DELETE）
 * @param {sqlite3.Database} db - 数据库实例
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数数组
 * @returns {Promise<{lastID: number, changes: number}>}
 */
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        logger.error(`[dbRun] SQL 错误: ${err.message}`, { sql, params });
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
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
        logger.error(`[dbAll] SQL 错误: ${err.message}`, { sql, params });
        reject(err);
      } else {
        resolve(rows || []);
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
        logger.error(`[dbGet] SQL 错误: ${err.message}`, { sql, params });
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// ─── 数据库生命周期管理 ─────────────────────────────────────────────────────

/**
 * 生成数据库实例：若目标文件不存在，则从 init.db 模板复制后连接
 * @param {string} dbPath - 目标数据库文件路径
 * @param {string} templatePath - 模板数据库文件路径
 * @returns {sqlite3.Database}
 */
function genDb(dbPath, templatePath) {
  try {
    fs.accessSync(dbPath);
  } catch {
    logger.info(`数据库不存在，从模板创建: ${path.basename(dbPath)}`);
    const data = fs.readFileSync(templatePath);
    fs.writeFileSync(dbPath, data);
  }
  return new sqlite3.Database(dbPath, (err) => {
    if (err) {
      logger.error(`数据库连接失败: ${dbPath}`, err.message);
    }
  });
}

/**
 * 根据传感器类型初始化数据库集合
 * 汽车类型需要 sit + back 两个库，volvo 需要 sit + back + head 三个库
 *
 * @param {string} sensorType - 传感器类型标识符
 * @param {string} dbDir - 数据库文件目录
 * @param {function} isCarFn - 判断是否为汽车类型的函数
 * @returns {{ db: sqlite3.Database, db1: sqlite3.Database|undefined, db2: sqlite3.Database|undefined }}
 */
function initDatabases(sensorType, dbDir, isCarFn) {
  const templatePath = path.join(dbDir, 'init.db');
  let db, db1, db2;

  if (isCarFn(sensorType)) {
    db  = genDb(path.join(dbDir, `${sensorType}sit.db`), templatePath);
    db1 = genDb(path.join(dbDir, `${sensorType}back.db`), templatePath);
    logger.info(`已初始化汽车双库: ${sensorType}sit.db, ${sensorType}back.db`);
  } else if (sensorType === 'volvo') {
    db  = genDb(path.join(dbDir, `${sensorType}sit.db`), templatePath);
    db1 = genDb(path.join(dbDir, `${sensorType}back.db`), templatePath);
    db2 = genDb(path.join(dbDir, `${sensorType}head.db`), templatePath);
    logger.info(`已初始化 Volvo 三库: sit/back/head`);
  } else {
    db = genDb(path.join(dbDir, `${sensorType}.db`), templatePath);
    logger.info(`已初始化单库: ${sensorType}.db`);
  }

  return { db, db1, db2 };
}

// ─── 业务操作封装 ───────────────────────────────────────────────────────────

/**
 * 向 matrix 表插入一帧压力数据
 * @param {sqlite3.Database} db - 数据库实例
 * @param {string} date - 采集标签（时间戳字符串）
 * @param {Array} dataArr - 压力矩阵数组
 * @returns {Promise<{lastID: number}>}
 */
function insertFrame(db, date, dataArr) {
  const timestamp = Date.now();
  const sql = 'INSERT INTO matrix (data, timestamp, date) VALUES (?, ?, ?)';
  return dbRun(db, sql, [JSON.stringify(dataArr), timestamp, date]);
}

/**
 * 查询指定标签下的所有帧数据
 * @param {sqlite3.Database} db - 数据库实例
 * @param {string} date - 采集标签
 * @returns {Promise<Array>}
 */
function queryFramesByDate(db, date) {
  return dbAll(db, 'SELECT * FROM matrix WHERE date = ? ORDER BY timestamp ASC', [date]);
}

/**
 * 查询所有不重复的采集标签列表
 * @param {sqlite3.Database} db - 数据库实例
 * @returns {Promise<string[]>}
 */
async function queryDateLabels(db) {
  const rows = await dbAll(db, 'SELECT DISTINCT date FROM matrix ORDER BY date DESC');
  return rows.map((r) => r.date);
}

/**
 * 删除指定标签的所有帧数据
 * @param {sqlite3.Database} db - 数据库实例
 * @param {string} date - 采集标签
 * @returns {Promise<{changes: number}>}
 */
function deleteFramesByDate(db, date) {
  return dbRun(db, 'DELETE FROM matrix WHERE date = ?', [date]);
}

/**
 * 创建 matrix 表（如果不存在）
 * @param {sqlite3.Database} db - 数据库实例
 * @returns {Promise<void>}
 */
function ensureMatrixTable(db) {
  const sql = `CREATE TABLE IF NOT EXISTS matrix (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT,
    timestamp INTEGER,
    date TEXT
  )`;
  return dbRun(db, sql);
}

/**
 * 安全关闭数据库连接
 * @param {sqlite3.Database} db
 * @returns {Promise<void>}
 */
function closeDb(db) {
  return new Promise((resolve) => {
    if (!db) { resolve(); return; }
    db.close((err) => {
      if (err) logger.warn('关闭数据库时出现警告', err.message);
      resolve();
    });
  });
}

module.exports = {
  dbRun,
  dbAll,
  dbGet,
  genDb,
  initDatabases,
  insertFrame,
  queryFramesByDate,
  queryDateLabels,
  deleteFramesByDate,
  ensureMatrixTable,
  closeDb,
};
