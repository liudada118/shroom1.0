export const SENSOR_FRAME_TYPE = 'sensor.frame';
export const SENSOR_FRAME_SCHEMA_VERSION = 1;

const LEGACY_CHANNEL_FIELDS = {
  sit: 'sitData',
  back: 'backData',
  head: 'headData',
  sensor: 'sensorData',
};

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function parseWirePayload(payload) {
  if (typeof payload !== 'string') return payload;
  try {
    return JSON.parse(payload);
  } catch {
    return payload;
  }
}

function resolveSensorId(frame) {
  if (typeof frame.sensorId === 'string' && frame.sensorId.trim()) {
    return frame.sensorId.trim();
  }
  const channelId = String(frame.channelId || '');
  const prefix = frame.displaySystemId ? `${frame.displaySystemId}:` : '';
  if (prefix && channelId.startsWith(prefix)) return channelId.slice(prefix.length);
  const separatorIndex = channelId.indexOf(':');
  return separatorIndex >= 0 ? channelId.slice(separatorIndex + 1) : channelId;
}

function assignArray(target, key, value) {
  if (Array.isArray(value)) target[key] = value;
}

/**
 * 判断消息是否为唯一的传感器实时/回放帧契约。
 * 系统状态、授权和命令确认仍按各自消息对象原样返回。
 */
export function isSensorFrameEnvelope(value) {
  return isObject(value)
    && value.type === SENSOR_FRAME_TYPE
    && Number(value.schemaVersion ?? value.version) === SENSOR_FRAME_SCHEMA_VERSION
    && typeof value.channelId === 'string'
    && isObject(value.payload);
}

/**
 * 将 canonical sensor.frame 转成现有页面内部使用的对象。
 *
 * 旧字段只存在于浏览器进程内部，WebSocket wire 上仍只有 sensor.frame。
 * 这样现有可视化和命令式 renderer 无需在协议切换时一起重写。
 */
export function adaptSensorFrameForLegacyPage(frame) {
  if (!isSensorFrameEnvelope(frame)) return frame;

  const payload = frame.payload;
  const stages = isObject(payload.stages) ? payload.stages : {};
  const sensorId = resolveSensorId(frame);
  const outputChannel = String(frame.outputChannel || sensorId || '').trim();
  const value = payload.value;
  const internal = {
    type: frame.type,
    schemaVersion: Number(frame.schemaVersion ?? frame.version),
    channelId: frame.channelId,
    displaySystemId: frame.displaySystemId,
    sensorId,
    sensorType: frame.sensorType,
    outputChannel,
    source: frame.source,
    sequence: frame.sequence,
    timestamp: frame.timestamp,
    quality: frame.quality,
    payload,
    value,
    metrics: isObject(payload.metrics) ? payload.metrics : {},
    algorithmMetrics: isObject(payload.algorithmMetrics) ? payload.algorithmMetrics : {},
    orientation: payload.orientation,
    status: payload.status,
    temperature: payload.temperature,
    protocol: payload.protocol,
    history: payload.history,
    matrix: payload.matrix,
  };

  if (Array.isArray(value) && outputChannel) {
    const legacyField = LEGACY_CHANNEL_FIELDS[outputChannel];
    if (legacyField) {
      internal[legacyField] = value;
    } else {
      internal.data = value;
      internal[`${outputChannel}Data`] = value;
    }
  }

  assignArray(internal, 'rawData', stages.decoded);
  assignArray(internal, 'realArr', stages.decoded);
  assignArray(internal, 'normalizedData', stages.normalized);
  assignArray(internal, 'calibratedData', stages.calibrated);
  assignArray(internal, 'rawPressureData', stages.calibrated);
  assignArray(internal, 'processedData', stages.processed);
  assignArray(internal, 'mappedData', stages.mapped);
  assignArray(internal, 'newArr147', stages.mapped);
  assignArray(internal, 'mappedArr195', stages.mapped);
  assignArray(internal, 'rotate', payload.orientation);

  if (isObject(payload.status)) {
    if (typeof payload.status.primaryConnected === 'boolean') {
      internal.sitFlag = payload.status.primaryConnected;
    }
    if (typeof payload.status.secondaryConnected === 'boolean') {
      internal.backFlag = payload.status.secondaryConnected;
    }
    if (Number.isFinite(Number(payload.status.rateHz))) {
      internal.hz = Number(payload.status.rateHz);
    }
  }

  if (isObject(payload.temperature)) {
    assignArray(internal, 'temperatureRawData', payload.temperature.raw);
    assignArray(internal, 'temperatureData', payload.temperature.values);
    if (payload.temperature.average != null) internal.temperatureAvg = payload.temperature.average;
    if (payload.temperature.coefficient != null) internal.temperatureK = payload.temperature.coefficient;
    if (payload.temperature.threshold != null) internal.pressureThreshold = payload.temperature.threshold;
  }

  if (isObject(payload.protocol)) Object.assign(internal, payload.protocol);
  if (isObject(payload.history)) {
    if (payload.history.index != null) internal.index = payload.history.index;
    if (payload.history.recordedAt != null) internal.time = payload.history.recordedAt;
  }

  if (isObject(payload.matrix)) {
    internal.matrixWidth = payload.matrix.cols;
    internal.matrixHeight = payload.matrix.rows;
    internal.metadata = { matrix: payload.matrix };
  }

  return internal;
}

/**
 * 统一 WebSocket 接收边界：解析 JSON，并仅对 sensor.frame 做内部兼容适配。
 */
export function decodeWebSocketPayload(payload) {
  const parsed = parseWirePayload(payload);
  return isSensorFrameEnvelope(parsed)
    ? adaptSensorFrameForLegacyPage(parsed)
    : parsed;
}

export default decodeWebSocketPayload;
