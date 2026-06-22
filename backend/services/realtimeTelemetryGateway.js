const { normalizeLegacyRealtimeFrame } = require('../normalizers/telemetryNormalizer');

function createRealtimeTelemetryGateway({
  channelBus,
  wsSubscriptions,
  getSensorType,
  source = 'server.js',
} = {}) {
  if (!channelBus) {
    throw new Error('channelBus is required');
  }
  if (!wsSubscriptions) {
    throw new Error('wsSubscriptions is required');
  }

  /**
   * 发布实时帧：兼容旧通道推送，同时生成标准 telemetry 通道帧。
   *
   * @param {string} channel 旧实时通道，例如 sit/back/head。
   * @param {string | object} payload 旧通道 payload。
   * @returns {{legacySent: number, telemetrySent: number, telemetryFrame: object | null}}
   */
  function publishRealtimeFrame(channel, payload) {
    const sensorType = typeof getSensorType === 'function' ? getSensorType() : undefined;
    const legacyEvent = channelBus.publish(channel, payload, {
      sensorType,
      source,
    });
    const legacySent = wsSubscriptions.publish(channel, payload);
    const telemetryFrame = normalizeLegacyRealtimeFrame(channel, payload, {
      sensorType,
      timestamp: legacyEvent.timestamp,
    });

    if (!telemetryFrame) {
      return {
        legacySent,
        telemetrySent: 0,
        telemetryFrame: null,
      };
    }

    channelBus.publish(telemetryFrame.channelId, telemetryFrame, {
      sensorType,
      source: 'telemetry-normalizer',
      legacyChannel: channel,
      standard: true,
    });

    return {
      legacySent,
      telemetrySent: wsSubscriptions.publishExact(telemetryFrame.channelId, telemetryFrame),
      telemetryFrame,
    };
  }

  return {
    publishRealtimeFrame,
  };
}

module.exports = {
  createRealtimeTelemetryGateway,
};
