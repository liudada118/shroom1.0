/**
 * sqlite3-compat.js
 *
 * Minimal sqlite3 callback-style compatibility layer backed by better-sqlite3.
 * It currently implements the subset used by server.js: Database/run/all/get/close/serialize.
 */

const BetterSqlite3 = require("better-sqlite3");

function normalizeArgs(params, callback) {
  if (typeof params === "function") {
    return { params: [], callback: params };
  }
  if (params === undefined || params === null) {
    return { params: [], callback };
  }
  return { params: Array.isArray(params) ? params : [params], callback };
}

class Database {
  constructor(filename) {
    this._db = new BetterSqlite3(filename);
  }

  run(sql, params, callback) {
    const normalized = normalizeArgs(params, callback);
    try {
      const result = this._db.prepare(sql).run(...normalized.params);
      if (typeof normalized.callback === "function") {
        const ctx = {
          lastID: Number(result.lastInsertRowid ?? 0),
          changes: Number(result.changes ?? 0),
        };
        process.nextTick(() => normalized.callback.call(ctx, null));
      }
    } catch (err) {
      if (typeof normalized.callback === "function") {
        process.nextTick(() => normalized.callback(err));
      } else {
        throw err;
      }
    }
    return this;
  }

  all(sql, params, callback) {
    const normalized = normalizeArgs(params, callback);
    try {
      const rows = this._db.prepare(sql).all(...normalized.params);
      if (typeof normalized.callback === "function") {
        process.nextTick(() => normalized.callback(null, rows));
      }
    } catch (err) {
      if (typeof normalized.callback === "function") {
        process.nextTick(() => normalized.callback(err, []));
      } else {
        throw err;
      }
    }
    return this;
  }

  get(sql, params, callback) {
    const normalized = normalizeArgs(params, callback);
    try {
      const row = this._db.prepare(sql).get(...normalized.params);
      if (typeof normalized.callback === "function") {
        process.nextTick(() => normalized.callback(null, row));
      }
    } catch (err) {
      if (typeof normalized.callback === "function") {
        process.nextTick(() => normalized.callback(err, null));
      } else {
        throw err;
      }
    }
    return this;
  }

  close(callback) {
    try {
      this._db.close();
      if (typeof callback === "function") {
        process.nextTick(() => callback(null));
      }
    } catch (err) {
      if (typeof callback === "function") {
        process.nextTick(() => callback(err));
      } else {
        throw err;
      }
    }
    return this;
  }

  serialize(callback) {
    if (typeof callback === "function") {
      callback();
    }
    return this;
  }
}

module.exports = {
  Database,
  verbose() {
    return module.exports;
  },
};
