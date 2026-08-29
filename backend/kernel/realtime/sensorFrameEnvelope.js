const SENSOR_FRAME_TYPE = 'sensor.frame';
const SENSOR_FRAME_SCHEMA_VERSION = 1;

function parseFramePayload(payload) {
  if (payload && typeof payload === 'object' && !Buffer.isBuffer(payload)) {
    return payload;
  }
  try {
    const parsed = JSON.parse(String(payload));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toNumericArray(value) {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(candidate)) return null;
  return candidate.map((item) => Number(item));
}

function firstArray(...values) {
  for (const value of values) {
    const array = toNumericArray(value);
    if (array) return array;
  }
  return null;
}

function normalizeIdentityPart(value, fallback) {
  const normalized = String(value || fallback || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-');
  return normalized || fallback;
}

function getLegacyDataField(channel) {
  if (channel === 'back') return 'backData';
  if (channel === 'head') return 'headData';
  if (channel === 'sensor') return 'sensorData';
  return 'sitData';
}

function extractMatrix(data = {}) {
  const source = data.metadata?.matrix || data.matrix || null;
  const rows = Number(source?.rows ?? data.matrixHeight);
  const cols = Number(source?.cols ?? data.matrixWidth);
  if (!Number.isInteger(rows) || rows <= 0 || !Number.isInteger(cols) || cols <= 0) {
    return null;
  }
  return { rows, cols, total: rows * cols };
}

function compactObject(value) {
  const entries = Object.entries(value).filter(([, item]) => item !== undefined && item !== null);
  return entries.length ? Object.fromEntries(entries) : null;
}

function resolveSensorId(channelId, fallback) {
  const separatorIndex = String(channelId || '').indexOf(':');
  return separatorIndex >= 0
    ? String(channelId).slice(separatorIndex + 1)
    : normalizeIdentityPart(fallback, 'sensor');
}

/**
 * 将内部 legacy/manifest 帧统一转换成唯一的 WebSocket 传感器帧契约。
 *
 * 该转换位于存储之后、网络发送之前，因此不改变串口协议、线序、算法或历史格式。
 * 未知的数据阶段明确返回 null，避免把旧处理结果伪装成 raw/normalized 数据。
 */
function buildSensorFrameEnvelope({
  channel,
  payload,
  sensorType,
  source = 'realtime',
  sequence = 0,
  timestamp,
} = {}) {
  const data = parseFramePayload(payload);
  if (!data) return null;
  if (data.type === SENSOR_FRAME_TYPE && data.schemaVersion === SENSOR_FRAME_SCHEMA_VERSION) {
    const framePayload = data.payload && typeof data.payload === 'object'
      ? data.payload
      : {};
    const frameStages = framePayload.stages && typeof framePayload.stages === 'object'
      ? framePayload.stages
      : {};
    const value = firstArray(framePayload.value, frameStages.processed);
    const channelId = String(data.channelId || '').trim();
    if (!channelId || !value) return null;

    const normalizedSensorType = normalizeIdentityPart(data.sensorType || sensorType, 'legacy');
    const displaySystemId = String(data.displaySystemId || normalizedSensorType).trim();
    const sensorId = String(data.sensorId || resolveSensorId(channelId, channel)).trim();
    const outputChannel = String(data.outputChannel || sensorId).trim();
    const resolvedTimestamp = Number(timestamp ?? data.timestamp);

    // 即使内部调用方已经传入 sensor.frame，也只投影白名单字段。
    // 这样顶层 sitData/*Data 等旧字段无法夹带到 WebSocket wire。
    return {
      type: SENSOR_FRAME_TYPE,
      schemaVersion: SENSOR_FRAME_SCHEMA_VERSION,
      channelId,
      displaySystemId,
      sensorId,
      sensorType: normalizedSensorType,
      outputChannel,
      source: data.source || source,
      sequence: Number(sequence) || 0,
      timestamp: Number.isFinite(resolvedTimestamp) ? resolvedTimestamp : Date.now(),
      quality: typeof data.quality === 'string' ? data.quality : 'good',
      payload: {
        value,
        stages: {
          decoded: firstArray(frameStages.decoded),
          normalized: firstArray(frameStages.normalized),
          calibrated: firstArray(frameStages.calibrated),
          processed: firstArray(frameStages.processed),
          mapped: firstArray(frameStages.mapped),
        },
        metrics: framePayload.metrics && typeof framePayload.metrics === 'object'
          ? framePayload.metrics
          : {},
        algorithmMetrics: framePayload.algorithmMetrics
          && typeof framePayload.algorithmMetrics === 'object'
          ? framePayload.algorithmMetrics
          : {},
        matrix: extractMatrix({ matrix: framePayload.matrix }),
        orientation: firstArray(framePayload.orientation),
        status: framePayload.status && typeof framePayload.status === 'object'
          ? framePayload.status
          : null,
        temperature: framePayload.temperature && typeof framePayload.temperature === 'object'
          ? framePayload.temperature
          : null,
        protocol: framePayload.protocol && typeof framePayload.protocol === 'object'
          ? framePayload.protocol
          : null,
        history: framePayload.history && typeof framePayload.history === 'object'
          ? framePayload.history
          : null,
      },
    };
  }

  const outputChannel = String(data.outputChannel || channel || '').trim();
  if (!outputChannel) return null;
  const legacyDataField = getLegacyDataField(outputChannel);
  const dynamicDataField = `${outputChannel}Data`;
  const processed = firstArray(
    data.data,
    data[dynamicDataField],
    data[legacyDataField],
    data.pressureData,
    data.value,
  );
  const mapped = firstArray(data.mappedData, data.mappedArr195, data.newArr147, data.newArr);
  const value = processed || mapped;
  if (!value) return null;

  const normalizedSensorType = normalizeIdentityPart(
    data.sensorType || sensorType,
    'legacy',
  );
  const channelId = String(data.channelId || '').trim()
    || `${normalizedSensorType}:${normalizeIdentityPart(outputChannel, 'sensor')}`;
  const displaySystemId = String(data.displaySystemId || normalizedSensorType).trim();
  const sensorId = String(data.sensorId || resolveSensorId(channelId, outputChannel)).trim();
  const resolvedTimestamp = Number(timestamp ?? data.timestamp ?? data.time);

  const decoded = firstArray(data.rawData, data.realArr, data.rawSitData);
  const normalized = firstArray(data.normalizedData);
  const calibrated = firstArray(data.calibratedData, data.rawPressureData);
  const orientation = firstArray(data.orientation, data.rotate);
  const matrix = extractMatrix(data);
  const status = compactObject({
    primaryConnected: typeof data.sitFlag === 'boolean' ? data.sitFlag : undefined,
    secondaryConnected: typeof data.backFlag === 'boolean' ? data.backFlag : undefined,
    rateHz: Number.isFinite(Number(data.hz)) ? Number(data.hz) : undefined,
  });
  const temperature = compactObject({
    raw: firstArray(data.temperatureRawData),
    values: firstArray(data.temperatureData),
    average: Number.isFinite(Number(data.temperatureAvg)) ? Number(data.temperatureAvg) : undefined,
    coefficient: Number.isFinite(Number(data.temperatureK)) ? Number(data.temperatureK) : undefined,
    threshold: Number.isFinite(Number(data.pressureThreshold))
      ? Number(data.pressureThreshold)
      : undefined,
  });
  const protocol = compactObject({
    frameIndex: data.frameIndex,
    packetType: data.packetType,
    handSide: data.handSide,
    outputSide: data.outputSide,
    packetSourcePort: data.packetSourcePort,
  });
  const history = compactObject({
    index: data.index,
    recordedAt: data.time,
  });

  return {
    type: SENSOR_FRAME_TYPE,
    schemaVersion: SENSOR_FRAME_SCHEMA_VERSION,
    channelId,
    displaySystemId,
    sensorId,
    sensorType: normalizedSensorType,
    outputChannel,
    source,
    sequence: Number(sequence) || 0,
    timestamp: Number.isFinite(resolvedTimestamp) ? resolvedTimestamp : Date.now(),
    quality: 'good',
    payload: {
      value,
      stages: {
        decoded,
        normalized,
        calibrated,
        processed,
        mapped,
      },
      metrics: data.metrics && typeof data.metrics === 'object' ? data.metrics : {},
      algorithmMetrics: data.algorithmMetrics && typeof data.algorithmMetrics === 'object'
        ? data.algorithmMetrics
        : (data.metrics?.algorithm || {}),
      matrix,
      orientation,
      status,
      temperature,
      protocol,
      history,
    },
  };
}

module.exports = {
  SENSOR_FRAME_SCHEMA_VERSION,
  SENSOR_FRAME_TYPE,
  buildSensorFrameEnvelope,
  parseFramePayload,
  toNumericArray,
};
