const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { createObjectCsvStringifier } = require('csv-writer');
const acorn = createRequire(path.join(__dirname, '../client/package.json'))('acorn');
const { totalToN } = require('../util');
const { findMax } = require('../server/mathUtils');
const { timeStampToDate, timeStampTo_Date } = require('../openWeb');
const { prefixCsvHeaderWithBom, CSV_UTF8_BOM } = require('../server/csvUtf8');
const { getCollectionCsvLabelInfo } = require('../server/csvMatrixUtils');

const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest' });
const BASE_TIME = 1700000000000;
const DATE = String(BASE_TIME);
const GLOVE_TYPES = ['hand0205', 'handGlove115200', 'handGloveFullPacket'];

/** 提取实际导出代码，避免启动 Electron、串口或生产数据库。 */
function symbolSource(name) {
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id.name === name) return source.slice(node.start, node.end);
    if (node.type !== 'VariableDeclaration') continue;
    const declaration = node.declarations.find((item) => item.id.name === name);
    if (declaration) return `${node.kind} ${source.slice(declaration.start, declaration.end)};`;
  }
  assert.fail(`Missing server symbol ${name}`);
}

/** 构造带独立矩阵、四元数和清零帧的实际历史存储记录。 */
function historyRow(id, timestamp, marker = 1, legacy = false) {
  const pressureData = Array.from({ length: 256 }, (_, index) => marker + index);
  const rotate = [marker, marker + 0.1, marker + 0.2, marker + 0.3];
  const zeroFrame = new Array(256).fill(marker + 1000);
  return {
    id, timestamp, date: DATE,
    data: JSON.stringify(legacy ? [...pressureData, ...rotate] : { pressureData, rotate, zeroFrame }),
  };
}

/** 解析真正写出的 CSV，包含 JSON 单元格里的逗号和转义引号。 */
function parseCsv(content) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const text = content.startsWith(CSV_UTF8_BOM) ? content.slice(1) : content;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if (character === '\n' && !quoted) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (character !== '\r' || quoted) cell += character;
  }
  assert.equal(quoted, false, 'CSV must not end inside a quoted field');
  if (row.length || cell) rows.push([...row, cell]);
  return rows;
}

/** 替换历史数据库 I/O，保留真实流式合并、帧解析、表头和文件写入。 */
function createExportHarness(t, { file = 'hand0205', left = [], right = [], range = [0, null] } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'shroom-glove-csv-'));
  t.after(async () => {
    await new Promise((resolve) => setImmediate(resolve));
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('shroom-glove-csv-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const successes = [], failures = [], progress = [], queries = [], headers = [];
  // 与真实 SQL 保持相同的 timestamp/id 排序，只替换数据库 I/O。
  const gloveRows = (dbRef, date) => dbRef.rows.filter((row) => row.date === date)
    .sort((leftRow, rightRow) => Number(leftRow.timestamp) - Number(rightRow.timestamp) || leftRow.id - rightRow.id);
  const sandbox = {
    fs, path, console, Buffer, totalToN, findMax, timeStampToDate, timeStampTo_Date,
    prefixCsvHeaderWithBom, getCollectionCsvLabelInfoFromValue: getCollectionCsvLabelInfo,
    file, colHZ: 12, historyArr: range, nowGetTime: DATE,
    db: { rows: left }, db1: { rows: right },
    getHistoryStats: (dbRef, date) => {
      const rows = dbRef.rows.filter((row) => row.date === date);
      return { count: rows.length, minId: rows[0]?.id || 0, maxId: rows.at(-1)?.id || 0 };
    },
    queryHistoryRows: (dbRef, date, limit, offset = 0) => {
      queries.push({ kind: 'offset', limit, offset });
      return dbRef.rows.filter((row) => row.date === date).slice(offset, offset + limit);
    },
    queryHistoryRowsFromId: (dbRef, date, minId, limit) => {
      queries.push({ kind: 'cursor', minId, limit });
      return dbRef.rows.filter((row) => row.date === date && row.id >= minId).slice(0, limit);
    },
    queryGloveHistoryRows: (dbRef, date, limit, offset = 0) => {
      queries.push({ kind: 'glove-offset', limit, offset });
      return gloveRows(dbRef, date).slice(offset, offset + limit);
    },
    queryGloveHistoryRowsAfter: (dbRef, date, timestamp, id, limit) => {
      queries.push({ kind: 'glove-cursor', limit, timestamp, id });
      return gloveRows(dbRef, date).filter((row) => Number(row.timestamp) > Number(timestamp)
        || (Number(row.timestamp) === Number(timestamp) && row.id > id)).slice(0, limit);
    },
    createCsvStringifier: (options) => {
      headers.push(Array.from(options.header, (header) => ({ ...header })));
      return createObjectCsvStringifier(options);
    },
  };
  vm.createContext(sandbox);
  const symbols = [
    'HAND_GLOVE_FULL_PACKET', 'HAND_GLOVE_DOUBLE', 'HAND_GLOVE_TYPES',
    'TEMP_FULL_BED_TYPE', 'SMALL_BED_TYPE', 'SMALL_BED_NO_ALG_TYPE', 'SMALL_BED_12B_TYPE',
    'WHOLE_CHAIR_TYPE', 'isHandGloveType', 'isHandStorageType', 'isZeroFrameStorageType',
    'HAND_GLOVE_CSV_SEGMENT_HEADER_TITLES', 'HAND_GLOVE_CSV_SEGMENT_HEADER_IDS',
    'HAND_GLOVE_CSV_SEGMENT_POINTS', 'CSV_TITLES', 'getCsvLanguage', 'getCsvTitleMap',
    'getCsvTitleLanguage', 'getHandGloveSideLabels', 'getHandGloveCsvFilePrefix',
    'appendHandGloveCsvHeaders', 'buildHandGloveCsvSegments', 'normalizeFiniteFrame',
    'appendPrefixedHandGloveCsvHeaders', 'buildPrefixedHandGloveCsvSegments', 'buildStoredHandGloveCsvFrame',
    'parseStoredFrameData', 'parseStoredSensorFrame', 'shouldTransposeSmallBedRawMatrix',
    'formatMatrixTotalForFile', 'formatCsvDatePart', 'getCollectionCsvLabelInfo',
    'hasCollectionLabelInfo', 'appendCollectionLabelHeaders', 'applyCollectionLabelInfo',
    'getCsvElapsedSecondsFromBase', 'buildGenericSitCsvRow', 'buildGenericBackCsvRow',
    'getDefaultSitCsvHeaders', 'getDefaultBackCsvHeaders', 'writeStreamChunk', 'closeWriteStream',
    'iterateHandGloveHistoryRows', 'mergeHandGloveHistoryRows', 'getCombinedHandGloveCsvFilePrefix',
    'buildCombinedHandGloveCsvRow', 'exportCombinedHandGloveCsvStreaming',
    'retainHandGloveExportSources', 'exportHandGloveDoubleCsvStreaming', 'exportHistoryCsvStreaming',
  ];
  vm.runInContext(symbols.map(symbolSource).join('\n'), sandbox);
  return {
    sandbox, successes, failures, progress, queries, directory,
    /** 发出真实下载请求，允许失败场景独立检查通知。 */
    async request(language = 'en') {
      await sandbox.exportHistoryCsvStreaming({
        date: DATE,
        csvTitle: sandbox.getCsvTitleMap({ language }),
        csvTargetPath: (filename) => path.join(directory, filename),
        sendCsvSuccess: (files) => successes.push(Array.from(files)),
        sendCsvFailed: (error) => failures.push(error),
        sendCsvProgress: (value) => progress.push({ ...value }),
        downloadOptions: { language },
      });
    },
    async export(language = 'en') {
      await this.request(language);
      assert.deepEqual(failures, []);
      assert.equal(successes.length, 1);
      assert.equal(successes[0].length, 1);
      assert.equal(fs.readdirSync(directory).length, 1);
      const content = fs.readFileSync(successes[0][0], 'utf8');
      assert.equal(content[0], CSV_UTF8_BOM);
      const [titles, ...values] = parseCsv(content);
      assert.deepEqual(titles, headers[0].map((header) => header.title));
      const ids = headers[0].map((header) => header.id);
      const records = values.map((row) => {
        assert.equal(row.length, ids.length, 'every CSV row must match its header width');
        return Object.fromEntries(ids.map((id, index) => [id, row[index]]));
      });
      return { records, headers: headers[0], filename: path.basename(successes[0][0]) };
    },
  };
}

for (const file of GLOVE_TYPES) {
  test(`${file} exports both hands into one chronological CSV without pairing unrelated frames`, async (t) => {
    const left = [historyRow(1, BASE_TIME, 1), historyRow(9, BASE_TIME + 30, 20)];
    const right = [historyRow(3, BASE_TIME + 10, 40), historyRow(12, BASE_TIME + 20, 60)];
    const harness = createExportHarness(t, { file, left, right });
    const { records } = await harness.export();
    assert.equal(records.length, 4, 'every source frame must produce its own CSV row');
    assert.deepEqual(records.map((row) => row.hand), ['left', 'right', 'right', 'left']);
    assert.deepEqual(records.map((row) => row.index), ['0.000', '0.010', '0.020', '0.030']);
    const expectedRows = [left[0], right[0], right[1], left[1]];
    for (let index = 0; index < records.length; index += 1) {
      const row = records[index];
      const stored = JSON.parse(expectedRows[index].data);
      assert.equal(row.time, timeStampToDate(expectedRows[index].timestamp));
      assert.deepEqual(JSON.parse(row.realData), stored.pressureData, 'matrix stays with its original hand and millisecond timestamp');
      assert.deepEqual(JSON.parse(row.rotate), stored.rotate);
      assert.deepEqual(JSON.parse(row.zeroFrame), stored.zeroFrame);
      const littleFingerChannel = row.hand === 'left' ? 31 : 228;
      const thumbChannel = row.hand === 'left' ? 19 : 240;
      assert.equal(JSON.parse(row.littleFinger)[0], stored.pressureData[littleFingerChannel - 1]);
      assert.equal(JSON.parse(row.thumb)[0], stored.pressureData[thumbChannel - 1]);
      assert.equal(Number(row.max), Math.max(...stored.pressureData));
      assert.equal(Number(row.pressure), stored.pressureData.reduce((sum, value) => sum + value, 0));
      assert.equal(Number(row.pressureArea), stored.pressureData.filter((value) => value > (row.hand === 'left' ? 0 : 10)).length);
    }
    const finalProgress = harness.progress.at(-1);
    assert.equal(finalProgress.percent, 100);
    assert.equal(finalProgress.written, records.length);
    assert.equal(finalProgress.total, records.length);
    assert.equal(finalProgress.fileCount, 1);
    assert.equal(finalProgress.fileIndex, 1);
    assert.ok(harness.progress.every((value) => value.fileCount === 1));
  });
}

test('equal millisecond timestamps and repeated timestamps preserve every frame with stable left-first ordering', async (t) => {
  const harness = createExportHarness(t, {
    left: [historyRow(1, BASE_TIME, 10), historyRow(7, BASE_TIME, 20), historyRow(9, BASE_TIME + 2, 30)],
    right: [historyRow(2, BASE_TIME, 40), historyRow(10, BASE_TIME + 1, 50)],
  });
  const { records } = await harness.export();
  assert.equal(records.length, 5);
  assert.deepEqual(records.map((row) => row.hand), ['left', 'left', 'right', 'right', 'left']);
  assert.deepEqual(records.map((row) => JSON.parse(row.realData)[0]), [10, 20, 40, 50, 30]);
  assert.deepEqual(records.map((row) => row.index), ['0.000', '0.000', '0.000', '0.001', '0.002']);
});

test('hand0205Double keeps its existing wide CSV with separate left/right columns', async (t) => {
  const left = historyRow(1, BASE_TIME, 11);
  const right = historyRow(2, BASE_TIME + 1, 22);
  const harness = createExportHarness(t, { file: 'hand0205Double', left: [left], right: [right] });
  const { records, headers, filename } = await harness.export();
  assert.equal(records.length, 1, 'the existing glove2 wide format remains one paired row');
  assert.ok(filename.startsWith('glove2'));
  assert.equal(headers.some((header) => header.id === 'hand'), false);
  const row = records[0];
  assert.deepEqual(JSON.parse(row.leftRealData), JSON.parse(left.data).pressureData);
  assert.deepEqual(JSON.parse(row.rightRealData), JSON.parse(right.data).pressureData);
  assert.deepEqual(JSON.parse(row.leftZeroFrame), JSON.parse(left.data).zeroFrame);
  assert.deepEqual(JSON.parse(row.rightZeroFrame), JSON.parse(right.data).zeroFrame);
  assert.deepEqual(JSON.parse(row.leftRotate), JSON.parse(left.data).rotate);
  assert.deepEqual(JSON.parse(row.rightRotate), JSON.parse(right.data).rotate);
  assert.equal(JSON.parse(row.leftLittleFinger)[0], JSON.parse(left.data).pressureData[30]);
  assert.equal(JSON.parse(row.rightLittleFinger)[0], JSON.parse(right.data).pressureData[227]);
});

test('the same exclusive start/end selection applies to each hand even when stored IDs have gaps', async (t) => {
  const left = [historyRow(1, BASE_TIME), historyRow(10, BASE_TIME + 3, 10), historyRow(20, BASE_TIME + 6, 20), historyRow(30, BASE_TIME + 9, 30)];
  const right = [historyRow(2, BASE_TIME + 1, 2), historyRow(11, BASE_TIME + 4, 11), historyRow(22, BASE_TIME + 7, 22)];
  const harness = createExportHarness(t, { left, right, range: [1, 3] });
  const { records } = await harness.export();
  assert.equal(records.length, 4);
  assert.deepEqual(records.map((row) => JSON.parse(row.realData)[0]), [10, 11, 20, 22]);
  assert.deepEqual(records.map((row) => row.hand), ['left', 'right', 'left', 'right']);
  assert.deepEqual(records.map((row) => row.index), ['0.000', '0.001', '0.003', '0.004']);
  assert.ok(harness.queries.some((query) => query.kind === 'glove-offset' && query.offset === 1));
});

for (const side of ['left', 'right']) {
  test(`an absent ${side === 'left' ? 'right' : 'left'} hand exports only the available ${side} frames`, async (t) => {
    const frames = [historyRow(4, BASE_TIME, 4), historyRow(17, BASE_TIME + 5, 17)];
    const harness = createExportHarness(t, { [side]: frames });
    const { records } = await harness.export();
    assert.equal(records.length, frames.length);
    assert.deepEqual(records.map((row) => row.hand), [side, side]);
    assert.deepEqual(records.map((row) => row.index), ['0.000', '0.005']);
    assert.deepEqual(records.map((row) => row.time), frames.map((row) => timeStampToDate(row.timestamp)));
    assert.deepEqual(records.map((row) => JSON.parse(row.realData)[0]), [4, 17]);
  });
}

test('legacy 260-value glove rows retain all 256 pressure values and their four quaternion values', async (t) => {
  const left = historyRow(1, BASE_TIME, 7, true);
  const right = historyRow(2, BASE_TIME + 1, 8, true);
  const harness = createExportHarness(t, { left: [left], right: [right] });
  const { records } = await harness.export();
  for (const [index, storedRow] of [left, right].entries()) {
    const raw = JSON.parse(storedRow.data);
    assert.deepEqual(JSON.parse(records[index].realData), raw.slice(0, 256));
    assert.deepEqual(JSON.parse(records[index].rotate), raw.slice(256));
    assert.equal(records[index].zeroFrame, '');
  }
});

const LANGUAGES = [
  { language: 'zh', handTitle: '手别', left: '左手', right: '右手', matrix: '矩阵数据', littleFinger: '小拇指', prefix: '触觉手套' },
  { language: 'en', handTitle: 'hand', left: 'left', right: 'right', matrix: 'data', littleFinger: 'littleFinger', prefix: 'glove' },
  { language: 'ja', handTitle: '手側', left: '左手', right: '右手', matrix: 'マトリックスデータ', littleFinger: '小指', prefix: '触覚グローブ' },
];

for (const expected of LANGUAGES) {
  test(`${expected.language} CSV localizes hand labels, matrix headers, finger headers and the single filename`, async (t) => {
    const harness = createExportHarness(t, { left: [historyRow(1, BASE_TIME)], right: [historyRow(2, BASE_TIME + 1)] });
    const { records, headers, filename } = await harness.export(expected.language);
    const titles = Object.fromEntries(headers.map((header) => [header.id, header.title]));
    assert.equal(titles.hand, expected.handTitle);
    assert.equal(titles.realData, expected.matrix);
    assert.equal(titles.littleFinger, expected.littleFinger);
    assert.deepEqual(records.map((row) => row.hand), [expected.left, expected.right]);
    assert.ok(filename.startsWith(expected.prefix));
  });
}

test('merging more than one 1000-frame batch keeps both streams and the final right-hand frame', async (t) => {
  const count = 1001;
  const left = Array.from({ length: count }, (_, index) => historyRow(1 + index * 5, BASE_TIME + index * 2, 1));
  const right = Array.from({ length: count }, (_, index) => historyRow(3 + index * 7, BASE_TIME + index * 2 + 1, 2));
  const harness = createExportHarness(t, { left, right });
  const { records } = await harness.export();
  assert.equal(records.length, count * 2);
  for (let index = 0; index < records.length; index += 1) {
    assert.equal(records[index].hand, index % 2 ? 'right' : 'left');
    assert.equal(records[index].time, timeStampToDate(BASE_TIME + index));
    assert.equal(records[index].index, (index / 1000).toFixed(3));
  }
  assert.equal(records.at(-1).hand, 'right');
  assert.ok(harness.queries.filter((query) => query.kind.startsWith('glove-')).every((query) => query.limit <= 1000));
  assert.equal(harness.progress.at(-1).written, count * 2);
  assert.equal(harness.progress.at(-1).total, count * 2);
});

test('empty or invalid timestamps fail export while epoch zero and numeric strings retain their actual frame time', async (t) => {
  for (const timestamp of [null, undefined, '', '   ', 'invalid timestamp']) {
    const harness = createExportHarness(t, { left: [historyRow(1, timestamp)] });
    await harness.request();
    assert.equal(harness.successes.length, 0, `invalid timestamp ${String(timestamp)} must not report success`);
    assert.equal(harness.failures.length, 1);
    assert.match(harness.failures[0].message, /invalid timestamp/);
    assert.ok(harness.progress.every((value) => value.percent < 100));
  }
  const valid = createExportHarness(t, {
    left: [historyRow(1, 0), historyRow(9, '2000')],
    right: [historyRow(2, 1), historyRow(11, '2001')],
  });
  const { records } = await valid.export();
  assert.deepEqual(records.map((row) => row.index), ['0.000', '0.001', '2.000', '2.001']);
  assert.deepEqual(records.map((row) => row.time), [0, 1, 2000, 2001].map(timeStampToDate));
});

test('a history stream ending before its selected count fails instead of reporting an incomplete CSV as successful', async (t) => {
  const harness = createExportHarness(t, {
    left: [historyRow(1, BASE_TIME), historyRow(9, BASE_TIME + 2)],
    right: [historyRow(3, BASE_TIME + 1)],
  });
  const query = harness.sandbox.queryGloveHistoryRows;
  let leftReadCount = 0;
  harness.sandbox.queryGloveHistoryRows = (dbRef, ...args) => {
    if (dbRef === harness.sandbox.db) {
      leftReadCount += 1;
      return leftReadCount === 1 ? query(dbRef, ...args).slice(0, 1) : [];
    }
    return query(dbRef, ...args);
  };
  const queryAfter = harness.sandbox.queryGloveHistoryRowsAfter;
  harness.sandbox.queryGloveHistoryRowsAfter = (dbRef, ...args) => {
    if (dbRef === harness.sandbox.db) {
      leftReadCount += 1;
      return [];
    }
    return queryAfter(dbRef, ...args);
  };
  await harness.request();
  assert.equal(leftReadCount, 2, 'fixture must end only after returning its first valid left frame');
  assert.equal(harness.successes.length, 0);
  assert.equal(harness.failures.length, 1);
  assert.match(harness.failures[0].message, /incomplete glove export/);
  assert.ok(harness.progress.every((value) => value.percent < 100));
});
