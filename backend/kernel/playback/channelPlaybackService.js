/**
 * 按 canonical channelId 构造动态历史回放帧。
 *
 * 本模块不认识 sit/back/head 的位置，也不依据 channels 数组下标推断身份；数组下标
 * 只表示所有通道共同请求的时间序号。每路身份必须来自 descriptor、数据库行或已存帧。
 */

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function stringValue(value) {
  return value == null ? '' : String(value).trim();
}

function parseChannelId(channelId) {
  if (typeof channelId !== 'string' || channelId !== channelId.trim()) return null;
  const parts = channelId.split(':');
  if (
    parts.length !== 2
    || !parts[0]
    || !parts[1]
    || parts[0] !== parts[0].trim()
    || parts[1] !== parts[1].trim()
  ) {
    return null;
  }
  return { channelId, displaySystemId: parts[0], sensorId: parts[1] };
}

function normalizeParserChannel(value) {
  if (!isObject(value)) return value;
  return firstPresent(value.id, value.role, value.channel, '');
}

function compactObject(value) {
  return Object.entries(value).reduce((result, [key, item]) => {
    if (item !== undefined && item !== null && item !== '') result[key] = item;
    return result;
  }, {});
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
  const parsed = parseChannelId(rawChannelId);
  if (!parsed) return null;
  if (
    [rowChannelId, storedChannelId]
      .filter((value) => value !== undefined && value !== null && value !== '')
      .some((value) => value !== parsed.channelId)
  ) {
    return null;
  }
  const channelId = stringValue(firstPresent(
    descriptor.channelId,
    descriptorIdentity.channelId,
    row.channel_id,
    row.channelId,
    storedFrame.channelId,
    storedIdentity.channelId,
  ));
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
    channelId,
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

function createPayload(storedFrame, identity, serial, index, timestamp) {
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
      recordedAt: timestamp,
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
 * @returns {Array<{channelId:string,outputChannel:string,payload:object,timestamp:*}>} 可发布帧。
 */
function buildChannelPlaybackFrames({
  channels = [],
  index = 0,
  parseStoredFrameData,
} = {}) {
  if (!Array.isArray(channels) || !Number.isInteger(index) || index < 0) return [];
  if (typeof parseStoredFrameData !== 'function') return [];

  const frames = [];
  for (const channel of channels) {
    const descriptor = isObject(channel?.descriptor) ? channel.descriptor : {};
    const rows = channel?.rows;
    if (!rows || Number(rows.length) <= index) continue;

    let row;
    let storedFrame;
    try {
      row = rows[index];
      if (!row) continue;
      storedFrame = parseStoredFrameData(row);
    } catch {
      // 一路坏历史不能阻塞其它串口回放。
      continue;
    }
    if (!Array.isArray(storedFrame) && !isObject(storedFrame)) continue;

    const identity = resolveIdentity(row, storedFrame, descriptor);
    if (!identity) continue;
    const timestamp = firstPresent(
      row.timestamp,
      row.recorded_at,
      row.recordedAt,
      storedFrame.timestamp,
      storedFrame.time,
      null,
    ) ?? null;
    const serial = resolveSerial(row, storedFrame, descriptor);
    const payload = createPayload(storedFrame, identity, serial, index, timestamp);
    frames.push({
      channelId: identity.channelId,
      outputChannel: identity.outputChannel,
      payload,
      timestamp,
    });
  }
  return frames;
}

module.exports = {
  buildChannelPlaybackFrames,
  resolveIdentity,
  resolveSerial,
};
