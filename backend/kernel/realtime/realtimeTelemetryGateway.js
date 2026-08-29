const {
  buildSensorFrameEnvelope,
} = require('./sensorFrameEnvelope');

/**
 * 创建实时传感器帧网关。
 *
 * 内部处理器仍可输出既有对象，网关在唯一的 WebSocket 边界把它们转换成
 * `sensor.frame`。同一物理帧只发布一次，订阅键与消息身份都使用 canonical channelId。
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

  const channelSequences = new Map();

  function nextSequence(channelId) {
    const next = (channelSequences.get(channelId) || 0) + 1;
    channelSequences.set(channelId, next);
    return next;
  }

  /**
   * 发布唯一格式的传感器帧。
   *
   * @param {string} channel 内部输出别名，例如 sit、back、armLeft。
   * @param {string|object} payload 内部 legacy 或 manifest 帧。
   * @param {{source?: string, timestamp?: number}} options 来源信息。
   * @returns {{sent:number, frame:object|null}}
   */
  function publishRealtimeFrame(channel, payload, options = {}) {
    const sensorType = typeof getSensorType === 'function' ? getSensorType() : undefined;
    const now = Number(options.timestamp) || Date.now();
    const identityFrame = buildSensorFrameEnvelope({
      channel,
      payload,
      sensorType,
      source: options.source || 'realtime',
      sequence: 0,
      timestamp: now,
    });
    if (!identityFrame) return { sent: 0, frame: null };

    const frame = {
      ...identityFrame,
      sequence: nextSequence(identityFrame.channelId),
    };
    channelBus.publish(frame.channelId, frame, {
      sensorType,
      source,
      frameSource: frame.source,
      outputChannel: frame.outputChannel,
      standard: true,
    });

    return {
      sent: wsSubscriptions.publish(frame.channelId, frame),
      frame,
    };
  }

  return {
    publishRealtimeFrame,
  };
}

module.exports = {
  createRealtimeTelemetryGateway,
};
