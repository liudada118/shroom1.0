const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const acorn = createRequire(path.join(__dirname, '../client/package.json'))('acorn');
const { handL, handR, handRVideo1470506 } = require('../openWeb');
const { bytes4ToInt10, numLessZeroToZero } = require('../server/mathUtils');

const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const ast = acorn.parse(source, { ecmaVersion: 'latest' });

function symbolSource(name) {
  for (const node of ast.body) {
    if (node.type === 'FunctionDeclaration' && node.id.name === name) return source.slice(node.start, node.end);
    if (node.type !== 'VariableDeclaration') continue;
    const declaration = node.declarations.find(item => item.id.name === name);
    if (declaration) return `${node.kind} ${source.slice(declaration.start, declaration.end)};`;
  }
  assert.fail(`Missing server symbol ${name}`);
}

/** 运行真正的串口回调与采集函数，只替换串口、WS 和数据库写入等外部 I/O。 */
function createHarness(file = 'hand0205Single', licensed = true) {
  const messages = [], rows = [];
  let currentTime = 1700000000000;
  class MockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [currentTime])); }
    static now() { return currentTime; }
  }
  const sandbox = {
    Buffer, console, Date: MockDate, file, bytes4ToInt10, numLessZeroToZero, handL, handR, handRVideo1470506,
    MINZHEN_TYPE: 'minzhen', WebSocket: { OPEN: 1 },
    licenseManager: { isLicenseValid: () => licensed },
    port1: { isOpen: true }, port2: { isOpen: true },
    server: { clients: [{ readyState: 1, send: data => messages.push(JSON.parse(data)) }] },
    flag: true, localFlag: false, saveTime: 'test-collection',
    shouldStoreCollectionFrame: () => true, hasEnoughCollectionDiskSpace: () => true,
    db: { hand: 'left' }, db1: { hand: 'right' },
    collectionInsertQueue: {
      enqueue: (db, values, channel) => rows.push({ hand: db.hand, channel, data: JSON.parse(values[0]), timestamp: values[1], date: values[2] }),
    },
    pointArr: [], pointArr2: [], newData: [],
    firstBlueData: [], lastBlueData: [], firstBlueData1: [], lastBlueData1: [],
    pointArr1RawZero: [], pointArr2RawZero: [], pointArr1zero: [], pointArr2zero: [],
    pointArr147zero: [], pointArr147zero_2: [], pointArr4zero: [],
    pointArr1RawZeroData: [], pointArr2RawZeroData: [], pointArr1zeroData: [], pointArr2zeroData: [],
    newArr147: [], newArr147_2: [],
  };
  vm.createContext(sandbox);
  const symbols = [
    'HAND_GLOVE_FULL_PACKET', 'HAND_GLOVE_DOUBLE', 'HAND_GLOVE_TYPES',
    'HAND_GLOVE_FULL_PACKET_LENGTH',
    'TEMP_FULL_BED_TYPE', 'SMALL_BED_TYPE', 'SMALL_BED_NO_ALG_TYPE', 'SMALL_BED_12B_TYPE',
    'isHandGloveType', 'isZeroFrameStorageType', 'isSmallBedMatrixType', 'getSensorBaudRate',
    'getZeroAwareStoragePressureData', 'getZeroFrameForStorage', 'buildZeroAwareStorageData',
    'normalizeFiniteFrame', 'parseStoredSensorFrame', 'getHandGlovePlaybackFrame',
    'handleHandGloveDoubleFirstPacket', 'handleHandGloveDoubleSecondPacket',
    'colOrSendData', 'colOrSendData1',
  ];
  vm.runInContext(symbols.map(symbolSource).join('\n'), sandbox);
  sandbox.getSensorBaudRate = vm.runInContext('getSensorBaudRate', sandbox);
  for (const parserName of ['parser', 'parser2']) {
    const expression = ast.body.find(node => {
      const call = node.expression;
      return call?.type === 'CallExpression' && call.callee.type === 'MemberExpression'
        && call.callee.object.name === parserName && call.callee.property.name === 'on'
        && call.arguments[0]?.value === 'data';
    });
    assert.ok(expression, `Missing ${parserName} data callback`);
    const callback = expression.expression.arguments[1];
    sandbox[parserName] = vm.runInContext(`(${source.slice(callback.start, callback.end)})`, sandbox);
  }
  return { sandbox, messages, rows, setTime: value => { currentTime = value; } };
}

function packetPair(pressure, rotate = [0.25, -0.5, 0.75, 1], type = 0) {
  const first = Buffer.from([1, type, ...pressure.slice(0, 128)]);
  const quaternion = Buffer.alloc(16);
  rotate.forEach((value, index) => quaternion.writeFloatLE(value, index * 4));
  const second = Buffer.concat([Buffer.from([2, type, ...pressure.slice(128)]), quaternion]);
  assert.equal(first.length, 130);
  assert.equal(second.length, 146);
  return [first, second];
}

const pressure = Array.from({ length: 256 }, (_, index) => index % 200 + 10);

for (const file of ['hand0205Single', 'hand0205']) {
  test(`${file} preserves both ordinary 130+146 packet paths, pressure mapping and stored quaternion`, () => {
    const { sandbox, rows, messages } = createHarness(file);
    assert.equal(sandbox.getSensorBaudRate(file), 921600);
    for (const packet of packetPair(pressure, undefined, 3)) sandbox.parser(packet);
    assert.equal(rows.length, 1);
    for (const packet of packetPair(pressure, undefined, 4)) sandbox.parser2(packet);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map(row => [row.hand, row.channel]), [['left', 'sit'], ['right', 'back']]);
    for (const row of rows) {
      assert.deepEqual(row.data.pressureData, pressure);
      assert.deepEqual(row.data.rotate, [0.25, -0.5, 0.75, 1]);
      assert.deepEqual(row.data.zeroFrame, []);
      assert.equal(row.date, 'test-collection');
    }
    assert.deepEqual(messages[0].sitData, pressure);
    assert.deepEqual(messages[0].newArr147, handL([...pressure]));
    assert.deepEqual(messages[1].backData, handRVideo1470506([...pressure]));
    assert.deepEqual(messages[1].newArr147, handR([...pressure]));
  });
}

test('single glove zeroing keeps independent baselines and quaternion in real collection path', () => {
  const { sandbox, rows, messages } = createHarness();
  sandbox.pointArr1RawZero = sandbox.pointArr1zero = new Array(256).fill(20);
  sandbox.pointArr2RawZero = sandbox.pointArr2zero = new Array(256).fill(30);
  sandbox.pointArr147zero = new Array(handL([...pressure]).length).fill(5);
  sandbox.pointArr147zero_2 = new Array(handR([...pressure]).length).fill(7);
  for (const packet of packetPair(pressure)) sandbox.parser(packet);
  for (const packet of packetPair(pressure)) sandbox.parser2(packet);
  const leftPressure = pressure.map(value => Math.max(0, value - 20));
  const rightPressure = pressure.map(value => Math.max(0, value - 30));
  assert.deepEqual(rows[0].data.pressureData, leftPressure);
  assert.deepEqual(rows[1].data.pressureData, rightPressure);
  assert.deepEqual(rows[0].data.zeroFrame, new Array(256).fill(20));
  assert.deepEqual(rows[1].data.zeroFrame, new Array(256).fill(30));
  assert.deepEqual(messages[0].sitData, leftPressure);
  assert.deepEqual(messages[0].newArr147, handL([...pressure]).map(value => Math.max(0, value - 5)));
  assert.deepEqual(messages[1].newArr147, handR([...pressure]).map(value => Math.max(0, value - 7)));
  assert.deepEqual(messages[0].newArr147Raw, handL([...pressure]));
  assert.deepEqual(messages[1].newArr147Raw, handR([...pressure]));
});

test('single glove ignores double-glove hand routing codes and follows the physical source port', () => {
  const { sandbox, rows } = createHarness();
  for (const packet of packetPair(pressure, undefined, 4)) sandbox.parser(packet);
  for (const packet of packetPair(pressure, undefined, 3)) sandbox.parser2(packet);
  assert.deepEqual(rows.map(row => row.hand), ['left', 'right']);
});

test('single glove keeps old 260 and 151 frame playback compatibility and clears a missing hand', () => {
  const { sandbox } = createHarness();
  for (const count of [256, 147]) {
    const stored = [...pressure.slice(0, count), 0.25, -0.5, 0.75, 1];
    const frame = sandbox.getHandGlovePlaybackFrame({ data: JSON.stringify(stored) }, 'hand0205Single');
    assert.deepEqual(Array.from(frame.pressureData), pressure.slice(0, count));
    assert.deepEqual(Array.from(frame.rotateData), [0.25, -0.5, 0.75, 1]);
  }
  const missing = sandbox.getHandGlovePlaybackFrame(undefined, 'hand0205Single');
  assert.deepEqual(Array.from(missing.pressureData), new Array(256).fill(0));
});

test('single glove emits no pressure or collection frames when the license is invalid', () => {
  const { sandbox, rows, messages } = createHarness('hand0205Single', false);
  for (const packet of packetPair(pressure)) sandbox.parser(packet);
  for (const packet of packetPair(pressure)) sandbox.parser2(packet);
  assert.equal(rows.length, 0);
  assert.equal(messages.length, 0);
});

test('single glove suppresses an all-zero quaternion without dropping its pressure frame', () => {
  const { sandbox, rows, messages } = createHarness();
  for (const packet of packetPair(pressure, [0, 0, 0, 0])) sandbox.parser(packet);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].data.pressureData, pressure);
  assert.deepEqual(rows[0].data.rotate, []);
  assert.equal(messages[0].rotate, undefined);
});

const gloveTypes = ['hand0205', 'hand0205Single', 'hand0205Double', 'handGlove115200', 'handGloveFullPacket'];

/** Feed the real shared send/collection functions without any physical serial or database access. */
function sendGloveFrameBurst(harness, intervalMs = 4, frameCount = 220) {
  const expectedMessages = [], expectedRows = [];
  for (let frameNumber = 0; frameNumber < frameCount; frameNumber += 1) {
    const timestamp = 1700000000000 + frameNumber * intervalMs;
    harness.setTime(timestamp);
    for (const [channel, dataKey, hand, seed, sendName] of [
      ['sit', 'sitData', 'left', 11, 'colOrSendData'],
      ['back', 'backData', 'right', 71, 'colOrSendData1'],
    ]) {
      const matrix = Array.from({ length: 256 }, (_, index) => (index + frameNumber + seed) % 256);
      const rotate = [frameNumber, seed, 0.25, 1];
      const message = { [dataKey]: matrix, rawPressureData: matrix, rotate, frameNumber, channel };
      harness.sandbox[sendName](JSON.stringify(message));
      expectedMessages.push(message);
      expectedRows.push({
        hand, channel, timestamp, date: 'test-collection',
        data: { pressureData: matrix, rotate, zeroFrame: [] },
      });
    }
  }
  return { expectedMessages, expectedRows };
}

for (const file of gloveTypes) {
  for (const intervalMs of [4, 0]) {
    test(`${file} sends every frame from both hands at ${intervalMs} ms cadence while retaining every collection row`, () => {
      const harness = createHarness(file);
      const { expectedMessages, expectedRows } = sendGloveFrameBurst(harness, intervalMs);
      assert.equal(harness.messages.length, 440, '220 frames per hand must reach the display');
      assert.deepEqual(harness.messages, expectedMessages, 'global hand/frame order and every original matrix remain unchanged');
      assert.equal(harness.rows.length, 440, 'display sending must not drop collection records');
      assert.deepEqual(harness.rows, expectedRows, 'collection keeps each hand, matrix, quaternion and timestamp');
    });
  }

  test(`${file} streams without collection, suppresses real-time display during replay, and skips closed WebSockets`, () => {
    const live = createHarness(file);
    live.sandbox.flag = false;
    const { expectedMessages } = sendGloveFrameBurst(live);
    assert.deepEqual(live.messages, expectedMessages, 'collection flag does not throttle display frames');
    assert.equal(live.rows.length, 0, 'stopped collection must not enqueue records');

    const replay = createHarness(file);
    replay.sandbox.flag = false;
    replay.sandbox.localFlag = true;
    sendGloveFrameBurst(replay);
    assert.equal(replay.messages.length, 0, 'live sensor frames must not overwrite replay display');
    assert.equal(replay.rows.length, 0);

    const closed = createHarness(file);
    closed.sandbox.server.clients[0].readyState = 3;
    const { expectedRows } = sendGloveFrameBurst(closed);
    assert.equal(closed.messages.length, 0, 'closed clients must not receive data');
    assert.deepEqual(closed.rows, expectedRows, 'WebSocket connectivity does not change collection records');
  });
}
