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
   * **每个 channelId 独立计数**，不是全局一个序号。因为前端是按通道订阅的，
   * 只订了 back 的客户端如果收到全局序号，会看到序号大幅跳跃，无法判断自己丢了帧。
   * 分通道计数之后，「序号不连续」就精确地等于「这个通道丢帧了」。
   *
   * 序号的用途是**让前端能发现丢帧**（WebSocket 不保证送达，慢客户端会被跳过），
   * 而不是用来排序 —— 同一条连接上的消息本来就是有序的。
   *
   * 从 1 开始（`|| 0` 然后 +1）而不是 0：0 在 JS 里是 falsy，
   * 前端写 `if (frame.sequence)` 会把第一帧判成「没有序号」。
   *
   * ⚠️ `channelSequences` 这个 Map **只增不减**，切换展示系统产生的新 channelId 会一直
   * 累积。条目极小（一个字符串键 + 一个整数），一次运行里 channelId 的种类是有限的，
   * 所以不是泄漏风险；但也意味着**序号不会因为切回某个通道而重置** ——
   * 前端重连后看到的序号不是从 1 开始，判断丢帧要基于「与上一条的差值」而不是绝对值。
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
