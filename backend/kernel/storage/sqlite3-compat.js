/**
 * 用 better-sqlite3 顶替 `sqlite3` 的回调式兼容层（Database + run/all/get/close/serialize）。
 *
 * 依赖已换成 `better-sqlite3`，但两者 API 形状相反（回调式异步 vs 同步返回值），而 server.js 与
 * dbManager.js 有几十处回调式调用点 —— 这个 shim 让它们一行都不用改。只实现实际用到的子集：需要
 * `each`/`prepare`/`Statement` 时在这里补，别直接 import better-sqlite3（混用两套风格会让「这条
 * 查询是同步还是异步」变成读代码才能确定的事）。本文件沿用双引号旧格式便于和上游 API 对照，
 * 不要顺手格式化。
 *
 * ⚠️ **底层是同步的，回调只是形状模拟**（查询在返回前已连磁盘 I/O 执行完，回调靠
 * `process.nextTick`）。好处是不存在真 sqlite3 那种「回调还没跑又发一条查询」的竞态，`serialize`
 * 因此可以是空壳。代价是**大查询会阻塞事件循环** —— 历史库有几 GB 的表，一条没走索引的查询会让
 * 整个后端（含实时采集与 WebSocket）停住。写查询时要当同步代码看。
 */

const BetterSqlite3 = require("better-sqlite3");

/**
 * 归一 `(sql, params?, callback?)` 这种可变参数形态。
 *
 * 单个非数组值包成数组，因为 sqlite3 允许 `db.get(sql, id, cb)` 而 better-sqlite3 的
 * `run(...params)` 需要展开。
 *
 * ⚠️ 第二个参数是函数时必须当回调（sqlite3 允许 `db.run(sql, cb)`）：少了这一支，回调会被当成 SQL
 * 绑定参数塞进 better-sqlite3，报的是「参数类型不支持」，与真实原因毫无关系。
 *
 * @param {Array|*|Function|undefined} params 绑定参数、单个参数值，或直接是回调。
 * @param {Function} [callback] 回调。
 * @returns {{params: Array, callback: Function|undefined}} 归一后的参数与回调。
 */
function normalizeArgs(params, callback) {
  if (typeof params === "function") {
    return { params: [], callback: params };
  }
  if (params === undefined || params === null) {
    return { params: [], callback };
  }
  return { params: Array.isArray(params) ? params : [params], callback };
}

/**
 * 模拟 sqlite3 的 `Database`，内部持有一个 better-sqlite3 实例。
 *
 * 三个查询方法（run/all/get）形状一致，共三条约定：**返回 `this`** 以支持 sqlite3 的链式调用；
 * 回调统一走 `process.nextTick`（同步回调会让「回调里再发一条查询」变成同步递归、栈可能爆）；
 * **没给回调时错误直接抛**而不是吞掉 —— sqlite3 原行为是发 `error` 事件，这里没有事件通道，吞掉
 * 会让「表不存在」「SQL 写错」完全无声，现象是界面上永远没有数据。
 */
class Database {
  /**
   * @param {string} filename 数据库文件路径。
   * @throws {Error} 文件无法打开（目录不存在、权限、文件损坏）时同步抛出 ——
   *         与 sqlite3 不同，这里没有「先返回对象、稍后报错」的窗口。
   */
  constructor(filename) {
    this._db = new BetterSqlite3(filename);
  }

  /**
   * 执行一条不返回行的语句（INSERT/UPDATE/DELETE/DDL）。
   *
   * ⚠️ 回调用 `callback.call(ctx, null)` 调，`lastID`/`changes` 挂在 `this` 上（sqlite3 的约定），
   * **所以调用方的回调不能是箭头函数** —— 箭头函数没有自己的 `this`，读不到 lastID。
   *
   * ⚠️ `Number(...)` 那层不能省：`lastInsertRowid` 在大表上是 BigInt，而调用方当普通数字用，
   * BigInt 会让 `JSON.stringify` 直接抛错。
   *
   * @param {string} sql SQL 语句。
   * @param {Array|*|Function} [params] 绑定参数，或直接给回调。
   * @param {Function} [callback] `(err)` 回调，`this` 上带 lastID/changes。
   * @returns {Database} this，支持链式调用。
   * @throws {Error} 未提供回调且执行失败。
   */
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

  /**
   * 查询并一次取回全部行。
   *
   * ⚠️ **没有分页也没有行数上限**，整个结果集一次进内存。历史库里有几 GB 的表，
   * 一条 `SELECT *` 会直接把进程撑爆。所有历史查询都要自己带 `LIMIT`
   * （见 historyQueryService 的做法）。
   *
   * 出错时回调收到 `(err, [])` —— **第二参给空数组而不是 undefined**，
   * 因为大量调用点写的是 `rows.forEach(...)`，给 undefined 会在回调里再炸一次，
   * 把真正的 SQL 错误埋在一个 TypeError 底下。
   *
   * @param {string} sql SQL 语句。
   * @param {Array|*|Function} [params] 绑定参数，或直接给回调。
   * @param {Function} [callback] `(err, rows)` 回调。
   * @returns {Database} this。
   * @throws {Error} 未提供回调且查询失败。
   */
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

  /**
   * 查询第一行。
   *
   * 没有匹配行时 better-sqlite3 返回 `undefined`，这里**原样传给回调**（不转成 null），
   * 与 sqlite3 的行为一致。所以调用方判「查到了吗」要用 `if (row)`，不要用 `!== null`。
   *
   * 出错时第二参给 `null`（而不是空数组）—— 单行查询的调用方读的是 `row.xxx`，
   * null 与 undefined 在 `if (row)` 下等价，形状上更贴近「没有这一行」。
   *
   * @param {string} sql SQL 语句。
   * @param {Array|*|Function} [params] 绑定参数，或直接给回调。
   * @param {Function} [callback] `(err, row)` 回调；无匹配行时 row 为 undefined。
   * @returns {Database} this。
   * @throws {Error} 未提供回调且查询失败。
   */
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

  /**
   * 关闭数据库连接。
   *
   * better-sqlite3 的 `close()` 是同步的，返回时文件句柄已经释放。这一点对
   * Windows 下的关闭流程很要紧：句柄没放掉，Electron 退出后数据库文件仍被占用，
   * 下次启动可能打不开。所以 serverShutdownOrchestrator 必须等这一步完成。
   *
   * 重复 close 会被 better-sqlite3 忽略（不抛），所以关闭流程里多调一次是安全的。
   *
   * @param {Function} [callback] `(err)` 回调。
   * @returns {Database} this。
   * @throws {Error} 未提供回调且关闭失败。
   */
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

  /**
   * `db.serialize(cb)` 的空壳实现：直接同步调用回调。
   *
   * sqlite3 里它保证块内查询按顺序执行，而底层同步天然满足，所以**这不是待实现的占位** ——
   * 删掉会让 server.js 的调用点报「serialize is not a function」。
   *
   * ⚠️ 回调是**同步**调的（不走 nextTick）：语义是「在 serialize 块内写查询」，异步化会让块内的
   * 查询跑到块外代码之后，顺序反而变了。
   *
   * @param {Function} [callback] 在其中发起一批查询。
   * @returns {Database} this。
   */
  serialize(callback) {
    if (typeof callback === "function") {
      callback();
    }
    return this;
  }
}

module.exports = {
  Database,
  /**
   * `sqlite3.verbose()` 的空壳：返回模块自身。
   *
   * sqlite3 里它会开启带堆栈的详细错误。这里没有对应能力（better-sqlite3 的错误本来就带
   * SQL 上下文），但两个调用点都写着 `require('./sqlite3-compat').verbose()`，
   * 所以必须返回一个还带 `Database` 的对象 —— 返回 undefined 会让它们在装配期就崩。
   *
   * @returns {object} 模块导出对象本身，可继续 `.Database`。
   */
  verbose() {
    return module.exports;
  },
};
