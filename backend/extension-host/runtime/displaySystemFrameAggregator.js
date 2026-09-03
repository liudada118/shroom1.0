/**
 * 多传感器算法输入聚合器。
 *
 * 每路串口仍独立完成协议解码和线序/点位映射；这里只保存每个 sensorId 的最新标准矩阵，
 * 并按算法包 input 声明生成一个带身份和时间戳的快照。它不修改帧、不发布数据，也不把
 * 普通多串口误称为硬件同步：strict 只是在软件层拒绝时间差过大的组合。
 */
function createDisplaySystemFrameAggregator() {
  const systems = new Map();

  function getSystemFrames(displaySystemId) {
    if (!systems.has(displaySystemId)) systems.set(displaySystemId, new Map());
    return systems.get(displaySystemId);
  }

  function update(frame = {}) {
    if (!frame.displaySystemId || !frame.sensorId) return null;
    const snapshot = {
      channelId: frame.channelId || null,
      displaySystemId: frame.displaySystemId,
      sensorId: frame.sensorId,
      sensorLabel: frame.sensorLabel || frame.sensorId,
      sensorType: frame.sensorType || null,
      outputChannel: frame.outputChannel || frame.sensorId,
      timestamp: Number(frame.timestamp || Date.now()),
      matrix: frame.matrix || null,
      rawData: Array.from(frame.rawData || []),
      normalizedData: Array.from(frame.normalizedData || []),
    };
    getSystemFrames(frame.displaySystemId).set(frame.sensorId, snapshot);
    return snapshot;
  }

  function buildSnapshot(displaySystemId, input = {}, now = Date.now()) {
    const requiredSensors = Array.isArray(input.sensors) ? input.sensors : [];
    const systemFrames = systems.get(displaySystemId) || new Map();
    const missingSensors = requiredSensors.filter((sensorId) => !systemFrames.has(sensorId));
    if (missingSensors.length) {
      return {
        ready: false,
        reason: 'missing-sensors',
        missingSensors,
        frames: {},
      };
    }

    const selected = requiredSensors.map((sensorId) => systemFrames.get(sensorId));
    const maxAgeMs = Number(input.sync?.maxAgeMs ?? 1000);
    const staleSensors = selected
      .filter((frame) => now - frame.timestamp > maxAgeMs)
      .map((frame) => frame.sensorId);
    if (staleSensors.length) {
      return {
        ready: false,
        reason: 'stale-sensors',
        staleSensors,
        frames: {},
      };
    }

    const timestamps = selected.map((frame) => frame.timestamp);
    const skewMs = Math.max(...timestamps) - Math.min(...timestamps);
    const strategy = input.sync?.strategy || 'latest';
    const maxSkewMs = Number(input.sync?.maxSkewMs ?? 50);
    if (strategy === 'strict' && skewMs > maxSkewMs) {
      return {
        ready: false,
        reason: 'sensor-skew',
        skewMs,
        maxSkewMs,
        frames: {},
      };
    }

    return {
      ready: true,
      reason: null,
      skewMs,
      frames: Object.fromEntries(selected.map((frame) => [frame.sensorId, {
        ...frame,
        rawData: [...frame.rawData],
        normalizedData: [...frame.normalizedData],
      }])),
    };
  }

  function clear(displaySystemId = null) {
    if (displaySystemId) systems.delete(displaySystemId);
    else systems.clear();
  }

  return { buildSnapshot, clear, update };
}

module.exports = {
  createDisplaySystemFrameAggregator,
};
