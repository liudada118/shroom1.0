const assert = require('assert');
const {
  buildChannelPlaybackFrames,
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

// 右手只有一行：index=1 只跳过右手，左手继续回放。
const indexOneFrames = buildChannelPlaybackFrames({
  channels,
  index: 1,
  parseStoredFrameData,
});
assert.strictEqual(indexOneFrames.length, 1);
const leftFrame = indexOneFrames[0];
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
assert.deepStrictEqual(leftFrame.payload.history, { index: 1, recordedAt: 200 });
assert.deepStrictEqual(leftFrame.payload.serial, {
  role: 'actual-left',
  path: 'COM7',
  status: 'open',
  openedAt: 123,
  baudRate: 115200,
  parserChannel: 'parser-left',
});
assert.strictEqual(storedLeft.serial.path, 'COM-old', 'builder must not mutate cached parsed frames');

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
