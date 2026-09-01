const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  DISPLAY_SYSTEM_SCHEMA_VERSION,
  SENSOR_FRAME_SCHEMA_VERSION,
  buildSdkContractSnapshot,
  isSensorFrameV1Envelope: validateBackendFrame,
  multiSensorStableContract,
} = require('@shroom/backend/contract');
const {
  SENSOR_FRAME_TYPE,
  buildSensorFrameEnvelope,
} = require('../../kernel/realtime/sensorFrameEnvelope');
const { CHANNEL_HISTORY_COLUMNS } = require('../../kernel/storage/dbManager');
const { CSV_COLUMN_IDS } = require('../../kernel/csv/csvDownloadService');
const {
  DISPLAY_SYSTEM_SCHEMA_VERSION: VALIDATOR_SCHEMA_VERSION,
  SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS,
} = require('../../extension-host/manifest/displaySystemConfigValidator');

const frontendContractPath = path.resolve(
  __dirname,
  '../../../sdk/frontend/src/contract/multiSensorStableContract.json',
);

function sortedKeys(value) {
  return Object.keys(value).sort();
}

function testPublishedCopiesDoNotDrift() {
  const frontendContract = JSON.parse(fs.readFileSync(frontendContractPath, 'utf8'));

  assert.deepStrictEqual(
    frontendContract,
    multiSensorStableContract,
    '@shroom/frontend 与 @shroom/backend 的多传感器稳定契约不一致；发布前必须同步更新并升版。',
  );
  assert.strictEqual(multiSensorStableContract.contractName, 'shroom.multi-sensor');
  assert.strictEqual(multiSensorStableContract.contractVersion, 1);
  assert.strictEqual(multiSensorStableContract.status, 'stable');
  assert.strictEqual(Object.isFrozen(multiSensorStableContract), true);
}

function testAllBackendBoundariesUseTheFrozenVersion() {
  assert.strictEqual(SENSOR_FRAME_SCHEMA_VERSION, multiSensorStableContract.frame.schemaVersion);
  assert.strictEqual(SENSOR_FRAME_TYPE, multiSensorStableContract.frame.type);
  assert.strictEqual(DISPLAY_SYSTEM_SCHEMA_VERSION, multiSensorStableContract.manifest.schemaVersion);
  assert.strictEqual(VALIDATOR_SCHEMA_VERSION, multiSensorStableContract.manifest.schemaVersion);
  assert.deepStrictEqual(
    [...SUPPORTED_DISPLAY_SYSTEM_SCHEMA_VERSIONS],
    multiSensorStableContract.manifest.supportedSchemaVersions,
  );
  assert.deepStrictEqual(
    CHANNEL_HISTORY_COLUMNS.map((column) => [...column]),
    multiSensorStableContract.storage.identityColumns,
  );
  assert.deepStrictEqual(
    [...CSV_COLUMN_IDS],
    [
      ...multiSensorStableContract.csv.legacyColumnIds,
      ...multiSensorStableContract.csv.identityColumnIds,
    ],
  );

  const snapshot = buildSdkContractSnapshot();
  assert.deepStrictEqual(snapshot.stableContracts.multiSensor, {
    name: multiSensorStableContract.contractName,
    version: multiSensorStableContract.contractVersion,
    status: multiSensorStableContract.status,
    compatibilityPolicy: multiSensorStableContract.compatibilityPolicy,
  });
}

function testWireShapeAndPlaybackDiagnosticsAreFrozen() {
  const frame = buildSensorFrameEnvelope({
    channel: 'leftPressure',
    sequence: 7,
    payload: {
      type: 'sensor.frame',
      schemaVersion: 1,
      channelId: 'human-body:left-hand',
      displaySystemId: 'human-body',
      sensorId: 'left-hand',
      sensorLabel: '左手',
      sensorType: 'hand-pad',
      outputChannel: 'leftPressure',
      source: 'playback',
      timestamp: 1234,
      quality: 'good',
      serial: {
        role: 'leftHand',
        portId: 'leftHand',
        path: 'COM7',
        baudRate: 921600,
        parserChannel: 'human-body:left-hand',
        status: 'open',
        isOpen: true,
        openedAt: 1000,
      },
      payload: {
        value: [1, 2],
        stages: {
          decoded: [1, 2],
          normalized: [1, 2],
          calibrated: [1, 2],
          processed: [1, 2],
          mapped: [2, 1],
        },
        metrics: { totalPressure: 3 },
        algorithmMetrics: { score: 1 },
        matrix: { rows: 1, cols: 2 },
        orientation: [0, 0, 0, 1],
        status: { connected: true },
        temperature: { average: 30 },
        protocol: { frameIndex: 8 },
        history: {
          index: 4,
          sourceIndex: 2,
          recordedAt: 1200,
          alignedAt: 1234,
          skewMs: -34,
          privateField: 'must-not-leak',
        },
      },
      sitData: [999],
    },
  });

  assert.ok(frame, '完整 canonical 帧应该能生成稳定信封');
  assert.strictEqual(validateBackendFrame(frame), true);
  assert.deepStrictEqual(sortedKeys(frame), [...multiSensorStableContract.frame.producerTopLevelFields].sort());
  assert.deepStrictEqual(sortedKeys(frame.payload), [...multiSensorStableContract.frame.payloadFields].sort());
  assert.deepStrictEqual(sortedKeys(frame.payload.stages), [...multiSensorStableContract.frame.stageFields].sort());
  assert.deepStrictEqual(sortedKeys(frame.serial), [...multiSensorStableContract.frame.serialFields].sort());
  assert.deepStrictEqual(sortedKeys(frame.payload.history), [...multiSensorStableContract.playback.historyFields].sort());
  assert.strictEqual(frame.payload.history.skewMs, -34);
  assert.strictEqual(Object.hasOwn(frame.payload.history, 'privateField'), false);
  multiSensorStableContract.frame.legacyInputOnlyFields.forEach((field) => {
    assert.strictEqual(Object.hasOwn(frame, field), false, `${field} 只能作为兼容输入，不能出现在 wire 顶层`);
  });

  const invalidSampleFrame = buildSensorFrameEnvelope({
    channel: 'sit',
    sensorType: 'legacy-chair',
    payload: { sitData: ['not-a-number', 2] },
  });
  assert.deepStrictEqual(invalidSampleFrame.payload.value, [null, 2]);
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(invalidSampleFrame)).payload.value,
    [null, 2],
    'ChannelBus 内存帧与 JSON WebSocket 帧必须对坏采样点使用同一 null 语义',
  );

  // channelPlaybackService 交给网关的是 legacy-shaped payload；这条专门守住
  // sourceIndex/alignedAt/skewMs 不会在最后一次白名单投影中被丢掉。
  const playbackFrame = buildSensorFrameEnvelope({
    channel: 'rightPressure',
    source: 'playback',
    payload: {
      channelId: 'human-body:right-hand',
      displaySystemId: 'human-body',
      sensorId: 'right-hand',
      outputChannel: 'rightPressure',
      data: [5, 6],
      history: {
        index: 8,
        sourceIndex: 6,
        recordedAt: 1400,
        alignedAt: 1500,
        skewMs: -100,
      },
    },
  });
  assert.deepStrictEqual(playbackFrame.payload.history, {
    index: 8,
    sourceIndex: 6,
    recordedAt: 1400,
    alignedAt: 1500,
    skewMs: -100,
  });
}

function testBackendValidatorFailsClosed() {
  const base = {
    type: 'sensor.frame',
    schemaVersion: 1,
    channelId: 'chair:left-hand',
    displaySystemId: 'chair',
    sensorId: 'left-hand',
    outputChannel: 'leftPressure',
    payload: { value: [1, null, 3] },
  };
  const fixtures = [
    { name: 'valid including null sample', value: base, expected: true },
    { name: 'future version', value: { ...base, schemaVersion: 2 }, expected: false },
    { name: 'identity mismatch', value: { ...base, displaySystemId: 'other' }, expected: false },
    { name: 'ambiguous identity', value: { ...base, sensorId: 'left:hand', channelId: 'chair:left:hand' }, expected: false },
    { name: 'missing value', value: { ...base, payload: {} }, expected: false },
    { name: 'string sample', value: { ...base, payload: { value: ['1'] } }, expected: false },
    { name: 'non-finite sample', value: { ...base, payload: { value: [Number.NaN] } }, expected: false },
  ];

  fixtures.forEach(({ name, value, expected }) => {
    assert.strictEqual(validateBackendFrame(value), expected, `backend validator: ${name}`);
  });
}

testPublishedCopiesDoNotDrift();
testAllBackendBoundariesUseTheFrozenVersion();
testWireShapeAndPlaybackDiagnosticsAreFrozen();
testBackendValidatorFailsClosed();

console.log('multiSensorStableContract.test.js passed');
