'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { PassThrough } = require('node:stream');
const { createMatrixDeviceProfiles, createFast256DeviceProfiles } = require('./matrix-device-fixtures.cjs');
const { runGloveWorkflow } = require('./glove-workflow.cjs');

/** Replace only the physical device; production SerialManager still owns opening, piping and closing. */
class AcceptancePort extends PassThrough {
  /** Keep the fake port closed until its asynchronous open callback. */
  constructor() { super(); this.isOpen = false; }
  /** Emulate successful driver opening without touching any COM device. */
  open(callback) { queueMicrotask(() => { this.isOpen = true; this.emit('open'); callback?.(); }); }
  /** Emit the same disconnect signal as a physical serial port. */
  close(callback) { this.isOpen = false; this.emit('close'); callback?.(); }
}

/** Parse CSV quoting so point comparisons inspect the exported file, not an intermediate array. */
function parseCsv(text) {
  const rows = [], row = [];
  let cell = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (char === '\n') { rows.push([...row]); row.length = 0; }
    } else cell += char;
  }
  assert.equal(quoted, false, 'CSV contains an unterminated quoted field');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

/** Generate asymmetric nonzero matrices that expose truncation, row shifts, mirrors and stale frames. */
function pressureFrame(side, frameIndex) {
  return Array.from({ length: side * side }, (_, index) =>
    20 + ((Math.floor(index / side) * 17 + index % side * 29 + frameIndex * 43) % 180));
}

/** 保留普通矩阵用例，与专用设备共用真实串口、采集及导出验收。 */
function plainMatrixProfile(m, sensorType, side) {
  return {
    id: sensorType, sensorType, side, parserChannel: 'sit',
    baudRate: m.getDefaultBaudRate(sensorType), delimiter: Buffer.from([0xaa, 0x55, 0x03, 0x99]),
    /** 原始字节和预期矩阵直接对应，便于发现截断或错帧。 */
    fixture(index) {
      const expected = pressureFrame(side, index);
      return { bytes: Buffer.from(expected), expected, realtimeExpected: expected };
    },
    /** 根据矩阵尺寸选择目标包中的正式处理器。 */
    createProcessor(target) {
      const process = side === 32
        ? target.createSit1024FrameProcessor({ ...target.processing, ...target.sensors, isCar: target.isCar, isPetCareSystem: () => false }).processFrame
        : target.createLegacyGenericMatrixFrameProcessor({ ...target.processing, ...target.sensors, isCar: target.isCar }).processBed4096Frame;
      /** 正式处理器拒绝的字节不产生验收帧。 */
      return (bytes, context) => {
        const result = process(bytes, context);
        return result ? JSON.parse(result.jsonData) : null;
      };
    },
    /** 普通矩阵仍按数组原样保存。 */
    assertStored(stored, fixture) { assert.deepEqual(stored, fixture.expected); },
    /** 实时和回放都保留完整矩阵。 */
    assertPayload(payload, fixture) { assert.deepEqual(payload.sitData, fixture.realtimeExpected); },
  };
}

/** Verify artifact components through real HTTP commands, serial framing, SQLite, replay and CSV. */
async function runDataWorkflow({ loadApp, outputDir }) {
  const report = { scope: 'components_only', cases: [], sensors: [],
    limitations: ['Physical serial device is simulated.', 'Connection context and stop callbacks are harness wiring, not the application composition root.',
      'Authorization is an allowed fixture; UI rendering, installation, collection frequency sampling and real hardware are not covered.',
      '12B cases cover 32x32 and four 16x16 display sampling points; separate collection-only downsampling is not covered.'] };
  /** Retain successful evidence and the precise failing stage for the outer release report. */
  async function check(id, run) {
    const start = Date.now();
    try { const details = await run(); report.cases.push({ id, status: 'passed', durationMs: Date.now() - start, ...details }); }
    catch (error) {
      report.cases.push({ id, status: 'failed', durationMs: Date.now() - start, error: error.message });
      error.cases = report.cases; error.dataWorkflow = report; error.details = report; throw error;
    }
  }
  let modules;
  await check('data.load_artifact_modules', () => {
    /** Resolve every production dependency from the caller's selected application artifact. */
    const app = relative => loadApp(relative);
    modules = {
      Database: app('node_modules/better-sqlite3'), express: app('node_modules/express'),
      sensors: app('node_modules/@shroom/backend/sensors'), processing: app('node_modules/@shroom/backend/processing'),
      ...app('node_modules/@shroom/backend/serial/serialManager.js'),
      ...app('node_modules/@shroom/backend/serial/serialParserManager.js'),
      ...app('node_modules/@shroom/backend/session/profiles.js'),
      ...app('node_modules/@shroom/backend/telemetry/channelBus.js'),
      ...app('node_modules/@shroom/backend/collection/collectionInsertQueueService.js'),
      ...app('node_modules/@shroom/backend/collection/collectionFrameStorageService.js'),
      ...app('node_modules/@shroom/backend/collection/collectionService.js'),
      ...app('backend/compatibility/legacyDataUtils.js'),
      ...app('backend/extensions/built-in-sensors/sit1024FrameProcessor.js'),
      ...app('backend/extensions/built-in-sensors/legacyGenericMatrixFrameProcessor.js'),
      ...app('backend/extensions/built-in-sensors/smallBed12BRuntime.js'),
      ...app('backend/extensions/built-in-sensors/legacySerialFrameRuntime.js'),
      pressureCalibration: app('util/pressureCalibration_V2.7.54.js'),
      ...app('backend/kernel/storage/history/collectionSessionService.js'),
      ...app('backend/kernel/storage/history/collectionSourceMonitor.js'),
      ...app('backend/kernel/platform/commands/controlCommandRouter.js'),
      ...app('backend/kernel/platform/commands/controlCommandService.js'),
      ...app('backend/kernel/platform/commands/registerRuntimeCommandHandlers.js'),
      ...app('backend/kernel/platform/http/controlRoutes.js'),
      ...app('backend/kernel/realtime/sensorFrameEnvelope.js'),
      ...app('backend/kernel/playback/historyPlaybackService.js'),
      ...app('backend/kernel/playback/playbackFrameService.js'),
      ...app('backend/kernel/playback/historyFrameTransformService.js'),
      ...app('backend/kernel/storage/history/historyQueryService.js'),
      ...app('backend/kernel/csv/csvDownloadService.js'),
    };
  });
  const m = modules;
  const profiles = [plainMatrixProfile(m, 'fast1024', 32), plainMatrixProfile(m, 'bed4096num', 64),
    ...createMatrixDeviceProfiles(m), ...createFast256DeviceProfiles(m)];
  for (const profile of profiles) {
    const { id, sensorType, side, parserChannel, baudRate } = profile;
    const root = path.join(outputDir, id);
    fs.mkdirSync(root, { recursive: true });
    const db = new m.Database(path.join(root, 'matrix.db'));
    db.exec('CREATE TABLE matrix (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, timestamp INTEGER, date TEXT)');
    const state = { flag: false, saveTime: 'unchanged', colHZ: 50, collectOptions: profile.collectOptions || {} };
    let now = 1800000000000, port, monitor, server;
    const received = [], errors = [], pageFrames = [];
    /** 分包设备必须逐包进入parser，完整矩阵仍只占一个包。 */
    const packets = fixture => fixture.packets || [fixture.bytes];
    const journal = m.createCollectionSessionService({ root, now: () => now });
    const writer = m.createCollectionInsertQueueService({ sql: 'INSERT INTO matrix(data,timestamp,date) VALUES (?,?,?)',
      batchSize: 64, flushIntervalMs: 100000, onSettled: journal.settled, onError: error => errors.push(String(error)) });
    const parser = m.createSerialParserManager({ frameDelimiter: m.STANDARD_FRAME_DELIMITER, smallBed12BDelimiter: m.SMALL_BED_12B_FRAME_TAIL });
    const manager = m.createSerialManager({ parserManager: parser, createSerialPort: () => (port = new AcceptancePort()),
      onStatus: () => monitor?.refresh() });
    const bus = m.createChannelBus();
    /** Drain the real queue before recording a final collection result. */
    function finish(reason = 'USER_STOPPED') { state.flag = false; journal.finish(reason, writer.flushAll); }
    monitor = m.createCollectionSourceMonitor({ channelBus: bus, now: () => now,
      schedule: () => ({ unref() {} }), unschedule() {},
      getContext: () => ({ systemId: sensorType, connected: manager.isOpen('sit'), collecting: state.flag, playback: false,
        roles: ['sit'], roleConnectionKeys: { sit: String(manager.getStatus('sit')?.connectionId || '') } }),
      onUnavailable: status => finish(status.connected ? 'DATA_STREAM_TIMEOUT' : 'SERIAL_DISCONNECTED') });
    const transforms = m.createHistoryFrameTransformService({ ...m.sensors, totalToN: m.totalToN,
      smallBed12BCalibration: profile.calibration, getCollectOptions: () => state.collectOptions,
      getRuntime: () => ({ file: sensorType }) });
    const storage = m.createCollectionFrameStorageService({ ...m.sensors, ...transforms,
      smallBed12BType: m.sensors.SMALL_BED_12B_TYPE, getSensorType: () => sensorType,
      getDbRef: () => db, isCollecting: () => state.flag, shouldStoreCollectionFrame: () => true,
      hasEnoughCollectionDiskSpace: () => true,
      enqueueCollectionFrame: (targetDb, data, channelId) => writer.enqueue(targetDb, [data, now, state.saveTime], channelId,
        journal.queued({ channelId, timestamp: now })) });
    const processor = profile.createProcessor(m, { transforms });
    /** Follow the production parser's complete-frame event into processing, readiness and persistence. */
    function onFrame(bytes) {
      try {
        const payload = processor(bytes, { file: sensorType, colHZ: state.colHZ });
        if (!payload) return;
        received.push(payload);
        const envelope = m.buildSensorFrameEnvelope({ channel: 'sit', sensorType, source: 'realtime', payload, timestamp: now });
        bus.publish(envelope.channelId, envelope);
        storage.storeSit(payload);
      } catch (error) { errors.push(error.stack || String(error)); }
    }
    parser.onData(parserChannel, onFrame);
    const router = m.createControlCommandRouter();
    m.registerRuntimeCommandHandlers(router, { getRuntime: () => state, setRuntime: patch => Object.assign(state, patch),
      getCollectionSource: monitor.status, requireAccess() {}, normalizeCollectFrequency: m.normalizeCollectFrequency,
      normalizeCollectOptions: m.normalizeCollectOptions, resetCollectionStorageClock() {}, flushCollectionInsertQueues: writer.flushAll,
      onCollectionStarted: runtime => journal.begin({ recordKey: runtime.saveTime, systemId: sensorType, inputCoverage: 'synchronous' }),
      onCollectionStopping: finish });
    const app = m.express(); app.use(m.express.json());
    m.registerControlRoutes(app, { controlCommandService: m.createControlCommandService({ commandRouter: router }), serialManager: manager });
    /** Submit commands using the artifact's real public HTTP route on an isolated ephemeral port. */
    async function command(payload) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/commands`, { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'collection.control', requestId: `acceptance-${now}`, payload }) });
      return { status: response.status, ack: (await response.json()).data };
    }
    /** Split frames across awkward byte boundaries, including inside the delimiter. */
    async function transmit(frames) {
      for (const frame of frames) {
        const bytes = Buffer.concat([Buffer.from(frame), profile.delimiter]);
        // 最后一次write从尾标第2字节开始，保证专用12B尾标也跨包。
        const cuts = [0, 1, Math.floor(frame.length / 2), frame.length + 1, bytes.length];
        for (let index = 1; index < cuts.length; index++) port.write(bytes.subarray(cuts[index - 1], cuts[index]));
      }
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(errors, [], 'serial processing or SQLite emitted errors');
    }
    try {
      server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
      await check(`${id}.connection_guards`, async () => {
        assert.equal((await command({ active: true, name: 'must-not-start' })).ack.code, 'COLLECTION_DEVICE_NOT_CONNECTED');
        assert.equal(state.flag, false); assert.equal(state.saveTime, 'unchanged'); assert.equal(journal.current(), null);
        manager.open('sit', { path: `COM_ACCEPTANCE_${id}`, parserChannel, baudRate, reconnect: false });
        await manager.waitForOpen('sit');
        assert.equal((await command({ active: true })).ack.code, 'COLLECTION_DATA_NOT_READY');
        await transmit([new Array(127).fill(20)]);
        assert.equal((await command({ active: true })).ack.code, 'COLLECTION_DATA_NOT_READY');
        assert.equal(journal.current(), null);
        if (profile.incompletePackets?.length) {
          await transmit(profile.incompletePackets);
          assert.equal(received.length, 0, 'A first half-packet cannot publish a complete matrix');
          assert.equal((await command({ active: true })).ack.code, 'COLLECTION_DATA_NOT_READY');
        }
        const initial = profile.fixture(0);
        await transmit(packets(initial));
        assert.equal(received.length, 1); profile.assertPayload(received[0], initial);
        assert.equal(monitor.status().ready, true); assert.equal(db.prepare('SELECT count(*) n FROM matrix').get().n, 0);
      });
      const fixtures = Array.from({ length: 5 }, (_, index) => profile.fixture(index + 1));
      const expected = fixtures.map(fixture => fixture.expected);
      let rows, recordKey;
      await check(`${id}.collect_stop_drain`, async () => {
        assert.equal((await command({ active: true, name: '1800000000000' })).status, 200); assert.equal(state.flag, true);
        recordKey = state.saveTime; const before = received.length;
        now += 100; await transmit(fixtures.flatMap(packets));
        assert.equal(received.length - before, fixtures.length);
        received.slice(before).forEach((payload, index) => {
          profile.assertPayload(payload, fixtures[index]);
          if (sensorType === 'fast256') pageFrames.push({ expected: expected[index], frame:
            m.buildSensorFrameEnvelope({ channel: 'sit', sensorType, source: 'realtime', payload, timestamp: now, sequence: index + 1 }) });
        });
        assert.equal(writer.getStats().pending, expected.length); assert.equal(db.prepare('SELECT count(*) n FROM matrix').get().n, 0);
        assert.equal((await command({ active: false })).status, 200);
        const summary = await journal.whenFinished();
        assert.equal(summary.result, 'saved'); assert.equal(summary.channels.sit.committed, expected.length);
        assert.equal(writer.getStats().pending, 0); assert.equal(writer.getStats().failed, 0);
        rows = db.prepare('SELECT * FROM matrix WHERE date = ? ORDER BY id').all(recordKey);
        assert.equal(rows.length, expected.length);
        rows.forEach((row, index) => profile.assertStored(JSON.parse(row.data), fixtures[index]));
        await transmit(packets(profile.fixture(99)));
        assert.equal(db.prepare('SELECT count(*) n FROM matrix').get().n, expected.length);
        return { frames: rows.length, pointsPerFrame: side * side, comparedPoints: rows.length * side * side };
      });
      await check(`${id}.replay_all_points_and_clear`, () => {
        const zero = m.buildZeroPlaybackPayload({ sensorType, smallBed12BType: m.sensors.SMALL_BED_12B_TYPE,
          smallBed12BDisplayOptions: profile.displayOptions });
        const clear = m.buildSensorFrameEnvelope({ channel: 'sit', sensorType, source: 'playback', payload: zero });
        assert.equal(clear.payload.value.length, side * side, 'history clear must use the actual matrix size');
        assert(clear.payload.value.every(value => value === 0));
        const playback = m.createPlaybackFrameService({ ...m.sensors, ...m.processing, ...transforms,
          smallBed12BType: m.sensors.SMALL_BED_12B_TYPE });
        rows.forEach((row, index) => {
          const payload = playback.buildPayloads({ sensorType, sitRows: rows, index }).sitPayload;
          const frame = m.buildSensorFrameEnvelope({ channel: 'sit', sensorType, source: 'playback', payload });
          assert.deepEqual(frame.payload.value, expected[index], `replay frame ${index} differs`);
          profile.assertPayload({ ...payload, sitData: frame.payload.value }, fixtures[index]);
          assert.deepEqual(transforms.normalizeHistoryPressureData(row, sensorType), expected[index]);
          if (sensorType === 'fast256') pageFrames.push({ expected: expected[index], frame });
        });
        return { replayedFrames: rows.length, clearPoints: side * side };
      });
      await check(`${id}.csv_export_all_points`, async () => {
        const csv = m.createCsvDownloadService({ fs, path, ...m.processing, ...m, ...transforms,
          timeStampToDateLabel: m.processing.timeStampTo_Date,
          logger: { info() {}, warn() {}, error() {} }, csvPath: path.join(root, 'csv'), publishSystemEvent() {},
          getRuntime: () => ({ file: sensorType, historyArr: [0, rows.length] }), getDatabases: () => ({ db }) });
        const result = await csv.exportHistoryCsv({ date: recordKey, downloadOptions: { path: path.join(root, 'csv'), rangeMode: 'full', language: 'en' } });
        assert.equal(result.ok, true, result.error); assert.equal(result.files.length, 1);
        const exported = parseCsv(fs.readFileSync(result.files[0], 'utf8').replace(/^\ufeff/, ''));
        const dataIndex = exported[0].indexOf(transforms.getCsvTitleMap({ language: 'en' }).realData);
        assert(dataIndex >= 0, 'CSV matrix column missing'); assert.equal(exported.length - 1, expected.length);
        exported.slice(1).forEach((row, index) => assert.deepEqual(JSON.parse(row[dataIndex]), expected[index], `CSV frame ${index} differs`));
        return { csvFrames: expected.length, file: result.files[0] };
      });
      await check(`${id}.timeout_and_disconnect_stop`, async () => {
        assert.equal((await command({ active: true, name: 'timeout-session' })).status, 200);
        await transmit(packets(profile.fixture(10))); now += 5001; monitor.refresh();
        assert.equal(state.flag, false); assert.equal((await journal.whenFinished()).reason, 'DATA_STREAM_TIMEOUT');
        assert.equal(writer.getStats().pending, 0);
        assert.equal((await command({ active: true })).ack.code, 'COLLECTION_DATA_NOT_READY');
        await transmit(packets(profile.fixture(11))); assert.equal(state.flag, false, 'new data must not silently restart collection');
        assert.equal((await command({ active: true, name: 'disconnect-session' })).status, 200);
        await transmit(packets(profile.fixture(12))); port.close(); monitor.refresh();
        assert.equal(state.flag, false); const summary = await journal.whenFinished();
        assert.equal(summary.reason, 'SERIAL_DISCONNECTED'); assert.equal(summary.channels.sit.committed, 1);
        assert.equal(writer.getStats().pending, 0);
        assert.equal((await command({ active: true })).ack.code, 'COLLECTION_DEVICE_NOT_CONNECTED');
        return { writtenFrames: writer.getStats().written, interruptedSessions: 2 };
      });
      if (sensorType === 'fast256') fs.writeFileSync(path.join(root, 'page-frames.json'), JSON.stringify({
        id, sensorType, source: 'production-parser-storage-and-playback', frames: pageFrames,
      }));
      report.sensors.push({ id, sensorType, side, baudRate, parserChannel, delimiterHex: profile.delimiter.toString('hex'),
        displayOptions: profile.displayOptions, framesCompared: expected.length, pointsCompared: expected.length * side * side,
        database: path.join(root, 'matrix.db') });
    } finally {
      monitor.dispose(); state.flag = false; writer.flushAll(); await manager.closeAll();
      parser.offData(parserChannel, onFrame); journal.dispose();
      server?.closeAllConnections(); if (server?.listening) await new Promise(resolve => server.close(resolve));
      db.close();
    }
  }
  /** 合并专用双路手套证据，失败时也保留此前所有矩阵用例结果。 */
  function mergeGloveEvidence(result = {}) {
    report.cases.push(...(result.cases || []));
    report.sensors.push(...(result.sensors || []));
    report.limitations.push(...(result.limitations || []));
  }
  try { mergeGloveEvidence(await runGloveWorkflow({ loadApp, outputDir })); }
  catch (error) { mergeGloveEvidence(error.details); error.details = report; throw error; }
  report.counts = { passed: report.cases.filter(item => item.status === 'passed').length, failed: 0,
    comparedPoints: report.sensors.reduce((total, sensor) => total + sensor.pointsCompared, 0),
    orientationValuesCompared: report.sensors.reduce((total, sensor) => total + (sensor.orientationValuesCompared || 0), 0) };
  return report;
}

module.exports = { runDataWorkflow };
