/**
 * dbManager.js - 数据库初始化和管理
 *
 * 从 server.js 中提取的数据库相关函数。
 * 负责 SQLite 数据库的创建、初始化和连接管理。
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const sqlite3 = require("../sqlite3-compat").verbose();
const logger = require('../logger');
const { isCar } = require('../util');

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

  if (isCar(fileStr)) {
    db = genDb(`${filePath}/${fileStr}sit.db`, filePath, runtimeResourceRoot);
    db1 = genDb(`${filePath}/${fileStr}back.db`, filePath, runtimeResourceRoot);
  } else if (fileStr === 'volvo') {
    db = genDb(`${filePath}/${fileStr}sit.db`, filePath, runtimeResourceRoot);
    db1 = genDb(`${filePath}/${fileStr}back.db`, filePath, runtimeResourceRoot);
    db2 = genDb(`${filePath}/${fileStr}head.db`, filePath, runtimeResourceRoot);
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
  try {
    fs.accessSync(file);
    return new sqlite3.Database(file);
  } catch (err) {
    logger.warn('Database file not found, creating from template:', file);
    const initCandidates = [
      path.join(filePath, "init.db"),
      path.join(runtimeResourceRoot, "db", "init.db"),
      path.join(runtimeResourceRoot, "init.db"),
      path.join(__dirname, "..", "db", "init.db"),
      path.join(app.getAppPath(), "db", "init.db"),
    ];
    const initDbPath = initCandidates.find((candidate) => fs.existsSync(candidate));
    if (!initDbPath) {
      throw new Error(`init.db not found. checked: ${initCandidates.join(", ")}`);
    }
    const data = fs.readFileSync(initDbPath);
    fs.writeFileSync(file, data);
    return new sqlite3.Database(file);
  }
}

module.exports = {
  initDb,
  genDb,
};
