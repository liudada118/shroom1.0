const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const net = require('node:net');
const { EventEmitter, once } = require('node:events');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const acorn = createRequire(path.join(__dirname, '../client/package.json'))('acorn');
const { HalowReceiver, isHalowDisplaySystem } = require('../server/halowReceiver');
const { numLessZeroToZero, findMax } = require('../server/mathUtils');
const { isCar, totalToN } = require('../util');
const { timeStampToDate } = require('../openWeb');
const { SENSOR_INDICES, getPressureVestStatistics } = require('../server/pressureVest');

const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const serverAst = acorn.parse(serverSource, { ecmaVersion: 'latest' });

/** 取实际后端符号源码，隔离执行数据链而不启动 Electron、生产服务或数据库。 */
function symbolSource(name) {
  for (const node of serverAst.body) {
    if (node.type === 'FunctionDeclaration' && node.id.name === name) return serverSource.slice(node.start, node.end);
    if (node.type !== 'VariableDeclaration') continue;
    const declaration = node.declarations.find(item => item.id.name === name);
    if (declaration) return `${node.kind} ${serverSource.slice(declaration.start, declaration.end)};`;
  }
  assert.fail(`Missing server symbol ${name}`);
}

/** 找到主 parser 的真实 data 回调，覆盖背心与人体共用的 1024 点处理路径。 */
function parserRegistrationSource() {
  const node = serverAst.body.find(item => {
    const call = item.expression;
    return call?.type === 'CallExpression' && call.callee?.object?.name === 'parser'
      && call.callee?.property?.name === 'on' && call.arguments[0]?.value === 'data';
  });
  assert.ok(node, 'Missing primary pressure parser');
  return serverSource.slice(node.start, node.end);
}

/** 取实际 HaLow 清屏回调，确认清屏帧不会混进采集。 */
function clearRegistrationSource() {
  const node = serverAst.body.find(item => {
    const call = item.expression;
    return call?.type === 'CallExpression' && call.callee?.object?.name === 'halowReceiver'
      && call.callee?.property?.name === 'on' && call.arguments[0]?.value === 'clear';
  });
  assert.ok(node, 'Missing HaLow view reset callback');
  return serverSource.slice(node.start, node.end);
}

/** 定位真实消息路由分支，检查时间范围和旧矩阵选区不会使用不同统计口径。 */
function messageBranchSource(property) {
  const pending = [serverAst];
  while (pending.length) {
    const node = pending.pop();
    const target = node.test?.left;
    if (node.type === 'IfStatement' && target?.object?.name === 'getMessage' && target.property?.name === property) {
      return serverSource.slice(node.start, node.end);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value.filter(item => item?.type));
      else if (value?.type) pending.push(value);
    }
  }
  assert.fail(`Missing message branch ${property}`);
}

/** 构造隔离的后端数据链，只替换 I/O 边界并保留实际帧、归零、存储和导出代码。 */
function createPipeline(file = 'pressureVest') {
  const sent = [];
  const stored = [];
  const sandbox = {
    Buffer, console, HalowReceiver, isHalowDisplaySystem, numLessZeroToZero, findMax, isCar, totalToN, timeStampToDate,
    getPressureVestStatistics,
    file, parser: new EventEmitter(), serverShutdownRequested: false,
    licenseValid: true, licenseManager: { isLicenseValid: () => sandbox.licenseValid },
    flag: false, localFlag: false, saveTime: 'vest-recording', db: {},
    colHZ: 12, pointArr: [], pointArr1zeroData: [], pointArr1zero: [], newData: [], useMatrixOrigin: false,
    shouldStoreCollectionFrame: () => true, hasEnoughCollectionDiskSpace: () => true,
    shouldSendRealtimeFrame: () => true,
    collectionInsertQueue: { enqueue: (_db, row, channel) => stored.push({ row, channel }) },
    WebSocket: { OPEN: 1 }, server: { clients: [{ readyState: 1, send: text => sent.push(JSON.parse(text)) }] },
    broadcastJson: value => sent.push(value),
    localData: [], localDataBack: [], localDataHead: [], getMessage: {},
    historyArr: [], indexArr: [], sitPressSelect: [], sitAreaSelect: [], nowIndex: 0, length: 0, timeStamp: [],
    stopPlaybackTimer: () => {}, getHistoryStats: db => ({ count: db.rows?.length || 0 }),
    queryHistoryRows: db => db.rows || [], queryHistoryTimestampSample: db => (db.rows || []).map(row => row.timestamp),
    calcDetectedInterval: () => 1000 / 12, logger: { info: () => {}, error: () => {} },
  };
  vm.createContext(sandbox);
  const names = [
    'HAND_GLOVE_FULL_PACKET', 'HAND_GLOVE_DOUBLE', 'HAND_GLOVE_TYPES', 'HAND_GLOVE_FULL_PACKET_LENGTH',
    'TEMP_FULL_BED_TYPE', 'SMALL_BED_TYPE', 'SMALL_BED_NO_ALG_TYPE', 'SMALL_BED_12B_TYPE',
    'HAND_SINGLE_POINT_TYPE', 'WHOLE_CHAIR_TYPE', 'MINZHEN_TYPE', 'JQ_BED_TYPE',
    'isHandGloveType', 'isHandStorageType', 'isZeroFrameStorageType', 'isSmallBedMatrixType', 'getFrameMatrixData',
    'PET_CARE_SYSTEM_TYPES', 'isPetCareSystem', 'THREE_PORT_SENSOR_TYPES', 'isThreePortFile',
    'getSensorBaudRate', 'parseStoredFrameData', 'getStoredSitData', 'getHistoryPressureData',
    'normalizeHistoryPressureData', 'HISTORY_CHART_SAMPLE_LIMIT', 'HISTORY_EAGER_ROW_LIMIT', 'getHistorySeries',
    'getHistoryLengthFromCounts', 'createHistoryRowsForPlayback', 'buildZeroPlaybackFrame', 'buildZeroPlaybackPayload',
    'broadcastHistorySelectionPayload', 'loadSelectedHistory', 'parseCsvMatrixData', 'buildCollectionCsvRow',
    'shouldTransposeSmallBedRawMatrix', 'formatMatrixTotalForFile', 'hasCollectionLabelInfo',
    'applyCollectionLabelInfo', 'getCsvElapsedSecondsFromBase', 'buildGenericSitCsvRow', 'colOrSendData',
  ];
  vm.runInContext(names.map(symbolSource).join('\n') + '\n' + parserRegistrationSource()
    + '\n' + symbolSource('halowReceiver') + '\n' + clearRegistrationSource()
    + '\nglobalThis.receiver = halowReceiver;', sandbox);
  return { sandbox, sent, stored };
}

/** 等待有限时间，供本机 TCP 测试确认帧已到达。 */
async function waitFor(predicate) {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'Timed out waiting for a vest frame');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/** 从操作系统获取空闲回环 TCP 端口。 */
async function freePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return port;
}

test('real TCP vest frames preserve ADC indexes through zeroing, collection, playback data and CSV', async t => {
  const { sandbox, sent, stored } = createPipeline();
  const receiver = sandbox.receiver;
  receiver.getAddresses = () => [{ address: '127.0.0.1', name: 'test', internal: true }];
  t.after(() => receiver.stop());
  sandbox.flag = true;
  sandbox.pointArr1zero = new Array(1024).fill(20);
  const raw = Buffer.from(Array.from({ length: 1024 }, (_, index) => index % 256));
  const expected = Array.from(raw, value => Math.max(0, value - 20));
  const port = await freePort();
  await receiver.start({ host: '127.0.0.1', port });
  const socket = net.connect(port, '127.0.0.1');
  socket.on('error', () => {});
  t.after(() => socket.destroy());
  await once(socket, 'connect');
  const id = Buffer.from('VEST_01');
  socket.write(Buffer.concat([Buffer.from([0xaa, 0x55, 0, id.length]), id, Buffer.from([0xaa, 0x55, 3, 0x99]), raw]));
  await waitFor(() => stored.length === 1);
  assert.deepEqual(Array.from(sandbox.pointArr1zeroData), Array.from(raw), 'zero baseline must retain original ADC ordering');
  assert.deepEqual(sent[0].sitData, expected);
  assert.equal(stored[0].channel, 'sit');
  const row = { data: stored[0].row[0], timestamp: stored[0].row[1] };
  assert.deepEqual(JSON.parse(row.data), expected, 'stored data remains one full 1024-point channel');
  assert.deepEqual(Array.from(sandbox.getStoredSitData(row)), expected, 'generic playback reads the same ordered values');
  const csv = sandbox.buildGenericSitCsvRow(row, { absoluteIndex: 0, relativeIndex: 0, baseTimestamp: row.timestamp }, {});
  assert.deepEqual(JSON.parse(csv.realData), expected);
  assert.equal(csv.max, 235);
  assert.equal(csv.index, '0.000');
  assert.equal(csv.rotate, '');
  assert.equal(vm.runInContext('isZeroFrameStorageType(file)', sandbox), false, 'vest must not enter the 256-point glove storage path');
  assert.equal(vm.runInContext('getSensorBaudRate(file)', sandbox), 1000000);
});

test('human body raw frame behavior remains identical to pressure vest', () => {
  const raw = Buffer.from(Array.from({ length: 1024 }, (_, index) => (index * 17) % 256));
  for (const file of ['humanBody', 'humanBodyOptimized', 'pressureVest']) {
    const { sandbox, sent } = createPipeline(file);
    sandbox.parser.emit('data', raw);
    assert.deepEqual(sent[0].sitData, Array.from(raw), file);
  }
});

test('license expiration rejects vest input and playback suppresses live broadcasting', () => {
  const { sandbox, sent, stored } = createPipeline();
  sandbox.flag = true;
  sandbox.licenseValid = false;
  sandbox.parser.emit('data', Buffer.alloc(1024, 30));
  assert.equal(sent.length, 0);
  assert.equal(stored.length, 0);
  assert.equal(sandbox.receiver.isAllowed(), false);
  sandbox.licenseValid = true;
  sandbox.flag = false;
  sandbox.localFlag = true;
  sandbox.parser.emit('data', Buffer.alloc(1024, 40));
  assert.equal(sent.length, 0);
  assert.equal(stored.length, 0);
  sandbox.file = 'hand';
  assert.equal(sandbox.receiver.isAllowed(), false);
});

test('HaLow disconnect clears vest display without creating a synthetic recording row', () => {
  const { sandbox, sent, stored } = createPipeline();
  sandbox.flag = true;
  sandbox.receiver.emit('clear');
  assert.deepEqual(Array.from(sent[0].sitData), new Array(1024).fill(0));
  assert.equal(stored.length, 0);
  sandbox.localFlag = true;
  sandbox.receiver.emit('clear');
  assert.equal(sent.length, 1, 'disconnect must not overwrite a displayed playback frame');
});

test('vest history selection and time ranges ignore unused channels and match Home statistics', async () => {
  const { getHumanBodyPressureStatistics } = await import(pathToFileURL(path.join(__dirname, '../client/src/page/home/humanBodyPressureStatistics.js')).href);
  const frames = Array.from({ length: 3 }, () => {
    const frame = new Array(1024).fill(255);
    SENSOR_INDICES.forEach(index => { frame[index] = 0; });
    return frame;
  });
  frames[1][1 - 1] = 1;
  frames[1][692 - 1] = 2;
  frames[1][1024 - 1] = 10;
  frames[2][69 - 1] = 3;
  frames[2][692 - 1] = 7;
  const expected = frames.map(frame => getHumanBodyPressureStatistics(frame, SENSOR_INDICES));
  frames.forEach((frame, index) => assert.deepEqual(getPressureVestStatistics(frame), expected[index]));
  const { sandbox, sent } = createPipeline();
  sandbox.db.rows = frames.map((frame, index) => ({ data: JSON.stringify(frame), timestamp: 1000 + index * 100 }));
  sandbox.loadSelectedHistory('vest-session');
  assert.deepEqual(sent[0].pressArr, [0, 13, 10]);
  assert.deepEqual(sent[0].areaArr, [0, 3, 2], 'ADC values from 1 to 10 are valid active vest points');
  assert.equal(sent[0].length, 3);
  sandbox.getMessage = { indexArr: [1, 3] };
  vm.runInContext(messageBranchSource('indexArr'), sandbox);
  assert.deepEqual(sent[1].pressArr, expected.slice(1).map(statistics => statistics.totalPres));
  assert.deepEqual(sent[1].areaArr, expected.slice(1).map(statistics => statistics.point));
  assert.deepEqual(Array.from(sandbox.historyArr), [1, 3]);
  sandbox.getMessage = { sitIndex: [0, 32, 0, 32] };
  vm.runInContext(messageBranchSource('sitIndex'), sandbox);
  assert.deepEqual(sent[2].pressArr, [0, 13, 10]);
  assert.deepEqual(sent[2].areaArr, [0, 3, 2]);
});

test('vest CSV metadata uses real sensor points while realData preserves all 1024 ADC values', () => {
  const frame = new Array(1024).fill(255);
  SENSOR_INDICES.forEach(index => { frame[index] = 0; });
  const { sandbox } = createPipeline();
  for (const values of [[], [[0, 1], [691, 2], [1023, 10]]]) {
    values.forEach(([index, value]) => { frame[index] = value; });
    const statistics = getPressureVestStatistics(frame);
    const row = { data: JSON.stringify(frame), timestamp: 1234 };
    const meta = { absoluteIndex: 0, relativeIndex: 0, baseTimestamp: 1234 };
    for (const csv of [sandbox.buildGenericSitCsvRow(row, meta, {}), sandbox.buildCollectionCsvRow(row, meta, {})]) {
      assert.equal(csv.max, statistics.maxPres);
      assert.equal(csv.pressureArea, statistics.point);
      assert.equal(csv.pressure, statistics.totalPres, 'vest export remains raw ADC rather than totalToN conversion');
      assert.deepEqual(JSON.parse(csv.realData), frame);
    }
  }
});

test('human body history and CSV retain their original complete-channel conversion and thresholds', () => {
  const frame = new Array(1024).fill(0);
  frame[0] = 1;
  frame[1] = 10;
  frame[2] = 11;
  const row = { data: JSON.stringify(frame), timestamp: 1000 };
  for (const file of ['humanBody', 'humanBodyOptimized']) {
    const { sandbox } = createPipeline(file);
    const series = sandbox.getHistorySeries({ sitRows: [row], file });
    assert.deepEqual(Array.from(series.press), [totalToN(22)]);
    assert.deepEqual(Array.from(series.area), [1], 'generic history keeps its historical >10 threshold');
    const csv = sandbox.buildGenericSitCsvRow(row, { absoluteIndex: 0, relativeIndex: 0, baseTimestamp: 1000 }, {});
    assert.equal(csv.pressure, totalToN(22));
    assert.equal(csv.pressureArea, 3, 'generic CSV keeps its original >0 threshold');
    assert.equal(csv.max, 11);
    assert.deepEqual(JSON.parse(csv.realData), frame);
  }
});

test('offline sensor catalog includes pressure vest without changing known sensor labels', () => {
  const exports = {};
  const sandbox = {
    module: { exports }, URL,
    require: name => {
      if (name === 'fs') return { existsSync: () => false };
      if (name === 'path') return path;
      if (name === './configManager') return { APP_DATA_DIR: 'C:/unused-test-data' };
      if (name === './logger') return { info: () => {}, warn: () => {} };
      assert.fail(`Unexpected catalog dependency ${name}`);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../sensorTypeStore.js'), 'utf8'), sandbox);
  assert.equal(sandbox.module.exports.getSensorLabel('pressureVest'), '压力传感背心');
  assert.equal(sandbox.module.exports.getSensorLabel('humanBodyOptimized'), '人体全身优化');
  const vest = sandbox.module.exports.getSensorArr().filter(item => item.value === 'pressureVest');
  assert.equal(vest.length, 1);
  assert.equal(vest[0].group, '精密');
});
