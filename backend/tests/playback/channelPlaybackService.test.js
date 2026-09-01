const assert = require('assert');
const {
  buildPlaybackAnchorTimeline,
  buildChannelPlaybackFrames,
  findNearestTimestampRowIndex,
  selectPlaybackAnchorChannel,
} = require('../../kernel/playback/channelPlaybackService');

function parseStoredFrameData(row) {
  if (row.throwOnParse) throw new Error('bad history row');
  return JSON.parse(row.data);
}

const storedLeft = {
  data: [10, 20],
  stages: { decoded: [1, 2], processed: [10, 20] },
  metrics: { totalPressure: 30 },
  algorithmMetrics: { supportRate: 50 },
  serial: { role: 'stored-left', path: 'COM-old', status: 'open', openedAt: 123 },
  customField: 'preserved',
};
const leftRows = [
  { timestamp: 100, data: JSON.stringify({ data: [1] }) },
  {
    timestamp: 200,
    channel_id: 'wearable:left-hand',
    display_system_id: 'wearable',
    sensor_id: 'left-hand',
    sensor_label: '左手',
    output_channel: 'left',
    serial_role: 'actual-left',
    serial_port_path: 'COM7',
    baud_rate: 115200,
    parser_channel: 'parser-left',
    data: JSON.stringify(storedLeft),
  },
];
const rightRows = [{
  timestamp: 150,
  data: JSON.stringify({
    data: [30, 40],
    stages: { mapped: [30, 40] },
    metrics: { max: 40 },
    serial: { role: 'actual-right', path: 'COM8', baudRate: 57600 },
  }),
}];

// 故意把右手放在数组第一项：输出身份仍必须来自 descriptor，不能把第一项当 sit/左手。
const channels = [
  {
    descriptor: {
      channelId: 'wearable:right-hand',
      displaySystemId: 'wearable',
      sensorId: 'right-hand',
      sensorLabel: '右手',
      sensorType: 'glove',
      outputChannel: 'right',
      serialRole: 'descriptor-right',
      serialPortPath: 'COM2',
      baudRate: 9600,
    },
    rows: rightRows,
  },
  {
    descriptor: {
      channelId: 'wearable:left-hand',
      displaySystemId: 'wearable',
      sensorId: 'left-hand',
      sensorLabel: '左手',
      sensorType: 'glove',
      outputChannel: 'left',
      serialRole: 'descriptor-left',
      serialPortPath: 'COM1',
      baudRate: 9600,
    },
    rows: leftRows,
  },
];

const indexZeroFrames = buildChannelPlaybackFrames({
  channels,
  index: 0,
  parseStoredFrameData,
});
assert.deepStrictEqual(
  indexZeroFrames.map((frame) => [frame.channelId, frame.outputChannel]),
  [
    ['wearable:right-hand', 'right'],
    ['wearable:left-hand', 'left'],
  ],
);
assert.deepStrictEqual(indexZeroFrames[0].payload.data, [30, 40]);
assert.strictEqual(indexZeroFrames[0].payload.sensorLabel, '右手');
assert.strictEqual(indexZeroFrames[0].payload.serial.path, 'COM8');
assert.strictEqual(indexZeroFrames[0].payload.history.recordedAt, 150);

// 右手只有一行但带 timestamp：index=1 时按左手时间轴取最近右手帧，避免通道消失。
const indexOneFrames = buildChannelPlaybackFrames({
  channels,
  index: 1,
  parseStoredFrameData,
});
assert.strictEqual(indexOneFrames.length, 2);
const rightAlignedFrame = indexOneFrames.find((frame) => frame.channelId === 'wearable:right-hand');
assert.strictEqual(rightAlignedFrame.timestamp, 150);
assert.strictEqual(rightAlignedFrame.payload.index, 1);
assert.deepStrictEqual(rightAlignedFrame.payload.data, [30, 40]);
assert.deepStrictEqual(rightAlignedFrame.payload.history, {
  index: 1,
  sourceIndex: 0,
  recordedAt: 150,
  alignedAt: 200,
  skewMs: -50,
});
const leftFrame = indexOneFrames.find((frame) => frame.channelId === 'wearable:left-hand');
assert.strictEqual(leftFrame.channelId, 'wearable:left-hand');
assert.strictEqual(leftFrame.outputChannel, 'left');
assert.strictEqual(leftFrame.timestamp, 200);
assert.deepStrictEqual(leftFrame.payload.data, [10, 20]);
assert.deepStrictEqual(leftFrame.payload.stages, storedLeft.stages);
assert.deepStrictEqual(leftFrame.payload.metrics, storedLeft.metrics);
assert.deepStrictEqual(leftFrame.payload.algorithmMetrics, storedLeft.algorithmMetrics);
assert.strictEqual(leftFrame.payload.customField, 'preserved');
assert.strictEqual(leftFrame.payload.index, 1);
assert.strictEqual(leftFrame.payload.time, 200);
assert.deepStrictEqual(leftFrame.payload.history, {
  index: 1,
  sourceIndex: 1,
  recordedAt: 200,
  alignedAt: 200,
  skewMs: 0,
});
assert.deepStrictEqual(leftFrame.payload.serial, {
  role: 'actual-left',
  path: 'COM7',
  status: 'open',
  openedAt: 123,
  baudRate: 115200,
  parserChannel: 'parser-left',
});
assert.strictEqual(storedLeft.serial.path, 'COM-old', 'builder must not mutate cached parsed frames');

// 不同帧率且右路丢包：最长的左路提供时间轴，右路每个时刻取最近 timestamp，
// 不能继续拿同一个数组下标（index=1 的旧行为会错误选到 1205）。
const alignedChannels = [
  {
    descriptor: {
      channelId: 'aligned:right',
      outputChannel: 'right',
      sensorLabel: '右手',
    },
    rows: [
      { timestamp: 1005, data: JSON.stringify({ data: ['right-0'] }) },
      { timestamp: 1205, data: JSON.stringify({ data: ['right-1'] }) },
      { timestamp: 1405, data: JSON.stringify({ data: ['right-2'] }) },
    ],
  },
  {
    descriptor: {
      channelId: 'aligned:left',
      outputChannel: 'left',
      sensorLabel: '左手',
    },
    rows: [1000, 1100, 1200, 1300, 1400].map((timestamp, rowIndex) => ({
      timestamp,
      data: JSON.stringify({ data: [`left-${rowIndex}`] }),
    })),
  },
];
assert.strictEqual(
  selectPlaybackAnchorChannel(alignedChannels),
  alignedChannels[1],
  'server historySeries should use the same longest channel as playback alignment',
);

// UI 时间轴只从锚点行读取时间戳：曲线时间按上限抽样，帧间隔检测使用连续原始帧，
// 并兼容三种数据库字段名；data getter 用来确保这里绝不会解析压力数据。
const timestampOnlyRows = [
  { timestamp: 1000 },
  { recorded_at: 1010 },
  { recordedAt: 1020 },
  { timestamp: 1030 },
  { timestamp: 'invalid', recorded_at: 1040 },
  { timestamp: 1050 },
].map((row) => Object.defineProperty(row, 'data', {
  configurable: true,
  get() {
    throw new Error('timeline must not read pressure data');
  },
}));
assert.deepStrictEqual(buildPlaybackAnchorTimeline(
  { rows: timestampOnlyRows },
  { sampleLimit: 2, intervalSampleLimit: 4 },
), {
  time: [1000, 1030],
  intervalTimestamps: [1000, 1010, 1020, 1030],
  length: 6,
  sampleStep: 3,
});

// 连续样本遇到缺失时间戳就停止，不能过滤后跨行计算帧间隔；UI 数组仍保留下标对应的 null。
assert.deepStrictEqual(buildPlaybackAnchorTimeline({
  rows: [{ timestamp: 100 }, {}, { timestamp: 300 }],
}), {
  time: [100, null, 300],
  intervalTimestamps: [100],
  length: 3,
  sampleStep: 1,
});

const defaultIntervalTimeline = buildPlaybackAnchorTimeline({
  rows: Array.from({ length: 24 }, (_, rowIndex) => ({ timestamp: rowIndex * 5 })),
});
assert.deepStrictEqual(
  defaultIntervalTimeline.intervalTimestamps,
  Array.from({ length: 21 }, (_, rowIndex) => rowIndex * 5),
);
assert.deepStrictEqual(buildPlaybackAnchorTimeline(null), {
  time: [],
  intervalTimestamps: [],
  length: 0,
  sampleStep: 1,
});

const alignedAtSecondTick = buildChannelPlaybackFrames({
  channels: alignedChannels,
  index: 1,
  parseStoredFrameData,
});
assert.deepStrictEqual(
  alignedAtSecondTick.find((frame) => frame.channelId === 'aligned:right').payload.data,
  ['right-0'],
);
assert.deepStrictEqual(
  alignedAtSecondTick.find((frame) => frame.channelId === 'aligned:right').payload.history,
  {
    index: 1,
    sourceIndex: 0,
    recordedAt: 1005,
    alignedAt: 1100,
    skewMs: -95,
  },
);
assert.deepStrictEqual(
  alignedAtSecondTick.find((frame) => frame.channelId === 'aligned:left').payload.data,
  ['left-1'],
);

const alignedAtFourthTick = buildChannelPlaybackFrames({
  channels: alignedChannels,
  index: 3,
  parseStoredFrameData,
});
assert.deepStrictEqual(
  alignedAtFourthTick.find((frame) => frame.channelId === 'aligned:right').payload.data,
  ['right-1'],
);
assert.strictEqual(
  alignedAtFourthTick.find((frame) => frame.channelId === 'aligned:right').timestamp,
  1205,
);
assert.strictEqual(
  alignedAtFourthTick.find((frame) => frame.channelId === 'aligned:right').payload.history.sourceIndex,
  1,
);

// 等长通道保持原下标；即使两个串口采样时刻有固定微小偏移，也不应跳到相邻帧。
const equalLengthChannels = [
  {
    descriptor: { channelId: 'equal:seat', outputChannel: 'sit' },
    rows: [100, 200, 300].map((timestamp, rowIndex) => ({
      timestamp,
      data: JSON.stringify({ data: [`seat-${rowIndex}`] }),
    })),
  },
  {
    descriptor: { channelId: 'equal:back', outputChannel: 'back' },
    rows: [105, 205, 305].map((timestamp, rowIndex) => ({
      timestamp,
      data: JSON.stringify({ data: [`back-${rowIndex}`] }),
    })),
  },
];
assert.strictEqual(
  selectPlaybackAnchorChannel([...equalLengthChannels].reverse()),
  equalLengthChannels[0],
  'equal row counts keep the legacy sit preference',
);
const equalLengthFrames = buildChannelPlaybackFrames({
  channels: equalLengthChannels,
  index: 1,
  parseStoredFrameData,
});
assert.deepStrictEqual(
  equalLengthFrames.map((frame) => [frame.channelId, frame.payload.data, frame.payload.history.sourceIndex]),
  [
    ['equal:seat', ['seat-1'], 1],
    ['equal:back', ['back-1'], 1],
  ],
);

// 正好夹在两帧中间时选较早帧，防止历史画面提前显示未来数据。
assert.strictEqual(findNearestTimestampRowIndex({
  rows: [
    { timestamp: 100, data: '[]' },
    { timestamp: 300, data: '[]' },
  ],
  targetTimestamp: 200,
  fallbackIndex: 1,
  parseStoredFrameData,
}), 0);

// 完全没有 timestamp 的旧历史仍按原数组下标：短通道越界就跳过，不擅自重复末帧。
const legacyIndexOnlyFrames = buildChannelPlaybackFrames({
  channels: [
    {
      descriptor: { channelId: 'index-only:short', outputChannel: 'short' },
      rows: [{ data: JSON.stringify({ data: ['short-0'] }) }],
    },
    {
      descriptor: { channelId: 'index-only:long', outputChannel: 'long' },
      rows: [
        { data: JSON.stringify({ data: ['long-0'] }) },
        { data: JSON.stringify({ data: ['long-1'] }) },
      ],
    },
  ],
  index: 1,
  parseStoredFrameData,
});
assert.deepStrictEqual(
  legacyIndexOnlyFrames.map((frame) => [frame.channelId, frame.payload.data]),
  [['index-only:long', ['long-1']]],
);

// 旧数组也可回放，但身份必须由 descriptor 显式提供。
const legacyFrames = buildChannelPlaybackFrames({
  channels: [{
    descriptor: {
      channelId: 'legacy-demo:seat',
      displaySystemId: 'legacy-demo',
      sensorId: 'seat',
      sensorLabel: '座椅',
      sensorType: 'legacy-demo',
      outputChannel: 'sit',
    },
    rows: [{ timestamp: 300, data: '[7,8]' }],
  }],
  index: 0,
  parseStoredFrameData,
});
assert.deepStrictEqual(legacyFrames[0].payload.data, [7, 8]);
assert.strictEqual(legacyFrames[0].payload.sensorLabel, '座椅');

// descriptor 缺失时，显式数据库身份仍可用；完全无身份的数组不能按位置猜测。
const explicitRowFrames = buildChannelPlaybackFrames({
  channels: [{
    descriptor: {},
    rows: [{
      channel_id: 'chair:back',
      output_channel: 'back',
      timestamp: 400,
      data: JSON.stringify({ data: [9] }),
    }],
  }],
  index: 0,
  parseStoredFrameData,
});
assert.strictEqual(explicitRowFrames[0].channelId, 'chair:back');
assert.strictEqual(explicitRowFrames[0].payload.displaySystemId, 'chair');
assert.strictEqual(explicitRowFrames[0].payload.sensorId, 'back');

assert.deepStrictEqual(buildChannelPlaybackFrames({
  channels: [{ descriptor: {}, rows: [{ timestamp: 500, data: '[1]' }] }],
  index: 0,
  parseStoredFrameData,
}), []);

// 显式身份前后矛盾时宁可跳过，也不能把一条历史行发布到错误通道。
assert.deepStrictEqual(buildChannelPlaybackFrames({
  channels: [{
    descriptor: { channelId: 'chair:sit', outputChannel: 'sit' },
    rows: [{ channel_id: 'chair:back', timestamp: 501, data: '[1]' }],
  }],
  index: 0,
  parseStoredFrameData,
}), []);

// canonical identity 只允许严格两段式；不能把 a:b:c 在回放边界解释成 a + b:c。
assert.deepStrictEqual(buildChannelPlaybackFrames({
  channels: [{
    descriptor: { channelId: 'chair:sit:raw', outputChannel: 'sit' },
    rows: [{ timestamp: 502, data: '[1]' }],
  }],
  index: 0,
  parseStoredFrameData,
}), []);

assert.deepStrictEqual(buildChannelPlaybackFrames({
  channels: [{
    descriptor: { channelId: 'chair:sit', outputChannel: 'sit' },
    rows: [{
      timestamp: 502,
      data: JSON.stringify({ channelId: 'chair:sit:raw', data: [1] }),
    }],
  }],
  index: 0,
  parseStoredFrameData,
}), [], '已存帧内的多冒号 channelId 也不能被 descriptor 掩盖');

// channelId 合法但显式 displaySystemId 矛盾时同样跳过，避免错误历史串到别的系统。
assert.deepStrictEqual(buildChannelPlaybackFrames({
  channels: [{
    descriptor: {
      channelId: 'chair:sit',
      displaySystemId: 'other-chair',
      sensorId: 'sit',
      outputChannel: 'sit',
    },
    rows: [{ timestamp: 503, data: '[1]' }],
  }],
  index: 0,
  parseStoredFrameData,
}), []);

// 一路解析失败不能阻塞另一通道。
const isolatedFrames = buildChannelPlaybackFrames({
  channels: [
    {
      descriptor: { channelId: 'demo:bad', outputChannel: 'bad' },
      rows: [{ throwOnParse: true, data: 'bad' }],
    },
    {
      descriptor: { channelId: 'demo:good', outputChannel: 'good' },
      rows: [{ timestamp: 600, data: JSON.stringify({ data: [6] }) }],
    },
  ],
  index: 0,
  parseStoredFrameData,
});
assert.deepStrictEqual(isolatedFrames.map((frame) => frame.channelId), ['demo:good']);

assert.deepStrictEqual(buildChannelPlaybackFrames({ channels, index: -1, parseStoredFrameData }), []);
assert.deepStrictEqual(buildChannelPlaybackFrames({ channels, index: 0 }), []);

console.log('channelPlaybackService.test.js passed');
