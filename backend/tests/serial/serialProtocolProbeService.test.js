const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const {
  captureSerialAtBaud,
  createSerialProtocolProbeService,
} = require('../../kernel/serial/serialProtocolProbeService');
const { loadSerialProtocolPresets } = require('@shroom/backend/protocol/presets/index.js');
const { createSerialManager } = require('@shroom/backend/serial/serialManager.js');
const { getSerialPathReservation } = require('@shroom/backend/serial/serialPathReservation.js');

const DELIMITER = Buffer.from([0xaa, 0x55, 0x03, 0x99]);

/** 保留明确的首尾分隔符，让探测器能验证所有完整帧。 */
function buildCapture(frames, delimiter = DELIMITER) {
  return Buffer.concat([delimiter, ...frames.flatMap(frame => [frame, delimiter])]);
}

/** 生成真实130+146格式，首尾同手侧且IMU为float32LE。 */
function buildGloveFrames({ pairs = 6, firstSide = 1, secondSide = firstSide, nonFiniteImu = false } = {}) {
  return Array.from({ length: pairs }, (_, index) => {
    const first = Buffer.alloc(130, index + 10);
    first[0] = 1; first[1] = firstSide;
    const second = Buffer.alloc(146, index + 20);
    second[0] = 2; second[1] = secondSide;
    [nonFiniteImu ? NaN : 1, 0.25, 0.5, 0.75].forEach((value, offset) => second.writeFloatLE(value, 130 + offset * 4));
    return [first, second];
  }).flat();
}

/** 执行 HTTP 工厂真实的原子关闭守卫，避免测试另写一份条件。 */
function productionPrepareConnection(context) {
  const source = fs.readFileSync(path.resolve(__dirname, '../../kernel/platform/http/httpAppFactory.js'), 'utf8');
  const acorn = createRequire(path.resolve(__dirname, '../../../client/package.json'))('acorn');
  const factory = acorn.parse(source, { ecmaVersion: 'latest' }).body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'createHttpApp');
  const declarations = factory.body.body.filter(node => node.type === 'FunctionDeclaration'
    && ['assertCanProbe', 'prepareProbeConnection'].includes(node.id.name));
  return vm.runInNewContext(`${declarations.map(node => source.slice(node.start, node.end)).join('\n')}\nprepareProbeConnection`, context);
}

/** 默认连接只在同一系统、同一连接且没有有效数据时关闭，关闭完成后才能探测。 */
async function testDefaultConnectionFallback() {
  /** 每例独立持有一个模拟物理连接及其可控关闭回执。 */
  function fixture() {
    const state = { sensorType: 'fast256', phase: null, ready: false, missingEvidence: false,
      status: { role: 'sit', path: 'COM-DEFAULT', connectionId: 7, status: 'open', isOpen: true } };
    let closeCount = 0, captureCount = 0, finishClose;
    const manager = { getStatus: role => role ? state.status : [state.status],
      close: () => {
        closeCount += 1; state.status.status = 'stopping';
        return new Promise(resolve => { finishClose = result => {
          if (result.ok) { state.status.isOpen = false; state.status.status = 'closed'; }
          resolve(result);
        }; });
      } };
    const prepareConnection = productionPrepareConnection({ serialManager: manager,
      requireAccess() {}, getCurrentSensorType: () => state.sensorType,
      getCollectionStatus: () => ({ current: state.phase ? { phase: state.phase } : null,
        serialDataStatus: state.missingEvidence ? [] : [{ ...state.status, ready: state.ready, detectionSupported: true }] }),
    });
    const service = createSerialProtocolProbeService({ serialManager: manager, prepareConnection,
      captureAtBaud: async () => { captureCount += 1; return buildCapture(Array.from({ length: 6 }, () => Buffer.alloc(256, 5))); } });
    return { state, service, request: { path: 'COM-DEFAULT', connection: { sensorType: 'fast256', role: 'sit', connectionId: 7 } },
      counts: () => [closeCount, captureCount], finish: result => finishClose(result) };
  }
  {
    const f = fixture(); f.state.ready = true;
    assert.strictEqual((await f.service.detect(f.request)).status, 'reading');
    assert.deepStrictEqual(f.counts(), [0, 0]);
    assert.strictEqual(f.state.status.isOpen, true);
  }
  for (const [change, code] of [
    [f => { f.state.status.connectionId = 8; }, 'SERIAL_CONNECTION_CHANGED'],
    [f => { f.state.sensorType = 'hand'; }, 'SERIAL_CONNECTION_CHANGED'],
    [f => { f.state.phase = 'collecting'; }, 'COLLECTION_ACTIVE'],
    [f => { f.state.phase = 'finalizing'; }, 'COLLECTION_ACTIVE'],
    [f => { f.state.missingEvidence = true; }, 'SERIAL_STATUS_UNAVAILABLE'],
  ]) {
    const f = fixture(); change(f);
    await assert.rejects(f.service.detect(f.request), error => error.code === code);
    assert.deepStrictEqual(f.counts(), [0, 0]);
    assert.strictEqual(f.state.status.isOpen, true);
    assert.strictEqual(getSerialPathReservation('COM-DEFAULT'), null);
  }
  {
    const f = fixture(), pending = f.service.detect(f.request);
    assert.deepStrictEqual(f.counts(), [1, 0], 'close is started atomically but probing waits for physical release');
    assert.ok(getSerialPathReservation('COM-DEFAULT'), 'closing connection is reserved against replacements');
    f.finish({ ok: true });
    assert.strictEqual((await pending).status, 'matched');
    assert.deepStrictEqual(f.counts(), [1, 1]);
    assert.strictEqual(getSerialPathReservation('COM-DEFAULT'), null);
  }
  {
    const f = fixture(), pending = f.service.detect(f.request);
    f.finish({ ok: false, error: Object.assign(new Error('close failed'), { code: 'SERIAL_CLOSE_FAILED' }) });
    await assert.rejects(pending, error => error.code === 'SERIAL_CLOSE_FAILED');
    assert.deepStrictEqual(f.counts(), [1, 0]);
  }
  {
    const f = fixture(), pending = f.service.detect(f.request);
    f.state.sensorType = 'hand'; f.finish({ ok: true });
    await assert.rejects(pending, error => error.code === 'SERIAL_CONNECTION_CHANGED');
    assert.deepStrictEqual(f.counts(), [1, 0]);
  }
}

/** 覆盖原生连接五档探测、证据阈值、兼容判断和取消/采集中拒绝。 */
async function testNativeDetection() {
  const rates = [921600, 1000000, 1500000, 3000000, 6000000];
  const connection = { sensorType: 'fast256', role: 'sit' };
  const matrix = buildCapture(Array.from({ length: 6 }, (_, index) => Buffer.alloc(256, index + 1)));
  for (const [index, targetRate] of rates.entries()) {
    const attempted = [];
    const service = createSerialProtocolProbeService({
      serialManager: { getStatus: () => [] },
      captureAtBaud: async ({ baudRate }) => {
        attempted.push(baudRate);
        return baudRate === targetRate ? matrix : Buffer.alloc(0);
      },
    });
    const result = await service.detect({ path: `COM-NATIVE-${index}`, connection });
    assert.strictEqual(result.status, 'matched');
    assert.strictEqual(result.match.id, 'matrix-256');
    assert.strictEqual(result.protocol.baudRate, targetRate);
    assert.strictEqual(result.defaultBaudRate, 921600);
    assert.strictEqual(result.compatible, true);
    assert.deepStrictEqual(attempted, rates.slice(0, index + 1), 'default first, then only the remaining allowed rates');
    assert.strictEqual(getSerialPathReservation(`COM-NATIVE-${index}`), null);
  }

  for (const [sensorType, expected] of [
    ['smallBed12B', [1500000, 921600, 1000000, 3000000, 6000000]],
    ['bed4096', [3000000, 921600, 1000000, 1500000, 6000000]],
  ]) {
    const attempted = [];
    const service = createSerialProtocolProbeService({ serialManager: { getStatus: () => [] },
      captureAtBaud: async ({ baudRate }) => { attempted.push(baudRate); return Buffer.alloc(0); } });
    const result = await service.detect({ path: 'COM-NATIVE-DEFAULT', connection: { sensorType, role: 'sit' } });
    assert.strictEqual(result.status, 'unknown');
    assert.deepStrictEqual(attempted, expected, 'preserve the actual hardware default for each system');
  }

  const noisyFrames = Array.from({ length: 5 }, () => Buffer.alloc(256, 13));
  const gloveFrames = buildGloveFrames();
  const cases = [
    ['unknown length', buildCapture(Array.from({ length: 6 }, () => Buffer.alloc(13, 7))), 'unknown', null],
    ['one corrupt matrix frame tolerated', buildCapture([...noisyFrames, Buffer.alloc(17)]), 'matched', 'matrix-256'],
    ['too many corrupt matrix frames', buildCapture([...noisyFrames, Buffer.alloc(17), Buffer.alloc(18)]), 'unknown', null],
    ['paired glove segments', buildCapture(gloveFrames), 'matched', 'glove-segmented'],
    ['glove first halves only', buildCapture(gloveFrames.filter((_, index) => index % 2 === 0)), 'unknown', null],
    ['glove second halves only', buildCapture(gloveFrames.filter((_, index) => index % 2 === 1)), 'unknown', null],
    ['different glove sides', buildCapture(buildGloveFrames({ secondSide: 2 })), 'unknown', null],
    ['non-finite glove IMU', buildCapture(buildGloveFrames({ nonFiniteImu: true })), 'unknown', null],
    ['too few glove pairs', buildCapture(buildGloveFrames({ pairs: 4 })), 'unknown', null],
    ['excessive mixed glove data', buildCapture([...gloveFrames, ...Array.from({ length: 4 }, () => Buffer.alloc(19))]), 'unknown', null],
  ];
  for (const [name, bytes, status, id] of cases) {
    const service = createSerialProtocolProbeService({ serialManager: { getStatus: () => [] }, captureAtBaud: async () => bytes });
    const result = await service.detect({ path: 'COM-NATIVE-EVIDENCE', connection });
    assert.strictEqual(result.status, status, name);
    assert.strictEqual(result.match?.id || null, id, name);
  }

  const incompatible = createSerialProtocolProbeService({ serialManager: { getStatus: () => [] }, captureAtBaud: async () => buildStandardCapture() });
  const incompatibleResult = await incompatible.detect({ path: 'COM-NATIVE-INCOMPATIBLE', connection });
  assert.strictEqual(incompatibleResult.status, 'matched');
  assert.strictEqual(incompatibleResult.match.id, 'standard-1024');
  assert.strictEqual(incompatibleResult.compatible, false, 'identifying a protocol does not authorize replacing the current system');

  let blockedCaptures = 0;
  const unsupported = createSerialProtocolProbeService({ serialManager: { getStatus: () => [] },
    captureAtBaud: async () => { blockedCaptures += 1; return matrix; } });
  assert.strictEqual((await unsupported.detect({ path: 'COM-NATIVE-UNSUPPORTED', connection: { sensorType: 'handGlove115200' } })).status, 'unsupported');
  assert.strictEqual(blockedCaptures, 0, 'legacy 115200 protocols must stay outside the five-rate detector');
  const busy = createSerialProtocolProbeService({ serialManager: { getStatus: () => [{ path: 'COM-NATIVE-BUSY', isOpen: true }] },
    captureAtBaud: async () => { blockedCaptures += 1; return matrix; } });
  await assert.rejects(busy.detect({ path: 'COM-NATIVE-BUSY', connection }), error => error.code === 'SERIAL_PORT_BUSY');
  assert.strictEqual(blockedCaptures, 0);

  const collecting = createSerialProtocolProbeService({ serialManager: { getStatus: () => [] },
    assertCanProbe: () => { throw Object.assign(new Error('collection active'), { code: 'COLLECTION_ACTIVE' }); },
    captureAtBaud: async () => { blockedCaptures += 1; return matrix; } });
  await assert.rejects(collecting.detect({ path: 'COM-NATIVE-COLLECTING', connection }), error => error.code === 'COLLECTION_ACTIVE');
  assert.strictEqual(blockedCaptures, 0);
  let collectionActive = false;
  const becameCollecting = createSerialProtocolProbeService({ serialManager: { getStatus: () => [] },
    assertCanProbe: () => { if (collectionActive) throw Object.assign(new Error('collection active'), { code: 'COLLECTION_ACTIVE' }); },
    captureAtBaud: async () => { collectionActive = true; return matrix; } });
  await assert.rejects(becameCollecting.detect({ path: 'COM-NATIVE-COLLECTION-RACE', connection }), error => error.code === 'COLLECTION_ACTIVE');
  assert.strictEqual(getSerialPathReservation('COM-NATIVE-COLLECTION-RACE'), null);

  const controller = new AbortController();
  const cancelPorts = [];
  const cancelled = createSerialProtocolProbeService({ serialManager: { getStatus: () => [] }, durationMs: 1000,
    createSerialPort: () => {
      const port = new FakeSerialPort();
      cancelPorts.push(port);
      setTimeout(() => controller.abort(), 10);
      return port;
    } });
  await assert.rejects(cancelled.detect({ path: 'COM-NATIVE-CANCEL', connection, signal: controller.signal }), error => error.code === 'SERIAL_CONNECT_CANCELLED');
  assert.strictEqual(cancelPorts.length, 1, 'cancellation must not open the next baud rate');
  assert.strictEqual(cancelPorts[0].isOpen, false);
  assert.strictEqual(cancelPorts[0].closeCalls, 1);
  assert.strictEqual(getSerialPathReservation('COM-NATIVE-CANCEL'), null);
  await assert.rejects(cancelled.detect({ path: 'COM-NATIVE-CANCEL', connection, signal: controller.signal }), error => error.code === 'SERIAL_CONNECT_CANCELLED');
  assert.strictEqual(cancelPorts.length, 1, 'an already aborted request never opens hardware');
}

/** 手动推进驱动open回调，以验证取消/超时之后的迟到成功不会抢占下一代连接。 */
function createDelayedOpenPort() {
  const port = new EventEmitter();
  port.isOpen = false;
  port.opening = false;
  port.closeCalls = 0;
  port.open = (callback) => { port.opening = true; port.openCallback = callback; };
  port.finishOpen = () => { port.opening = false; port.isOpen = true; port.openCallback(); };
  port.close = (callback) => { port.closeCalls += 1; port.isOpen = false; port.emit('close'); callback?.(); };
  return port;
}

/** 验证打开挂起、关闭失败及关闭回调丢失时，错误有界返回但路径锁延迟到实际释放。 */
async function testProbeCleanupRaces() {
  const connection = { sensorType: 'fast256', role: 'sit' };
  for (const native of [true, false]) {
    const port = createDelayedOpenPort();
    let opened = 0;
    const service = createSerialProtocolProbeService({ serialManager: { getStatus: () => [] },
      createSerialPort: () => { opened += 1; return port; },
      captureAtBaud: options => captureSerialAtBaud({ ...options, openTimeoutMs: 5, closeTimeoutMs: 5 }),
    });
    const path = `COM-PENDING-OPEN-${native}`;
    const request = { path, ...(native ? { connection } : { candidateIds: ['matrix-256'] }) };
    let timeoutError;
    await assert.rejects(service.detect(request), error => {
      timeoutError = error;
      return error.code === 'SERIAL_CONNECT_TIMEOUT' && error.pendingRelease instanceof Promise;
    });
    assert.strictEqual(opened, 1, 'an unconfirmed close must stop later baud attempts');
    assert.ok(getSerialPathReservation(path), 'timed-out opening keeps the physical path reserved');
    await assert.rejects(service.detect(request), error => error.code === 'SERIAL_PORT_BUSY');
    port.finishOpen();
    await timeoutError.pendingRelease;
    assert.strictEqual(port.closeCalls, 1, 'late open is immediately closed');
    assert.strictEqual(port.isOpen, false);
    assert.strictEqual(getSerialPathReservation(path), null);
  }

  const controller = new AbortController();
  const cancelledPort = createDelayedOpenPort();
  const cancelling = captureSerialAtBaud({ path: 'COM-CANCEL-OPEN', baudRate: 921600,
    signal: controller.signal, closeTimeoutMs: 5, createSerialPort: () => cancelledPort });
  controller.abort();
  let cancellationError;
  await assert.rejects(cancelling, error => {
    cancellationError = error;
    return error.code === 'SERIAL_CONNECT_CANCELLED' && error.pendingRelease instanceof Promise;
  });
  cancelledPort.finishOpen();
  await cancellationError.pendingRelease;
  assert.strictEqual(cancelledPort.isOpen, false);

  for (const closeMode of ['error', 'hung']) {
    const port = new FakeSerialPort({ chunks: [buildStandardCapture()] });
    port.close = (callback) => {
      port.closeCalls += 1;
      port.closeCallback = callback;
      if (closeMode === 'error') callback(new Error('driver cannot close yet'));
    };
    let opened = 0;
    const path = `COM-CLOSE-${closeMode}`;
    const service = createSerialProtocolProbeService({ serialManager: { getStatus: () => [] },
      createSerialPort: () => { opened += 1; return port; },
      captureAtBaud: options => captureSerialAtBaud({ ...options, durationMs: 5, closeTimeoutMs: 5 }) });
    let closeError;
    await assert.rejects(service.detect({ path, connection }), error => {
      closeError = error;
      return error.code === 'SERIAL_CLOSE_FAILED' && error.pendingRelease instanceof Promise;
    });
    assert.strictEqual(opened, 1);
    assert.strictEqual(port.isOpen, true);
    assert.ok(getSerialPathReservation(path), 'a failed close must not be mistaken for released hardware');
    await assert.rejects(service.detect({ path, connection }), error => error.code === 'SERIAL_PORT_BUSY');
    port.isOpen = false;
    port.emit('close');
    port.closeCallback?.();
    await closeError.pendingRelease;
    assert.strictEqual(getSerialPathReservation(path), null);
  }
}

function buildStandardCapture() {
  const parts = [Buffer.from([9, 9]), DELIMITER];
  for (let index = 0; index < 5; index += 1) {
    parts.push(Buffer.alloc(1024, index + 1), DELIMITER);
  }
  return Buffer.concat(parts);
}

class FakeSerialPort extends EventEmitter {
  constructor({ chunks = [], openError = null, runtimeError = null } = {}) {
    super();
    this.chunks = chunks;
    this.openError = openError;
    this.runtimeError = runtimeError;
    this.isOpen = false;
    this.opening = false;
    this.closeCalls = 0;
  }

  open(callback) {
    this.opening = true;
    setImmediate(() => {
      this.opening = false;
      if (this.openError) {
        callback(this.openError);
        return;
      }
      this.isOpen = true;
      callback();
      setImmediate(() => {
        this.chunks.forEach((chunk) => this.emit('data', chunk));
        if (this.runtimeError) this.emit('error', this.runtimeError);
      });
    });
  }

  close(callback) {
    this.closeCalls += 1;
    this.opening = false;
    this.isOpen = false;
    callback?.();
  }
}

async function main() {
  const captureBytes = buildStandardCapture();
  const fakePort = new FakeSerialPort({
    chunks: [captureBytes.subarray(0, 7), captureBytes.subarray(7)],
  });
  const captured = await captureSerialAtBaud({
    path: 'COM7',
    baudRate: 1000000,
    durationMs: 5,
    createSerialPort: () => fakePort,
  });
  assert.deepStrictEqual(captured, captureBytes);
  assert.strictEqual(fakePort.closeCalls, 1, 'timeout/success path must close the temporary port');

  const openFailurePort = new FakeSerialPort({ openError: new Error('access denied') });
  await assert.rejects(
    captureSerialAtBaud({
      path: 'COM7',
      baudRate: 1000000,
      durationMs: 5,
      createSerialPort: () => openFailurePort,
    }),
    /access denied/,
  );
  assert.strictEqual(openFailurePort.closeCalls, 1, 'open error path must dispose the handle');

  const runtimeFailurePort = new FakeSerialPort({ runtimeError: new Error('device removed') });
  await assert.rejects(
    captureSerialAtBaud({
      path: 'COM7',
      baudRate: 1000000,
      durationMs: 50,
      createSerialPort: () => runtimeFailurePort,
    }),
    /device removed/,
  );
  assert.strictEqual(runtimeFailurePort.closeCalls, 1, 'runtime error path must close the handle');

  const calls = [];
  const service = createSerialProtocolProbeService({
    serialManager: { getStatus: () => [{ path: 'COM1', status: 'registered', isOpen: false }] },
    captureAtBaud: async ({ baudRate }) => {
      calls.push(baudRate);
      return baudRate === 1000000 ? captureBytes : Buffer.alloc(0);
    },
  });
  const result = await service.detect({ path: 'COM7' });
  assert.strictEqual(result.status, 'matched');
  assert.strictEqual(result.match.id, 'standard-1024');
  assert.deepStrictEqual(result.protocol, result.match.protocol);
  assert.deepStrictEqual(calls, [921600, 1000000, 1500000, 3000000]);

  const partialBaudService = createSerialProtocolProbeService({
    serialManager: { getStatus: () => [] },
    captureAtBaud: async ({ baudRate }) => {
      if (baudRate === 3000000) throw new Error('unsupported baud rate');
      return baudRate === 1000000 ? captureBytes : Buffer.alloc(0);
    },
  });
  const partialBaudResult = await partialBaudService.detect({ path: 'COM9' });
  assert.strictEqual(partialBaudResult.status, 'matched');
  assert.deepStrictEqual(partialBaudResult.diagnostics.failedBaudRates, [3000000]);

  const noSupportedBaudService = createSerialProtocolProbeService({
    serialManager: { getStatus: () => [] },
    captureAtBaud: async () => { throw new Error('unsupported baud rate'); },
  });
  await assert.rejects(
    noSupportedBaudService.detect({ path: 'COM10' }),
    (error) => error.code === 'SERIAL_PROTOCOL_PROBE_FAILED' && error.httpStatus === 503,
  );

  let busyCaptureCalls = 0;
  const busyService = createSerialProtocolProbeService({
    serialManager: { getStatus: () => [{ path: 'com7', status: 'opening', isOpen: false }] },
    captureAtBaud: async () => {
      busyCaptureCalls += 1;
      return Buffer.alloc(0);
    },
  });
  await assert.rejects(
    busyService.detect({ path: 'COM7' }),
    (error) => error.code === 'SERIAL_PORT_BUSY' && error.httpStatus === 409,
  );
  assert.strictEqual(busyCaptureCalls, 0, 'busy ports must never be disconnected or probed');

  const closingService = createSerialProtocolProbeService({
    serialManager: { getStatus: () => [{ path: 'COM7', status: 'error', isOpen: false }], isPathBusy: () => true },
    captureAtBaud: async () => { busyCaptureCalls += 1; return Buffer.alloc(0); },
  });
  await assert.rejects(closingService.detect({ path: 'COM7' }), (error) => error.code === 'SERIAL_PORT_BUSY');
  assert.strictEqual(busyCaptureCalls, 0, 'a timed-out pending open remains reserved until the driver closes it');

  // 已登记但关闭不算 busy；这是常见的 Builder 配置状态。
  const registeredClosedService = createSerialProtocolProbeService({
    serialManager: { getStatus: () => [{ path: 'COM7', status: 'registered', isOpen: false }] },
    captureAtBaud: async ({ baudRate }) => (baudRate === 1000000 ? captureBytes : Buffer.alloc(0)),
  });
  assert.strictEqual((await registeredClosedService.detect({ path: 'COM7' })).status, 'matched');

  const fixedPreset = {
    id: 'fixed',
    label: 'fixed',
    protocol: {
      baudRate: 115200,
      framing: { type: 'fixedLength', frameLength: 64 },
      decoding: { valueType: 'uint8', valueCount: 64 },
    },
  };
  const fixedService = createSerialProtocolProbeService({
    serialManager: { getStatus: () => [] },
    loadPresets: () => ({ presets: [fixedPreset], invalid: [] }),
    captureAtBaud: async () => {
      throw new Error('fixedLength candidate must not open a port');
    },
  });
  const fixedResult = await fixedService.detect({ path: 'COM8', candidateIds: ['fixed'] });
  assert.strictEqual(fixedResult.status, 'unknown');
  assert.strictEqual(fixedResult.reason, 'no-detectable-candidates');
  assert.deepStrictEqual(fixedResult.diagnostics.skippedCandidateIds, ['fixed']);

  const unknownIdService = createSerialProtocolProbeService({
    serialManager: { getStatus: () => [] },
    loadPresets: () => loadSerialProtocolPresets(),
    captureAtBaud: async () => Buffer.alloc(0),
  });
  await assert.rejects(
    unknownIdService.detect({ path: 'COM8', candidateIds: ['missing'] }),
    (error) => error.code === 'UNKNOWN_PROTOCOL_PRESET' && error.httpStatus === 400,
  );

  // 探测与业务打开共享路径 reservation：探测先占用时，SerialManager 必须 fail closed，
  // 不能在 busy check 与临时端口 open 之间抢同一个物理 COM。
  let releaseReservedCapture;
  let notifyReservedCaptureStarted;
  const reservedCaptureStarted = new Promise((resolve) => { notifyReservedCaptureStarted = resolve; });
  const manager = createSerialManager({
    createSerialPort: (options, callback) => {
      const port = new EventEmitter();
      port.isOpen = false;
      port.close = (done) => done?.();
      setImmediate(() => callback?.());
      return port;
    },
  });
  manager.registerPort('sit', {
    path: 'COM11',
    baudRate: 1000000,
    autoOpen: false,
  });
  const reservationService = createSerialProtocolProbeService({
    serialManager: manager,
    captureAtBaud: async () => {
      notifyReservedCaptureStarted();
      return new Promise((resolve) => { releaseReservedCapture = resolve; });
    },
  });
  const reservedDetection = reservationService.detect({
    path: 'COM11',
    candidateIds: ['standard-1024'],
  });
  await reservedCaptureStarted;
  assert.throws(
    () => manager.start('sit'),
    (error) => error.code === 'SERIAL_PORT_RESERVED',
  );
  releaseReservedCapture(captureBytes);
  assert.strictEqual((await reservedDetection).status, 'matched');
  assert.doesNotThrow(() => manager.start('sit'), 'reservation must be released after detection');
  await manager.stop('sit');
  await testNativeDetection();
  await testDefaultConnectionFallback();
  await testProbeCleanupRaces();
}

main()
  .then(() => console.log('serialProtocolProbeService.test.js passed'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
