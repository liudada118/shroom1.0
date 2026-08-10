function parsePayload(payload) {
  if (payload && typeof payload === 'object' && !Buffer.isBuffer(payload)) {
    return payload;
  }
  try {
    return JSON.parse(String(payload));
  } catch {
    return null;
  }
}

function getChannelDataKey(legacyChannel) {
  if (legacyChannel === 'back') return 'backData';
  if (legacyChannel === 'head') return 'headData';
  return 'sitData';
}

function buildDeviceId(sensorType, legacyChannel) {
  const safeSensorType = String(sensorType || 'sensor').replace(/[^\w.-]/g, '_');
  return `${safeSensorType}_${legacyChannel}`;
}

function buildPressureChannelId(sensorType, legacyChannel) {
  return `${buildDeviceId(sensorType, legacyChannel)}.pressure`;
}

function getLegacyPressureMatrix(legacyChannel, data) {
  const dataKey = getChannelDataKey(legacyChannel);
  if (Array.isArray(data.pressureData)) return data.pressureData;
  if (Array.isArray(data[dataKey])) return data[dataKey];
  return null;
}

/**
 * 将历史实时通道 payload 归一化为目标架构里的标准 telemetry 数据帧。
 *
 * @param {string} legacyChannel 旧实时通道名，例如 sit/back/head。
 * @param {string | object} payload 旧通道 payload，支持 JSON 字符串或对象。
 * @param {{sensorType?: string, timestamp?: number}} options 归一化上下文。
 * @returns {object | null} 标准 telemetry 数据帧；无法识别压力矩阵时返回 null。
 */
function normalizeLegacyRealtimeFrame(legacyChannel, payload, {
  sensorType,
  timestamp = Date.now(),
} = {}) {
  const data = parsePayload(payload);
  if (!data) return null;

  const matrix = getLegacyPressureMatrix(legacyChannel, data);
  if (!matrix) return null;

  const dataKey = getChannelDataKey(legacyChannel);
  const unit = data.pressureUnit || data.dataUnit || 'raw';
  const deviceId = buildDeviceId(sensorType, legacyChannel);
  return {
    channelId: buildPressureChannelId(sensorType, legacyChannel),
    deviceId,
    portId: legacyChannel,
    metric: 'pressure',
    value: matrix,
    unit,
    timestamp,
    quality: 'good',
    metadata: {
      sensorType,
      legacyChannel,
      legacyDataKey: dataKey,
      matrixWidth: data.matrixWidth || null,
      matrixHeight: data.matrixHeight || null,
      sourceMatrixWidth: data.sourceMatrixWidth || null,
      sourceMatrixHeight: data.sourceMatrixHeight || null,
    },
  };
}

module.exports = {
  buildDeviceId,
  buildPressureChannelId,
  getChannelDataKey,
  normalizeLegacyRealtimeFrame,
  parsePayload,
};
