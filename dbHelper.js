/**
 * dbHelper.js - 数据库操作工具模块 (better-sqlite3 版本)
 *
 * 从 sqlite3（异步回调式）迁移到 better-sqlite3（同步式）
 *
 * 优势:
 * 1. 同步 API：代码线性执行，无回调地狱，无需 Promise 包装
 * 2. 性能提升：better-sqlite3 比 sqlite3 快 5-10 倍（批量插入场景）
 * 3. 事务支持：内置 transaction() 方法，批量操作原子性保证
 * 4. WAL 模式：支持并发读写，提升高频数据采集场景的吞吐量
 * 5. Prepared Statements：自动缓存预编译语句，减少 SQL 解析开销
 *
 * 兼容说明:
 * - 保留了与旧版相同的 module.exports 接口名称
 * - 原有的 Promise 返回值改为同步返回，调用方需去除 await
 * - 提供了 DatabaseManager 类作为新的推荐用法
 */

const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");
const logger = require("./logger");

// ─── DatabaseManager 类（推荐用法）──────────────────────────────────────────

class DatabaseManager {
  /**
   * @param {string} dbPath - 数据库文件路径
   * @param {object} options - 配置选项
   * @param {boolean} options.verbose - 是否输出 SQL 日志
   * @param {boolean} options.wal - 是否启用 WAL 模式（默认 true）
   */
  constructor(dbPath, options = {}) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.dbPath = dbPath;
    this.db = new Database(dbPath, {
      verbose: options.verbose ? console.log : undefined,
    });

    // 启用 WAL 模式：允许并发读写，显著提升写入性能
    if (options.wal !== false) {
      this.db.pragma("journal_mode = WAL");
    }

    // 性能优化 pragma
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("cache_size = -64000"); // 64MB 缓存
    this.db.pragma("temp_store = MEMORY");

    // 预编译语句缓存
    this._stmtCache = new Map();
  }

  /**
   * 获取或创建预编译语句（自动缓存）
   * @param {string} sql - SQL 语句
   * @returns {Statement}
   */
  _getStmt(sql) {
    if (!this._stmtCache.has(sql)) {
      this._stmtCache.set(sql, this.db.prepare(sql));
    }
    return this._stmtCache.get(sql);
  }

  /** 执行写操作（INSERT / UPDATE / DELETE） */
  run(sql, params = []) {
    const stmt = this._getStmt(sql);
    const result = stmt.run(...params);
    return { lastID: result.lastInsertRowid, changes: result.changes };
  }

  /** 查询多行 */
  all(sql, params = []) {
    const stmt = this._getStmt(sql);
    return stmt.all(...params);
  }

  /** 查询单行 */
  get(sql, params = []) {
    const stmt = this._getStmt(sql);
    return stmt.get(...params);
  }

  /** 执行原始 SQL（建表等 DDL 操作） */
  exec(sql) {
    return this.db.exec(sql);
  }

  /**
   * 批量插入（事务包裹，性能提升 50-100 倍）
   * @param {string} sql - INSERT SQL 语句
   * @param {Array<Array>} paramsList - 参数数组的数组
   * @returns {number} 插入的行数
   */
  insertBatch(sql, paramsList) {
    if (paramsList.length === 0) return 0;
    const stmt = this._getStmt(sql);
    const insertMany = this.db.transaction((list) => {
      for (const params of list) {
        stmt.run(...params);
      }
    });
    insertMany(paramsList);
    return paramsList.length;
  }

  /** 关闭数据库 */
  close() {
    this._stmtCache.clear();
    this.db.close();
    logger.info(`数据库已关闭: ${path.basename(this.dbPath)}`);
  }
}

// ─── 兼容旧接口的函数（供 server.js 平滑迁移）──────────────────────────────

/**
 * 生成数据库实例：若目标文件不存在，则从 init.db 模板复制后连接
 * @param {string} dbPath - 目标数据库文件路径
 * @param {string} templatePath - 模板数据库文件路径
 * @returns {DatabaseManager}
 */
function genDb(dbPath, templatePath) {
  try {
    fs.accessSync(dbPath);
  } catch {
    logger.info(`数据库不存在，从模板创建: ${path.basename(dbPath)}`);
    const data = fs.readFileSync(templatePath);
    fs.writeFileSync(dbPath, data);
  }
  return new DatabaseManager(dbPath);
}

/**
 * 根据传感器类型初始化数据库集合
 * @param {string} sensorType - 传感器类型标识符
 * @param {string} dbDir - 数据库文件目录
 * @param {function} isCarFn - 判断是否为汽车类型的函数
 * @returns {{ db: DatabaseManager, db1?: DatabaseManager, db2?: DatabaseManager }}
 */
function initDatabases(sensorType, dbDir, isCarFn) {
  const templatePath = path.join(dbDir, "init.db");
  let db, db1, db2;

  if (isCarFn(sensorType)) {
    db = genDb(path.join(dbDir, `${sensorType}sit.db`), templatePath);
    db1 = genDb(path.join(dbDir, `${sensorType}back.db`), templatePath);
    logger.info(`已初始化汽车双库: ${sensorType}sit.db, ${sensorType}back.db`);
  } else if (sensorType === "volvo") {
    db = genDb(path.join(dbDir, `${sensorType}sit.db`), templatePath);
    db1 = genDb(path.join(dbDir, `${sensorType}back.db`), templatePath);
    db2 = genDb(path.join(dbDir, `${sensorType}head.db`), templatePath);
    logger.info(`已初始化 Volvo 三库: sit/back/head`);
  } else {
    db = genDb(path.join(dbDir, `${sensorType}.db`), templatePath);
    logger.info(`已初始化单库: ${sensorType}.db`);
  }

  return { db, db1, db2 };
}

// ─── 业务操作封装（同步版本）──────────────────────────────────────────────────

/**
 * 向 matrix 表插入一帧压力数据
 * @param {DatabaseManager} db - 数据库管理器实例
 * @param {string} date - 采集标签（时间戳字符串）
 * @param {Array} dataArr - 压力矩阵数组
 * @returns {{ lastID: number, changes: number }}
 */
function insertFrame(db, date, dataArr) {
  const timestamp = Date.now();
  const sql = "INSERT INTO matrix (data, timestamp, date) VALUES (?, ?, ?)";
  return db.run(sql, [JSON.stringify(dataArr), timestamp, date]);
}

/**
 * 批量插入多帧数据（事务包裹，性能提升 50-100 倍）
 * @param {DatabaseManager} db - 数据库管理器实例
 * @param {string} date - 采集标签
 * @param {Array<Array>} frames - 多帧压力矩阵数组
 * @returns {number} 插入的行数
 */
function insertFramesBatch(db, date, frames) {
  const sql = "INSERT INTO matrix (data, timestamp, date) VALUES (?, ?, ?)";
  const paramsList = frames.map((dataArr) => [
    JSON.stringify(dataArr),
    Date.now(),
    date,
  ]);
  return db.insertBatch(sql, paramsList);
}

/**
 * 查询指定标签下的所有帧数据
 * @param {DatabaseManager} db - 数据库管理器实例
 * @param {string} date - 采集标签
 * @returns {Array}
 */
function queryFramesByDate(db, date) {
  return db.all(
    "SELECT * FROM matrix WHERE date = ? ORDER BY timestamp ASC",
    [date]
  );
}

/**
 * 查询所有不重复的采集标签列表
 * @param {DatabaseManager} db - 数据库管理器实例
 * @returns {string[]}
 */
function queryDateLabels(db) {
  const rows = db.all(
    "SELECT DISTINCT date FROM matrix ORDER BY date DESC"
  );
  return rows.map((r) => r.date);
}

/**
 * 删除指定标签的所有帧数据
 * @param {DatabaseManager} db - 数据库管理器实例
 * @param {string} date - 采集标签
 * @returns {{ changes: number }}
 */
function deleteFramesByDate(db, date) {
  return db.run("DELETE FROM matrix WHERE date = ?", [date]);
}

/**
 * 创建 matrix 表（如果不存在）
 * @param {DatabaseManager} db - 数据库管理器实例
 */
function ensureMatrixTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS matrix (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT,
    timestamp INTEGER,
    date TEXT
  )`);
}

/**
 * 安全关闭数据库连接
 * @param {DatabaseManager} db
 */
function closeDb(db) {
  if (db && typeof db.close === "function") {
    db.close();
  }
}

// ─── 兼容旧版 Promise 接口的包装器 ──────────────────────────────────────────
// 供尚未迁移的代码使用，返回 resolved Promise 以兼容 await 调用

function dbRun(db, sql, params = []) {
  return Promise.resolve(db.run(sql, params));
}

function dbAll(db, sql, params = []) {
  return Promise.resolve(db.all(sql, params));
}

function dbGet(db, sql, params = []) {
  return Promise.resolve(db.get(sql, params));
}

module.exports = {
  DatabaseManager,
  dbRun,
  dbAll,
  dbGet,
  genDb,
  initDatabases,
  insertFrame,
  insertFramesBatch,
  queryFramesByDate,
  queryDateLabels,
  deleteFramesByDate,
  ensureMatrixTable,
  closeDb,
};
