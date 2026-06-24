/**
 * 实时 telemetry 网关。
 *
 * 负责把旧 sit/back/head 实时 payload 同时发布到旧 WebSocket 通道和新的
 * 标准 telemetry channel。它是旧前端兼容通道与新 ChannelBus 模型之间的桥。
 */
const { normalizeLegacyRealtimeFrame } = require('../normalizers/telemetryNormalizer');

/**
 * 创建实时 telemetry 网关。
 *
 * @param {object} deps ChannelBus、订阅管理器和传感器类型读取器。
 * @returns {{ publishRealtimeFrame: Function }} 实时发布 API。
 */
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
