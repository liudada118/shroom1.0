const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createCsvDownloadService,
  sanitizeFileNameSegment,
  shortChannelHash,
} = require('../../kernel/csv/csvDownloadService');

const DATE = '2026-08-31 10:00:00';

function normalizeHistoryPressureData(row, sensorType) {
  normalizeHistoryPressureData.calls.push(sensorType);
  const stored = typeof row?.data === 'string' ? JSON.parse(row.data) : row?.data;
  if (Array.isArray(stored)) return stored.map(Number);
  if (Array.isArray(stored?.pressureData)) return stored.pressureData.map(Number);
  if (Array.isArray(stored?.sitData)) return stored.sitData.map(Number);
  if (Array.isArray(stored?.backData)) return stored.backData.map(Number);
  if (Array.isArray(stored?.headData)) return stored.headData.map(Number);
  return [];
}
normalizeHistoryPressureData.calls = [];

function createService({ exportDir, events, databases, descriptors, rowsByKey, legacyRowsByDb }) {
  const rowsQueries = [];
  const service = createCsvDownloadService({
    fs,
    path,
    logger: { error() {}, warn() {} },
    csvPath: exportDir,
    publishSystemEvent: (event) => events.push(event),
    getRuntime: () => ({ file: 'demo', historyArr: [0, 100] }),
    getDatabases: () => databases,
    queryHistoryChannels: (dbRef) => descriptors.get(dbRef) || [],
    getChannelHistoryStats: (dbRef, _date, channelId) => {
      if (channelId == null) return { count: (legacyRowsByDb.get(dbRef) || []).length };
      return { count: (rowsByKey.get(`${dbRef.name}|${channelId}`) || []).length };
    },
    queryChannelHistoryRows: (dbRef, _date, channelId) => {
      rowsQueries.push({ dbRef, channelId });
      if (channelId == null) return legacyRowsByDb.get(dbRef) || [];
      return rowsByKey.get(`${dbRef.name}|${channelId}`) || [];
    },
    getHistoryStats: () => {
      throw new Error('date-only stats must not be used when exact query helpers exist');
    },
    queryHistoryRows: () => {
      throw new Error('date-only rows must not be used when exact query helpers exist');
    },
    normalizeHistoryPressureData,
    formatMatrixTotalForFile: (value) => value,
    totalToN: (value) => value,
    findMax: (values) => Math.max(...values),
    timeStampToDate: (timestamp) => `time-${timestamp}`,
    timeStampToDateLabel: () => '2026-08-31',
    getCsvElapsedSeconds: (_rows, _index, _start, frameIndex) => String(frameIndex),
    getCsvFilePrefix: (_sensorType, channel) => channel,
    getCsvTitleMap: () => ({
      index: 'index',
      max: 'max',
      time: 'time',
      pressureArea: 'pressureArea',
      pressure: 'pressure',
      realData: 'realData',
    }),
  });
  return { service, rowsQueries };
}

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-csv-channel-test-'));
  try {
    assert.strictEqual(sanitizeFileNameSegment('pad/a?'), 'pad-a');
    assert.notStrictEqual(shortChannelHash('desk:pad/a'), shortChannelHash('desk:pad?a'));

    const db = { name: 'db' };
    const db1 = { name: 'db1' };
    const db2 = { name: 'db2' };
    const databases = { db, db1, db2 };
    const descriptors = new Map([
      [db, [
        {
          channelId: 'desk:pad/a',
          displaySystemId: 'desk',
          sensorId: 'pad/a',
          sensorLabel: '左手 / Left',
          sensorType: 'left-glove',
          outputChannel: 'left',
          schemaVersion: 1,
          serialRole: 'descriptor-left',
          serialPortPath: 'COM1',
          baudRate: 9600,
          parserChannel: 'descriptor-parser',
        },
        {
          channelId: 'desk:pad?a',
          displaySystemId: 'desk',
          sensorId: 'pad?a',
          sensorLabel: '右手 / Right',
          sensorType: 'right-glove',
          outputChannel: 'right',
          schemaVersion: 1,
        },
      ]],
      [db1, []],
      [db2, [{
        channelId: 'desk:head',
        displaySystemId: 'desk',
        sensorId: 'head',
        outputChannel: 'head',
        schemaVersion: 2,
        serialRole: 'head-role',
        serialPortPath: 'COM9',
        baudRate: 57600,
        parserChannel: 'head-parser',
      }]],
    ]);
    const rowsByKey = new Map([
      ['db|desk:pad/a', [{
        id: 1,
        timestamp: 1000,
        data: JSON.stringify({
          data: [1, 2],
          normalizedData: [99, 99],
          sensorType: 'left-glove-v2',
          serial: {
            role: 'actual-left',
            path: 'COM7',
            baudRate: 115200,
            parserChannel: 'actual-parser',
          },
        }),
      }, {
        id: 5,
        timestamp: 1050,
        data: JSON.stringify({
          data: [5, 6],
          sensorType: 'left-glove-v2',
          serial: {
            role: 'actual-left',
            path: 'COM8',
            baudRate: 115200,
            parserChannel: 'actual-parser',
          },
        }),
      }]],
      ['db|desk:pad?a', [{
        id: 2,
        timestamp: 1100,
        data: JSON.stringify({
          normalizedData: [3, 4],
          rightData: [88],
          serialRole: 'actual-right',
          serialPortPath: 'COM8',
          baudRate: 38400,
          parserChannel: 'right-parser',
        }),
      }]],
      ['db2|desk:head', [{
        id: 3,
        timestamp: 1200,
        data: JSON.stringify({ headData: [42] }),
      }]],
    ]);
    const legacyRowsByDb = new Map([
      [db, []],
      [db1, [{ id: 4, timestamp: 1300, data: JSON.stringify([20, 30]) }]],
      [db2, []],
    ]);

    const events = [];
    const exportDir = path.join(tempRoot, 'all');
    const { service } = createService({
      exportDir,
      events,
      databases,
      descriptors,
      rowsByKey,
      legacyRowsByDb,
    });
    const result = await service.exportHistoryCsv({ date: DATE, downloadOptions: {} });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.files.length, 4);
    assert.strictEqual(result.artifacts.length, 4);

    const firstName = path.basename(result.artifacts.find((item) => item.channelId === 'desk:pad/a').file);
    const secondName = path.basename(result.artifacts.find((item) => item.channelId === 'desk:pad?a').file);
    assert.match(firstName, /^desk__左手-Left__pad-a--[a-f0-9]{8}__2026-08-31\.csv$/);
    assert.match(secondName, /^desk__右手-Right__pad-a--[a-f0-9]{8}__2026-08-31\.csv$/);
    assert.notStrictEqual(firstName, secondName, 'sanitized channel name collisions need distinct hashes');
    assert.ok(result.files.some((file) => path.basename(file) === 'back2026-08-31.csv'));

    const leftArtifact = result.artifacts.find((item) => item.channelId === 'desk:pad/a');
    assert.deepStrictEqual({
      serialRole: leftArtifact.serialRole,
      serialPortPath: leftArtifact.serialPortPath,
      baudRate: leftArtifact.baudRate,
      parserChannel: leftArtifact.parserChannel,
      sensorType: leftArtifact.sensorType,
    }, {
      serialRole: 'actual-left',
      serialPortPath: 'COM7',
      baudRate: 115200,
      parserChannel: 'actual-parser',
      sensorType: 'left-glove-v2',
    });
    assert.deepStrictEqual(leftArtifact.serialRoles, ['actual-left']);
    assert.deepStrictEqual(leftArtifact.serialPortPaths, ['COM7', 'COM8']);
    assert.deepStrictEqual(leftArtifact.baudRates, [115200]);
    assert.deepStrictEqual(leftArtifact.parserChannels, ['actual-parser']);
    assert.strictEqual(leftArtifact.serialChanged, true);

    const leftCsv = fs.readFileSync(leftArtifact.file, 'utf8');
    const header = leftCsv.slice(1).split(/\r?\n/)[0];
    assert.strictEqual(
      header,
      'index,max,time,pressureArea,pressure,realData,channelId,displaySystemId,sensorId,sensorLabel,sensorType,outputChannel,timestamp,schemaVersion,serialRole,serialPortPath,baudRate,parserChannel',
    );
    assert.ok(leftCsv.includes('[1,2]'), 'canonical data must win over normalizedData');
    assert.ok(!leftCsv.includes('[99,99]'));
    assert.ok(leftCsv.includes('actual-left'));
    assert.ok(leftCsv.includes('COM7'));
    assert.strictEqual(leftArtifact.sensorLabel, '左手 / Left');
    assert.ok(normalizeHistoryPressureData.calls.includes('left-glove-v2'));
    assert.ok(normalizeHistoryPressureData.calls.includes('right-glove'));

    const rightArtifact = result.artifacts.find((item) => item.channelId === 'desk:pad?a');
    const rightDataRow = fs.readFileSync(rightArtifact.file, 'utf8').split(/\r?\n/)[1];
    assert.strictEqual(rightDataRow.split(',')[3], '2', 'canonical non-sit labels must not use legacy back threshold');

    const successEvent = events.find((event) => event.download === 'export csv success');
    assert.deepStrictEqual(successEvent.downloadFiles, result.files);
    assert.strictEqual(successEvent.downloadArtifacts.length, 4);
    assert.ok(events.some((event) => event.csvDownloadProgress?.channelId === 'desk:pad/a'));

    // 精确筛选只能执行目标 channelId 的行查询；未知目标会作为 skipped 返回。
    const filteredEvents = [];
    const filtered = createService({
      exportDir: path.join(tempRoot, 'filtered'),
      events: filteredEvents,
      databases,
      descriptors,
      rowsByKey,
      legacyRowsByDb,
    });
    const filteredResult = await filtered.service.exportHistoryCsv({
      date: DATE,
      downloadOptions: { channelIds: ['desk:pad?a', 'desk:missing'] },
    });
    assert.strictEqual(filteredResult.ok, true);
    assert.deepStrictEqual(filteredResult.artifacts.map((item) => item.channelId), ['desk:pad?a']);
    assert.deepStrictEqual(filteredResult.skippedChannels, ['desk:missing']);
    assert.deepStrictEqual(
      filtered.rowsQueries.filter((query) => query.channelId != null).map((query) => query.channelId),
      ['desk:pad?a'],
    );

    const emptyEvents = [];
    const empty = createService({
      exportDir: path.join(tempRoot, 'empty'),
      events: emptyEvents,
      databases,
      descriptors,
      rowsByKey,
      legacyRowsByDb,
    });
    const emptyResult = await empty.service.exportHistoryCsv({
      date: DATE,
      downloadOptions: { channelIds: [] },
    });
    assert.strictEqual(emptyResult.ok, false);
    assert.match(emptyResult.error, /must not be empty/);
    assert.strictEqual(emptyEvents.at(-1).download, 'export csv failed');

    const unknownResult = await empty.service.exportHistoryCsv({
      date: DATE,
      downloadOptions: { channelIds: ['desk:unknown'] },
    });
    assert.strictEqual(unknownResult.ok, false);
    assert.match(unknownResult.error, /no requested history channels found/);

    // 没有新 query helper 的旧装配仍按 db/db1/db2 全部导出，不再依赖 isCar 判断。
    const legacyEvents = [];
    const legacyDir = path.join(tempRoot, 'legacy-only');
    const oldRows = new Map([
      [db, [{ timestamp: 1, data: '[1]' }]],
      [db1, [{ timestamp: 2, data: '[2]' }]],
      [db2, [{ timestamp: 3, data: '[3]' }]],
    ]);
    const legacyService = createCsvDownloadService({
      fs,
      path,
      logger: { error() {}, warn() {} },
      csvPath: legacyDir,
      publishSystemEvent: (event) => legacyEvents.push(event),
      getRuntime: () => ({ file: 'legacyDemo', historyArr: [0, 10] }),
      getDatabases: () => databases,
      getHistoryStats: (dbRef) => ({ count: oldRows.get(dbRef).length }),
      queryHistoryRows: (dbRef) => oldRows.get(dbRef),
      normalizeHistoryPressureData,
      formatMatrixTotalForFile: (value) => value,
      totalToN: (value) => value,
      findMax: (values) => Math.max(...values),
      timeStampToDate: String,
      timeStampToDateLabel: () => '2026-08-31',
      getCsvElapsedSeconds: () => '0',
      getCsvFilePrefix: (_type, channel) => channel,
      getCsvTitleMap: () => ({}),
    });
    const legacyResult = await legacyService.exportHistoryCsv({ date: DATE });
    assert.strictEqual(legacyResult.ok, true);
    assert.deepStrictEqual(
      legacyResult.artifacts.map((item) => item.outputChannel),
      ['sit', 'back', 'head'],
    );

    console.log('csvDownloadService.test.js passed');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
