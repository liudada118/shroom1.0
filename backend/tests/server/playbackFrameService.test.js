const assert = require('assert');
const { createPlaybackFrameService } = require('../../kernel/playback/playbackFrameService');

const playback = createPlaybackFrameService({
  footArrToNormal: () => [],
  footL: (values) => values,
  footR: (values) => values,
  footVideo: (values) => values,
  footVideo1: (values) => values,
  handL: (values) => values,
  handR: (values) => values,
  handGloveFullPacket: 'handGloveFullPacket',
  isHandGloveType: () => false,
  isSmallBedMatrixType: () => false,
  isThreePortFile: () => false,
  mapHandGloveFullPacketModelMatrix: (values) => values,
  mapHandGloveFullPacketPressure: (values) => values,
  normalizeFiniteFrame: (values) => values,
  normalizeWholeChairFrame: (_, values) => values,
  parseStoredSensorFrame: () => ({ pressureData: [], rotateData: [], zeroFrame: [] }),
  buildSmallBedPlaybackPayload: () => ({}),
  buildTempFullBedPlaybackPayload: () => ({}),
  smallBed12BType: 'smallBed12B',
  tempFullBedType: 'tempFullBed',
  wholeChairType: 'wholeChair',
});

const storedFrame = {
  sitData: [10, 20],
  normalizedData: [5, 10],
  algorithmMetrics: { supportRate: 50 },
  metrics: { totalPressure: 30, algorithm: { supportRate: 50 } },
  displaySystemId: 'custom-seat',
  channelId: 'custom-seat:sit',
  outputChannel: 'sit',
};

const { sitPayload } = playback.buildPayloads({
  sensorType: 'custom-seat',
  sitRows: [{ data: JSON.stringify(storedFrame), timestamp: 12345 }],
});

assert.deepStrictEqual(sitPayload, {
  ...storedFrame,
  time: 12345,
  index: 0,
  backFlag: false,
});

const headStoredFrame = {
  ...storedFrame,
  headData: [30, 40],
  channelId: 'custom-seat:head',
  outputChannel: 'head',
};
delete headStoredFrame.sitData;
const displayPayloads = playback.buildPayloads({
  sensorType: 'custom-seat',
  sitRows: [{ data: JSON.stringify(storedFrame), timestamp: 12345 }],
  headRows: [{ data: JSON.stringify(headStoredFrame), timestamp: 12346 }],
});
assert.deepStrictEqual(displayPayloads.headPayload, {
  ...headStoredFrame,
  time: 12346,
  index: 0,
  sitFlag: true,
});

const legacyPayload = playback.buildPayloads({
  sensorType: 'legacy',
  sitRows: [{ data: JSON.stringify([1, 2]), timestamp: 54321 }],
}).sitPayload;
assert.strictEqual(legacyPayload.sitData, '[1,2]');

const { glovePlaybackFrames } = require('../fixtures/glovePlayback.cjs');
const pressureData = Array.from({ length: 256 }, (_, index) => index % 64);
const orientation = [0, 0, 0, 1];
for (const data of [pressureData, [...pressureData, ...orientation], { pressureData, rotate: orientation, zeroFrame: [] }]) {
  const row = { data: JSON.stringify(data), timestamp: 1000 };
  for (const channel of ['sit', 'back']) {
    const frames = glovePlaybackFrames({ [`${channel}Rows`]: [row] });
    assert.strictEqual(frames.length, 1, '单手记录不能产生缺失通道的空帧');
    assert.strictEqual(frames[0].outputChannel, channel);
    assert.deepStrictEqual(frames[0].payload.value, pressureData);
    assert.strictEqual(frames[0].payload.stages.mapped.length, 147);
    if (!Array.isArray(data) || data.length === 260) assert.deepStrictEqual(frames[0].payload.orientation, orientation);
  }
  assert.strictEqual(glovePlaybackFrames({ sitRows: [row], backRows: [row] }).length, 2);
}
const mapped = Array.from({ length: 147 }, (_, index) => index);
assert.strictEqual(glovePlaybackFrames({ backRows: [{ data: JSON.stringify([...mapped, ...orientation]) }] })[0].payload.stages.mapped.length, 147);

const sensors = require('@shroom/backend/sensors');
const { buildZeroPlaybackPayload } = require('../../kernel/playback/historyPlaybackService');
const { createHistoryFrameTransformService } = require('../../kernel/playback/historyFrameTransformService');
const { createCollectionFrameStorageService } = require('@shroom/backend/collection');
const { createLegacyGenericMatrixFrameProcessor } = require('../../extensions/built-in-sensors/legacyGenericMatrixFrameProcessor');
const { zeroLineMatrix } = require('@shroom/backend/processing');
const { buildSensorFrameEnvelope } = require('../../kernel/realtime/sensorFrameEnvelope');

const fast256Clear = buildZeroPlaybackPayload({ sensorType: 'fast256', smallBed12BType: sensors.SMALL_BED_12B_TYPE });
assert.deepStrictEqual(fast256Clear.sitData, new Array(256).fill(0), '16×16高速回放清屏必须恰好256个零点');
const fast256ClearFrame = buildSensorFrameEnvelope({ channel: 'sit', sensorType: 'fast256', source: 'playback', payload: fast256Clear });
assert.strictEqual(fast256ClearFrame.channelId, 'fast256:sit');
assert.deepStrictEqual(fast256ClearFrame.payload.value, new Array(256).fill(0), '标准回放帧保留16×16清屏尺寸');

for (const sensorType of ['bed4096', 'bed4096num']) {
  const clear = buildZeroPlaybackPayload({ sensorType, smallBed12BType: sensors.SMALL_BED_12B_TYPE });
  assert.strictEqual(clear.sitData.length, 4096, '64×64 回放清屏必须覆盖完整矩阵');
  assert.ok(clear.sitData.every(value => value === 0));
}
for (const [sensorType, matrixMode, expectedLength] of [
  ['bigBed', undefined, 2048],
  ['smallBed12B', '16x16', 256],
  ['smallBed12B', '32x32', 1024],
  ['pressureVest', undefined, 1024],
]) {
  const clear = buildZeroPlaybackPayload({ sensorType, smallBed12BType: sensors.SMALL_BED_12B_TYPE,
    smallBed12BDisplayOptions: { matrixMode } });
  assert.strictEqual(clear.sitData.length, expectedLength);
}

const bedType = 'bed4096num';
const rawBed = Buffer.from(Array.from({ length: 4096 }, (_, index) => (index * 17 + Math.floor(index / 64) * 13) % 251));
const bedProcessor = createLegacyGenericMatrixFrameProcessor({
  isCar: () => false, isSmallBedMatrixType: sensors.isSmallBedMatrixType, zeroLineMatrix,
});
const realtimeBed = bedProcessor.processBed4096Frame(rawBed, { file: bedType, colHZ: 95 });
const bedStorage = createCollectionFrameStorageService({
  getSensorType: () => bedType,
  isZeroFrameStorageType: sensors.isZeroFrameStorageType,
  isSmallBedMatrixType: sensors.isSmallBedMatrixType,
  getFrameMatrixData: sensors.getFrameMatrixData,
  tempFullBedType: sensors.TEMP_FULL_BED_TYPE,
  smallBed12BType: sensors.SMALL_BED_12B_TYPE,
  buildZeroAwareStorageData: () => assert.fail('64×64 帧不能走手部 256 点存储路径'),
});
const bedFrame = JSON.parse(realtimeBed.jsonData);
const bedRow = { data: bedStorage.buildSitCollectionData(bedFrame), timestamp: 1000 };
const bedPlayback = createPlaybackFrameService({
  isHandGloveType: sensors.isHandGloveType,
  isSmallBedMatrixType: sensors.isSmallBedMatrixType,
  isThreePortFile: sensors.isThreePortFile,
});
const bedPayload = bedPlayback.buildPayloads({ sensorType: bedType, sitRows: [bedRow] }).sitPayload;
const bedEnvelope = buildSensorFrameEnvelope({ channel: 'sit', sensorType: bedType,
  source: 'playback', payload: bedPayload });
const bedTransforms = createHistoryFrameTransformService(sensors);
assert.strictEqual(realtimeBed.frame.length, 4096);
assert.deepStrictEqual(JSON.parse(bedRow.data), realtimeBed.frame, '采集保存完整 4096 点');
assert.deepStrictEqual(bedEnvelope.payload.value, realtimeBed.frame, '回放不得裁剪或再次转换线序');
assert.deepStrictEqual(bedTransforms.normalizeHistoryPressureData(bedRow, bedType), realtimeBed.frame, 'CSV 使用完整 4096 点');
assert.deepStrictEqual(sensors.getFrameMatrixData(bedFrame, 'sitData'), realtimeBed.frame);

console.log('playbackFrameService.test.js passed');
