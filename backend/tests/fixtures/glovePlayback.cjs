const sensors = require('@shroom/backend/sensors');
const processing = require('@shroom/backend/processing');
const { createHistoryFrameTransformService } = require('../../kernel/playback/historyFrameTransformService');
const { createPlaybackFrameService } = require('../../kernel/playback/playbackFrameService');
const { buildSensorFrameEnvelope } = require('../../kernel/realtime/sensorFrameEnvelope');

const transform = createHistoryFrameTransformService({
  isHandGloveType: sensors.isHandGloveType,
  isHandStorageType: sensors.isHandStorageType,
});
const playback = createPlaybackFrameService({
  ...processing, ...transform,
  isHandGloveType: sensors.isHandGloveType,
  isSmallBedMatrixType: sensors.isSmallBedMatrixType,
  isThreePortFile: sensors.isThreePortFile,
  handGloveFullPacket: 'handGloveFullPacket',
  ...sensors.handGloveFullPacket,
});

/** 用真实旧手套回放转换和标准信封构造器生成测试帧；可传入只读历史行。 */
function glovePlaybackFrames({ sitRows = [], backRows = [], index = 0, sensorType = 'hand0205' } = {}) {
  const payloads = playback.buildPayloads({ sensorType, sitRows, backRows, index });
  return ['back', 'sit'].flatMap((channel) => {
    const payload = payloads[`${channel}Payload`];
    if (!payload) return [];
    const frame = buildSensorFrameEnvelope({ channel, payload, sensorType, source: 'playback', sequence: index + 1, timestamp: 1000 + index * 10 });
    return frame ? [frame] : [];
  });
}

module.exports = { glovePlaybackFrames };
