const fs = require('node:fs');
const path = require('node:path');
const BetterSqlite3 = require('better-sqlite3');

const GLOVE_SENSOR_TYPES = Object.freeze(['hand0205', 'hand0205Double', 'handGlove115200', 'handGloveFullPacket']);

/** 判断是否使用左右手同库存储，其他传感系统保持原数据库布局。 */
function isGloveDatabaseType(sensorType) {
  return GLOVE_SENSOR_TYPES.includes(sensorType);
}

/** 只改写右手 SQL 的表/索引标识符，保留字符串、注释和绑定参数。 */
function rewriteGloveSql(sql, hand) {
  if (hand !== 'right' || typeof sql !== 'string') return sql;
  const replacements = {
    matrix: 'matrix_right',
    idx_matrix_date_id: 'idx_matrix_right_date_id',
    idx_matrix_date_timestamp_id: 'idx_matrix_right_date_timestamp_id',
  };
  let result = '';
  let offset = 0;
  while (offset < sql.length) {
    const char = sql[offset];
    if (sql.startsWith('--', offset)) {
      const end = sql.indexOf('\n', offset);
      const next = end < 0 ? sql.length : end;
      result += sql.slice(offset, next);
      offset = next;
    } else if (sql.startsWith('/*', offset)) {
      const end = sql.indexOf('*/', offset + 2);
      const next = end < 0 ? sql.length : end + 2;
      result += sql.slice(offset, next);
      offset = next;
    } else if (char === "'" || char === '"' || char === '`' || char === '[') {
      const closing = char === '[' ? ']' : char;
      const start = offset++;
      while (offset < sql.length) {
        if (sql[offset++] !== closing) continue;
        if (char !== '[' && sql[offset] === closing) { offset += 1; continue; }
        break;
      }
      const original = sql.slice(start, offset);
      const identifier = original.slice(1, -1).toLowerCase();
      result += char !== "'" && replacements[identifier]
        ? `${char}${replacements[identifier]}${closing}`
        : original;
    } else if (/[a-zA-Z_]/.test(char)) {
      const start = offset++;
      while (offset < sql.length && /[a-zA-Z0-9_$]/.test(sql[offset])) offset += 1;
      const token = sql.slice(start, offset);
      result += /[:@$]/.test(sql[start - 1] || '') ? token : replacements[token.toLowerCase()] || token;
    } else {
      result += char;
      offset += 1;
    }
  }
  return result;
}

/** 兼容项目 sqlite3 回调 API 的参数形式。 */
function normalizeCallbackArgs(params, callback) {
  if (typeof params === 'function') return { params: [], callback: params };
  return { params: params == null ? [] : Array.isArray(params) ? params : [params], callback };
}

/** 为一个物理连接建立按表视图；两个 native facade 共享事务但分开缓存语句。 */
function createGloveDatabaseView(nativeDb, filename, hand, owner) {
  let closed = false;
  let facade;
  const assertOpen = () => {
    if (closed || !nativeDb.open) throw new Error('The database connection is not open');
  };
  const closePhysical = () => {
    if (!closed) { closed = true; owner.references -= 1; }
    if (owner.references === 0 && nativeDb.open) nativeDb.close();
  };
  facade = new Proxy(nativeDb, {
    get(target, property) {
      if (property === 'open') return !closed && target.open;
      if (property === 'prepare') return sql => {
        assertOpen();
        const statement = target.prepare(rewriteGloveSql(sql, hand));
        return new Proxy(statement, {
          get(stmt, key) {
            const value = Reflect.get(stmt, key, stmt);
            return typeof value === 'function' ? (...args) => { assertOpen(); return value.apply(stmt, args); } : value;
          },
        });
      };
      if (property === 'exec') return sql => { assertOpen(); target.exec(rewriteGloveSql(sql, hand)); return facade; };
      if (property === 'pragma') return (sql, options) => { assertOpen(); return target.pragma(rewriteGloveSql(sql, hand), options); };
      if (property === 'close') return () => { closePhysical(); return facade; };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? (...args) => { assertOpen(); return value.apply(target, args); } : value;
    },
  });
  const view = { _db: facade, path: filename, filename, hand };
  for (const method of ['run', 'all', 'get']) {
    view[method] = (sql, params, callback) => {
      const normalized = normalizeCallbackArgs(params, callback);
      try {
        const result = facade.prepare(sql)[method](...normalized.params);
        if (typeof normalized.callback === 'function') {
          if (method === 'run') {
            const context = { lastID: Number(result.lastInsertRowid ?? 0), changes: Number(result.changes ?? 0) };
            process.nextTick(() => normalized.callback.call(context, null));
          } else {
            process.nextTick(() => normalized.callback(null, result));
          }
        }
      } catch (error) {
        if (typeof normalized.callback !== 'function') throw error;
        process.nextTick(() => normalized.callback(error, method === 'all' ? [] : method === 'get' ? null : undefined));
      }
      return view;
    };
  }
  view.serialize = callback => { if (typeof callback === 'function') callback(); return view; };
  // 导出持有独立逻辑视图，切系统释放原视图时不关闭同一个物理连接。
  view.retain = () => {
    assertOpen();
    owner.references += 1;
    return createGloveDatabaseView(nativeDb, filename, hand, owner);
  };
  view.close = callback => {
    try {
      closePhysical();
      if (typeof callback === 'function') process.nextTick(() => callback(null));
    } catch (error) {
      if (typeof callback !== 'function') throw error;
      process.nextTick(() => callback(error));
    }
    return view;
  };
  return view;
}

/** 建立左右采集表；既有单库缺少 hand 列时仅追加默认手别。 */
function ensureGloveSchema(nativeDb) {
  for (const [table, hand] of [['matrix', 'left'], ['matrix_right', 'right']]) {
    nativeDb.exec(`CREATE TABLE IF NOT EXISTS ${table} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT,
      timestamp INTEGER,
      date TEXT,
      hand TEXT NOT NULL DEFAULT '${hand}' CHECK (hand = '${hand}')
    )`);
    if (!nativeDb.pragma(`table_info(${table})`).some(column => column.name === 'hand')) {
      nativeDb.exec(`ALTER TABLE ${table} ADD COLUMN hand TEXT NOT NULL DEFAULT '${hand}' CHECK (hand = '${hand}')`);
    }
  }
  nativeDb.exec(`CREATE TABLE IF NOT EXISTS glove_migrations (
    source_path TEXT PRIMARY KEY,
    hand TEXT NOT NULL,
    last_imported_id INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`);
}

/** 事务性追加旧库未迁移的行；游标按源 ID 记录，删掉目标历史不会重新导入旧行。 */
function migrateLegacyGloveRows(nativeDb, sensorType, directory) {
  const readCursor = nativeDb.prepare('SELECT last_imported_id FROM glove_migrations WHERE source_path = ?');
  const saveCursor = nativeDb.prepare(`INSERT INTO glove_migrations (source_path, hand, last_imported_id, updated_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(source_path) DO UPDATE SET
    hand = excluded.hand, last_imported_id = excluded.last_imported_id, updated_at = excluded.updated_at`);
  nativeDb.transaction(() => {
    for (const [suffix, hand, table] of [['sit', 'left', 'matrix'], ['back', 'right', 'matrix_right']]) {
      const sourcePath = `${sensorType}${suffix}.db`;
      const filename = path.join(directory, sourcePath);
      if (!fs.existsSync(filename)) continue;
      const cursor = readCursor.get(sourcePath)?.last_imported_id || 0;
      const source = new BetterSqlite3(filename, { readonly: true, fileMustExist: true });
      try {
        const preserveSourceIds = !nativeDb.prepare(`SELECT 1 AS present FROM ${table} LIMIT 1`).get();
        const insertWithId = nativeDb.prepare(`INSERT INTO ${table} (id, data, timestamp, date, hand) VALUES (?, ?, ?, ?, ?)`);
        const insertAutoId = nativeDb.prepare(`INSERT INTO ${table} (data, timestamp, date, hand) VALUES (?, ?, ?, ?)`);
        let lastImportedId = cursor;
        for (const row of source.prepare('SELECT id, data, timestamp, date FROM matrix WHERE id > ? ORDER BY id ASC').iterate(cursor)) {
          // 目标已有行时统一追加，避免保留空闲低 ID 导致同批旧帧的先后顺序倒置。
          if (preserveSourceIds) insertWithId.run(row.id, row.data, row.timestamp, row.date, hand);
          else insertAutoId.run(row.data, row.timestamp, row.date, hand);
          lastImportedId = row.id;
        }
        if (lastImportedId !== cursor) saveCursor.run(sourcePath, hand, lastImportedId, Date.now());
      } finally {
        source.close();
      }
    }
  })();
}

/** 打开手套单库，安全迁入旧左右库并返回兼容现有调用链的左右视图。 */
function openGloveDatabase(sensorType, directory) {
  if (!isGloveDatabaseType(sensorType)) throw new Error('unsupported glove database type');
  const resolvedDirectory = path.resolve(directory);
  fs.mkdirSync(resolvedDirectory, { recursive: true });
  const filename = path.join(resolvedDirectory, `${sensorType}.db`);
  const nativeDb = new BetterSqlite3(filename);
  try {
    ensureGloveSchema(nativeDb);
    migrateLegacyGloveRows(nativeDb, sensorType, resolvedDirectory);
    const owner = { references: 2 };
    return {
      db: createGloveDatabaseView(nativeDb, filename, 'left', owner),
      db1: createGloveDatabaseView(nativeDb, filename, 'right', owner),
    };
  } catch (error) {
    nativeDb.close();
    throw error;
  }
}

module.exports = { GLOVE_SENSOR_TYPES, isGloveDatabaseType, openGloveDatabase, rewriteGloveSql };
