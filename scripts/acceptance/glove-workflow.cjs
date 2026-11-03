'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { PassThrough } = require('node:stream');
const GLOVE_DELIMITER = Buffer.from([0xaa, 0x55, 0x03, 0x99]);

/** 模拟物理手套串口；生产 SerialManager 仍负责开关和 parser 管道。 */
class GlovePort extends PassThrough {
  /** 在异步打开回调前保持未连接状态。 */
  constructor() { super(); this.isOpen = false; }
  /** 发出串口驱动打开事件，不访问真实 COM 设备。 */
  open(callback) { queueMicrotask(() => { this.isOpen = true; this.emit('open'); callback?.(); }); }
  /** 发出拔线事件，交给生产连接状态和采集监测处理。 */
  close(callback) { this.isOpen = false; this.emit('close'); callback?.(); }
}

/** 生成左右手可区分的已知256点压力和精确可表示的四元数，期望值不调用生产解析器。 */
function gloveSample(channel, index) {
  const right = channel === 'back';
  const pressure = Array.from({ length: 256 }, (_, point) => 20 + ((point * 17 + index * 31 + (right ? 67 : 0)) % 180));
  const rotate = [1, index / 8, right ? -0.5 : 0.5, 0.25];
  const imu = Buffer.alloc(16);
  rotate.forEach((value, offset) => imu.writeFloatLE(value, offset * 4));
  return { pressure, rotate, packets: [Buffer.from([1, right ? 2 : 1, ...pressure.slice(0, 128)]),
    Buffer.concat([Buffer.from([2, right ? 2 : 1, ...pressure.slice(128)]), imu])] };
}

/** 读取实际CSV中的引号转义字段，避免只比较导出前的中间对象。 */
function readCsv(text) {
  const records = [], row = [];
  let cell = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index++; } else quoted = !quoted;
    } else if (!quoted && (character === ',' || character === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (character === '\n') { records.push([...row]); row.length = 0; }
    } else cell += character;
  }
  assert.equal(quoted, false, 'CSV quotation must be complete');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); records.push(row); }
  return records;
}

/** 用目标包的生产手套协议、左右数据库视图及采集/回放/CSV服务验证已知设备数据。 */
async function runGloveWorkflow({ loadApp, outputDir }) {
  const report = { cases: [], sensors: [], limitations: [
    'Glove cases cover hand0205 left/right and hand0205Double manual dual-port routing; full-packet, 115200, automatic packet-side routing and physical drivers are not covered.',
    'Pressure and orientation use independent known inputs; mapped rendering is checked for realtime/replay consistency, not anatomical geometry accuracy.',
  ] };
  /** 保留已通过的阶段以及准确失败点，交给外层统一报告。 */
  async function check(id, run) {
    const started = Date.now();
    try {
      const details = await run();
      report.cases.push({ id, status: 'passed', durationMs: Date.now() - started, ...details });
    }
    catch (error) {
      report.cases.push({ id, status: 'failed', durationMs: Date.now() - started, error: error.message });
      error.details = report; throw error;
    }
  }
  let m;
  await check('glove.load_artifact_modules', () => {
    m = {
      express: loadApp('node_modules/express'),
      sensors: loadApp('node_modules/@shroom/backend/sensors'), processing: loadApp('node_modules/@shroom/backend/processing'),
      ...loadApp('node_modules/@shroom/backend/serial/serialManager.js'),
      ...loadApp('node_modules/@shroom/backend/serial/serialParserManager.js'),
      ...loadApp('node_modules/@shroom/backend/session/profiles.js'),
      ...loadApp('node_modules/@shroom/backend/telemetry/channelBus.js'),
      ...loadApp('node_modules/@shroom/backend/collection/collectionInsertQueueService.js'),
      ...loadApp('node_modules/@shroom/backend/collection/collectionFrameStorageService.js'),
      ...loadApp('node_modules/@shroom/backend/collection/collectionService.js'),
      ...loadApp('backend/compatibility/legacyDataUtils.js'),
      ...loadApp('backend/extensions/built-in-sensors/legacySerialFrameRuntime.js'),
      ...loadApp('backend/extensions/built-in-sensors/handPacketRuntime.js'),
      ...loadApp('backend/kernel/storage/gloveDatabase.js'),
      ...loadApp('backend/kernel/storage/history/collectionSessionService.js'),
      ...loadApp('backend/kernel/storage/history/collectionSourceMonitor.js'),
      ...loadApp('backend/kernel/platform/commands/controlCommandRouter.js'),
      ...loadApp('backend/kernel/platform/commands/controlCommandService.js'),
      ...loadApp('backend/kernel/platform/commands/registerRuntimeCommandHandlers.js'),
      ...loadApp('backend/kernel/platform/http/controlRoutes.js'),
      ...loadApp('backend/kernel/realtime/sensorFrameEnvelope.js'),
      ...loadApp('backend/kernel/playback/playbackFrameService.js'),
      ...loadApp('backend/kernel/playback/historyFrameTransformService.js'),
      ...loadApp('backend/kernel/storage/history/historyQueryService.js'),
      ...loadApp('backend/kernel/csv/csvDownloadService.js'),
    };
  });

  const variants = [
    { id: 'hand0205-left', sensorType: 'hand0205', channels: ['sit'] },
    { id: 'hand0205-right', sensorType: 'hand0205', channels: ['back'] },
    { id: 'hand0205Double', sensorType: 'hand0205Double', channels: ['sit', 'back'] },
  ];
  for (const { id, sensorType, channels } of variants) {
    const root = path.join(outputDir, id);
    fs.mkdirSync(root, { recursive: true });
    const pair = m.openGloveDatabase(sensorType, root);
    const databases = { sit: pair.db, back: pair.db1 };
    let now = 1800000000000, monitor, server;
    const ports = {}, errors = [], received = { sit: [], back: [] };
    const state = { file: sensorType, flag: false, saveTime: 'unchanged', colHZ: 50, collectOptions: {},
      firstBlueData: [], firstBlueData1: [], nowDate: now, endDate: now + 86400000 };
    const journal = m.createCollectionSessionService({ root, now: () => now });
    const writer = m.createCollectionInsertQueueService({ sql: 'INSERT INTO matrix(data,timestamp,date) VALUES (?,?,?)',
      batchSize: 64, flushIntervalMs: 100000, onSettled: journal.settled, onError: error => errors.push(String(error)) });
    const parser = m.createSerialParserManager({ frameDelimiter: m.STANDARD_FRAME_DELIMITER, smallBed12BDelimiter: m.SMALL_BED_12B_FRAME_TAIL });
    const manager = m.createSerialManager({ parserManager: parser, createSerialPort: options => {
      const role = String(options.path).endsWith('_back') ? 'back' : 'sit'; return (ports[role] = new GlovePort());
    }, onStatus: () => monitor?.refresh() });
    const bus = m.createChannelBus();
    /** 停采时排空正式队列后登记结果，防止末帧仍留在内存。 */
    function finish(reason = 'USER_STOPPED') { state.flag = false; journal.finish(reason, writer.flushAll); }
    monitor = m.createCollectionSourceMonitor({ channelBus: bus, now: () => now,
      schedule: () => ({ unref() {} }), unschedule() {},
      getContext: () => ({ systemId: sensorType, connected: channels.some(channel => manager.isOpen(channel)), collecting: state.flag,
        playback: false, roles: channels, roleConnectionKeys: Object.fromEntries(channels.map(channel =>
          [channel, manager.isOpen(channel) ? String(manager.getStatus(channel)?.connectionId || '') : null])) }),
      onUnavailable: source => finish(source.connected ? 'DATA_STREAM_TIMEOUT' : 'SERIAL_DISCONNECTED') });
    const transforms = m.createHistoryFrameTransformService({ ...m.sensors, totalToN: m.totalToN, getRuntime: () => state });
    const storage = m.createCollectionFrameStorageService({ ...m.sensors, ...transforms,
      getSensorType: () => sensorType, getDbRef: channel => databases[channel], isCollecting: () => state.flag,
      shouldStoreCollectionFrame: () => true, hasEnoughCollectionDiskSpace: () => true,
      enqueueCollectionFrame: (db, data, channel) => writer.enqueue(db, [data, now, state.saveTime], channel,
        journal.queued({ channelId: channel, timestamp: now })) });
    /** 将真实协议输出送入标准帧、数据就绪监测与正式存储服务。 */
    function publish(channel, json) {
      const payload = JSON.parse(json);
      const frame = m.buildSensorFrameEnvelope({ channel, sensorType, source: 'realtime', payload, timestamp: now });
      received[channel].push({ payload, frame });
      bus.publish(frame.channelId, frame);
      storage[channel === 'sit' ? 'storeSit' : 'storeBack'](payload);
      return { frame: payload };
    }
    const packetRuntime = m.createHandPacketRuntime({ ...m.processing, ...transforms,
      fullPacketType: 'handGloveFullPacket', doublePacketType: 'hand0205Double',
      parseFullPacket: m.sensors.handGloveFullPacket.parseHandGloveFullPacket,
      mapFullPacketModelMatrix: m.sensors.handGloveFullPacket.mapHandGloveFullPacketModelMatrix,
      createDoublePacketParser: m.sensors.handGloveDouble.createHandGloveDoublePacketParser,
      getRuntime: () => state, setRuntime: patch => Object.assign(state, patch),
      publishSit: json => publish('sit', json), publishBack: json => publish('back', json) });
    const ctx = Object.assign(state, m.processing, m.sensors, { isCar: m.isCar,
      handleHandGloveDoublePacket: packetRuntime.handleDoublePacket, handleHandGloveFullPacket: packetRuntime.handleFullPacket,
      colOrSendData: json => publish('sit', json), colOrSendData1: json => publish('back', json) });
    const legacy = m.createLegacySerialFrameRuntime(ctx);
    const handlers = {};
    for (const channel of channels) {
      /** 接住协议异常并保留到本次断言，不吞掉 parser 回调失败。 */
      handlers[channel] = bytes => {
        try { legacy[channel === 'sit' ? 'handleSitSerialFrame' : 'handleBackSerialFrame'](bytes); }
        catch (error) { errors.push(error.stack || String(error)); }
      };
      parser.onData(channel, handlers[channel]);
    }
    const router = m.createControlCommandRouter();
    m.registerRuntimeCommandHandlers(router, { getRuntime: () => state, setRuntime: patch => Object.assign(state, patch),
      getCollectionSource: monitor.status, requireAccess() {}, normalizeCollectFrequency: m.normalizeCollectFrequency,
      normalizeCollectOptions: m.normalizeCollectOptions, resetCollectionStorageClock() {}, flushCollectionInsertQueues: writer.flushAll,
      onCollectionStarted: runtime => journal.begin({ recordKey: runtime.saveTime, systemId: sensorType, inputCoverage: 'synchronous' }),
      onCollectionStopping: finish });
    const app = m.express(); app.use(m.express.json());
    m.registerControlRoutes(app, { controlCommandService: m.createControlCommandService({ commandRouter: router }), serialManager: manager });
    /** 通过目标包实际HTTP路由控制采集，监听临时端口。 */
    async function command(payload) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/commands`, { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'collection.control', requestId: `glove-${now}`, payload }) });
      return { status: response.status, ack: (await response.json()).data };
    }
    /** 任意切分串口字节，包括帧尾内部；多手可交错首尾包发送。 */
    async function transmit(channel, packets) {
      for (const packet of packets) {
        const bytes = Buffer.concat([packet, GLOVE_DELIMITER]);
        const cuts = [0, 1, Math.floor(packet.length / 2), packet.length + 1, bytes.length];
        for (let index = 1; index < cuts.length; index++) ports[channel].write(bytes.subarray(cuts[index - 1], cuts[index]));
      }
      await new Promise(resolve => setImmediate(resolve));
      assert.deepEqual(errors, [], 'Glove parser/processor/storage must not raise errors');
    }
    /** 交错发送左右首包再发送尾包，暴露手侧缓存混用和压力串路。 */
    async function transmitSample(index) {
      for (const channel of channels) await transmit(channel, [gloveSample(channel, index).packets[0]]);
      for (const channel of [...channels].reverse()) await transmit(channel, [gloveSample(channel, index).packets[1]]);
    }
    /** 按当前采集记录读取左右实际物理表，不使用入库前副本作为结果。 */
    function readRows(recordKey) {
      return Object.fromEntries(['sit', 'back'].map(channel => [channel,
        databases[channel]._db.prepare('SELECT * FROM matrix WHERE date = ? ORDER BY id').all(recordKey)]));
    }
    try {
      server = http.createServer(app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
      await check(`${id}.connection_and_half_packet_guards`, async () => {
        assert.equal((await command({ active: true })).ack.code, 'COLLECTION_DEVICE_NOT_CONNECTED');
        for (const channel of channels) {
          manager.open(channel, { path: `COM_ACCEPTANCE_${id}_${channel}`, parserChannel: channel, baudRate: 921600, reconnect: false });
          await manager.waitForOpen(channel); state[channel === 'sit' ? 'port1' : 'port2'] = ports[channel];
        }
        assert.equal((await command({ active: true })).ack.code, 'COLLECTION_DATA_NOT_READY');
        for (const channel of channels) await transmit(channel, [Buffer.alloc(127, 25), gloveSample(channel, 0).packets[0]]);
        assert.equal((await command({ active: true })).ack.code, 'COLLECTION_DATA_NOT_READY');
        assert.equal(received.sit.length + received.back.length, 0, 'First half alone must not publish pressure');
        for (const channel of channels) await transmit(channel, [gloveSample(channel, 0).packets[1]]);
        assert.equal(monitor.status().ready, true);
        assert.equal(writer.getStats().queued, 0);
      });
      let rows, recordKey, live;
      await check(`${id}.collect_stop_drain_and_hand_identity`, async () => {
        assert.equal((await command({ active: true, name: '1800000000000' })).status, 200); assert.equal(state.flag, true);
        recordKey = state.saveTime;
        const starts = Object.fromEntries(channels.map(channel => [channel, received[channel].length]));
        for (let index = 1; index <= 5; index++) { now += 10; await transmitSample(index); }
        assert.equal(writer.getStats().pending, channels.length * 5);
        assert.equal((await command({ active: false })).status, 200);
        const summary = await journal.whenFinished(); assert.equal(summary.result, 'saved');
        rows = readRows(recordKey); live = {};
        for (const channel of channels) {
          live[channel] = received[channel].slice(starts[channel]);
          assert.equal(rows[channel].length, 5); assert.equal(live[channel].length, 5);
          assert.equal(summary.channels[channel].committed, 5);
          rows[channel].forEach((row, index) => {
            const expected = gloveSample(channel, index + 1), stored = JSON.parse(row.data), current = live[channel][index];
            assert.deepEqual(current.payload.rawPressureData, expected.pressure, 'Realtime raw pressure differs from wire data');
            assert.deepEqual(current.payload.rotate, expected.rotate, 'Realtime IMU differs from wire float32');
            assert.equal(current.frame.channelId, `${sensorType}:${channel}`);
            assert.deepEqual(current.frame.payload.stages.calibrated, expected.pressure);
            assert.deepEqual(stored.pressureData, expected.pressure, 'Stored raw pressure differs');
            assert.deepEqual(stored.rotate, expected.rotate, 'Stored IMU differs');
            assert.equal(row.hand, channel === 'sit' ? 'left' : 'right');
          });
        }
        for (const channel of ['sit', 'back'].filter(channel => !channels.includes(channel))) assert.equal(rows[channel].length, 0);
        assert.equal(writer.getStats().pending, 0); assert.equal(writer.getStats().failed, 0);
        await transmitSample(99);
        assert.equal(readRows(recordKey).sit.length + readRows(recordKey).back.length, 5 * channels.length);
        return { frames: 5 * channels.length, pointsPerFrame: 256, comparedPoints: 1280 * channels.length };
      });
      await check(`${id}.replay_pressure_orientation_and_mapping`, () => {
        const playback = m.createPlaybackFrameService({ ...m.sensors, ...m.processing, ...transforms,
          handGloveFullPacket: 'handGloveFullPacket', ...m.sensors.handGloveFullPacket });
        for (let index = 0; index < 5; index++) {
          const payloads = playback.buildPayloads({ sensorType, sitRows: rows.sit, backRows: rows.back, index });
          for (const channel of channels) {
            const payload = payloads[`${channel}Payload`], expected = gloveSample(channel, index + 1);
            assert.ok(payload, `${channel} playback payload is missing`);
            assert.deepEqual(payload[`${channel}Data`], expected.pressure, 'Replay raw pressure differs');
            assert.deepEqual(payload.rotate, expected.rotate, 'Replay IMU differs');
            assert.deepEqual(payload.newArr147, live[channel][index].payload.newArr147, 'Realtime/replay hand mapping differs');
            const frame = m.buildSensorFrameEnvelope({ channel, sensorType, source: 'playback', payload });
            assert.equal(frame.channelId, `${sensorType}:${channel}`);
            assert.deepEqual(frame.payload.value, expected.pressure);
            assert.deepEqual(transforms.normalizeHistoryPressureData(rows[channel][index], sensorType), expected.pressure);
          }
        }
        return { replayedFrames: 5 * channels.length, orientationValuesPerFrame: 4 };
      });
      await check(`${id}.csv_pressure_orientation_and_hand_identity`, async () => {
        const csv = m.createCsvDownloadService({ fs, path, ...m.processing, ...m, ...transforms,
          timeStampToDateLabel: m.processing.timeStampTo_Date, logger: { info() {}, warn() {}, error() {} },
          csvPath: path.join(root, 'csv'), publishSystemEvent() {}, getRuntime: () => ({ file: sensorType, historyArr: [0, 5] }),
          getDatabases: () => pair });
        const result = await csv.exportHistoryCsv({ date: recordKey, downloadOptions: { path: path.join(root, 'csv'), rangeMode: 'full', language: 'en' } });
        assert.equal(result.ok, true, result.error); assert.equal(result.files.length, 1);
        const exported = readCsv(fs.readFileSync(result.files[0], 'utf8').replace(/^\ufeff/, ''));
        const headers = exported[0], titles = transforms.getCsvTitleMap({ language: 'en' });
        const dataColumn = headers.indexOf(titles.realData), rotateColumn = headers.indexOf(titles.rotate), handColumn = headers.indexOf('hand');
        assert.ok(dataColumn >= 0 && rotateColumn >= 0 && handColumn >= 0, 'Glove CSV data/rotation/side columns missing');
        assert.equal(exported.length - 1, 5 * channels.length);
        const counters = { sit: 0, back: 0 };
        for (const row of exported.slice(1)) {
          assert.ok(['left', 'right'].includes(row[handColumn]));
          const channel = row[handColumn] === 'left' ? 'sit' : 'back';
          assert.ok(channels.includes(channel), 'CSV contains an uncollected hand');
          const expected = gloveSample(channel, ++counters[channel]);
          assert.deepEqual(JSON.parse(row[dataColumn]), expected.pressure);
          assert.deepEqual(JSON.parse(row[rotateColumn]), expected.rotate);
        }
        for (const channel of channels) assert.equal(counters[channel], 5);
        return { csvFrames: exported.length - 1, file: result.files[0] };
      });
      await check(`${id}.timeout_and_disconnect_stop`, async () => {
        assert.equal((await command({ active: true, name: 'timeout-session' })).status, 200);
        await transmitSample(10); now += 5001; monitor.refresh();
        assert.equal(state.flag, false); assert.equal((await journal.whenFinished()).reason, 'DATA_STREAM_TIMEOUT');
        assert.equal(writer.getStats().pending, 0);
        assert.equal((await command({ active: true })).ack.code, 'COLLECTION_DATA_NOT_READY');
        await transmitSample(11); assert.equal(state.flag, false);
        assert.equal((await command({ active: true, name: 'disconnect-session' })).status, 200);
        await transmitSample(12);
        for (const channel of channels) ports[channel].close();
        monitor.refresh(); assert.equal(state.flag, false);
        const summary = await journal.whenFinished(); assert.equal(summary.reason, 'SERIAL_DISCONNECTED');
        for (const channel of channels) assert.equal(summary.channels[channel].committed, 1);
        assert.equal(writer.getStats().pending, 0);
        assert.equal((await command({ active: true })).ack.code, 'COLLECTION_DEVICE_NOT_CONNECTED');
        return { writtenFrames: writer.getStats().written, interruptedSessions: 2 };
      });
      report.sensors.push({ id, sensorType, channels, protocol: '130+146 bytes; 256 uint8 pressure + 4 float32 LE orientation',
        baudRate: 921600, delimiterHex: GLOVE_DELIMITER.toString('hex'),
        framesCompared: 5 * channels.length, pointsCompared: 1280 * channels.length,
        orientationValuesCompared: 20 * channels.length, database: pair.db.path });
    } finally {
      monitor.dispose(); state.flag = false; writer.flushAll(); await manager.closeAll();
      for (const channel of channels) parser.offData(channel, handlers[channel]);
      journal.dispose(); server?.closeAllConnections();
      if (server?.listening) await new Promise(resolve => server.close(resolve));
      pair.db.close(); pair.db1.close();
    }
  }
  return report;
}

module.exports = { runGloveWorkflow };
