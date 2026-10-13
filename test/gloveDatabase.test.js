const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const BetterSqlite3 = require('better-sqlite3');
const { createObjectCsvStringifier } = require('csv-writer');
const acorn = createRequire(path.join(__dirname, '../client/package.json'))('acorn');
const { openGloveDatabase, GLOVE_SENSOR_TYPES, isGloveDatabaseType } = require('../server/gloveDatabase');
const { createCollectionInsertQueue } = require('../server/collectionInsertQueue');
const { totalToN, isCar } = require('../util');
const { findMax } = require('../server/mathUtils');
const { timeStampToDate, timeStampTo_Date } = require('../openWeb');
const { prefixCsvHeaderWithBom, CSV_UTF8_BOM } = require('../server/csvUtf8');
const { getCollectionCsvLabelInfo } = require('../server/csvMatrixUtils');

const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const serverAst = acorn.parse(serverSource, { ecmaVersion: 'latest' });
const BASE_TIME = 1700000000000;
const DATE = String(BASE_TIME);
const INSERT = 'INSERT INTO matrix (data, timestamp, date) VALUES (?, ?, ?)';

/** 创建并登记仅属于本测试的临时库，删除前校验绝对路径范围。 */
function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-glove-db-'));
  const connections = [];
  t.after(async () => {
    for (const pair of connections) {
      await closeDatabase(pair.db);
      await closeDatabase(pair.db1);
    }
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('shroom-glove-db-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return {
    directory,
    register(pair) {
      connections.push(pair);
      return pair;
    },
    open(sensorType = 'hand0205') {
      const pair = openGloveDatabase(sensorType, directory);
      connections.push(pair);
      return pair;
    },
  };
}

/** 等待 callback 风格连接释放，以验证共享库不会被重复关闭。 */
function closeDatabase(database) {
  return new Promise((resolve, reject) => database.close((error) => error ? reject(error) : resolve()));
}

/** 通过采集实际使用的 callback 接口写入一帧并读取 lastID/changes。 */
function run(database, sql, params = []) {
  return new Promise((resolve, reject) => database.run(sql, params, function completed(error) {
    if (error) reject(error);
    else resolve({ lastID: this.lastID, changes: this.changes });
  }));
}

/** 通过兼容接口读取某一路数据，验证参数和回调均保持可用。 */
function all(database, sql, params = []) {
  return new Promise((resolve, reject) => database.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
}

/** 从真正的后端文件提取符号，隔离运行历史和 CSV 而不启动服务器。 */
function symbolSource(name) {
  for (const node of serverAst.body) {
    if (node.type === 'FunctionDeclaration' && node.id.name === name) return serverSource.slice(node.start, node.end);
    if (node.type !== 'VariableDeclaration') continue;
    const declaration = node.declarations.find((item) => item.id.name === name);
    if (declaration) return `${node.kind} ${serverSource.slice(declaration.start, declaration.end)};`;
  }
  assert.fail(`Missing server symbol ${name}`);
}

/** 将真实表路由连接交给实际历史查询函数，覆盖 statement 缓存和索引。 */
function historyPipeline(pair) {
  const messages = [];
  const sandbox = {
    ...pair, fs, path, console, Buffer, totalToN, isCar, findMax, timeStampToDate, timeStampTo_Date,
    prefixCsvHeaderWithBom, createCsvStringifier: createObjectCsvStringifier,
    getCollectionCsvLabelInfoFromValue: getCollectionCsvLabelInfo,
    logger: { warn: () => {}, info: () => {}, error: () => {} },
    file: 'hand0205', colHZ: 12, historyArr: [0, null], nowGetTime: DATE,
    timeNum: 80, stopPlaybackTimer: () => {},
    broadcastHistorySelectionPayload: (payload) => messages.push(payload),
    collectionInsertQueue: { flushAll: () => {} }, messages,
  };
  vm.createContext(sandbox);
  const symbols = [
    'historyStmtCache', 'getNativeDb', 'getHistoryStmt', 'dbGetHistory', 'dbAllHistory',
    'ensureHistoryIndexes', 'getHistoryStats', 'queryHistoryRows', 'queryHistoryRowsFromId',
    'queryGloveHistoryRows', 'queryGloveHistoryRowsAfter', 'queryHistoryTimestampSample',
    'HAND_GLOVE_FULL_PACKET', 'HAND_GLOVE_DOUBLE', 'HAND_GLOVE_TYPES',
    'TEMP_FULL_BED_TYPE', 'SMALL_BED_TYPE', 'SMALL_BED_NO_ALG_TYPE', 'SMALL_BED_12B_TYPE',
    'WHOLE_CHAIR_TYPE', 'THREE_PORT_SENSOR_TYPES', 'isThreePortFile',
    'isHandGloveType', 'isHandStorageType', 'isZeroFrameStorageType',
    'HAND_GLOVE_CSV_SEGMENT_HEADER_TITLES', 'HAND_GLOVE_CSV_SEGMENT_HEADER_IDS',
    'HAND_GLOVE_CSV_SEGMENT_POINTS', 'CSV_TITLES', 'getCsvLanguage', 'getCsvTitleMap',
    'getCsvTitleLanguage', 'getHandGloveSideLabels', 'appendHandGloveCsvHeaders',
    'getHandGloveCsvFilePrefix', 'appendPrefixedHandGloveCsvHeaders',
    'buildPrefixedHandGloveCsvSegments', 'buildStoredHandGloveCsvFrame',
    'buildHandGloveCsvSegments', 'normalizeFiniteFrame', 'formatCsvDatePart',
    'parseStoredFrameData', 'getHistoryPressureData', 'normalizeHistoryPressureData', 'formatMatrixTotalForFile',
    'HISTORY_EAGER_ROW_LIMIT', 'HISTORY_CHART_SAMPLE_LIMIT', 'createLazyHistoryRows',
    'getHistorySeries', 'getHistoryLengthFromCounts', 'createHistoryRowsForPlayback',
    'buildZeroPlaybackFrame', 'buildZeroPlaybackPayload', 'loadSelectedHistory', 'calcDetectedInterval',
    'getHandGlovePlaybackFrame', 'deleteHandGloveCollection',
    'getCollectionCsvLabelInfo', 'hasCollectionLabelInfo', 'appendCollectionLabelHeaders',
    'applyCollectionLabelInfo', 'getCsvElapsedSecondsFromBase', 'parseStoredSensorFrame',
    'getDefaultSitCsvHeaders', 'writeStreamChunk', 'closeWriteStream',
    'iterateHandGloveHistoryRows', 'mergeHandGloveHistoryRows', 'getCombinedHandGloveCsvFilePrefix',
    'buildCombinedHandGloveCsvRow', 'exportCombinedHandGloveCsvStreaming',
    'retainHandGloveExportSources',
    'exportHandGloveDoubleCsvStreaming',
  ];
  vm.runInContext(symbols.map(symbolSource).join('\n'), sandbox);
  return sandbox;
}

/** 创建旧版 sit/back 库，以真实 SQL 保留非连续 ID 和原始 JSON 字节内容。 */
function createLegacyDatabase(filename, rows) {
  const native = new BetterSqlite3(filename);
  try {
    native.exec('CREATE TABLE matrix (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, timestamp INTEGER, date TEXT)');
    const insert = native.prepare('INSERT INTO matrix (id,data,timestamp,date) VALUES (?,?,?,?)');
    native.transaction(() => rows.forEach((row) => insert.run(row.id, row.data, row.timestamp, row.date)))();
  } finally {
    native.close();
  }
}

/** 模拟旧安装版本继续向保留的旧库追加数据。 */
function appendLegacyRows(filename, rows) {
  const native = new BetterSqlite3(filename);
  try {
    const insert = native.prepare('INSERT INTO matrix (id,data,timestamp,date) VALUES (?,?,?,?)');
    native.transaction(() => rows.forEach((row) => insert.run(row.id, row.data, row.timestamp, row.date)))();
  } finally {
    native.close();
  }
}

/** 从实际数据库导出并捕获实际写出的记录，用于时间和切换连接回归。 */
async function exportRows(history, directory, exporter = 'exportCombinedHandGloveCsvStreaming') {
  const successes = [], failures = [], progress = [], writtenRecords = [];
  history.createCsvStringifier = (options) => {
    const stringifier = createObjectCsvStringifier(options);
    return {
      getHeaderString: () => stringifier.getHeaderString(),
      stringifyRecords: (rows) => {
        writtenRecords.push(...rows.map((row) => ({ ...row })));
        return stringifier.stringifyRecords(rows);
      },
    };
  };
  await history[exporter]({
    date: DATE, csvTitle: history.getCsvTitleMap({ language: 'en' }),
    csvTargetPath: (filename) => path.join(directory, filename),
    sendCsvSuccess: (files) => successes.push(Array.from(files)),
    sendCsvFailed: (error) => failures.push(error),
    sendCsvProgress: (value) => progress.push({ ...value }),
  });
  assert.deepEqual(failures, []);
  assert.equal(successes.length, 1);
  assert.equal(successes[0].length, 1);
  const content = fs.readFileSync(successes[0][0], 'utf8');
  assert.equal(content[0], CSV_UTF8_BOM);
  assert.equal(content.trimEnd().split(/\r?\n/).length, writtenRecords.length + 1);
  assert.equal(progress.at(-1).written, writtenRecords.length);
  assert.equal(progress.at(-1).total, writtenRecords.length);
  return writtenRecords;
}

/** 生成一帧能够直接用于真实 CSV 导出的历史数据。 */
function frameData(marker) {
  return JSON.stringify({
    pressureData: new Array(256).fill(marker),
    rotate: [marker, 0.1, 0.2, 0.3],
    zeroFrame: new Array(256).fill(marker + 1000),
  });
}

for (const sensorType of ['hand0205', 'hand0205Double', 'handGlove115200', 'handGloveFullPacket']) {
  test(`${sensorType} writes both hands to one physical database with distinct routed tables`, async (t) => {
    const fixture = temporaryDirectory(t);
    const { db, db1 } = fixture.open(sensorType);
    const filename = path.join(fixture.directory, `${sensorType}.db`);
    assert.ok(GLOVE_SENSOR_TYPES.includes(sensorType));
    assert.equal(isGloveDatabaseType(sensorType), true);
    assert.notEqual(db._db, db1._db, 'statement caches need separate table-routing facades');
    assert.equal(db._db.prepare('SELECT 1').database, db1._db.prepare('SELECT 1').database, 'both facades use the same physical SQLite connection');
    assert.equal(db._db.name, filename);
    assert.equal(db1._db.name, filename);
    const leftResult = await run(db, INSERT, [frameData(11), BASE_TIME, DATE]);
    const rightResult = await run(db1, INSERT, [frameData(22), BASE_TIME + 1, DATE]);
    assert.deepEqual(leftResult, { lastID: 1, changes: 1 });
    assert.deepEqual(rightResult, { lastID: 1, changes: 1 });
    const leftRows = await all(db, 'SELECT * FROM matrix');
    const rightRows = await all(db1, 'SELECT * FROM matrix');
    assert.equal(leftRows[0].hand, 'left');
    assert.equal(rightRows[0].hand, 'right');
    assert.equal(leftRows[0].data, frameData(11));
    assert.equal(rightRows[0].data, frameData(22));
    assert.deepEqual(fs.readdirSync(fixture.directory).filter((name) => name.endsWith('.db')), [`${sensorType}.db`]);
  });
}

test('dbManager dispatches ordinary gloves to a single file without needing an init.db template', async (t) => {
  const fixture = temporaryDirectory(t);
  const { initDb } = require('../server/dbManager');
  const pair = initDb('hand0205', fixture.directory, fixture.directory);
  try {
    assert.equal(pair.db._db.name, path.join(fixture.directory, 'hand0205.db'));
    assert.equal(pair.db1._db.name, pair.db._db.name);
    await run(pair.db1, INSERT, [frameData(9), BASE_TIME, DATE]);
    assert.equal((await all(pair.db1, 'SELECT * FROM matrix')).length, 1);
  } finally {
    await closeDatabase(pair.db);
    await closeDatabase(pair.db1);
  }
});

test('actual history statistics, cursors and indexes keep left and right reads separate on one connection', async (t) => {
  const fixture = temporaryDirectory(t);
  const pair = fixture.open();
  for (const id of [2, 10, 50]) await run(pair.db, 'INSERT INTO matrix (id,data,timestamp,date) VALUES (?,?,?,?)', [id, frameData(id), BASE_TIME + id, DATE]);
  for (const id of [3, 30]) await run(pair.db1, 'INSERT INTO matrix (id,data,timestamp,date) VALUES (?,?,?,?)', [id, frameData(id), BASE_TIME + id, DATE]);
  const history = historyPipeline(pair);
  assert.deepEqual(JSON.parse(JSON.stringify(history.getHistoryStats(pair.db, DATE))), { count: 3, minId: 2, maxId: 50 });
  assert.deepEqual(JSON.parse(JSON.stringify(history.getHistoryStats(pair.db1, DATE))), { count: 2, minId: 3, maxId: 30 });
  assert.deepEqual(history.queryHistoryRows(pair.db, DATE, 2, 1).map((row) => row.id), [10, 50]);
  assert.deepEqual(history.queryHistoryRows(pair.db1, DATE, 2, 1).map((row) => row.id), [30]);
  assert.deepEqual(history.queryHistoryRowsFromId(pair.db, DATE, 10, 2).map((row) => row.id), [10, 50]);
  assert.deepEqual(history.queryHistoryRowsFromId(pair.db1, DATE, 10, 2).map((row) => row.id), [30]);
  assert.deepEqual(history.queryGloveHistoryRows(pair.db, DATE, 2, 1).map((row) => row.id), [10, 50]);
  assert.deepEqual(history.queryGloveHistoryRows(pair.db1, DATE, 2, 1).map((row) => row.id), [30]);
  await run(pair.db, 'INSERT INTO matrix (id,data,timestamp,date) VALUES (?,?,?,?)', [60, frameData(60), BASE_TIME + 10, DATE]);
  assert.deepEqual(history.queryGloveHistoryRowsAfter(pair.db, DATE, BASE_TIME + 10, 10, 3).map((row) => row.id), [60, 50], 'composite cursor must retain another frame at the same millisecond');
  assert.deepEqual(history.queryGloveHistoryRowsAfter(pair.db1, DATE, BASE_TIME + 3, 3, 3).map((row) => row.id), [30]);
  const native = new BetterSqlite3(path.join(fixture.directory, 'hand0205.db'), { readonly: true });
  try {
    const indexes = native.prepare("SELECT name,tbl_name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_matrix%'").all();
    assert.ok(indexes.some((index) => index.name === 'idx_matrix_date_id' && index.tbl_name === 'matrix'));
    assert.ok(indexes.some((index) => index.name === 'idx_matrix_right_date_id' && index.tbl_name === 'matrix_right'));
    assert.ok(indexes.some((index) => index.name === 'idx_matrix_date_timestamp_id' && index.tbl_name === 'matrix'));
    assert.ok(indexes.some((index) => index.name === 'idx_matrix_right_date_timestamp_id' && index.tbl_name === 'matrix_right'));
  } finally {
    native.close();
  }
});

test('a delete on one hand never deletes the other table or another collection', async (t) => {
  const fixture = temporaryDirectory(t);
  const { db, db1 } = fixture.open();
  for (const connection of [db, db1]) {
    await run(connection, INSERT, [frameData(1), BASE_TIME, DATE]);
    await run(connection, INSERT, [frameData(2), BASE_TIME + 1, 'other']);
  }
  await run(db, 'DELETE FROM matrix WHERE date = ?', [DATE]);
  assert.deepEqual((await all(db, 'SELECT date FROM matrix ORDER BY id')).map((row) => row.date), ['other']);
  assert.deepEqual((await all(db1, 'SELECT date FROM matrix ORDER BY id')).map((row) => row.date), [DATE, 'other']);
  await run(db1, 'DELETE FROM matrix WHERE date = ?', [DATE]);
  assert.deepEqual((await all(db1, 'SELECT date FROM matrix ORDER BY id')).map((row) => row.date), ['other']);
  assert.deepEqual((await all(db, 'SELECT date FROM matrix ORDER BY id')).map((row) => row.date), ['other']);
});

test('collectionInsertQueue transactions route each batch and roll back an entire invalid hand batch', async (t) => {
  const fixture = temporaryDirectory(t);
  const { db, db1 } = fixture.open();
  const errors = [];
  const queue = createCollectionInsertQueue({
    sql: 'INSERT INTO matrix (data,timestamp,date,hand) VALUES (?,?,?,?)',
    batchSize: 2, flushIntervalMs: 60000,
    onError: (error, channel) => errors.push({ error, channel }),
  });
  try {
    queue.enqueue(db, [frameData(1), BASE_TIME, DATE, 'left'], 'sit');
    queue.enqueue(db, [frameData(2), BASE_TIME + 1, DATE, 'right'], 'sit');
    queue.enqueue(db1, [frameData(3), BASE_TIME + 2, DATE, 'right'], 'back');
    queue.enqueue(db1, [frameData(4), BASE_TIME + 3, DATE, 'right'], 'back');
    queue.flushAll();
    assert.equal(errors.length, 1);
    assert.equal(errors[0].channel, 'sit');
    assert.match(errors[0].error.message, /CHECK/);
    assert.equal(db._db.prepare('SELECT COUNT(*) AS count FROM matrix').get().count, 0);
    assert.equal(db1._db.prepare('SELECT COUNT(*) AS count FROM matrix').get().count, 2);
    assert.deepEqual((await all(db1, 'SELECT data FROM matrix ORDER BY id')).map((row) => row.data), [frameData(3), frameData(4)]);
  } finally {
    queue.close();
  }
});

test('real SQLite history exports both routed tables into one chronological CSV', async (t) => {
  const fixture = temporaryDirectory(t);
  const pair = fixture.open();
  await run(pair.db, INSERT, [frameData(11), BASE_TIME, DATE]);
  await run(pair.db, INSERT, [frameData(33), BASE_TIME + 30, DATE]);
  await run(pair.db1, INSERT, [frameData(22), BASE_TIME + 10, DATE]);
  const history = historyPipeline(pair);
  const writtenRecords = await exportRows(history, fixture.directory);
  assert.deepEqual(writtenRecords.map((row) => row.hand), ['left', 'right', 'left']);
  assert.deepEqual(writtenRecords.map((row) => JSON.parse(row.realData)[0]), [11, 22, 33]);
  assert.deepEqual(writtenRecords.map((row) => row.index), ['0.000', '0.010', '0.030']);
});

test('legacy left/right databases migrate verbatim once and remain preserved after reopening', async (t) => {
  const fixture = temporaryDirectory(t);
  const leftRows = [
    { id: 7, data: frameData(11), timestamp: BASE_TIME, date: DATE },
    { id: 42, data: '{"note":"左手 matrix 原始字节","pressureData":[2,3]}', timestamp: BASE_TIME + 3, date: '样本' },
  ];
  const rightRows = [
    { id: 5, data: frameData(22), timestamp: BASE_TIME + 1, date: DATE },
    { id: 72, data: '{"note":"右手 matrix 原始字节","pressureData":[4,5]}', timestamp: BASE_TIME + 4, date: '样本' },
  ];
  const leftFile = path.join(fixture.directory, 'hand0205sit.db');
  const rightFile = path.join(fixture.directory, 'hand0205back.db');
  createLegacyDatabase(leftFile, leftRows);
  createLegacyDatabase(rightFile, rightRows);
  const hashes = [leftFile, rightFile].map((filename) => createHash('sha256').update(fs.readFileSync(filename)).digest('hex'));
  const first = fixture.open();
  assert.deepEqual(await all(first.db, 'SELECT id,data,timestamp,date FROM matrix ORDER BY id'), leftRows);
  assert.deepEqual(await all(first.db1, 'SELECT id,data,timestamp,date FROM matrix ORDER BY id'), rightRows);
  assert.equal((await run(first.db, INSERT, [frameData(33), BASE_TIME + 5, DATE])).lastID, 43);
  await closeDatabase(first.db);
  await closeDatabase(first.db1);
  const second = fixture.open();
  assert.equal((await all(second.db, 'SELECT * FROM matrix')).length, 3);
  assert.equal((await all(second.db1, 'SELECT * FROM matrix')).length, 2);
  const migrations = second.db._db.prepare('SELECT source_path,hand,last_imported_id FROM glove_migrations ORDER BY hand').all();
  assert.equal(migrations.length, 2);
  assert.deepEqual(migrations.map((migration) => migration.last_imported_id), [42, 72]);
  assert.deepEqual(migrations.map((migration) => migration.hand), ['left', 'right']);
  assert.deepEqual(migrations.map((migration) => migration.source_path), ['hand0205sit.db', 'hand0205back.db']);
  await run(second.db, 'DELETE FROM matrix WHERE id = ?', [7]);
  await closeDatabase(second.db);
  await closeDatabase(second.db1);
  const third = fixture.open();
  assert.deepEqual((await all(third.db, 'SELECT id FROM matrix ORDER BY id')).map((row) => row.id), [42, 43], 'completed migration must not resurrect deleted records');
  for (const [index, filename] of [leftFile, rightFile].entries()) {
    assert.ok(fs.existsSync(filename));
    assert.equal(createHash('sha256').update(fs.readFileSync(filename)).digest('hex'), hashes[index], 'migration must not modify legacy files');
  }
});

test('a failing right-hand migration rolls back both copied hands and markers then permits a complete retry', async (t) => {
  const fixture = temporaryDirectory(t);
  const leftRows = [{ id: 9, data: frameData(11), timestamp: BASE_TIME, date: DATE }];
  const rightRows = [{ id: 13, data: frameData(22), timestamp: BASE_TIME + 1, date: DATE }];
  const leftFile = path.join(fixture.directory, 'hand0205sit.db');
  const rightFile = path.join(fixture.directory, 'hand0205back.db');
  createLegacyDatabase(leftFile, leftRows);
  const broken = new BetterSqlite3(rightFile);
  broken.exec('CREATE TABLE unrelated (id INTEGER)');
  broken.close();
  assert.throws(() => fixture.open(), /matrix/);
  const target = new BetterSqlite3(path.join(fixture.directory, 'hand0205.db'));
  try {
    assert.equal(target.prepare('SELECT COUNT(*) AS count FROM matrix').get().count, 0);
    assert.equal(target.prepare('SELECT COUNT(*) AS count FROM matrix_right').get().count, 0);
    assert.equal(target.prepare('SELECT COUNT(*) AS count FROM glove_migrations').get().count, 0);
  } finally {
    target.close();
  }
  createLegacyDatabase(rightFile, rightRows);
  const retry = fixture.open();
  assert.deepEqual(await all(retry.db, 'SELECT id,data,timestamp,date FROM matrix'), leftRows);
  assert.deepEqual(await all(retry.db1, 'SELECT id,data,timestamp,date FROM matrix'), rightRows);
  assert.equal(retry.db._db.prepare('SELECT COUNT(*) AS count FROM glove_migrations').get().count, 2);
  assert.ok(fs.existsSync(leftFile));
  assert.ok(fs.existsSync(rightFile));
});

test('closing either view twice keeps its sibling usable and closes the native connection only once', async (t) => {
  const fixture = temporaryDirectory(t);
  const { db, db1 } = fixture.open();
  await closeDatabase(db);
  await closeDatabase(db);
  await run(db1, INSERT, [frameData(9), BASE_TIME, DATE]);
  assert.equal((await all(db1, 'SELECT * FROM matrix')).length, 1);
  await closeDatabase(db1);
  await closeDatabase(db1);
  await closeDatabase(db);
  assert.throws(() => db1._db.prepare('SELECT * FROM matrix'), /closed|not open/i);
  const reopened = fixture.open();
  assert.equal((await all(reopened.db1, 'SELECT * FROM matrix')).length, 1);
});

test('retained export views survive closing original views and release the shared physical connection last', async (t) => {
  const fixture = temporaryDirectory(t);
  const pair = fixture.open();
  const cachedLeftStatement = pair.db._db.prepare('SELECT * FROM matrix');
  const physical = cachedLeftStatement.database;
  const leases = fixture.register({ db: pair.db.retain(), db1: pair.db1.retain() });
  await closeDatabase(pair.db);
  await closeDatabase(pair.db1);
  assert.equal(physical.open, true);
  assert.equal(pair.db._db.open, false);
  assert.equal(pair.db1._db.open, false);
  assert.throws(() => cachedLeftStatement.all(), /not open/i);
  assert.throws(() => pair.db.retain(), /not open/i);
  await run(leases.db, INSERT, [frameData(11), BASE_TIME, DATE]);
  await run(leases.db1, INSERT, [frameData(22), BASE_TIME + 1, DATE]);
  await closeDatabase(leases.db);
  assert.equal(physical.open, true);
  assert.equal((await all(leases.db1, 'SELECT * FROM matrix')).length, 1);
  await closeDatabase(leases.db1);
  await closeDatabase(leases.db1);
  assert.equal(physical.open, false);
});

test('new legacy frames migrate incrementally without ID collision loss or reversing their source order', async (t) => {
  const fixture = temporaryDirectory(t);
  const leftFile = path.join(fixture.directory, 'hand0205sit.db');
  const rightFile = path.join(fixture.directory, 'hand0205back.db');
  createLegacyDatabase(leftFile, [{ id: 1, data: frameData(11), timestamp: BASE_TIME, date: DATE }]);
  createLegacyDatabase(rightFile, [{ id: 1, data: frameData(22), timestamp: BASE_TIME + 1, date: DATE }]);
  const first = fixture.open();
  await run(first.db, 'INSERT INTO matrix (id,data,timestamp,date) VALUES (?,?,?,?)', [2, frameData(33), BASE_TIME + 2, DATE]);
  await run(first.db, 'INSERT INTO matrix (id,data,timestamp,date) VALUES (?,?,?,?)', [20, frameData(44), BASE_TIME + 3, DATE]);
  await run(first.db1, INSERT, [frameData(55), BASE_TIME + 4, DATE]);
  await closeDatabase(first.db);
  await closeDatabase(first.db1);
  appendLegacyRows(leftFile, [
    { id: 2, data: frameData(66), timestamp: BASE_TIME + 5, date: DATE },
    { id: 3, data: frameData(77), timestamp: BASE_TIME + 6, date: DATE },
  ]);
  appendLegacyRows(rightFile, [{ id: 2, data: frameData(88), timestamp: BASE_TIME + 7, date: DATE }]);
  const second = fixture.open();
  const left = await all(second.db, 'SELECT * FROM matrix ORDER BY id');
  const right = await all(second.db1, 'SELECT * FROM matrix ORDER BY id');
  assert.deepEqual(left.map((row) => JSON.parse(row.data).pressureData[0]), [11, 33, 44, 66, 77]);
  assert.deepEqual(left.map((row) => row.id), [1, 2, 20, 21, 22]);
  assert.deepEqual(right.map((row) => JSON.parse(row.data).pressureData[0]), [22, 55, 88]);
  assert.deepEqual(second.db._db.prepare('SELECT last_imported_id FROM glove_migrations ORDER BY hand').all().map((row) => row.last_imported_id), [3, 2]);
  await closeDatabase(second.db);
  await closeDatabase(second.db1);
  const third = fixture.open();
  assert.equal((await all(third.db, 'SELECT * FROM matrix')).length, 5);
  assert.equal((await all(third.db1, 'SELECT * FROM matrix')).length, 3);
});

test('deleting a collection flushes queued frames then atomically deletes both hands without deleting other collections', async (t) => {
  const fixture = temporaryDirectory(t);
  const pair = fixture.open();
  const queue = createCollectionInsertQueue({ sql: INSERT, batchSize: 1000, flushIntervalMs: 60000 });
  const history = historyPipeline(pair);
  history.collectionInsertQueue = queue;
  try {
    queue.enqueue(pair.db, [frameData(11), BASE_TIME, DATE], 'sit');
    queue.enqueue(pair.db1, [frameData(22), BASE_TIME, DATE], 'back');
    await run(pair.db, INSERT, [frameData(33), BASE_TIME + 1, 'other']);
    await run(pair.db1, INSERT, [frameData(44), BASE_TIME + 1, 'other']);
    pair.db._db.exec(`CREATE TRIGGER protect_right BEFORE DELETE ON matrix_right
      WHEN OLD.date = '${DATE}' BEGIN SELECT RAISE(ABORT, 'right delete failed'); END`);
    assert.throws(() => history.deleteHandGloveCollection(DATE), /right delete failed/);
    assert.equal(history.getHistoryStats(pair.db, DATE).count, 1, 'left delete must roll back if right delete fails');
    assert.equal(history.getHistoryStats(pair.db1, DATE).count, 1);
    pair.db._db.exec('DROP TRIGGER protect_right');
    history.deleteHandGloveCollection(DATE);
    assert.equal(history.getHistoryStats(pair.db, DATE).count, 0);
    assert.equal(history.getHistoryStats(pair.db1, DATE).count, 0);
    queue.flushAll();
    assert.deepEqual((await all(pair.db, 'SELECT date FROM matrix')).map((row) => row.date), ['other']);
    assert.deepEqual((await all(pair.db1, 'SELECT date FROM matrix')).map((row) => row.date), ['other']);
  } finally {
    queue.close();
  }
});

test('collection listing still discovers dates recorded by either hand', async (t) => {
  const fixture = temporaryDirectory(t);
  const pair = fixture.open();
  const leftOnly = String(BASE_TIME + 100);
  const rightOnly = String(BASE_TIME + 200);
  await run(pair.db, INSERT, [frameData(11), BASE_TIME, leftOnly]);
  await run(pair.db1, INSERT, [frameData(22), BASE_TIME, rightOnly]);
  const leftDates = await all(pair.db, 'SELECT DISTINCT date FROM matrix');
  const rightDates = await all(pair.db1, 'SELECT DISTINCT date FROM matrix');
  assert.deepEqual(new Set([...leftDates, ...rightDates].map((row) => row.date)), new Set([leftOnly, rightOnly]));
});

test('lazy glove playback uses time-ordered row pages across sparse IDs and the 512-row boundary', async (t) => {
  const fixture = temporaryDirectory(t);
  const pair = fixture.open();
  const count = 520;
  const insert = pair.db._db.prepare('INSERT INTO matrix (id,data,timestamp,date) VALUES (?,?,?,?)');
  pair.db._db.transaction(() => {
    for (let index = 0; index < count; index += 1) {
      insert.run(1 + index * 10, frameData(index + 1), BASE_TIME + count - 1 - index, DATE);
    }
  })();
  const history = historyPipeline(pair);
  const lazy = history.createLazyHistoryRows(pair.db, DATE, history.getHistoryStats(pair.db, DATE));
  assert.equal(lazy.length, count);
  for (const index of [0, 1, 511, 512, 519, 0]) {
    assert.equal(lazy[index].id, 1 + (count - 1 - index) * 10);
    assert.equal(lazy[index].timestamp, BASE_TIME + index);
  }
  assert.equal(lazy[count], undefined);
});

test('selected history and CSV retain the longer hand tail while missing playback frames clear pressure', async (t) => {
  const fixture = temporaryDirectory(t);
  const pair = fixture.open();
  await run(pair.db, INSERT, [frameData(11), BASE_TIME, DATE]);
  for (const [index, marker] of [22, 33, 44].entries()) await run(pair.db1, INSERT, [frameData(marker), BASE_TIME + index + 1, DATE]);
  const history = historyPipeline(pair);
  history.loadSelectedHistory(DATE);
  assert.equal(history.length, 3);
  assert.equal(history.localData.length, 1);
  assert.equal(history.localDataBack.length, 3);
  assert.deepEqual(Array.from(history.historyArr), [0, 3]);
  const message = history.messages[0];
  assert.equal(message.historyError, undefined);
  assert.equal(message.length, 3);
  assert.equal(message.pressArr.length, 3);
  assert.equal(message.pressArr[2], 44 * 256);
  assert.deepEqual(Array.from(message.historyTimeArr), [BASE_TIME, BASE_TIME + 2, BASE_TIME + 3]);
  const missingLeft = history.getHandGlovePlaybackFrame(history.localData[2]);
  assert.equal(missingLeft.pressureData.length, 256);
  assert.ok(missingLeft.pressureData.every((value) => value === 0));
  assert.equal(history.getHandGlovePlaybackFrame(history.localDataBack[2]).pressureData[0], 44);
  const records = await exportRows(history, fixture.directory);
  assert.equal(records.length, 4);
  assert.deepEqual(records.map((row) => JSON.parse(row.realData)[0]), [11, 22, 33, 44]);
});

test('legacy frames appended after a newer target ID still export and replay in their original time order', async (t) => {
  const fixture = temporaryDirectory(t);
  const first = fixture.open();
  await run(first.db, INSERT, [frameData(33), BASE_TIME + 20, DATE]);
  await closeDatabase(first.db);
  await closeDatabase(first.db1);
  createLegacyDatabase(path.join(fixture.directory, 'hand0205sit.db'), [
    { id: 1, data: frameData(11), timestamp: BASE_TIME, date: DATE },
    { id: 2, data: frameData(22), timestamp: BASE_TIME + 10, date: DATE },
  ]);
  const pair = fixture.open();
  assert.deepEqual((await all(pair.db, 'SELECT timestamp FROM matrix ORDER BY id')).map((row) => row.timestamp), [BASE_TIME + 20, BASE_TIME, BASE_TIME + 10]);
  const history = historyPipeline(pair);
  const playback = history.createHistoryRowsForPlayback(pair.db, DATE, history.getHistoryStats(pair.db, DATE), true);
  assert.deepEqual(playback.map((row) => row.timestamp), [BASE_TIME, BASE_TIME + 10, BASE_TIME + 20]);
  const records = await exportRows(history, fixture.directory);
  assert.deepEqual(records.map((row) => JSON.parse(row.realData)[0]), [11, 22, 33]);
  assert.deepEqual(records.map((row) => row.index), ['0.000', '0.010', '0.020']);
});

for (const sensorType of ['hand0205', 'hand0205Double']) {
test(`${sensorType} in-flight CSV retains its original database while switching and closing active views`, async (t) => {
  const originalFixture = temporaryDirectory(t);
  const newFixture = temporaryDirectory(t);
  const original = originalFixture.open(sensorType);
  const replacement = newFixture.open('handGlove115200');
  await run(original.db, INSERT, [frameData(11), BASE_TIME, DATE]);
  await run(original.db1, INSERT, [frameData(22), BASE_TIME + 1, DATE]);
  await run(replacement.db, INSERT, [frameData(99), BASE_TIME, DATE]);
  const physical = original.db._db.prepare('SELECT 1').database;
  const history = historyPipeline(original);
  history.file = sensorType;
  const write = history.writeStreamChunk;
  let switched = false;
  history.writeStreamChunk = async (...args) => {
    if (!switched) {
      switched = true;
      history.db = replacement.db;
      history.db1 = replacement.db1;
      history.file = 'handGlove115200';
      await closeDatabase(original.db);
      await closeDatabase(original.db1);
      assert.equal(physical.open, true, 'export leases must keep the original physical database alive');
    }
    return write(...args);
  };
  const records = await exportRows(history, originalFixture.directory,
    sensorType === 'hand0205Double' ? 'exportHandGloveDoubleCsvStreaming' : 'exportCombinedHandGloveCsvStreaming');
  assert.equal(switched, true);
  if (sensorType === 'hand0205Double') {
    assert.equal(records.length, 1);
    assert.equal(JSON.parse(records[0].leftRealData)[0], 11);
    assert.equal(JSON.parse(records[0].rightRealData)[0], 22);
  } else {
    assert.deepEqual(records.map((row) => JSON.parse(row.realData)[0]), [11, 22]);
    assert.deepEqual(records.map((row) => row.hand), ['left', 'right']);
  }
  assert.equal(physical.open, false, 'successful export must release its retained source views');
  assert.equal(replacement.db._db.open, true);
});
}
