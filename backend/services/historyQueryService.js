const historyStmtCache = new WeakMap();

function getNativeDb(dbRef) {
  return dbRef && (dbRef._db || dbRef.db || null);
}

function getHistoryStmt(dbRef, sql) {
  const nativeDb = getNativeDb(dbRef);
  if (!nativeDb || typeof nativeDb.prepare !== 'function') {
    throw new Error('invalid history database handle');
  }

  let cache = historyStmtCache.get(nativeDb);
  if (!cache) {
    cache = new Map();
    historyStmtCache.set(nativeDb, cache);
  }

  if (!cache.has(sql)) {
    cache.set(sql, nativeDb.prepare(sql));
  }

  return cache.get(sql);
}

/**
 * 执行历史数据单行查询，并复用 prepared statement。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} sql SQL 语句。
 * @param {Array<unknown>} params 查询参数。
 * @returns {object | undefined} 查询结果。
 */
function dbGetHistory(dbRef, sql, params = []) {
  return getHistoryStmt(dbRef, sql).get(...params);
}

/**
 * 执行历史数据列表查询，并复用 prepared statement。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} sql SQL 语句。
 * @param {Array<unknown>} params 查询参数。
 * @returns {Array<object>} 查询结果列表。
 */
function dbAllHistory(dbRef, sql, params = []) {
  return getHistoryStmt(dbRef, sql).all(...params);
}

/**
 * 确保历史数据表存在按 date/id 查询的索引。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {object} logger 日志对象。
 * @returns {void}
 */
function ensureHistoryIndexes(dbRef, logger) {
  const nativeDb = getNativeDb(dbRef);
  if (!nativeDb || typeof nativeDb.exec !== 'function') return;
  try {
    nativeDb.exec('CREATE INDEX IF NOT EXISTS idx_matrix_date_id ON matrix(date, id)');
  } catch (error) {
    logger?.warn?.('[History] failed to ensure index:', error.message || error);
  }
}

/**
 * 查询指定历史日期的数据量和 ID 范围。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 历史日期标签。
 * @param {object} logger 日志对象。
 * @returns {{ count: number, minId: number, maxId: number }} 历史统计信息。
 */
function getHistoryStats(dbRef, date, logger) {
  if (!dbRef || !date) return { count: 0, minId: 0, maxId: 0 };
  ensureHistoryIndexes(dbRef, logger);
  const row = dbGetHistory(
    dbRef,
    'SELECT COUNT(*) AS count, MIN(id) AS minId, MAX(id) AS maxId FROM matrix WHERE date = ?',
    [date],
  ) || {};

  return {
    count: Number(row.count || 0),
    minId: Number(row.minId || 0),
    maxId: Number(row.maxId || 0),
  };
}

function queryHistoryRows(dbRef, date, limit, offset = 0, logger) {
  if (!dbRef || !date || limit <= 0) return [];
  ensureHistoryIndexes(dbRef, logger);
  return dbAllHistory(
    dbRef,
    'SELECT * FROM matrix WHERE date = ? ORDER BY id ASC LIMIT ? OFFSET ?',
    [date, limit, Math.max(0, offset)],
  );
}

function queryHistoryTimestampSample(dbRef, date, limit = 21, logger) {
  return queryHistoryRows(dbRef, date, limit, 0, logger)
    .map((row) => row.timestamp)
    .filter((value) => value != null);
}

function queryHistoryDates(dbRef, limit = 500, offset = 0, logger) {
  if (!dbRef) return [];
  try {
    return dbAllHistory(
      dbRef,
      'SELECT DISTINCT date FROM matrix ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [Math.max(0, Number(limit) || 500), Math.max(0, Number(offset) || 0)],
    );
  } catch (error) {
    logger?.error?.('[History] failed to query history dates:', error);
    return [];
  }
}

function queryHistoryRowsFromId(dbRef, date, minId, limit, logger) {
  if (!dbRef || !date || !minId || limit <= 0) return [];
  ensureHistoryIndexes(dbRef, logger);
  return dbAllHistory(
    dbRef,
    'SELECT * FROM matrix WHERE date = ? AND id >= ? ORDER BY id ASC LIMIT ?',
    [date, minId, limit],
  );
}

/**
 * 创建懒加载历史行代理，避免大采集数据一次性读入内存。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 历史日期标签。
 * @param {{ count: number, minId: number }} stats 历史统计信息。
 * @returns {Array<object>} 兼容数组读取的懒加载代理。
 */
function createLazyHistoryRows(dbRef, date, stats) {
  const cache = new Map();
  const maxCacheSize = 512;
  const lengthValue = Number(stats?.count || 0);
  const minId = Number(stats?.minId || 0);

  const readByIndex = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= lengthValue || !minId) return undefined;
    if (cache.has(index)) return cache.get(index);

    const row = dbGetHistory(
      dbRef,
      'SELECT * FROM matrix WHERE date = ? AND id >= ? ORDER BY id ASC LIMIT 1',
      [date, minId + index],
    );

    if (cache.size >= maxCacheSize) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    cache.set(index, row);
    return row;
  };

  return new Proxy([], {
    get(target, prop) {
      if (prop === 'length') return lengthValue;
      if (prop === '__lazyHistoryRows') return true;
      if (prop === '__historyDate') return date;
      if (prop === '__historyDb') return dbRef;
      if (prop === Symbol.iterator) {
        return function* lazyIterator() {
          for (let i = 0; i < lengthValue; i++) {
            yield readByIndex(i);
          }
        };
      }
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        return readByIndex(Number(prop));
      }
      return target[prop];
    },
  });
}

function createHistoryRowsForPlayback(dbRef, date, stats, eager, logger) {
  if (!stats?.count) return [];
  return eager
    ? queryHistoryRows(dbRef, date, stats.count, 0, logger)
    : createLazyHistoryRows(dbRef, date, stats);
}

module.exports = {
  createHistoryRowsForPlayback,
  createLazyHistoryRows,
  dbAllHistory,
  dbGetHistory,
  ensureHistoryIndexes,
  getHistoryStats,
  getHistoryStmt,
  getNativeDb,
  queryHistoryRows,
  queryHistoryRowsFromId,
  queryHistoryDates,
  queryHistoryTimestampSample,
};
