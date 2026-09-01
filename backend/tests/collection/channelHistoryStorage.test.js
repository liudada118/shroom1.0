const assert = require('assert');
const sqlite3 = require('../../kernel/storage/sqlite3-compat').verbose();
const {
  CHANNEL_HISTORY_COLUMNS,
  ensureChannelHistorySchema,
} = require('../../kernel/storage/dbManager');
const {
  createChannelHistoryRowsForPlayback,
  getChannelHistoryStats,
  queryChannelHistoryRows,
  queryHistoryChannels,
} = require('../../kernel/storage/history/historyQueryService');

function createLegacyMatrixDb() {
  const db = new sqlite3.Database(':memory:');
  db._db.exec(`CREATE TABLE matrix (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT,
    timestamp INTEGER,
    date TEXT
  )`);
  return db;
}

function insertCanonicalFrame(db, {
  data,
  timestamp,
  date,
  channelId,
  displaySystemId,
  sensorId,
  sensorLabel,
  sensorType = null,
  outputChannel,
  schemaVersion = 1,
  serialRole,
  serialPortPath,
  baudRate,
  parserChannel,
}) {
  db._db.prepare(`INSERT INTO matrix (
    data, timestamp, date, channel_id, display_system_id, sensor_id, sensor_label, sensor_type,
    output_channel, schema_version, serial_role, serial_port_path, baud_rate, parser_channel
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    data,
    timestamp,
    date,
    channelId,
    displaySystemId,
    sensorId,
    sensorLabel,
    sensorType,
    outputChannel,
    schemaVersion,
    serialRole,
    serialPortPath,
    baudRate,
    parserChannel,
  );
}

const migratedDb = createLegacyMatrixDb();
ensureChannelHistorySchema(migratedDb);
ensureChannelHistorySchema(migratedDb);

const migratedColumns = new Set(
  migratedDb._db.prepare('PRAGMA table_info(matrix)').all().map((column) => column.name),
);
CHANNEL_HISTORY_COLUMNS.forEach(([column]) => assert.ok(migratedColumns.has(column), column));
assert.ok(migratedColumns.has('data'));
assert.ok(migratedColumns.has('timestamp'));
assert.ok(migratedColumns.has('date'));

const channelIndex = migratedDb._db.prepare('PRAGMA index_list(matrix)').all()
  .find((index) => index.name === 'idx_matrix_date_channel_id_id');
assert.ok(channelIndex);
assert.strictEqual(channelIndex.partial, 1);
assert.deepStrictEqual(
  migratedDb._db.prepare('PRAGMA index_info(idx_matrix_date_channel_id_id)').all()
    .map((column) => column.name),
  ['date', 'channel_id', 'id'],
);

// 新列全部可空，旧版三列 INSERT 在迁移后仍可继续写。
migratedDb._db.prepare(
  'INSERT INTO matrix (data, timestamp, date) VALUES (?, ?, ?)',
).run('[0]', 1000, 'session-a');
insertCanonicalFrame(migratedDb, {
  data: '[11]',
  timestamp: 1001,
  date: 'session-a',
  channelId: 'chair:left-seat',
  displaySystemId: 'chair',
  sensorId: 'left-seat',
  sensorLabel: '左侧座椅',
  sensorType: 'seat-pressure',
  outputChannel: 'left',
  serialRole: 'leftPort',
  serialPortPath: 'COM3',
  baudRate: 115200,
  parserChannel: 'left-parser',
});
insertCanonicalFrame(migratedDb, {
  data: '[21]',
  timestamp: 1002,
  date: 'session-a',
  channelId: 'chair:right-seat',
  displaySystemId: 'chair',
  sensorId: 'right-seat',
  sensorLabel: '右侧座椅',
  sensorType: 'seat-pressure',
  outputChannel: 'right',
  serialRole: 'rightPort',
  serialPortPath: 'COM4',
  baudRate: 921600,
  parserChannel: 'right-parser',
});
insertCanonicalFrame(migratedDb, {
  data: '[12]',
  timestamp: 1003,
  date: 'session-a',
  channelId: 'chair:left-seat',
  displaySystemId: 'chair',
  sensorId: 'left-seat',
  sensorLabel: '左侧座椅',
  sensorType: 'seat-pressure',
  outputChannel: 'left',
  serialRole: 'leftPort',
  serialPortPath: 'COM3',
  baudRate: 115200,
  parserChannel: 'left-parser',
});
// 非 NULL 行声称自己是 canonical；多冒号或显式身份矛盾时必须从发现结果中剔除，
// 不能降级混进 NULL legacy 组。
insertCanonicalFrame(migratedDb, {
  data: '[98]',
  timestamp: 1004,
  date: 'session-a',
  channelId: 'chair:left-seat:raw',
  displaySystemId: 'chair',
  sensorId: 'left-seat:raw',
  sensorLabel: '歧义通道',
  outputChannel: 'ambiguous',
});
insertCanonicalFrame(migratedDb, {
  data: '[99]',
  timestamp: 1005,
  date: 'session-a',
  channelId: 'chair:ghost',
  displaySystemId: 'other-chair',
  sensorId: 'ghost',
  sensorLabel: '冲突通道',
  outputChannel: 'ghost',
});

const channels = queryHistoryChannels(migratedDb, 'session-a');
assert.deepStrictEqual(channels.map((channel) => channel.channelId), [
  null,
  'chair:left-seat',
  'chair:right-seat',
]);
assert.deepStrictEqual(channels[0], {
  channelId: null,
  displaySystemId: null,
  sensorId: null,
  sensorLabel: null,
  sensorType: null,
  outputChannel: null,
  schemaVersion: null,
  serialRoles: [],
  serialPortPaths: [],
  baudRates: [],
  parserChannels: [],
  count: 1,
  minId: 1,
  maxId: 1,
  serialRole: null,
  serialPortPath: null,
  baudRate: null,
  parserChannel: null,
});
assert.deepStrictEqual(channels[1], {
  channelId: 'chair:left-seat',
  displaySystemId: 'chair',
  sensorId: 'left-seat',
  sensorLabel: '左侧座椅',
  sensorType: 'seat-pressure',
  outputChannel: 'left',
  schemaVersion: 1,
  serialRoles: ['leftPort'],
  serialPortPaths: ['COM3'],
  baudRates: [115200],
  parserChannels: ['left-parser'],
  count: 2,
  minId: 2,
  maxId: 4,
  serialRole: 'leftPort',
  serialPortPath: 'COM3',
  baudRate: 115200,
  parserChannel: 'left-parser',
});
assert.deepStrictEqual(
  getChannelHistoryStats(migratedDb, 'session-a', 'chair:left-seat:raw'),
  { count: 0, minId: 0, maxId: 0 },
  '精确 canonical 查询不能接受多冒号 channelId',
);
assert.deepStrictEqual(
  queryChannelHistoryRows(migratedDb, 'session-a', 'chair:left-seat:raw', 10),
  [],
);

// 串口重新插拔或改波特率时保留完整物理来源集合，避免用最后一帧覆盖会话事实。
insertCanonicalFrame(migratedDb, {
  data: '[31]',
  timestamp: 2001,
  date: 'session-b',
  channelId: 'chair:left-seat',
  displaySystemId: 'chair',
  sensorId: 'left-seat',
  sensorLabel: '左侧座椅',
  sensorType: 'seat-pressure',
  outputChannel: 'left',
  serialRole: 'leftPort',
  serialPortPath: 'COM3',
  baudRate: 115200,
  parserChannel: 'left-parser',
});
insertCanonicalFrame(migratedDb, {
  data: '[32]',
  timestamp: 2002,
  date: 'session-b',
  channelId: 'chair:left-seat',
  displaySystemId: 'chair',
  sensorId: 'left-seat',
  sensorLabel: '左侧座椅',
  sensorType: 'seat-pressure',
  outputChannel: 'left',
  serialRole: 'leftPort',
  serialPortPath: 'COM5',
  baudRate: 230400,
  parserChannel: 'left-parser',
});
const changedSerialChannel = queryHistoryChannels(migratedDb, 'session-b')[0];
assert.strictEqual(changedSerialChannel.serialPortPath, null);
assert.deepStrictEqual(changedSerialChannel.serialPortPaths, ['COM3', 'COM5']);
assert.strictEqual(changedSerialChannel.baudRate, null);
assert.deepStrictEqual(changedSerialChannel.baudRates, [115200, 230400]);
assert.strictEqual(changedSerialChannel.serialRole, 'leftPort');
assert.strictEqual(changedSerialChannel.parserChannel, 'left-parser');

assert.deepStrictEqual(getChannelHistoryStats(migratedDb, 'session-a', null), {
  count: 1,
  minId: 1,
  maxId: 1,
});
assert.deepStrictEqual(getChannelHistoryStats(migratedDb, 'session-a', 'chair:left-seat'), {
  count: 2,
  minId: 2,
  maxId: 4,
});
assert.deepStrictEqual(
  queryChannelHistoryRows(migratedDb, 'session-a', 'chair:left-seat', 10)
    .map((row) => row.data),
  ['[11]', '[12]'],
);
assert.deepStrictEqual(
  queryChannelHistoryRows(migratedDb, 'session-a', null, 10).map((row) => row.data),
  ['[0]'],
);
assert.deepStrictEqual(
  queryChannelHistoryRows(migratedDb, 'session-a', 'chair:missing', 10),
  [],
);

const eagerRows = createChannelHistoryRowsForPlayback(
  migratedDb,
  'session-a',
  'chair:left-seat',
  getChannelHistoryStats(migratedDb, 'session-a', 'chair:left-seat'),
  true,
);
assert.deepStrictEqual(eagerRows.map((row) => row.data), ['[11]', '[12]']);

const lazyRows = createChannelHistoryRowsForPlayback(
  migratedDb,
  'session-a',
  'chair:left-seat',
  getChannelHistoryStats(migratedDb, 'session-a', 'chair:left-seat'),
  false,
);
assert.strictEqual(lazyRows.length, 2);
assert.strictEqual(lazyRows.__historyChannelId, 'chair:left-seat');
assert.strictEqual(lazyRows[0].data, '[11]');
assert.strictEqual(lazyRows[1].data, '[12]');
assert.deepStrictEqual([...lazyRows].map((row) => row.data), ['[11]', '[12]']);

// 迁移前旧库：null 仍严格表示全部 legacy 行，canonical 查询友好返回空结果。
const legacyDb = createLegacyMatrixDb();
legacyDb._db.prepare(
  'INSERT INTO matrix (data, timestamp, date) VALUES (?, ?, ?)',
).run('[7]', 2000, 'legacy-session');
const embeddedManifestFrame = JSON.stringify({
  runtimeSource: 'display-system',
  channelId: 'legacy-display:left-hand',
  displaySystemId: 'legacy-display',
  sensorId: 'left-hand',
  sensorLabel: '左手',
  sensorType: 'glove-pressure',
  outputChannel: 'leftHand',
  schemaVersion: 1,
  serial: {
    role: 'leftPort',
    path: 'COM8',
    baudRate: 460800,
    parserChannel: 'left-parser',
  },
  leftHandData: [8],
});
legacyDb._db.prepare(
  'INSERT INTO matrix (data, timestamp, date) VALUES (?, ?, ?)',
).run(embeddedManifestFrame, 2001, 'legacy-session');
const preMigrationChannels = queryHistoryChannels(legacyDb, 'legacy-session');
assert.deepStrictEqual(
  preMigrationChannels.map((channel) => channel.channelId),
  [null, 'legacy-display:left-hand'],
);
assert.strictEqual(preMigrationChannels[0].count, 1);
assert.deepStrictEqual(preMigrationChannels[1], {
  channelId: 'legacy-display:left-hand',
  displaySystemId: 'legacy-display',
  sensorId: 'left-hand',
  sensorLabel: '左手',
  sensorType: 'glove-pressure',
  outputChannel: 'leftHand',
  schemaVersion: 1,
  serialRoles: ['leftPort'],
  serialPortPaths: ['COM8'],
  baudRates: [460800],
  parserChannels: ['left-parser'],
  count: 1,
  minId: 2,
  maxId: 2,
  serialRole: 'leftPort',
  serialPortPath: 'COM8',
  baudRate: 460800,
  parserChannel: 'left-parser',
});
assert.strictEqual(getChannelHistoryStats(legacyDb, 'legacy-session', null).count, 1);
assert.strictEqual(
  getChannelHistoryStats(legacyDb, 'legacy-session', 'legacy-display:left-hand').count,
  1,
);
assert.strictEqual(queryChannelHistoryRows(legacyDb, 'legacy-session', null, 10)[0].data, '[7]');
assert.strictEqual(
  queryChannelHistoryRows(legacyDb, 'legacy-session', 'legacy-display:left-hand', 10)[0].data,
  embeddedManifestFrame,
);

// 表结构升级只补列，不重写旧 data；查询期仍能发现这些升级前 manifest 帧。
ensureChannelHistorySchema(legacyDb);
assert.deepStrictEqual(
  queryHistoryChannels(legacyDb, 'legacy-session').map((channel) => channel.channelId),
  [null, 'legacy-display:left-hand'],
);
assert.strictEqual(
  getChannelHistoryStats(legacyDb, 'legacy-session', 'legacy-display:left-hand').count,
  1,
);
assert.strictEqual(queryChannelHistoryRows(legacyDb, 'legacy-session', null, 10).length, 1);

const legacyLazyRows = createChannelHistoryRowsForPlayback(
  legacyDb,
  'legacy-session',
  null,
  getChannelHistoryStats(legacyDb, 'legacy-session', null),
  false,
);
assert.strictEqual(legacyLazyRows[0].data, '[7]');

// 不带原生连接的轻量 mock 不应因 PRAGMA 或新列查询抛错。
assert.deepStrictEqual(queryHistoryChannels({}, 'session-a'), []);
assert.deepStrictEqual(getChannelHistoryStats({}, 'session-a', null), {
  count: 0,
  minId: 0,
  maxId: 0,
});
assert.deepStrictEqual(queryChannelHistoryRows({}, 'session-a', null, 10), []);

legacyDb.close();
migratedDb.close();
console.log('channelHistoryStorage.test.js passed');
