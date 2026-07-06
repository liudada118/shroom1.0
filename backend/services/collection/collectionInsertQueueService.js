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
  return dbRef && (dbRef._db || dbRef.db || null);
}

/**
 * 创建采集入库队列，统一处理批量写入、定时 flush 和数据库错误回调。
 *
 * @param {{ sql: string, batchSize: number, flushIntervalMs: number, onError?: Function }} options 队列配置。
 * @returns {{ enqueue: Function, flushAll: Function, flushQueue: Function }} 入库队列服务。
 */
function createCollectionInsertQueueService({
  sql,
  batchSize = 200,
  flushIntervalMs = 250,
  onError,
} = {}) {
  const queues = new Set();
  const queueByDb = new WeakMap();
  let flushTimer = null;

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
    if (typeof onError === 'function') {
      onError(error, channel);
    }
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

    try {
      const nativeDb = getNativeDb(queue.dbRef);
      if (nativeDb && typeof nativeDb.transaction === 'function' && typeof nativeDb.prepare === 'function') {
        if (!queue.stmt) {
          queue.stmt = nativeDb.prepare(sql);
        }
        if (!queue.tx) {
          queue.tx = nativeDb.transaction((batchRows) => {
            for (const params of batchRows) {
              queue.stmt.run(...params);
            }
          });
        }
        queue.tx(rows);
      } else {
        for (const params of rows) {
          queue.dbRef.run(sql, params, function onRun(error) {
            reportError(error, queue.channel);
          });
        }
      }
    } catch (error) {
      reportError(error, queue.channel);
    } finally {
      queue.flushing = false;
    }
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
  function enqueue(dbRef, params, channel = 'sit') {
    const queue = getQueue(dbRef, channel);
    if (!queue) return;

    queue.rows.push(params);
    if (queue.rows.length >= batchSize) {
      flushQueue(queue);
    } else {
      ensureFlushTimer();
    }
  }

  return {
    enqueue,
    flushAll,
    flushQueue,
  };
}

module.exports = {
  createCollectionInsertQueueService,
  getNativeDb,
};
