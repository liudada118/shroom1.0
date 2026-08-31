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

  /**
   * 取某个通道的下一个帧序号，从 1 开始递增。
   *
   * 序号的用途是**让前端发现丢帧**（WebSocket 不保证送达，慢客户端会被跳过），不是排序 —— 同一条
   * 连接上的消息本来有序。**每个 channelId 独立计数**：前端按通道订阅，全局序号会让只订了 back 的
   * 客户端看到大幅跳跃；分通道后「序号不连续」就精确等于「这个通道丢帧了」。从 1 而不是 0 开始，
   * 因为 0 是 falsy，前端写 `if (frame.sequence)` 会把第一帧判成没有序号。
   *
   * ⚠️ `channelSequences` **只增不减**（条目极小、种类有限，不是泄漏风险），所以**序号不会因为切回
   * 某个通道而重置** —— 前端重连后看到的不是从 1 开始，判断丢帧要基于与上一条的差值而非绝对值。
   *
   * @param {string} channelId canonical 通道标识。
   * @returns {number} 该通道的下一个序号（≥ 1）。
   */
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
