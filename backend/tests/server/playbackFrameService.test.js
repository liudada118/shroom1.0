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

console.log('playbackFrameService.test.js passed');
