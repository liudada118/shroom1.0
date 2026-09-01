/**
 * dbManager.js - 数据库初始化和管理
 *
 * 从 server.js 中提取的数据库相关函数。
 * 负责 SQLite 数据库的创建、初始化和连接管理。
 */

const fs = require('fs');
const path = require('path');
let electronApp = null;
try {
  ({ app: electronApp } = require('electron'));
} catch {}
const sqlite3 = require('./sqlite3-compat').verbose();
const logger = require('../../common/logger');
const { isCar } = require('../../compatibility/legacyDataUtils');
const { multiSensorStableContract } = require('@shroom/backend/contract');

const CHANNEL_HISTORY_COLUMNS = Object.freeze(
  multiSensorStableContract.storage.identityColumns.map((column) => Object.freeze([...column])),
);

/**
 * 为旧 matrix 表补齐按通道存储所需的可空列。
 *
 * 旧三列 INSERT 不受影响；partial index 只索引新 canonical 行，避免升级数 GB 旧库时
 * 为全部 `channel_id IS NULL` 的历史数据构建无用索引。
 *
 * @param {object} dbRef sqlite3-compat 数据库句柄或 better-sqlite3 连接。
 * @returns {object} 原数据库句柄。
 */
function ensureChannelHistorySchema(dbRef) {
  const nativeDb = dbRef?._db || dbRef?.db || dbRef;
  if (!nativeDb || typeof nativeDb.prepare !== 'function' || typeof nativeDb.exec !== 'function') {
    throw new TypeError('channel history schema requires a SQLite database handle');
  }

  const migrate = () => {
    nativeDb.exec(`CREATE TABLE IF NOT EXISTS matrix (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT,
      timestamp INTEGER,
      date TEXT
    )`);

    const existingColumns = new Set(
      nativeDb.prepare('PRAGMA table_info(matrix)').all().map((column) => column.name),
    );
    CHANNEL_HISTORY_COLUMNS.forEach(([name, type]) => {
      if (!existingColumns.has(name)) {
        nativeDb.exec(`ALTER TABLE matrix ADD COLUMN ${name} ${type} NULL`);
      }
    });

    nativeDb.exec(`CREATE INDEX IF NOT EXISTS idx_matrix_date_channel_id_id
      ON matrix(date, channel_id, id)
      WHERE channel_id IS NOT NULL`);
  };

  if (typeof nativeDb.transaction === 'function') {
    nativeDb.transaction(migrate)();
  } else {
    migrate();
  }
  return dbRef;
}

/**
 * 打开数据库并在返回给调用方前完成通道历史 schema 迁移。
 *
 * @param {string} file 数据库文件路径。
 * @returns {object} 已准备好的数据库句柄。
 */
function openDb(file) {
  return ensureChannelHistorySchema(new sqlite3.Database(file));
}

/**
 * 初始化数据库
 * @param {string} fileStr - 传感器类型
 * @param {string} filePath - 数据库文件目录
 * @param {string} runtimeResourceRoot - 运行时资源根目录
 * @returns {{ db: sqlite3.Database, db1?: sqlite3.Database, db2?: sqlite3.Database }}
 */
function initDb(fileStr, filePath, runtimeResourceRoot) {
  logger.debug('initDb: ' + fileStr);
  let db, db1, db2;

  if (fileStr === 'volvo' || fileStr === 'wholeChair') {
    db = genDb(`${filePath}/${fileStr}sit.db`, filePath, runtimeResourceRoot);
    db1 = genDb(`${filePath}/${fileStr}back.db`, filePath, runtimeResourceRoot);
    db2 = genDb(`${filePath}/${fileStr}head.db`, filePath, runtimeResourceRoot);
  } else if (isCar(fileStr)) {
    db = genDb(`${filePath}/${fileStr}sit.db`, filePath, runtimeResourceRoot);
    db1 = genDb(`${filePath}/${fileStr}back.db`, filePath, runtimeResourceRoot);
  } else {
    db = genDb(`${filePath}/${fileStr}.db`, filePath, runtimeResourceRoot);
  }

  return { db, db1, db2 };
}

/**
 * 创建或打开数据库文件
 * 如果文件不存在，从 init.db 模板复制创建
 * @param {string} file - 数据库文件路径
 * @param {string} filePath - 数据库目录
 * @param {string} runtimeResourceRoot - 运行时资源根目录
 * @returns {sqlite3.Database}
 */
function genDb(file, filePath, runtimeResourceRoot) {
  let exists = true;
  try {
    fs.accessSync(file);
  } catch (err) {
    exists = false;
  }

  if (!exists) {
    logger.warn('Database file not found, creating from template:', file);
    const initCandidates = [
      path.join(filePath, "init.db"),
      path.join(runtimeResourceRoot, "db", "init.db"),
      path.join(runtimeResourceRoot, "init.db"),
      path.join(__dirname, "../../..", "db", "init.db"),
      electronApp ? path.join(electronApp.getAppPath(), "db", "init.db") : null,
    ].filter(Boolean);
    const initDbPath = initCandidates.find((candidate) => fs.existsSync(candidate));
    if (!initDbPath) {
      throw new Error(`init.db not found. checked: ${initCandidates.join(", ")}`);
    }
    const data = fs.readFileSync(initDbPath);
    fs.writeFileSync(file, data);
  }

  return openDb(file);
}

module.exports = {
  CHANNEL_HISTORY_COLUMNS,
  ensureChannelHistorySchema,
  initDb,
  genDb,
};
