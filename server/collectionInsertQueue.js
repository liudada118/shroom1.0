function createCollectionInsertQueue({
  sql,
  batchSize = 200,
  flushIntervalMs = 250,
  onError,
} = {}) {
  const queues = new Set();
  const queueByDb = new WeakMap();
  const normalizedBatchSize = Math.max(1, Number(batchSize) || 200);
  const normalizedFlushIntervalMs = Math.max(1, Number(flushIntervalMs) || 250);
  let timer = null;

  function report(error, channel) {
    if (error && typeof onError === "function") {
      onError(error, channel);
    }
  }

  function getQueue(dbRef, channel) {
    if (!dbRef) return null;
    let queue = queueByDb.get(dbRef);
    if (!queue) {
      queue = {
        dbRef,
        channel,
        rows: [],
        flushing: false,
        stmt: null,
        transaction: null,
      };
      queueByDb.set(dbRef, queue);
      queues.add(queue);
    }
    queue.channel = channel || queue.channel;
    return queue;
  }

  function flushQueue(queue) {
    if (!queue || queue.flushing || queue.rows.length === 0) return;
    const rows = queue.rows.splice(0);
    queue.flushing = true;
    try {
      const nativeDb = queue.dbRef._db || queue.dbRef.db;
      if (nativeDb?.prepare && nativeDb?.transaction) {
        queue.stmt ||= nativeDb.prepare(sql);
        queue.transaction ||= nativeDb.transaction((batch) => {
          batch.forEach((params) => queue.stmt.run(...params));
        });
        queue.transaction(rows);
      } else {
        rows.forEach((params) => {
          queue.dbRef.run(sql, params, function insertCallback(error) {
            report(error, queue.channel);
          });
        });
      }
    } catch (error) {
      report(error, queue.channel);
    } finally {
      queue.flushing = false;
    }
  }

  function flushAll() {
    queues.forEach(flushQueue);
  }

  function ensureTimer() {
    if (timer) return;
    timer = setInterval(flushAll, normalizedFlushIntervalMs);
    timer.unref?.();
  }

  function enqueue(dbRef, params, channel = "sit") {
    const queue = getQueue(dbRef, channel);
    if (!queue) return;
    queue.rows.push(params);
    if (queue.rows.length >= normalizedBatchSize) {
      flushQueue(queue);
    } else {
      ensureTimer();
    }
  }

  function close() {
    flushAll();
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { enqueue, flushAll, close };
}

module.exports = { createCollectionInsertQueue };
