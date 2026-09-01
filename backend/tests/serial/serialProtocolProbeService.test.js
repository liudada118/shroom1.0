const assert = require('assert');
const { EventEmitter } = require('events');
const {
  captureSerialAtBaud,
  createSerialProtocolProbeService,
} = require('../../kernel/serial/serialProtocolProbeService');
const { loadSerialProtocolPresets } = require('@shroom/backend/protocol/presets/index.js');
const { createSerialManager } = require('@shroom/backend/serial/serialManager.js');

const DELIMITER = Buffer.from([0xaa, 0x55, 0x03, 0x99]);

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
}

main()
  .then(() => console.log('serialProtocolProbeService.test.js passed'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
