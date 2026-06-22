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

  function ensureFlushTimer() {
    if (flushTimer) return;
    flushTimer = setInterval(flushAll, flushIntervalMs);
    if (typeof flushTimer.unref === 'function') {
      flushTimer.unref();
    }
  }

  function reportError(error, channel) {
    if (typeof onError === 'function') {
      onError(error, channel);
    }
  }

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

  function flushAll() {
    queues.forEach(flushQueue);
  }

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
