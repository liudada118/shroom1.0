/**
 * 按 canonical channelId 构造动态历史回放帧。
 *
 * 本模块不认识 sit/back/head 的位置，也不依据 channels 数组下标推断身份。回放下标
 * 属于最长通道的时间轴；其它通道按 timestamp 取最近帧，避免不同帧率或丢包后错位。
 * 每路身份必须来自 descriptor、数据库行或已存帧。
 */

const {
  parseSensorChannelId,
  resolveSensorIdentity,
} = require('@shroom/backend/identity');

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function stringValue(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeParserChannel(value) {
  if (!isObject(value)) return value;
  return firstPresent(value.id, value.role, value.channel, '');
}

/** 校验一个历史来源显式声明的身份是否与选中的 canonical channelId 一致。 */
function matchesCanonicalIdentity(expected, candidate = {}) {
  if (!isObject(candidate)) return true;
  const declarations = [
    ['channelId', candidate.channel_id],
    ['channelId', candidate.channelId],
    ['displaySystemId', candidate.display_system_id],
    ['displaySystemId', candidate.displaySystemId],
    ['sensorId', candidate.sensor_id],
    ['sensorId', candidate.sensorId],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  return declarations.every(([field, value]) => {
    const declared = { channelId: expected.channelId, [field]: value };
    const resolved = resolveSensorIdentity(declared, { allowDerived: true });
    return Boolean(
      resolved
      && resolved.channelId === expected.channelId
      && resolved.displaySystemId === expected.displaySystemId
      && resolved.sensorId === expected.sensorId,
    );
  });
}

function compactObject(value) {
  return Object.entries(value).reduce((result, [key, item]) => {
    if (item !== undefined && item !== null && item !== '') result[key] = item;
    return result;
  }, {});
}

function getRowCount(rows) {
  const count = Number(rows?.length || 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function getFallbackRowIndex(index, length) {
  return Number.isInteger(index) && index >= 0 && index < length ? index : -1;
}

function getHintRowIndex(index, length) {
  if (!length) return -1;
  return Math.min(Math.max(Number.isInteger(index) ? index : 0, 0), length - 1);
}

function resolveTimestamp(row = {}, storedFrame = {}) {
  return firstPresent(
    row.timestamp,
    row.recorded_at,
    row.recordedAt,
    storedFrame.timestamp,
    storedFrame.time,
    null,
  ) ?? null;
}

function normalizeTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readRowTimestamp(row) {
  if (!row) return null;
  for (const value of [row.timestamp, row.recorded_at, row.recordedAt]) {
    const timestamp = normalizeTimestamp(value);
    if (timestamp !== null) return timestamp;
  }
  return null;
}

function normalizePositiveInteger(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0
    ? Math.max(1, Math.floor(numeric))
    : fallback;
}

/**
 * 从已选中的回放锚点通道构造 UI 时间轴。
 *
 * 这里只读取数据库行的 timestamp/recorded_at/recordedAt，不解析 data，避免为了
 * 生成时间轴而反序列化压力矩阵。time 沿用趋势图的等步长抽样规则；
 * intervalTimestamps 必须是开头连续行的时间戳，遇到缺失值立即停止，防止
 * calcDetectedInterval 跨过数据缺口计算出虚假的采样间隔。
 *
 * @param {{rows:Array|object}|null} channel selectPlaybackAnchorChannel 返回的通道。
 * @param {object} options 时间轴选项。
 * @param {number} options.sampleLimit UI 时间轴最多抽样点数。
 * @param {number} options.intervalSampleLimit 检测帧间隔时最多读取的连续时间戳数。
 * @returns {{time:(number|null)[],intervalTimestamps:number[],length:number,sampleStep:number}}
 */
function buildPlaybackAnchorTimeline(channel, {
  sampleLimit = 2000,
  intervalSampleLimit = 21,
} = {}) {
  const rows = channel?.rows;
  const length = getRowCount(rows);
  const safeSampleLimit = normalizePositiveInteger(sampleLimit, 2000);
  const safeIntervalSampleLimit = normalizePositiveInteger(intervalSampleLimit, 21);
  const sampleStep = length > safeSampleLimit
    ? Math.ceil(length / safeSampleLimit)
    : 1;
  const time = [];
  for (let index = 0; index < length; index += sampleStep) {
    time.push(readRowTimestamp(rows[index]));
  }

  const intervalTimestamps = [];
  const intervalLength = Math.min(length, safeIntervalSampleLimit);
  for (let index = 0; index < intervalLength; index += 1) {
    const timestamp = readRowTimestamp(rows[index]);
    if (timestamp === null) break;
    intervalTimestamps.push(timestamp);
  }

  return {
    time,
    intervalTimestamps,
    length,
    sampleStep,
  };
}

function readComparableTimestamp(row, parseStoredFrameData) {
  if (!row) return null;
  const rowTimestamp = resolveTimestamp(row);
  const comparableRowTimestamp = normalizeTimestamp(rowTimestamp);
  if (comparableRowTimestamp !== null) return comparableRowTimestamp;
  try {
    const storedFrame = parseStoredFrameData(row);
    return normalizeTimestamp(resolveTimestamp(row, storedFrame));
  } catch {
    return null;
  }
}

/**
 * 在按时间升序的通道历史中查找离目标时刻最近的行。
 *
 * 时间戳缺失时回退到原来的数组下标，兼容旧数据库；距离相同时选较早帧，
 * 避免回放提前看到尚未发生的数据。
 */
function findNearestTimestampRowIndex({
  rows,
  targetTimestamp,
  fallbackIndex = 0,
  hintIndex = fallbackIndex,
  parseStoredFrameData,
} = {}) {
  const length = getRowCount(rows);
  if (!length) return -1;
  const fallback = getFallbackRowIndex(fallbackIndex, length);
  const target = normalizeTimestamp(targetTimestamp);
  if (target === null || typeof parseStoredFrameData !== 'function') return fallback;

  const hint = getHintRowIndex(hintIndex, length);
  const hintTimestamp = readComparableTimestamp(rows[hint], parseStoredFrameData);
  if (hintTimestamp === target) return hint;
  if (hintTimestamp !== null) {
    const hintDistance = Math.abs(hintTimestamp - target);
    const previousTimestamp = hint > 0
      ? readComparableTimestamp(rows[hint - 1], parseStoredFrameData)
      : null;
    const nextTimestamp = hint + 1 < length
      ? readComparableTimestamp(rows[hint + 1], parseStoredFrameData)
      : null;
    const hasPreviousBoundary = hint === 0 || previousTimestamp !== null;
    const hasNextBoundary = hint + 1 === length || nextTimestamp !== null;
    const previousIsCloser = previousTimestamp !== null
      && Math.abs(previousTimestamp - target) <= hintDistance;
    const nextIsCloser = nextTimestamp !== null
      && Math.abs(nextTimestamp - target) < hintDistance;
    if (hasPreviousBoundary && hasNextBoundary && !previousIsCloser && !nextIsCloser) {
      return hint;
    }
  }

  let low = 0;
  let high = length - 1;
  let earlier = null;
  let later = null;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const timestamp = readComparableTimestamp(rows[middle], parseStoredFrameData);
    if (timestamp === null) return fallback;
    if (timestamp === target) return middle;
    if (timestamp < target) {
      earlier = { index: middle, timestamp };
      low = middle + 1;
    } else {
      later = { index: middle, timestamp };
      high = middle - 1;
    }
  }

  if (!earlier) return later?.index ?? fallback;
  if (!later) return earlier.index;
  return target - earlier.timestamp <= later.timestamp - target
    ? earlier.index
    : later.index;
}

/**
 * 选择 canonical 回放的时间轴通道。
 *
 * 服务器的回放长度取最大行数，所以优先最长通道；等长时优先 sit，再按传入顺序。
 * server 构造 historySeries/timeStamp 时也应调用本函数，确保 UI 时间轴与实际对齐锚点一致。
 */
function selectPlaybackAnchorChannel(channels = []) {
  const candidates = (Array.isArray(channels) ? channels : [])
    .map((channel, order) => ({
      channel,
      order,
      length: getRowCount(channel?.rows),
      preferred: channel?.descriptor?.outputChannel === 'sit' ? 1 : 0,
    }))
    .filter((candidate) => candidate.length > 0)
    .sort((left, right) => (
      right.length - left.length
      || right.preferred - left.preferred
      || left.order - right.order
    ));
  return candidates[0]?.channel || null;
}

function resolvePlaybackAnchor({ channels, index, parseStoredFrameData }) {
  const channel = selectPlaybackAnchorChannel(channels);
  const length = getRowCount(channel?.rows);
  if (!channel || index >= length) return null;
  const row = channel.rows[index];
  const timestamp = readComparableTimestamp(row, parseStoredFrameData);
  return timestamp === null ? null : { timestamp, length };
}

/**
 * 合并一帧历史事实与通道 descriptor 的串口信息。
 * row/已存帧优先，descriptor 只补缺；未知扩展字段（status/openedAt 等）原样保留。
 */
function resolveSerial(row, storedFrame, descriptor) {
  const descriptorSerial = isObject(descriptor.serial) ? descriptor.serial : {};
  const storedSerial = isObject(storedFrame.serial) ? storedFrame.serial : {};
  const rowSerial = isObject(row.serial) ? row.serial : {};
  const serial = {
    ...descriptorSerial,
    ...storedSerial,
    ...rowSerial,
  };

  const baudRate = firstPresent(
    row.baud_rate,
    row.baudRate,
    rowSerial.baudRate,
    storedFrame.baudRate,
    storedSerial.baudRate,
    descriptor.baudRate,
    descriptorSerial.baudRate,
  );
  const numericBaudRate = Number(baudRate);
  return compactObject({
    ...serial,
    role: firstPresent(
      row.serial_role,
      row.serialRole,
      rowSerial.role,
      storedFrame.serialRole,
      storedSerial.role,
      descriptor.serialRole,
      descriptorSerial.role,
    ),
    portId: firstPresent(
      row.serial_port_id,
      row.serialPortId,
      rowSerial.portId,
      storedFrame.serialPortId,
      storedSerial.portId,
      descriptor.serialPortId,
      descriptorSerial.portId,
    ),
    path: firstPresent(
      row.serial_port_path,
      row.serialPortPath,
      rowSerial.path,
      rowSerial.portPath,
      storedFrame.serialPortPath,
      storedSerial.path,
      storedSerial.portPath,
      descriptor.serialPortPath,
      descriptorSerial.path,
      descriptorSerial.portPath,
    ),
    baudRate: Number.isFinite(numericBaudRate) && numericBaudRate > 0
      ? numericBaudRate
      : undefined,
    parserChannel: normalizeParserChannel(firstPresent(
      row.parser_channel,
      row.parserChannel,
      rowSerial.parserChannel,
      storedFrame.parserChannel,
      storedSerial.parserChannel,
      descriptor.parserChannel,
      descriptorSerial.parserChannel,
    )),
  });
}

function resolveIdentity(row, storedFrame, descriptor) {
  const storedIdentity = isObject(storedFrame.identity) ? storedFrame.identity : {};
  const descriptorIdentity = isObject(descriptor.identity) ? descriptor.identity : {};

  // descriptor 是这批 rows 的查询键，优先作为 channelId；没有 descriptor 时仍只接受
  // row/storedFrame 中的显式身份，绝不由 channels 数组位置生成 sit/back/head。
  const descriptorChannelId = firstPresent(descriptor.channelId, descriptorIdentity.channelId);
  const rowChannelId = firstPresent(row.channel_id, row.channelId);
  const storedChannelId = firstPresent(storedFrame.channelId, storedIdentity.channelId);
  const rawChannelId = firstPresent(descriptorChannelId, rowChannelId, storedChannelId);
  const parsed = parseSensorChannelId(rawChannelId);
  if (!parsed || parsed.channelId !== rawChannelId) return null;
  if (![descriptor, descriptorIdentity, row, storedFrame, storedIdentity]
    .every((candidate) => matchesCanonicalIdentity(parsed, candidate))) {
    return null;
  }
  const outputChannel = stringValue(firstPresent(
    row.output_channel,
    row.outputChannel,
    storedFrame.outputChannel,
    storedIdentity.outputChannel,
    descriptor.outputChannel,
    descriptorIdentity.outputChannel,
  ));
  const sensorId = parsed.sensorId;
  return {
    channelId: parsed.channelId,
    displaySystemId: parsed.displaySystemId,
    sensorId,
    sensorLabel: stringValue(firstPresent(
      row.sensor_label,
      row.sensorLabel,
      storedFrame.sensorLabel,
      storedIdentity.sensorLabel,
      descriptor.sensorLabel,
      descriptorIdentity.sensorLabel,
      sensorId,
    )),
    sensorType: stringValue(firstPresent(
      row.sensor_type,
      row.sensorType,
      storedFrame.sensorType,
      storedIdentity.sensorType,
      descriptor.sensorType,
      descriptorIdentity.sensorType,
    )),
    outputChannel: outputChannel || sensorId,
  };
}

function createPayload(storedFrame, identity, serial, index, timestamp, alignment = {}) {
  const payload = Array.isArray(storedFrame)
    ? { data: [...storedFrame] }
    : { ...storedFrame };

  // Clone the mutable metadata containers we extend so callers' cached parsed rows stay immutable.
  if (isObject(storedFrame.stages)) payload.stages = { ...storedFrame.stages };
  if (isObject(storedFrame.metrics)) payload.metrics = { ...storedFrame.metrics };
  if (isObject(storedFrame.algorithmMetrics)) {
    payload.algorithmMetrics = { ...storedFrame.algorithmMetrics };
  }

  Object.assign(payload, identity, {
    serial,
    index,
    time: timestamp,
    history: {
      ...(isObject(storedFrame.history) ? storedFrame.history : {}),
      index,
      sourceIndex: alignment.sourceIndex ?? index,
      recordedAt: timestamp,
      alignedAt: alignment.alignedAt ?? null,
      skewMs: alignment.skewMs ?? null,
    },
  });
  return payload;
}

/**
 * 构造一个动态通道回放时刻的所有可用帧。
 *
 * @param {object} options 参数。
 * @param {Array<{descriptor: object, rows: Array|object}>} options.channels 通道与其历史行。
 * @param {number} options.index 各路要读取的回放下标。
 * @param {Function} options.parseStoredFrameData 将数据库行解析成帧对象/数组。
 * @returns {Array<{channelId:string,outputChannel:string,payload:object,timestamp:*,sourceIndex:number,alignedAt:number|null,skewMs:number|null}>} 可发布帧。
 */
function buildChannelPlaybackFrames({
  channels = [],
  index = 0,
  parseStoredFrameData,
} = {}) {
  if (!Array.isArray(channels) || !Number.isInteger(index) || index < 0) return [];
  if (typeof parseStoredFrameData !== 'function') return [];

  const anchor = resolvePlaybackAnchor({
    channels,
    index,
    parseStoredFrameData,
  });
  const frames = [];
  for (const channel of channels) {
    const descriptor = isObject(channel?.descriptor) ? channel.descriptor : {};
    const rows = channel?.rows;
    if (!rows || getRowCount(rows) === 0) continue;

    const sourceIndex = findNearestTimestampRowIndex({
      rows,
      targetTimestamp: anchor?.timestamp,
      fallbackIndex: index,
      hintIndex: anchor?.length
        ? Math.floor(index * getRowCount(rows) / anchor.length)
        : index,
      parseStoredFrameData,
    });
    if (sourceIndex < 0) continue;

    let row;
    let storedFrame;
    try {
      row = rows[sourceIndex];
      if (!row) continue;
      storedFrame = parseStoredFrameData(row);
    } catch {
      // 一路坏历史不能阻塞其它串口回放。
      continue;
    }
    if (!Array.isArray(storedFrame) && !isObject(storedFrame)) continue;

    const identity = resolveIdentity(row, storedFrame, descriptor);
    if (!identity) continue;
    const timestamp = resolveTimestamp(row, storedFrame);
    const comparableTimestamp = normalizeTimestamp(timestamp);
    const alignedAt = anchor?.timestamp ?? comparableTimestamp;
    const skewMs = alignedAt !== null && comparableTimestamp !== null
      ? comparableTimestamp - alignedAt
      : null;
    const serial = resolveSerial(row, storedFrame, descriptor);
    const payload = createPayload(storedFrame, identity, serial, index, timestamp, {
      sourceIndex,
      alignedAt,
      skewMs,
    });
    frames.push({
      channelId: identity.channelId,
      outputChannel: identity.outputChannel,
      payload,
      timestamp,
      sourceIndex,
      alignedAt,
      skewMs,
    });
  }
  return frames;
}

module.exports = {
  buildPlaybackAnchorTimeline,
  buildChannelPlaybackFrames,
  findNearestTimestampRowIndex,
  resolvePlaybackAnchor,
  resolveIdentity,
  resolveSerial,
  selectPlaybackAnchorChannel,
};
