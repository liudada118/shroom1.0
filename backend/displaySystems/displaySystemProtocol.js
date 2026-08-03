const PROTOCOL_FRAMING_TYPES = Object.freeze({
  DELIMITER: 'delimiter',
  FIXED_LENGTH: 'fixedLength',
});

/**
 * 每种数值类型的字节宽度与读取函数。
 *
 * 用查表取代原先 `valueType.endsWith('16le')` 的宽度推断和一串 if：
 * 新增类型只需在这里加一行，decodeProtocolValues 不用改。
 */
const VALUE_TYPE_READERS = Object.freeze({
  uint8: { width: 1, read: (bytes, offset) => bytes.readUInt8(offset) },
  int8: { width: 1, read: (bytes, offset) => bytes.readInt8(offset) },
  uint16le: { width: 2, read: (bytes, offset) => bytes.readUInt16LE(offset) },
  uint16be: { width: 2, read: (bytes, offset) => bytes.readUInt16BE(offset) },
  int16le: { width: 2, read: (bytes, offset) => bytes.readInt16LE(offset) },
  int16be: { width: 2, read: (bytes, offset) => bytes.readInt16BE(offset) },
  uint32le: { width: 4, read: (bytes, offset) => bytes.readUInt32LE(offset) },
  uint32be: { width: 4, read: (bytes, offset) => bytes.readUInt32BE(offset) },
  int32le: { width: 4, read: (bytes, offset) => bytes.readInt32LE(offset) },
  int32be: { width: 4, read: (bytes, offset) => bytes.readInt32BE(offset) },
  float32le: { width: 4, read: (bytes, offset) => bytes.readFloatLE(offset) },
  float32be: { width: 4, read: (bytes, offset) => bytes.readFloatBE(offset) },
  // 位域：一个字节展开成 8 个 0/1，低位在前。开关量传感器（占位检测、按键阵列）
  // 用它就不必再把每个点位浪费成一整字节。宽度不是整字节，解码走单独分支。
  bit: { width: 1, bits: 1, read: (bytes, offset) => bytes.readUInt8(offset) },
});

const PROTOCOL_VALUE_TYPES = Object.freeze(Object.keys(VALUE_TYPE_READERS));

const PROTOCOL_CHECKSUM_TYPES = Object.freeze(['sum8', 'xor8', 'crc16-modbus']);

/**
 * 归一化校验和类型名。
 *
 * 手写 manifest 时 `crc16modbus` / `CRC16_MODBUS` 都很常见，统一去掉分隔符再比对，
 * 避免因为一个连字符就静默退化成「按 sum8 算」。真正拼错的类型仍会在校验时报错。
 *
 * @param {string} type 原始类型名。
 * @returns {string} 归一化后的类型名。
 */
function normalizeChecksumType(type) {
  const key = String(type || 'sum8').toLowerCase().replace(/[\s_-]+/g, '');
  if (key === 'crc16modbus') return 'crc16-modbus';
  return key;
}

/**
 * 校验和宽度。crc16 占两字节，其余占一字节。
 *
 * @param {string} type 校验和类型。
 * @returns {number} 字节宽度。
 */
function getChecksumWidth(type) {
  return normalizeChecksumType(type) === 'crc16-modbus' ? 2 : 1;
}

function parseByteSequence(value) {
  if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return Array.from(value);
  if (Array.isArray(value)) return value.map(Number);
  if (typeof value !== 'string') return [];
  return value
    .trim()
    .split(/[\s,;-]+/)
    .filter(Boolean)
    .map((part) => Number.parseInt(part.replace(/^0x/i, ''), 16));
}

/**
 * 归一化帧校验配置。
 *
 * `validation` 是可选的：没有声明时返回 null，帧校验整段跳过，
 * 行为与本字段引入之前完全一致。
 *
 * byteOffset 与 range 允许负数，表示从帧尾倒数（-1 即最后一个字节），
 * 这样变长帧也能把校验和放在尾部而不必写死绝对位置。
 *
 * @param {object | undefined} validation 原始校验配置。
 * @returns {object | null} 归一化后的校验配置。
 */
function normalizeValidationConfig(validation) {
  if (!validation || typeof validation !== 'object' || Array.isArray(validation)) return null;

  const header = parseByteSequence(validation.header);
  const rawChecksum = validation.checksum;
  const hasChecksum = rawChecksum && typeof rawChecksum === 'object' && !Array.isArray(rawChecksum);

  return {
    headerOffset: Number(validation.headerOffset || 0),
    header,
    checksum: hasChecksum
      ? {
        type: normalizeChecksumType(rawChecksum.type),
        byteOffset: rawChecksum.byteOffset == null ? -1 : Number(rawChecksum.byteOffset),
        range: normalizeChecksumRange(rawChecksum.range),
      }
      : null,
  };
}

/**
 * 归一化校验和覆盖区间。
 *
 * 两种写法等价：`[2, -1]` 与 `{ "start": 2, "end": -1 }`。数组紧凑，对象自解释，
 * 手写 manifest 的人两种都会用，这里统一收成 `[start, end)`。
 *
 * @param {number[] | {start: number, end: number} | undefined} range 原始区间。
 * @returns {number[] | null} 归一化后的 `[start, end)`，未声明时为 null。
 */
function normalizeChecksumRange(range) {
  if (Array.isArray(range)) {
    return range.length === 2 ? [Number(range[0]), Number(range[1])] : null;
  }
  if (range && typeof range === 'object' && range.start != null && range.end != null) {
    return [Number(range.start), Number(range.end)];
  }
  return null;
}

function normalizeProtocolConfig(protocol) {
  if (!protocol || typeof protocol !== 'object' || Array.isArray(protocol)) return null;

  const rawFraming = typeof protocol.framing === 'string'
    ? { type: protocol.framing }
    : (protocol.framing || {});
  const type = rawFraming.type || PROTOCOL_FRAMING_TYPES.DELIMITER;
  const decoding = protocol.decoding || {};

  return {
    validation: normalizeValidationConfig(protocol.validation),
    baudRate: protocol.baudRate == null ? null : Number(protocol.baudRate),
    framing: {
      type,
      delimiter: parseByteSequence(rawFraming.delimiter || protocol.delimiter),
      frameLength: rawFraming.frameLength == null
        ? (protocol.frameLength == null ? null : Number(protocol.frameLength))
        : Number(rawFraming.frameLength),
      includeDelimiter: rawFraming.includeDelimiter === true,
    },
    decoding: {
      valueType: decoding.valueType || protocol.valueType || 'uint8',
      byteOffset: Number(decoding.byteOffset || 0),
      valueCount: decoding.valueCount == null ? null : Number(decoding.valueCount),
    },
  };
}

function validateProtocolConfig(protocol, { source = 'display system manifest' } = {}) {
  if (protocol == null) return [];
  const normalized = normalizeProtocolConfig(protocol);
  const errors = [];

  if (!normalized) return [`${source}: protocol must be an object`];
  if (!Number.isInteger(normalized.baudRate) || normalized.baudRate <= 0) {
    errors.push(`${source}: protocol.baudRate must be a positive integer`);
  }
  if (!Object.values(PROTOCOL_FRAMING_TYPES).includes(normalized.framing.type)) {
    errors.push(`${source}: protocol.framing.type must be delimiter or fixedLength`);
  }
  if (normalized.framing.type === PROTOCOL_FRAMING_TYPES.DELIMITER) {
    if (!normalized.framing.delimiter.length) {
      errors.push(`${source}: protocol.framing.delimiter is required for delimiter framing`);
    } else if (normalized.framing.delimiter.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
      errors.push(`${source}: protocol.framing.delimiter must contain bytes between 0 and 255`);
    }
  }
  if (
    normalized.framing.type === PROTOCOL_FRAMING_TYPES.FIXED_LENGTH
    && (!Number.isInteger(normalized.framing.frameLength) || normalized.framing.frameLength <= 0)
  ) {
    errors.push(`${source}: protocol.framing.frameLength must be a positive integer for fixedLength framing`);
  }
  if (!PROTOCOL_VALUE_TYPES.includes(normalized.decoding.valueType)) {
    errors.push(`${source}: protocol.decoding.valueType is not supported`);
  }
  if (!Number.isInteger(normalized.decoding.byteOffset) || normalized.decoding.byteOffset < 0) {
    errors.push(`${source}: protocol.decoding.byteOffset must be a non-negative integer`);
  }
  if (
    normalized.decoding.valueCount != null
    && (!Number.isInteger(normalized.decoding.valueCount) || normalized.decoding.valueCount <= 0)
  ) {
    errors.push(`${source}: protocol.decoding.valueCount must be a positive integer`);
  }
  errors.push(...validateValidationConfig(normalized.validation, { source }));

  return errors;
}

/**
 * 校验帧校验配置。
 *
 * @param {object | null} validation 归一化后的校验配置。
 * @param {object} options 校验选项。
 * @returns {string[]} 错误列表。
 */
function validateValidationConfig(validation, { source }) {
  if (validation == null) return [];
  const errors = [];

  if (validation.header.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    errors.push(`${source}: protocol.validation.header must contain bytes between 0 and 255`);
  }
  if (!Number.isInteger(validation.headerOffset) || validation.headerOffset < 0) {
    errors.push(`${source}: protocol.validation.headerOffset must be a non-negative integer`);
  }
  if (validation.checksum) {
    if (!PROTOCOL_CHECKSUM_TYPES.includes(validation.checksum.type)) {
      errors.push(`${source}: protocol.validation.checksum.type must be one of ${PROTOCOL_CHECKSUM_TYPES.join(', ')}`);
    }
    if (!Number.isInteger(validation.checksum.byteOffset)) {
      errors.push(`${source}: protocol.validation.checksum.byteOffset must be an integer`);
    }
    if (validation.checksum.range && validation.checksum.range.some((bound) => !Number.isInteger(bound))) {
      errors.push(`${source}: protocol.validation.checksum.range must contain two integers`);
    }
  }

  return errors;
}

/**
 * 把可能为负的字节位置解析成绝对下标。
 *
 * @param {number} position 声明的位置，负数表示从帧尾倒数。
 * @param {number} length 帧长度。
 * @returns {number} 绝对下标。
 */
function resolveBytePosition(position, length) {
  return position < 0 ? length + position : position;
}

/**
 * 计算指定字节区间的校验和。
 *
 * @param {string} type 校验和类型。
 * @param {Buffer | number[]} frame 帧字节。
 * @param {number} [start] 起始下标（含），缺省为 0。
 * @param {number} [end] 结束下标（不含），缺省为帧尾。
 * @returns {number} 校验和。
 */
function computeChecksum(type, frame, start, end) {
  const bytes = Buffer.isBuffer(frame) ? frame : Buffer.from(frame || []);
  const from = start == null ? 0 : start;
  const to = end == null ? bytes.length : end;
  const algorithm = normalizeChecksumType(type);

  if (algorithm === 'xor8') {
    let result = 0;
    for (let index = from; index < to; index += 1) result ^= bytes[index];
    return result & 0xff;
  }
  if (algorithm === 'crc16-modbus') {
    let crc = 0xffff;
    for (let index = from; index < to; index += 1) {
      crc ^= bytes[index];
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc & 1) === 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
      }
    }
    return crc & 0xffff;
  }
  let result = 0;
  for (let index = from; index < to; index += 1) result += bytes[index];
  return result & 0xff;
}

/**
 * 校验一帧是否符合协议声明的帧头与校验和。
 *
 * 未声明 `protocol.validation` 时直接放行，因此对既有 manifest 无影响。
 *
 * `reason` 是稳定的短码（`header` / `checksum` / `length`），适合当作丢帧计数的
 * 分类键；`detail` 是给日志看的说明，措辞可以改而不影响统计口径。
 *
 * @param {Buffer | number[]} frame 原始帧。
 * @param {object} protocol 协议配置。
 * @returns {{ ok: boolean, reason: string | null, detail?: string }} 校验结果。
 */
function validateFrame(frame, protocol) {
  const normalized = normalizeProtocolConfig(protocol);
  const validation = normalized?.validation;
  if (!validation) return { ok: true, reason: null };

  const bytes = Buffer.from(frame || []);

  if (validation.header.length > 0) {
    const start = validation.headerOffset;
    if (bytes.length < start + validation.header.length) {
      return { ok: false, reason: 'length', detail: 'frame shorter than declared header' };
    }
    for (let index = 0; index < validation.header.length; index += 1) {
      if (bytes[start + index] !== validation.header[index]) {
        return { ok: false, reason: 'header', detail: 'header mismatch' };
      }
    }
  }

  const { checksum } = validation;
  if (checksum) {
    const width = getChecksumWidth(checksum.type);
    const offset = resolveBytePosition(checksum.byteOffset, bytes.length) - (width - 1);
    if (offset < 0 || offset + width > bytes.length) {
      return { ok: false, reason: 'length', detail: 'checksum offset outside frame' };
    }
    const rangeStart = checksum.range
      ? resolveBytePosition(checksum.range[0], bytes.length)
      : 0;
    const rangeEnd = checksum.range
      ? resolveBytePosition(checksum.range[1], bytes.length)
      : offset;
    if (rangeStart < 0 || rangeEnd > bytes.length || rangeStart > rangeEnd) {
      return { ok: false, reason: 'length', detail: 'checksum range outside frame' };
    }
    const expected = computeChecksum(checksum.type, bytes, rangeStart, rangeEnd);
    const actual = width === 2 ? bytes.readUInt16LE(offset) : bytes.readUInt8(offset);
    if (expected !== actual) {
      return { ok: false, reason: 'checksum', detail: 'checksum mismatch' };
    }
  }

  return { ok: true, reason: null };
}

/**
 * 按位展开字节，低位在前（bit0 是每个字节的第一个值）。
 *
 * 低位在前是 8 位开关量最常见的排布：设备侧通常按 `flags |= 1 << index` 置位。
 *
 * @param {Buffer} bytes 帧字节。
 * @param {number} byteOffset 起始字节。
 * @param {number | null} valueCount 需要的位数，null 表示取到帧尾。
 * @returns {number[]} 0/1 数组。
 */
function decodeBitValues(bytes, byteOffset, valueCount) {
  const availableBits = Math.max(0, (bytes.length - byteOffset) * 8);
  const count = valueCount == null ? availableBits : Math.min(valueCount, availableBits);
  const values = [];

  for (let index = 0; index < count; index += 1) {
    const byte = bytes.readUInt8(byteOffset + Math.floor(index / 8));
    values.push((byte >> (index % 8)) & 1);
  }

  return values;
}

function decodeProtocolValues(frame, protocol) {
  const normalized = normalizeProtocolConfig(protocol);
  const bytes = Buffer.from(frame || []);
  if (!normalized) return Array.from(bytes);

  const { byteOffset, valueCount, valueType } = normalized.decoding;
  const reader = VALUE_TYPE_READERS[valueType] || VALUE_TYPE_READERS.uint8;

  if (reader.bits) return decodeBitValues(bytes, byteOffset, valueCount);

  const availableCount = Math.max(0, Math.floor((bytes.length - byteOffset) / reader.width));
  const count = valueCount == null ? availableCount : Math.min(valueCount, availableCount);
  const values = [];

  for (let index = 0; index < count; index += 1) {
    values.push(reader.read(bytes, byteOffset + index * reader.width));
  }

  return values;
}

module.exports = {
  PROTOCOL_CHECKSUM_TYPES,
  PROTOCOL_FRAMING_TYPES,
  PROTOCOL_VALUE_TYPES,
  computeChecksum,
  decodeProtocolValues,
  normalizeProtocolConfig,
  parseByteSequence,
  validateFrame,
  validateProtocolConfig,
};
