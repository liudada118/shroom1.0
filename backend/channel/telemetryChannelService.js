const {
  buildDeviceId,
  buildPressureChannelId,
} = require('../normalizers/telemetryNormalizer');

function buildTelemetryChannelDefinitions(sensorType, legacyChannels = ['sit', 'back', 'head']) {
  return legacyChannels.map((legacyChannel) => {
    const deviceId = buildDeviceId(sensorType, legacyChannel);
    return {
      channelId: buildPressureChannelId(sensorType, legacyChannel),
      deviceId,
      portId: legacyChannel,
      metric: 'pressure',
      name: `${deviceId} pressure`,
      source: legacyChannel,
      type: 'matrix',
      unit: 'raw',
      transport: 'websocket',
      standard: true,
    };
  });
}

module.exports = {
  buildPressureChannelId,
  buildTelemetryChannelDefinitions,
};
