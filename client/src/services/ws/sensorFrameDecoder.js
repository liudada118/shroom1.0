import sensorFrameV1Contract from '@shroom/frontend/contract/sensorFrameV1';

export const SENSOR_FRAME_TYPE = sensorFrameV1Contract.SENSOR_FRAME_TYPE;
export const SENSOR_FRAME_SCHEMA_VERSION = sensorFrameV1Contract.SENSOR_FRAME_SCHEMA_VERSION;
export const isDeclaredSensorFrame = sensorFrameV1Contract.isDeclaredSensorFrame;

const LEGACY_CHANNEL_FIELDS = {
  sit: 'sitData',
  back: 'backData',
  head: 'headData',
  sensor: 'sensorData',
};

const LEGACY_STAGE_FIELDS = {
  decoded: ['rawData', 'realArr'],
  normalized: ['normalizedData'],
  calibrated: ['calibratedData', 'rawPressureData'],
  processed: ['processedData'],
  mapped: ['mappedData', 'mappedArr195', 'newArr147', 'newArr'],
};

const LEGACY_PROTOCOL_FIELDS = [
  'frameIndex',
  'packetType',
  'handSide',
  'outputSide',
  'packetSourcePort',
];

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

function parseArrayValue(value) {
  let current = value;
  for (let attempt = 0; attempt < 2 && typeof current === 'string'; attempt += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      return null;
    }
  }
  return Array.isArray(current) ? current : null;
}

function firstArray(...values) {
  for (const value of values) {
    const array = parseArrayValue(value);
    if (array) return array;
  }
  return null;
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
  const array = parseArrayValue(value);
  if (array) target[key] = array;
}

function resolveSerialMetadata(frame, payload) {
  const declared = isObject(frame.serial)
    ? frame.serial
    : (isObject(payload.serial) ? payload.serial : {});
  const serial = {
    ...declared,
    ...(frame.serialRole != null && declared.role == null
      ? { role: frame.serialRole }
      : {}),
    ...(frame.serialPortPath != null && declared.path == null
      ? { path: frame.serialPortPath }
      : {}),
    ...(frame.baudRate != null && declared.baudRate == null
      ? { baudRate: frame.baudRate }
      : {}),
    ...(frame.parser != null && declared.parserChannel == null
      ? { parserChannel: frame.parser }
      : {}),
  };
  return Object.keys(serial).length ? serial : null;
}

/**
 * 判断消息是否为唯一的传感器实时/回放帧契约。
 * 系统状态、授权和命令确认仍按各自消息对象原样返回。
 */
export function isSensorFrameEnvelope(value) {
  return sensorFrameV1Contract.isSensorFrameV1Envelope(value);
}

/**
 * 解析消息所属的逻辑输出通道。canonical 帧优先使用 outputChannel，旧消息仅作为
 * 过渡输入从 *Data 字段推断；页面代码不再直接读取这些顶层字段。
 */
export function getSensorFrameOutputChannel(value) {
  const frame = parseWirePayload(value);
  if (!isObject(frame)) return '';
  if (isDeclaredSensorFrame(frame) && !isSensorFrameEnvelope(frame)) return '';

  const declared = String(frame.outputChannel || frame.sensorId || frame.portId || '').trim();
  if (declared) return declared;

  for (const [channel, field] of Object.entries(LEGACY_CHANNEL_FIELDS)) {
    if (parseArrayValue(frame[field])) return channel;
  }
  return '';
}

/**
 * 按逻辑通道读取压力数组。
 *
 * 新协议只读取 payload.value；顶层 sitData/backData/headData 仅用于兼容尚未升级的
 * 旧服务端。所有客户端调用方都通过此边界读取，不再依赖 wire 顶层字段。
 */
export function getSensorFrameChannelValue(value, expectedChannel) {
  const frame = parseWirePayload(value);
  if (!isObject(frame)) return null;
  if (isDeclaredSensorFrame(frame) && !isSensorFrameEnvelope(frame)) return null;

  const expected = String(expectedChannel || '').trim();
  const actual = getSensorFrameOutputChannel(frame);

  if (isSensorFrameEnvelope(frame)) {
    if (expected && actual !== expected) return null;
    return firstArray(frame.payload.value, frame.payload.stages?.processed);
  }

  if (expected) {
    const legacyField = LEGACY_CHANNEL_FIELDS[expected] || `${expected}Data`;
    const legacyValue = parseArrayValue(frame[legacyField]);
    if (legacyValue) return legacyValue;
    if (actual && actual !== expected) return null;
    return firstArray(frame.data, frame.value);
  }

  if (actual) {
    return getSensorFrameChannelValue(frame, actual);
  }
  for (const field of Object.values(LEGACY_CHANNEL_FIELDS)) {
    const legacyValue = parseArrayValue(frame[field]);
    if (legacyValue) return legacyValue;
  }
  return firstArray(frame.data, frame.value);
}

export function hasSensorFrameChannelValue(value, expectedChannel) {
  return getSensorFrameChannelValue(value, expectedChannel) !== null;
}

/**
 * wildcard 订阅下按展示系统身份隔离传感器帧。系统事件与没有身份的旧帧继续透传。
 */
export function isSensorFrameForDisplay(value, acceptedIdentities = []) {
  const frame = parseWirePayload(value);
  if (!isObject(frame)) return false;

  // 声明为 canonical 的消息必须满足完整身份契约；不能再把畸形 sensor.frame
  // 降级成 legacy 后按同名 outputChannel 放行，否则不同展示系统会串路。
  if (isDeclaredSensorFrame(frame) && !isSensorFrameEnvelope(frame)) return false;

  const outputChannel = getSensorFrameOutputChannel(frame);
  if (!outputChannel || !getSensorFrameChannelValue(frame, outputChannel)) return true;

  const displaySystemId = String(frame.displaySystemId || '').trim();
  if (!displaySystemId) return true;

  const accepted = new Set(
    (Array.isArray(acceptedIdentities) ? acceptedIdentities : [acceptedIdentities])
      .map((identity) => String(identity || '').trim())
      .filter(Boolean),
  );
  // canonical 帧一旦声明 displaySystemId，就只能按这个稳定身份路由。
  // sensorType 可能被多个展示系统复用，不能拿它绕过明确的系统边界。
  return accepted.has(displaySystemId);
}

/**
 * 独立旧页面没有展示系统 definition：优先使用路由显式传入的身份，否则读取主界面写入
 * localStorage 的当前系统。canonical wildcard 帧没有任何已知身份时 fail closed；legacy
 * 无身份帧和系统事件仍透传。
 */
export function isSensorFrameForActiveDisplay(value, additionalIdentities = []) {
  const accepted = (Array.isArray(additionalIdentities)
    ? additionalIdentities
    : [additionalIdentities])
    .map((identity) => String(identity || '').trim())
    .filter(Boolean);

  if (accepted.length === 0) {
    try {
      const storedIdentity = globalThis.localStorage?.getItem?.('file');
      if (storedIdentity) accepted.push(String(storedIdentity).trim());
    } catch {
      // 沙箱、隐私模式或 Node 测试中 localStorage 可能不可访问。
    }
  }

  // canonical wildcard 帧没有明确当前身份时 fail closed；没有身份的 legacy 帧和系统事件
  // 仍由 isSensorFrameForDisplay 透传。
  return isSensorFrameForDisplay(value, accepted);
}

/**
 * 读取 canonical 数据阶段，并为旧服务端保留单点兼容入口。
 */
export function getSensorFrameStageValue(value, stage) {
  const frame = parseWirePayload(value);
  if (!isObject(frame)) return null;
  if (isDeclaredSensorFrame(frame) && !isSensorFrameEnvelope(frame)) return null;
  if (isSensorFrameEnvelope(frame)) {
    return parseArrayValue(frame.payload.stages?.[stage]);
  }
  return firstArray(...(LEGACY_STAGE_FIELDS[stage] || []).map((field) => frame[field]));
}

/**
 * 将 canonical sensor.frame 投影成现有页面的临时内部对象。
 *
 * 压力矩阵始终通过 getSensorFrameChannelValue 读取，因此这里不会重新制造
 * sitData/backData/headData 顶层别名。其它旧页面字段暂时保留，便于分阶段迁移
 * 手套姿态、温度和协议附加信息。
 */
export function adaptSensorFrameForClient(frame) {
  if (!isSensorFrameEnvelope(frame)) return frame;

  const payload = frame.payload;
  const stages = isObject(payload.stages) ? payload.stages : {};
  const sensorId = resolveSensorId(frame);
  const outputChannel = String(frame.outputChannel || sensorId || '').trim();
  const serial = resolveSerialMetadata(frame, payload);
  const internal = {
    type: frame.type,
    schemaVersion: Number(frame.schemaVersion ?? frame.version),
    channelId: frame.channelId,
    displaySystemId: frame.displaySystemId,
    sensorId,
    sensorLabel: frame.sensorLabel || sensorId,
    sensorType: frame.sensorType,
    outputChannel,
    source: frame.source,
    sequence: frame.sequence,
    timestamp: frame.timestamp,
    quality: frame.quality,
    payload,
    metrics: isObject(payload.metrics) ? payload.metrics : {},
    algorithmMetrics: isObject(payload.algorithmMetrics) ? payload.algorithmMetrics : {},
    orientation: payload.orientation,
    status: payload.status,
    temperature: payload.temperature,
    protocol: payload.protocol,
    history: payload.history,
    matrix: payload.matrix,
    serial,
  };

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

  if (isObject(payload.protocol)) {
    for (const field of LEGACY_PROTOCOL_FIELDS) {
      if (payload.protocol[field] != null) internal[field] = payload.protocol[field];
    }
  }
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
 * 统一 WebSocket 接收边界：解析 JSON，并仅对 sensor.frame 做内部兼容投影。
 */
export function decodeWebSocketPayload(payload) {
  const parsed = parseWirePayload(payload);
  return isSensorFrameEnvelope(parsed)
    ? adaptSensorFrameForClient(parsed)
    : parsed;
}

export default decodeWebSocketPayload;
