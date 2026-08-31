/**
 * 历史查询服务。
 *
 * 统一封装 matrix 表的索引保障、prepared statement 缓存、日期列表查询、
 * 历史行分页查询和大数据懒加载代理，避免 server.js 直接拼 SQL。
 */
const historyStmtCache = new WeakMap();

/**
 * 获取 sqlite 兼容包装对象中的原生数据库连接。
 *
 * @param {object} dbRef 数据库句柄或兼容包装对象。
 * @returns {object | null} 原生数据库连接。
 */
function getNativeDb(dbRef) {
  return dbRef && (dbRef._db || dbRef.db || null);
}

/**
 * 获取并缓存历史查询 prepared statement。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} sql SQL 语句。
 * @returns {object} prepared statement。
 */
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

/**
 * 查询指定日期的历史行。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 历史日期标签。
 * @param {number} limit 最大返回条数。
 * @param {number} offset 偏移量。
 * @param {object} logger 日志对象。
 * @returns {Array<object>} 历史行列表。
 */
function queryHistoryRows(dbRef, date, limit, offset = 0, logger) {
  if (!dbRef || !date || limit <= 0) return [];
  ensureHistoryIndexes(dbRef, logger);
  return dbAllHistory(
    dbRef,
    'SELECT * FROM matrix WHERE date = ? ORDER BY id ASC LIMIT ? OFFSET ?',
    [date, limit, Math.max(0, offset)],
  );
}

/**
 * 查询指定日期前几帧时间戳，用于估算历史回放帧间隔。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 历史日期标签。
 * @param {number} limit 采样条数。
 * @param {object} logger 日志对象。
 * @returns {Array<number>} 时间戳数组。
 */
function queryHistoryTimestampSample(dbRef, date, limit = 21, logger) {
  return queryHistoryRows(dbRef, date, limit, 0, logger)
    .map((row) => row.timestamp)
    .filter((value) => value != null);
}

/**
 * 查询历史采集日期列表。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {number} limit 最大返回条数。
 * @param {number} offset 偏移量。
 * @param {object} logger 日志对象。
 * @returns {Array<object>} 日期行列表。
 */
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

/**
 * 从指定 ID 开始读取历史行，用于分页或懒加载补充。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 历史日期标签。
 * @param {number} minId 起始 ID。
 * @param {number} limit 最大返回条数。
 * @param {object} logger 日志对象。
 * @returns {Array<object>} 历史行列表。
 */
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

  /**
   * 按下标取一行，带 LRU 缓存。
   *
   * **下标 → id 的换算是 `minId + index`，这依赖「同一天的 id 连续无空洞」。**
   * 用 `id >= ?` + `LIMIT 1` 而不是 `id = ?` 就是为了容忍空洞（删过行、写入失败过）：
   * 有空洞时会取到下一条存在的行，序列会略微错位但**不会返回 undefined 让回放中断**。
   * 这是刻意选的降级方向 —— 回放画面轻微跳一帧，比整条曲线断掉好。
   *
   * 越界/无效下标返回 `undefined` 而不抛：数组语义就是这样，
   * 调用方（回放推帧、曲线遍历）本来就在用 `if (row)` 判断。
   *
   * 缓存是 512 条的**近似 LRU**：满了就删 `keys().next().value`，也就是**最早插入**的那条
   * （Map 保持插入顺序），而不是最久未访问的 —— 命中时没有把该键重新插到队尾。
   * 严格 LRU 需要每次命中都 delete+set，对拖进度条这种「局部顺序访问」的模式收益很小，
   * 所以没做。512 × 一帧的行大小是这个代理的内存上限。
   *
   * ⚠️ 每次未命中都是一次**同步**数据库查询（见 sqlite3-compat 的说明），
   * 会阻塞事件循环。所以顺序遍历一个几十万行的懒加载序列会让后端卡住 ——
   * 遍历全序列的场景（如算整段曲线）应该走 eager 路径或分批。
   *
   * @param {number} index 行下标。
   * @returns {object|undefined} 历史行；越界或查不到时 undefined。
   */
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
    /**
     * 把「读数组」翻译成「查数据库」。
     *
     * 代理的目标是一个**真空数组** `[]`，所以任何没被下面几条拦住的属性
     * （`map`/`filter`/`slice`/`forEach`…）都会落到 `target[prop]`，也就是**空数组的方法**。
     * ⚠️ 这是本代理最大的限制：`rows.map(...)` 不会报错，它会返回 `[]` ——
     * 静默地把几十万帧当成零帧。调用方要么用下标循环、要么用 `for...of`
     * （`Symbol.iterator` 有实现），**不能用数组高阶方法**。
     * `historySessionService` 里那条「lazy 模式下曲线可能只覆盖一部分」的注记就是这个原因。
     *
     * 拦截的四类：
     * - `length` —— 来自 COUNT，不是真数组长度（真数组是空的）。
     * - 三个 `__` 前缀标记 —— 给调用方判断「这是懒加载的」以及从哪个库/哪天来的。
     *   用属性而不是 `instanceof` 是因为代理伪装成数组，没有自己的原型可认。
     * - `Symbol.iterator` —— 让 `for...of` 和展开可用。⚠️ 展开（`[...rows]`）会把整段
     *   历史逐行查出来放进内存，正好抵消懒加载的意义，不要这么用。
     * - 纯数字字符串下标 —— 正则 `^\d+$` 精确匹配，所以 `'1.5'`、`'-1'`、`'01'` 都不算
     *   （`'01'` 会落到 target 返回 undefined）。这与真数组的下标语义一致。
     *
     * 只实现了 `get`，没有 `set`/`has`/`ownKeys`：历史数据是只读的，
     * 写入会落到那个空数组上并被静默忽略。
     */
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

/**
 * 根据数据规模选择立即加载或懒加载历史行。
 *
 * @param {object} dbRef 数据库句柄。
 * @param {string} date 历史日期标签。
 * @param {{ count: number, minId: number }} stats 历史统计信息。
 * @param {boolean} eager 是否立即加载全部行。
 * @param {object} logger 日志对象。
 * @returns {Array<object>} 历史行数组或懒加载代理。
 */
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
