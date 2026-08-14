const test = require("node:test");
const assert = require("node:assert/strict");

const { createCollectionInsertQueue } = require("../server/collectionInsertQueue");

test("reaching the batch threshold flushes queued rows immediately", () => {
  const rows = [];
  const db = {
    run: (_sql, params, callback) => {
      rows.push(params);
      callback?.(null);
    },
  };
  const queue = createCollectionInsertQueue({
    sql: "INSERT",
    batchSize: 2,
    flushIntervalMs: 60000,
  });

  queue.enqueue(db, [1], "sit");
  assert.equal(rows.length, 0);
  queue.enqueue(db, [2], "sit");
  assert.deepEqual(rows, [[1], [2]]);
  queue.close();
});

test("flushAll writes a partial batch and reports database errors", () => {
  const errors = [];
  const db = {
    run: (_sql, _params, callback) => callback(new Error("disk full")),
  };
  const queue = createCollectionInsertQueue({
    sql: "INSERT",
    onError: (error, channel) => errors.push([error.message, channel]),
  });

  queue.enqueue(db, [1], "back");
  queue.flushAll();
  assert.deepEqual(errors, [["disk full", "back"]]);
  queue.close();
});

test("close is repeatable and flushes pending rows only once", () => {
  const rows = [];
  const db = {
    run: (_sql, params, callback) => {
      rows.push(params);
      callback?.(null);
    },
  };
  const queue = createCollectionInsertQueue({ sql: "INSERT" });

  queue.enqueue(db, [1], "head");
  queue.close();
  queue.close();
  assert.deepEqual(rows, [[1]]);
});
