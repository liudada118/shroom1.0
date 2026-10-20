const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const BetterSqlite3 = require('better-sqlite3');
const { initDb } = require('../../kernel/storage/dbManager');
const { getGloveStorageType } = require('../../kernel/storage/gloveDatabase');
const queries = require('../../kernel/storage/history/historyQueryService');
const { createHistoryMaintenanceService } = require('../../kernel/storage/history/historyMaintenanceService');
const { createHistoryFrameTransformService } = require('../../kernel/playback/historyFrameTransformService');
const { getHistorySeries } = require('../../kernel/playback/historyPlaybackService');
const { createCsvDownloadService } = require('../../kernel/csv/csvDownloadService');
const { createSit1024FrameProcessor } = require('../../extensions/built-in-sensors/sit1024FrameProcessor');
const { createHandPacketRuntime } = require('../../extensions/built-in-sensors/handPacketRuntime');
const { getPressureVestStatistics, SENSOR_INDICES } = require('../../extensions/built-in-sensors/pressureVest');
const sensors = require('@shroom/backend/sensors');
const { buildSensorFrameEnvelope } = require('../../kernel/realtime/sensorFrameEnvelope');
const { createPlaybackFrameService } = require('../../kernel/playback/playbackFrameService');
const INSERT = 'INSERT INTO matrix(data,timestamp,date) VALUES (?,?,?)';

/** 为测试分配隔离数据库；所有连接先关闭再清理临时目录。 */
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-revise-sensors-'));
  const opened = [];
  t.after(() => {
    for (const pair of opened) for (const database of [pair.db, pair.db1]) {
      if (database?._db?.open) database.close();
    }
    assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return { directory, open(type = 'hand0205') {
    const pair = initDb(type, directory, directory);
    opened.push(pair);
    return pair;
  } };
}

/** 构造旧版独立手库，包含删除造成的非连续ID与真实通道身份。 */
function legacyDatabase(filename, rows) {
  const database = new BetterSqlite3(filename);
  try {
    database.exec('CREATE TABLE matrix(id INTEGER PRIMARY KEY, data TEXT, timestamp INTEGER, date TEXT, channel_id TEXT)');
    const insert = database.prepare('INSERT INTO matrix VALUES (?,?,?,?,?)');
    database.transaction(() => rows.forEach(row => insert.run(...row)))();
  } finally { database.close(); }
}

/** 装配真实导出服务，保留数据库通道查询和CSV文件写入。 */
function exportService(pair, directory, type = 'hand0205', fsImpl = fs) {
  const normalize = row => {
    const stored = JSON.parse(row.data);
    return Array.isArray(stored) ? stored : stored.pressureData || [];
  };
  return createCsvDownloadService({
    fs: fsImpl, path, logger: { error() {}, warn() {} }, csvPath: directory,
    publishSystemEvent() {}, getRuntime: () => ({ file: type, historyArr: [0, 1000] }),
    getDatabases: () => pair, ...queries, normalizeHistoryPressureData: normalize,
    formatMatrixTotalForFile: value => value, totalToN: value => value,
    findMax: values => Math.max(...values), timeStampToDate: String,
    timeStampToDateLabel: String, getCsvElapsedSeconds: () => '0', getCsvFilePrefix: () => 'test',
    getCsvTitleMap: () => ({}),
  });
}

test('single glove alias shares history; distinct systems retain their own original prefixes', t => {
  const fixtureData = fixture(t);
  assert.equal(getGloveStorageType('hand0205Single'), 'hand0205');
  const single = fixtureData.open();
  single.db._db.prepare(INSERT).run('[1]', 100, 'date');
  single.db1._db.prepare(INSERT).run('[2]', 110, 'date');
  assert.equal(single.db.path, single.db1.path);
  assert.equal(single.db._db.prepare('SELECT data FROM matrix').get().data, '[1]');
  assert.equal(single.db1._db.prepare('SELECT data FROM matrix').get().data, '[2]');
  const double = fixtureData.open('hand0205Double');
  assert.notEqual(double.db.path, single.db.path);
  assert.equal(queries.getHistoryStats(double.db, 'date').count, 0);
  const alias = fixtureData.open('hand0205Single');
  assert.equal(queries.getHistoryStats(alias.db, 'date').count, 1);
});

test('legacy migration preserves raw JSON and canonical columns then imports incrementally without resurrection', t => {
  const data = fixture(t);
  const source = path.join(data.directory, 'hand0205sit.db');
  legacyDatabase(source, [[2, '{"pressureData":[3]}', 20, 'keep', 'hand0205:sit']]);
  const pair = data.open();
  const row = pair.db._db.prepare('SELECT * FROM matrix').get();
  assert.equal(row.data, '{"pressureData":[3]}');
  assert.equal(row.channel_id, 'hand0205:sit');
  pair.db._db.prepare('DELETE FROM matrix').run();
  pair.db.close(); pair.db1.close();
  let next = data.open();
  assert.equal(queries.getHistoryStats(next.db, 'keep').count, 0);
  next.db.close(); next.db1.close();
  const original = new BetterSqlite3(source);
  original.prepare('INSERT INTO matrix VALUES (?,?,?,?,?)').run(8, '[7]', 10, 'keep', null);
  original.close();
  next = data.open();
  assert.equal(queries.getHistoryStats(next.db, 'keep').count, 1);
  assert.equal(next.db._db.prepare('SELECT data FROM matrix').get().data, '[7]');
  assert.ok(fs.existsSync(source));
});

test('failed right migration rolls back all copied rows and cursors and keeps the source untouched', t => {
  const data = fixture(t);
  legacyDatabase(path.join(data.directory, 'hand0205sit.db'), [[2, '[1]', 1, 'date', null]]);
  const invalid = path.join(data.directory, 'hand0205back.db');
  fs.writeFileSync(invalid, 'not sqlite');
  assert.throws(() => data.open());
  fs.unlinkSync(invalid);
  const pair = data.open();
  assert.equal(queries.getHistoryStats(pair.db, 'date').count, 1);
  assert.equal(pair.db._db.prepare('SELECT COUNT(*) AS count FROM glove_migrations').get().count, 1);
});

test('glove schema/index queries isolate hands and preserve canonical serial metadata', t => {
  const data = fixture(t);
  const pair = data.open();
  pair.db._db.prepare('INSERT INTO matrix(data,timestamp,date,channel_id,serial_port_path) VALUES (?,?,?,?,?)')
    .run('[1]', 10, 'date', 'hand0205:sit', 'COM1');
  pair.db1._db.prepare('INSERT INTO matrix(data,timestamp,date,channel_id,serial_port_path) VALUES (?,?,?,?,?)')
    .run('[2]', 11, 'date', 'hand0205:back', 'COM2');
  assert.equal(queries.queryHistoryChannels(pair.db, 'date')[0].channelId, 'hand0205:sit');
  assert.equal(queries.queryHistoryChannels(pair.db1, 'date')[0].channelId, 'hand0205:back');
  assert.equal(queries.queryChannelHistoryRows(pair.db1, 'date', 'hand0205:back', 10)[0].serial_port_path, 'COM2');
  assert.equal(queries.queryChannelHistoryRows(pair.db, 'date', 'hand0205:back', 10).length, 0);
});

test('retained views stay usable during a system switch and close the physical connection last', t => {
  const data = fixture(t);
  const pair = data.open();
  const retained = pair.db1.retain();
  const physical = retained._db.glovePhysicalDatabase;
  pair.db.close(); pair.db.close(); pair.db1.close();
  retained._db.prepare(INSERT).run('[2]', 1, 'date');
  assert.equal(queries.getHistoryStats(retained, 'date').count, 1);
  retained.close();
  assert.equal(physical.open, false);
});

test('lazy glove history follows timestamps across sparse IDs and the page boundary', t => {
  const data = fixture(t);
  const pair = data.open();
  const insert = pair.db._db.prepare('INSERT INTO matrix(id,data,timestamp,date) VALUES (?,?,?,?)');
  pair.db._db.transaction(() => {
    for (let index = 519; index >= 0; index--) insert.run((520 - index) * 2, JSON.stringify([index]), index, 'date');
  })();
  const stats = queries.getHistoryStats(pair.db, 'date');
  const rows = queries.createHistoryRowsForPlayback(pair.db, 'date', stats, false);
  for (const index of [0, 511, 512, 519]) assert.equal(rows[index].timestamp, index);
});

test('deletion flushes queued frames and commits both hands atomically without resurrecting migrated rows', async t => {
  const data = fixture(t);
  const pair = data.open();
  pair.db._db.prepare(INSERT).run('[1]', 1, 'delete');
  pair.db1._db.prepare(INSERT).run('[2]', 1, 'keep');
  let flushed = false;
  const service = createHistoryMaintenanceService({ getDatabases: () => pair, publishSystemEvent() {},
    beforeDelete() { flushed = true; pair.db1._db.prepare(INSERT).run('[3]', 2, 'delete'); } });
  await service.deleteHistory('delete');
  assert.ok(flushed);
  assert.equal(queries.getHistoryStats(pair.db, 'delete').count, 0);
  assert.equal(queries.getHistoryStats(pair.db1, 'delete').count, 0);
  assert.equal(queries.getHistoryStats(pair.db1, 'keep').count, 1);
});

test('both hands export to one chronological CSV with full pressure, orientation, zero and identity fields', async t => {
  const data = fixture(t);
  const pair = data.open();
  pair.db._db.prepare(INSERT).run(JSON.stringify({ pressureData: Array(256).fill(2), rotate: [1, 2], zeroFrame: [3] }), 20, 'date');
  pair.db1._db.prepare(INSERT).run(JSON.stringify({ pressureData: Array(256).fill(4), rotate: [5, 6], zeroFrame: [7] }), 10, 'date');
  const result = await exportService(pair, data.directory).exportHistoryCsv({ date: 'date' });
  assert.ok(result.ok, result.error);
  assert.equal(result.files.length, 1);
  assert.equal(result.artifacts[0].rowCount, 2);
  const content = fs.readFileSync(result.files[0], 'utf8');
  assert.ok(content.startsWith('\ufeffhand,'));
  assert.match(content, /zeroFrame,rotate,littleFinger/);
  assert.ok(content.indexOf('right,') < content.indexOf('left,'));
  assert.match(content, /hand0205:back/);
  assert.match(content, /hand0205:sit/);
  assert.match(content, /"\[5,6\]"/);
});

test('in-flight glove export survives active views closing and releases retained views afterward', async t => {
  const data = fixture(t);
  const pair = data.open();
  pair.db._db.prepare(INSERT).run('[1]', 1, 'date');
  pair.db1._db.prepare(INSERT).run('[2]', 2, 'date');
  const physical = pair.db._db.glovePhysicalDatabase;
  const fsImpl = Object.create(fs);
  Object.defineProperty(fsImpl, 'promises', { value: { ...fs.promises, async writeFile(...args) {
    pair.db.close(); pair.db1.close();
    assert.equal(physical.open, true);
    return fs.promises.writeFile(...args);
  } } });
  const result = await exportService(pair, data.directory, 'hand0205', fsImpl).exportHistoryCsv({ date: 'date' });
  assert.ok(result.ok, result.error);
  assert.equal(physical.open, false);
});

test('pressure vest keeps 1024 original ADC values while statistics only count attached unique points', () => {
  const processor = createSit1024FrameProcessor({ isCar: () => false, isPetCareSystem: () => false, isSmallBedMatrixType: () => false });
  const input = Buffer.from(Array.from({ length: 1024 }, (_, index) => index % 251));
  const result = processor.processFrame(input, { file: 'pressureVest' });
  assert.deepEqual(result.pointArr, Array.from(input));
  assert.deepEqual(JSON.parse(result.jsonData).sitData, Array.from(input));
  const frame = Array(1024).fill(255);
  SENSOR_INDICES.forEach(index => { frame[index] = 0; });
  assert.equal(getPressureVestStatistics(frame).totalPres, 0);
  assert.equal(sensors.getSensorMatrix('pressureVest').total, 1024);
  assert.ok(sensors.isHandGloveType('hand0205Single'));
});

test('history statistics preserve the longer hand tail and vest raw ADC units', () => {
  const normalizeHistoryPressureData = row => row.values;
  const deps = { normalizeHistoryPressureData, formatMatrixTotalForFile: value => value, totalToN: value => value };
  const glove = getHistorySeries({ ...deps, sensorType: 'hand0205',
    sitRows: [{ timestamp: 1, values: [2] }], backRows: [{ timestamp: 1, values: [3] }, { timestamp: 2, values: [4] }] });
  assert.equal(glove.length, 2);
  assert.deepEqual(glove.time, [1, 2]);
  const frame = Array(1024).fill(255); SENSOR_INDICES.forEach(index => { frame[index] = 0; });
  const vest = getHistorySeries({ ...deps, sensorType: 'pressureVest', sitRows: [{ timestamp: 1, values: frame }] });
  assert.deepEqual(vest.press, [0]);
  assert.deepEqual(vest.area, [0]);
});

test('manual glove ports use their selected hand while automatic connection uses the packet hand', () => {
  const output = [];
  const runtime = createHandPacketRuntime({ fullPacketType: 'full', doublePacketType: 'hand0205Double',
    createDoublePacketParser: sensors.handGloveDouble.createHandGloveDoublePacketParser,
    normalizeFiniteFrame: (frame, length) => frame.slice(0, length), bytes4ToInt10: () => [],
    handL: frame => frame, handR: frame => frame, handRVideo1470506: frame => frame,
    publishSit: frame => output.push(['left', JSON.parse(frame)]), publishBack: frame => output.push(['right', JSON.parse(frame)]),
    getRuntime: () => ({ file: 'hand0205Double' }), setRuntime() {},
  });
  const first = Buffer.alloc(130, 2); first[0] = 1; first[1] = 2;
  const second = Buffer.alloc(146, 3); second[0] = 2; second[1] = 2;
  runtime.handleDoublePacket(first, 'left', 'sit'); runtime.handleDoublePacket(second, 'left', 'sit');
  assert.equal(output[0][0], 'left');
  assert.equal(output[0][1].rawPressureData.length, 256);
  runtime.reset({ routeByPacketType: true });
  runtime.handleDoublePacket(first, 'left', 'sit'); runtime.handleDoublePacket(second, 'left', 'sit');
  assert.equal(output[1][0], 'right');
  assert.deepEqual(output[1][1].newArr147Raw, output[1][1].newArr147);
});


test('canonical frames carry unzeroed hand mapping separately from zeroed displayed values', () => {
  const frame = buildSensorFrameEnvelope({ channel: 'sit', payload: { sitData: [0, 0], newArr147: [0, 0], newArr147Raw: [11, 22], realArr: [11, 22] }, sensorType: 'hand0205' });
  assert.equal(frame.channelId, 'hand0205:sit');
  assert.deepEqual(frame.payload.value, [0, 0]);
  assert.deepEqual(frame.payload.stages.mapped, [0, 0]);
  assert.deepEqual(frame.payload.protocol.mappedRaw, [11, 22]);
  assert.equal(Object.hasOwn(frame, 'newArr147Raw'), false);
});

test('a missing hand frame clears the finished hand while the longer hand continues playback', () => {
  const service = createPlaybackFrameService({
    isHandGloveType: type => type === 'hand0205', isThreePortFile: () => false,
    isSmallBedMatrixType: () => false, handL: values => values, handR: values => values,
    parseStoredSensorFrame: data => ({ pressureData: data, rotateData: [], zeroFrame: [] }),
  });
  const result = service.buildPayloads({ sensorType: 'hand0205', index: 1,
    sitRows: [{ data: JSON.stringify(Array(256).fill(1)) }],
    backRows: [{ data: JSON.stringify(Array(256).fill(2)) }, { data: JSON.stringify(Array(256).fill(3)) }] });
  assert.deepEqual(result.sitPayload.sitData, Array(256).fill(0));
  assert.deepEqual(result.backPayload.backData, Array(256).fill(3));
});
