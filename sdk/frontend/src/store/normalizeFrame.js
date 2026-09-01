import sensorFrameV1Contract from '../contract/sensorFrameV1.js';

export const SENSOR_FRAME_TYPE = sensorFrameV1Contract.SENSOR_FRAME_TYPE;
export const SENSOR_FRAME_SCHEMA_VERSION = sensorFrameV1Contract.SENSOR_FRAME_SCHEMA_VERSION;
export const isDeclaredSensorFrame = sensorFrameV1Contract.isDeclaredSensorFrame;

const CHANNEL_KEYS = {
  sitData: 'sit',
  backData: 'back',
  headData: 'head',
  rightData: 'right',
  leftData: 'left',
};

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function parseArrayValue(value) {
  let candidate = value;
  for (let attempt = 0; attempt < 2 && typeof candidate === 'string'; attempt += 1) {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  return Array.isArray(candidate) ? candidate : null;
}

function toNumberArray(value) {
  const candidate = parseArrayValue(value);
  if (!candidate) {
    return [];
  }
  return candidate.map((item) => {
    const numberValue = Number(item);
    return Number.isFinite(numberValue) ? numberValue : 0;
  });
}

function firstNumberArray(...values) {
  for (const value of values) {
    if (parseArrayValue(value)) {
      return toNumberArray(value);
    }
  }
  return [];
}

function inferMatrix(data, matrix = {}) {
  const metadata = isObject(matrix) ? matrix : {};
  const width = Number(matrix.width ?? matrix.cols);
  const height = Number(matrix.height ?? matrix.rows);
  if (Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0) {
    return {
      ...metadata,
      width,
      height,
      data,
    };
  }

  const square = Math.sqrt(data.length);
  if (Number.isInteger(square)) {
    return {
      ...metadata,
      width: square,
      height: square,
      data,
    };
  }

  return {
    ...metadata,
    width: null,
    height: null,
    data,
  };
}

function toFiniteNumber(...values) {
  for (const value of values) {
    const numberValue = Number(value);
    if (value !== null && value !== '' && Number.isFinite(numberValue)) {
      return numberValue;
    }
  }
  return undefined;
}

function calculateStats(data, stats = {}) {
  let max = 0;
  let min = 0;
  let total = 0;
  let point = 0;

  if (data.length) {
    max = -Infinity;
    min = Infinity;
    data.forEach((value) => {
      if (value > max) max = value;
      if (value < min) min = value;
      total += value;
      if (value > 0) point += 1;
    });
  }

  const calculated = {
    max,
    min,
    total,
    mean: data.length ? total / data.length : 0,
    point,
  };
  if (!isObject(stats) || !Object.keys(stats).length) {
    return calculated;
  }

  // Canonical metrics use descriptive names; retain those fields while exposing
  // the historical SDK aliases consumed by existing renderers.
  return {
    ...calculated,
    ...stats,
    max: toFiniteNumber(stats.max, stats.maxPressure, calculated.max),
    min: toFiniteNumber(stats.min, stats.minPressure, calculated.min),
    total: toFiniteNumber(stats.total, stats.totalPressure, calculated.total),
    mean: toFiniteNumber(stats.mean, stats.averagePressure, calculated.mean),
    point: toFiniteNumber(stats.point, stats.activePoints, stats.nonZeroCount, calculated.point),
  };
}

function resolveSensorId(frame = {}) {
  const explicit = String(frame.sensorId || '').trim();
  if (explicit) return explicit;

  const channelId = String(frame.channelId || '').trim();
  const displaySystemId = String(frame.displaySystemId || '').trim();
  if (displaySystemId && channelId.startsWith(`${displaySystemId}:`)) {
    return channelId.slice(displaySystemId.length + 1);
  }
  const separatorIndex = channelId.indexOf(':');
  return separatorIndex >= 0 ? channelId.slice(separatorIndex + 1) : channelId;
}

/**
 * 判断消息是否为 canonical 传感器帧。只接受已知 schema 版本，避免把未来协议
 * 静默解释成当前结构。
 */
export function isSensorFrameEnvelope(value) {
  return sensorFrameV1Contract.isSensorFrameV1Envelope(value);
}

export function normalizeFramePayload(payload = {}) {
  const data = firstNumberArray(payload.matrix?.data, payload.pressureData, payload.data);
  const sensorType = payload.sensorType || payload.matrixName || 'unknown';
  const channel = payload.channel || 'sit';

  return {
    sensorType,
    channel,
    mode: payload.mode || payload.numMatrixFlag || 'normal',
    timestamp: payload.timestamp ?? Date.now(),
    matrix: inferMatrix(data, payload.matrix || {}),
    data,
    raw: {
      data: firstNumberArray(payload.raw?.data, payload.rawData, payload.realArr, data),
      rotate: firstNumberArray(payload.raw?.rotate, payload.rotate),
      zeroFrame: firstNumberArray(payload.raw?.zeroFrame, payload.zeroFrame),
    },
    stats: calculateStats(data, payload.stats || {}),
    extra: payload.extra || {},
  };
}

/**
 * 将 schema v1 `sensor.frame` 转成 SDK 长期使用的统一帧结构。
 * 压力值只从 canonical payload 读取，不重新制造顶层 `sitData/backData/headData`。
 */
export function normalizeSensorFrameEnvelope(frame = {}) {
  if (!isSensorFrameEnvelope(frame)) return null;

  const payload = frame.payload;
  const stagesPayload = isObject(payload.stages) ? payload.stages : {};
  const data = firstNumberArray(payload.value, stagesPayload.processed);
  const sensorId = resolveSensorId(frame);
  const outputChannel = String(frame.outputChannel || sensorId || '').trim();
  const displaySystemId = String(frame.displaySystemId || '').trim();
  const sensorType = String(frame.sensorType || displaySystemId || 'unknown').trim();
  const metrics = isObject(payload.metrics) ? payload.metrics : {};
  const algorithmMetrics = isObject(payload.algorithmMetrics) ? payload.algorithmMetrics : {};
  const stages = {
    decoded: firstNumberArray(stagesPayload.decoded),
    normalized: firstNumberArray(stagesPayload.normalized),
    calibrated: firstNumberArray(stagesPayload.calibrated),
    processed: firstNumberArray(stagesPayload.processed),
    mapped: firstNumberArray(stagesPayload.mapped),
  };

  return {
    type: SENSOR_FRAME_TYPE,
    schemaVersion: SENSOR_FRAME_SCHEMA_VERSION,
    channelId: frame.channelId,
    displaySystemId,
    sensorId,
    sensorLabel: frame.sensorLabel || sensorId,
    sensorType,
    outputChannel,
    channel: outputChannel || 'sensor',
    source: frame.source,
    sequence: frame.sequence,
    quality: frame.quality,
    serial: isObject(frame.serial) ? { ...frame.serial } : null,
    mode: payload.mode || 'normal',
    timestamp: frame.timestamp ?? Date.now(),
    matrix: inferMatrix(data, payload.matrix || {}),
    data,
    raw: {
      data: firstNumberArray(stagesPayload.decoded, stagesPayload.calibrated, data),
      rotate: firstNumberArray(payload.orientation),
      zeroFrame: [],
    },
    stages,
    metrics,
    algorithmMetrics,
    stats: calculateStats(data, metrics),
    extra: {
      status: payload.status ?? null,
      temperature: payload.temperature ?? null,
      protocol: payload.protocol ?? null,
      history: payload.history ?? null,
      serial: isObject(frame.serial) ? { ...frame.serial } : null,
    },
  };
}

export function normalizeLegacyPayload(message = {}) {
  const frames = [];
  Object.entries(CHANNEL_KEYS).forEach(([payloadKey, channel]) => {
    if (!Array.isArray(message[payloadKey])) {
      return;
    }
    frames.push(normalizeFramePayload({
      sensorType: message.sensorType || message.file || message.matrixName,
      channel,
      data: message[payloadKey],
      rawData: message.rawPressureData || message.realArr,
      rotate: message.rotate,
      stats: message.stats,
      extra: {
        tempObj: message.tempObj,
        hz: message.hz,
        handSide: message.handSide,
        outputSide: message.outputSide,
        newArr147: message.newArr147,
        mappedArr195: message.mappedArr195,
      },
      timestamp: message.time ?? message.timestamp,
    }));
  });

  if (message.tempObj && !frames.length) {
    frames.push(normalizeFramePayload({
      sensorType: message.sensorType || message.file || 'unknown',
      channel: 'sensor',
      data: [],
      extra: {
        tempObj: message.tempObj,
      },
      timestamp: message.time ?? message.timestamp,
    }));
  }

  return frames;
}

/**
 * 兼容 canonical 契约之前 SDK backend 发布的标准 pressure telemetry。
 */
export function normalizeTelemetryPayload(message = {}) {
  if (typeof message.channelId !== 'string' || !parseArrayValue(message.value)) {
    return null;
  }

  const metadata = isObject(message.metadata) ? message.metadata : {};
  const channel = String(message.portId || metadata.legacyChannel || message.metric || 'sensor');
  const sensorType = String(metadata.sensorType || message.deviceId || 'unknown');
  const normalized = normalizeFramePayload({
    sensorType,
    channel,
    timestamp: message.timestamp,
    data: message.value,
    matrix: {
      width: metadata.matrixWidth,
      height: metadata.matrixHeight,
    },
    extra: {
      unit: message.unit,
      quality: message.quality,
      metadata,
    },
  });

  return {
    ...normalized,
    channelId: message.channelId,
    sensorId: channel,
    outputChannel: channel,
    quality: message.quality,
  };
}

export function normalizeIncomingMessage(message = {}) {
  if (isSensorFrameEnvelope(message)) {
    return {
      type: SENSOR_FRAME_TYPE,
      payload: message.payload,
      frames: [normalizeSensorFrameEnvelope(message)],
      raw: message,
    };
  }

  // 已声明 canonical 类型的消息只能按对应版本解释。身份、payload 或版本无效时
  // 保留原消息供 invalidFrame 诊断，但绝不降级读取顶层 legacy 字段。
  if (isDeclaredSensorFrame(message)) {
    return {
      type: SENSOR_FRAME_TYPE,
      payload: message.payload || message,
      frames: [],
      raw: message,
    };
  }

  if (message.type === 'frame') {
    return {
      type: message.type,
      payload: message.payload || {},
      frames: [normalizeFramePayload(message.payload || {})],
      raw: message,
    };
  }

  const legacyFrames = normalizeLegacyPayload(message);
  const telemetryFrame = legacyFrames.length ? null : normalizeTelemetryPayload(message);
  const frames = telemetryFrame ? [telemetryFrame] : legacyFrames;
  return {
    type: message.type || (frames.length ? 'frame' : 'message'),
    payload: message.payload || message,
    frames,
    raw: message,
  };
}
