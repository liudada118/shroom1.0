const PROTOCOL_FRAMING_TYPES = Object.freeze({
  DELIMITER: 'delimiter',
  FIXED_LENGTH: 'fixedLength',
});

const PROTOCOL_VALUE_TYPES = Object.freeze([
  'uint8',
  'int8',
  'uint16le',
  'uint16be',
  'int16le',
  'int16be',
]);

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

function normalizeProtocolConfig(protocol) {
  if (!protocol || typeof protocol !== 'object' || Array.isArray(protocol)) return null;

  const rawFraming = typeof protocol.framing === 'string'
    ? { type: protocol.framing }
    : (protocol.framing || {});
  const type = rawFraming.type || PROTOCOL_FRAMING_TYPES.DELIMITER;
  const decoding = protocol.decoding || {};

  return {
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

  return errors;
}

function decodeProtocolValues(frame, protocol) {
  const normalized = normalizeProtocolConfig(protocol);
  const bytes = Buffer.from(frame || []);
  if (!normalized) return Array.from(bytes);

  const { byteOffset, valueCount, valueType } = normalized.decoding;
  const width = valueType.endsWith('16le') || valueType.endsWith('16be') ? 2 : 1;
  const availableCount = Math.max(0, Math.floor((bytes.length - byteOffset) / width));
  const count = valueCount == null ? availableCount : Math.min(valueCount, availableCount);
  const values = [];

  for (let index = 0; index < count; index += 1) {
    const offset = byteOffset + index * width;
    if (valueType === 'int8') values.push(bytes.readInt8(offset));
    else if (valueType === 'uint16le') values.push(bytes.readUInt16LE(offset));
    else if (valueType === 'uint16be') values.push(bytes.readUInt16BE(offset));
    else if (valueType === 'int16le') values.push(bytes.readInt16LE(offset));
    else if (valueType === 'int16be') values.push(bytes.readInt16BE(offset));
    else values.push(bytes.readUInt8(offset));
  }

  return values;
}

module.exports = {
  PROTOCOL_FRAMING_TYPES,
  PROTOCOL_VALUE_TYPES,
  decodeProtocolValues,
  normalizeProtocolConfig,
  parseByteSequence,
  validateProtocolConfig,
};
