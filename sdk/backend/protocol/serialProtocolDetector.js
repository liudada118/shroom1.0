const {
  PROTOCOL_FRAMING_TYPES,
  PROTOCOL_VALUE_TYPE_WIDTHS,
  normalizeProtocolConfig,
  validateFrame,
} = require('./displaySystemProtocol');

const DEFAULT_MIN_COMPLETE_FRAMES = 5;
const DEFAULT_MIN_MATCH_RATIO = 0.8;

/**
 * 把一次探测收到的多个 data chunk 合成字节流。
 *
 * 探测器刻意不接入 SerialManager/DelimiterParser：它只看临时串口的原始字节，
 * 因而 delimiter 被拆在两个 chunk 之间时也能正确识别。
 */
function normalizeCapture(capture) {
  if (Buffer.isBuffer(capture)) return capture;
  if (capture == null) return Buffer.alloc(0);
  if (!Array.isArray(capture)) return Buffer.from(capture);
  return Buffer.concat(capture.map((chunk) => Buffer.from(chunk || [])));
}

/**
 * 只返回两个 delimiter 之间的完整片段。
 *
 * 串口可能在任意字节处开始/停止采样，所以第一个 delimiter 前和最后一个
 * delimiter 后的片段都不参与判断，避免把首尾残帧误算成协议不匹配。
 */
function splitCompleteFrames(capture, delimiter) {
  const bytes = normalizeCapture(capture);
  const marker = Buffer.from(delimiter || []);
  if (!marker.length || bytes.length < marker.length * 2) return [];

  const frames = [];
  let previousDelimiter = bytes.indexOf(marker);
  if (previousDelimiter < 0) return frames;

  let frameStart = previousDelimiter + marker.length;
  while (frameStart <= bytes.length - marker.length) {
    const nextDelimiter = bytes.indexOf(marker, frameStart);
    if (nextDelimiter < 0) break;
    frames.push(bytes.subarray(frameStart, nextDelimiter));
    frameStart = nextDelimiter + marker.length;
  }
  return frames;
}

/**
 * 返回 delimiter 协议在字节流中可观察到的 payload 长度。
 *
 * fixedLength 没有帧头/帧尾时，任意偏移都能被切成“正确长度”，不能据此猜协议；
 * valueCount 为空时也没有精确长度证据，因此两类候选都不进入自动识别。
 */
function getDetectablePayloadLength(protocol) {
  const normalized = normalizeProtocolConfig(protocol);
  if (!normalized || normalized.framing.type !== PROTOCOL_FRAMING_TYPES.DELIMITER) return null;
  if (!normalized.framing.delimiter.length) return null;

  const { valueType, byteOffset, valueCount } = normalized.decoding;
  const width = PROTOCOL_VALUE_TYPE_WIDTHS[valueType];
  if (!Number.isInteger(width) || !Number.isInteger(valueCount) || valueCount <= 0) return null;
  // bit 会在解码时把一个字节展开成 8 个点，不能按普通 valueType 的一值一字节计算。
  const decodedByteLength = valueType === 'bit'
    ? Math.ceil(valueCount / 8)
    : width * valueCount;
  let payloadLength = byteOffset + decodedByteLength;
  const validation = normalized.validation;
  if (validation?.header?.length) {
    payloadLength = Math.max(
      payloadLength,
      validation.headerOffset + validation.header.length,
    );
  }
  if (validation?.checksum) {
    const checksumWidth = validation.checksum.type === 'crc16-modbus' ? 2 : 1;
    if (validation.checksum.byteOffset >= 0) {
      // checksum.byteOffset 指向校验字段的最后一个字节。
      payloadLength = Math.max(payloadLength, validation.checksum.byteOffset + 1);
    } else {
      const delimiterWidth = normalized.framing.includeDelimiter
        ? normalized.framing.delimiter.length
        : 0;
      // 负偏移落在 payload 尾部时，校验字段通常紧跟解码数据；把它计入精确帧长。
      if (validation.checksum.byteOffset <= -(delimiterWidth + 1)) {
        payloadLength += checksumWidth;
      }
    }
  }
  return payloadLength;
}

function isDetectableProtocolPreset(preset) {
  return Boolean(
    preset
    && Number.isInteger(Number(preset.protocol?.baudRate))
    && Number(preset.protocol.baudRate) > 0
    && getDetectablePayloadLength(preset.protocol) != null,
  );
}

/**
 * 对一个候选协议评分。只有完整帧数和有效帧比例同时达标才算匹配。
 */
function scoreProtocolCapture(capture, preset, {
  minCompleteFrames = DEFAULT_MIN_COMPLETE_FRAMES,
  minMatchRatio = DEFAULT_MIN_MATCH_RATIO,
} = {}) {
  const protocol = normalizeProtocolConfig(preset?.protocol);
  const expectedPayloadLength = getDetectablePayloadLength(protocol);
  if (!protocol || expectedPayloadLength == null) {
    return {
      preset,
      detectable: false,
      matched: false,
      completeFrames: 0,
      exactLengthFrames: 0,
      validFrames: 0,
      matchRatio: 0,
      expectedPayloadLength: null,
    };
  }

  const frames = splitCompleteFrames(capture, protocol.framing.delimiter);
  let exactLengthFrames = 0;
  let validFrames = 0;
  frames.forEach((frame) => {
    if (frame.length !== expectedPayloadLength) return;
    exactLengthFrames += 1;
    const frameForValidation = protocol.framing.includeDelimiter
      ? Buffer.concat([frame, Buffer.from(protocol.framing.delimiter)])
      : frame;
    if (validateFrame(frameForValidation, protocol).ok) validFrames += 1;
  });

  const matchRatio = frames.length > 0 ? validFrames / frames.length : 0;
  return {
    preset,
    detectable: true,
    matched: validFrames >= minCompleteFrames && matchRatio >= minMatchRatio,
    completeFrames: frames.length,
    exactLengthFrames,
    validFrames,
    matchRatio,
    expectedPayloadLength,
  };
}

function readBaudCapture(capturesByBaud, baudRate) {
  if (capturesByBaud instanceof Map) return capturesByBaud.get(baudRate);
  return capturesByBaud?.[baudRate] ?? capturesByBaud?.[String(baudRate)];
}

function summarizeScore(score) {
  return {
    id: score.preset.id,
    label: score.preset.label,
    baudRate: Number(score.preset.protocol.baudRate),
    completeFrames: score.completeFrames,
    exactLengthFrames: score.exactLengthFrames,
    validFrames: score.validFrames,
    matchRatio: score.matchRatio,
    expectedPayloadLength: score.expectedPayloadLength,
  };
}

/**
 * 在按 baudRate 收集的原始字节中识别预设。
 *
 * 返回值不按列表顺序“挑第一个”：同时通过的候选一律 ambiguous。这样两个
 * 不同 id 如果拥有同一个可观察 wire signature，也不会被静默猜成其中一个。
 */
function detectProtocolFromCaptures({
  presets = [],
  capturesByBaud = new Map(),
  minCompleteFrames = DEFAULT_MIN_COMPLETE_FRAMES,
  minMatchRatio = DEFAULT_MIN_MATCH_RATIO,
} = {}) {
  const scores = presets
    .filter(isDetectableProtocolPreset)
    .map((preset) => scoreProtocolCapture(
      readBaudCapture(capturesByBaud, Number(preset.protocol.baudRate)),
      preset,
      { minCompleteFrames, minMatchRatio },
    ));
  const matches = scores.filter((score) => score.matched);

  if (matches.length === 1) {
    return {
      status: 'matched',
      reason: 'unique-match',
      match: matches[0].preset,
      evidence: summarizeScore(matches[0]),
      candidates: [],
      scores: scores.map(summarizeScore),
    };
  }

  if (matches.length > 1) {
    return {
      status: 'ambiguous',
      reason: 'multiple-matches',
      match: null,
      candidates: matches.map((score) => ({
        ...score.preset,
        evidence: summarizeScore(score),
      })),
      scores: scores.map(summarizeScore),
    };
  }

  const capturedBytes = [...new Set(
    presets.filter(isDetectableProtocolPreset).map((preset) => Number(preset.protocol.baudRate)),
  )].reduce((total, baudRate) => total + normalizeCapture(readBaudCapture(capturesByBaud, baudRate)).length, 0);

  return {
    status: 'unknown',
    reason: capturedBytes === 0 ? 'insufficient-data' : 'no-match',
    match: null,
    candidates: [],
    scores: scores.map(summarizeScore),
  };
}

module.exports = {
  DEFAULT_MIN_COMPLETE_FRAMES,
  DEFAULT_MIN_MATCH_RATIO,
  detectProtocolFromCaptures,
  getDetectablePayloadLength,
  isDetectableProtocolPreset,
  normalizeCapture,
  scoreProtocolCapture,
  splitCompleteFrames,
};
