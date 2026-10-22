/**
 * 采集入库队列服务。
 *
 * 将实时帧入库请求按数据库连接聚合，优先使用 better-sqlite3 transaction
 * 批量写入；兼容旧 sqlite3 异步 run 接口，并统一把写入错误回调给上层。
 */

/**
 * 获取 sqlite 兼容包装对象中的原生数据库连接。
 *
 * @param {object} dbRef 数据库句柄或兼容包装对象。
 * @returns {object | null} 原生数据库连接。
 */
function getNativeDb(dbRef) {
  return dbRef && (dbRef._db || dbRef.db || (typeof dbRef.prepare === 'function' ? dbRef : null));
}

/**
 * 创建采集入库队列，统一处理批量写入、定时 flush 和数据库错误回调。
 *
 * @param {{ sql: string, batchSize: number, flushIntervalMs: number, onError?: Function }} options 队列配置。
 * @returns {{ enqueue: Function, flushAll: Function, flushQueue: Function, getStats: Function }} 入库队列及只读计数。
 */
function createCollectionInsertQueueService({
  sql,
  batchSize = 200,
  flushIntervalMs = 250,
  onError,
  onSettled,
} = {}) {
  const queues = new Set();
  const queueByDb = new WeakMap();
  let flushTimer = null;
  const stats = { queued: 0, written: 0, failed: 0, pending: 0, exact: true };
  const settledRows = new WeakSet();

  /**
   * 获取指定数据库连接对应的队列，不存在时延迟创建。
   *
   * @param {object} dbRef 数据库连接。
   * @param {'sit' | 'back' | 'head'} channel 采集通道。
   * @returns {object | null} 队列对象。
   */
  function getQueue(dbRef, channel = 'sit') {
    if (!dbRef) return null;
    let queue = queueByDb.get(dbRef);
    if (!queue) {
      queue = {
        dbRef,
        channel,
        rows: [],
        flushing: false,
        stmt: null,
        tx: null,
        rowContexts: new WeakMap(),
        rowChannels: new WeakMap(),
      };
      queueByDb.set(dbRef, queue);
      queues.add(queue);
    }
    queue.channel = channel || queue.channel;
    return queue;
  }

  /**
   * 确保定时 flush 已启动；unref 后不会阻止 Node 进程退出。
   */
  function ensureFlushTimer() {
    if (flushTimer) return;
    flushTimer = setInterval(flushAll, flushIntervalMs);
    if (typeof flushTimer.unref === 'function') {
      flushTimer.unref();
    }
  }

  /**
   * 将数据库写入错误交给业务层处理。
   *
   * @param {Error | null} error 写入错误。
   * @param {string} channel 采集通道。
   */
  function reportError(error, channel) {
    if (!error) return;
    try { onError?.(error, channel); } catch { /* Observers cannot change completed SQL outcomes. */ }
  }

  /**
   * 立即 flush 单个数据库队列。
   *
   * @param {object} queue 队列对象。
   */
  function flushQueue(queue) {
    if (!queue || queue.flushing || queue.rows.length === 0) return;
    const rows = queue.rows.splice(0, queue.rows.length);
    queue.flushing = true;
    const nativeDb = getNativeDb(queue.dbRef);
    if (nativeDb && typeof nativeDb.transaction === 'function' && typeof nativeDb.prepare === 'function') {
      let error = null;
      try {
        if (!queue.stmt) queue.stmt = nativeDb.prepare(sql);
        if (!queue.tx) queue.tx = nativeDb.transaction((batchRows) => {
          let written = 0;
          for (const params of batchRows) {
            const result = queue.stmt.run(...params);
            written += Number.isFinite(result?.changes) ? result.changes : 1;
          }
          return written;
        });
        const written = queue.tx(rows);
        if (Number.isFinite(written)) stats.written += written;
        else stats.exact = false;
      } catch (cause) { error = cause; }
      // SQL has committed or rolled back before observers run; observer exceptions cannot reverse it.
      for (const params of rows) settleRow(queue, params, !error, 0);
      queue.flushing = false;
      if (error) reportError(error, queue.channel);
    } else {
      stats.exact = false;
      for (const params of rows) {
        try {
          queue.dbRef.run(sql, params, function onRun(error) {
            settleRow(queue, params, !error, Number.isFinite(this?.changes) ? this.changes : 1);
            reportError(error, queue.rowChannels.get(params));
          });
        } catch (error) {
          settleRow(queue, params, false, 0);
          reportError(error, queue.rowChannels.get(params));
        }
      }
      queue.flushing = false;
    }
  }

  /** Settle each queued row once; callbacks and diagnostic observers cannot double-count it. */
  function settleRow(queue, params, ok, written) {
    if (settledRows.has(params)) return;
    settledRows.add(params); stats.pending = Math.max(0, stats.pending - 1);
    if (ok) stats.written += written;
    else stats.failed++;
    try { onSettled?.(queue.rowContexts.get(params), ok); } catch { /* Committed writes remain committed. */ }
  }

  /**
   * flush 当前所有数据库队列。
   */
  function flushAll() {
    queues.forEach(flushQueue);
  }

  /**
   * 将一条 SQL 参数加入对应数据库队列，达到批量阈值时立即写入。
   *
   * @param {object} dbRef 数据库连接。
   * @param {unknown[]} params SQL 参数数组。
   * @param {'sit' | 'back' | 'head'} channel 采集通道。
   */
  function enqueue(dbRef, params, channel = 'sit', context = null) {
    const queue = getQueue(dbRef, channel);
    if (!queue || !Array.isArray(params)) {
      stats.queued++; stats.failed++;
      try { onSettled?.(context, false); } catch { /* No database means this row did not commit. */ }
      reportError(new Error(!queue ? 'Collection database is unavailable' : 'Collection SQL parameters are invalid'), channel);
      return false;
    }
    params = [...params];
    queue.rows.push(params);
    queue.rowChannels.set(params, channel);
    if (context && params && typeof params === 'object') queue.rowContexts.set(params, context);
    stats.queued++; stats.pending++;
    ensureFlushTimer();
    if (queue.rows.length >= batchSize) {
      flushQueue(queue);
    }
    return true;
  }

  return {
    enqueue,
    flushAll,
    flushQueue,
    /** Return counts only; queued rows and SQL values never leave the writer. */
    getStats: () => ({ ...stats }),
  };
}

module.exports = {
  createCollectionInsertQueueService,
  getNativeDb,
};
