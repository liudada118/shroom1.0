const { getSensorBaudRate } = require('@shroom/backend/sensors/registry.js');
const { detectProtocolFromCaptures, splitCompleteFrames } = require('@shroom/backend/protocol/serialProtocolDetector.js');

const CONNECTION_BAUD_RATES = Object.freeze([921600, 1000000, 1500000, 3000000, 6000000]);
const STANDARD_DELIMITER = [170, 85, 3, 153];
const BUILTIN_PRESETS = ['matrix-256', 'standard-1024', 'small-bed-12b', 'bed-4096', 'low-density-72', 'low-density-144']
  .map(id => require(`@shroom/backend/protocol/presets/${id}.json`));
const COMPATIBLE_PROTOCOLS = {
  fast256: ['matrix-256', 'glove-segmented'],
  hand0205: ['glove-segmented'], hand0205Single: ['glove-segmented'], hand0205Double: ['glove-segmented'],
  hand: ['standard-1024'], handSinglePoint: ['standard-1024'],
  smallBed: ['standard-1024'], smallBedNoAlg: ['standard-1024'], smallBed1: ['standard-1024'],
  smallBed12B: ['small-bed-12b'],
  fast1024: ['standard-1024'], fast1024sit: ['standard-1024'], normalFast: ['standard-1024'],
  bed4096: ['bed-4096'], bed4096num: ['bed-4096'],
  humanBody: ['standard-1024'], humanBodyOptimized: ['standard-1024'], pressureVest: ['standard-1024'],
};

/** 返回原生入口已经支持的线协议；未知入口保持原连接流程，不根据点数猜协议。 */
function getNativeDetectionConfig(connection) {
  const sensorType = String(connection?.sensorType || '');
  const compatibleIds = COMPATIBLE_PROTOCOLS[sensorType];
  if (!compatibleIds || !['sit', 'back'].includes(connection?.role || 'sit')) return null;
  const defaultBaudRate = getSensorBaudRate(sensorType);
  return { sensorType, compatibleIds, defaultBaudRate,
    baudRates: [defaultBaudRate, ...CONNECTION_BAUD_RATES.filter(rate => rate !== defaultBaudRate)] };
}

/** 用连续同手侧首尾包及有限IMU值识别手套；只有半包或随机字节不能确认为设备。 */
function scoreGloveSegments(bytes, baudRate, { minCompleteFrames, minMatchRatio }) {
  const frames = splitCompleteFrames(bytes, STANDARD_DELIMITER);
  const pending = new Set();
  let pairs = 0;
  let matchedPackets = 0;
  for (const frame of frames) {
    if (frame.length === 1 && frame[0] === 3) continue;
    const side = frame[1];
    if (![1, 2].includes(side)) { pending.clear(); continue; }
    if (frame.length === 130 && frame[0] === 1) { pending.add(side); continue; }
    if (frame.length === 146 && frame[0] === 2 && pending.has(side)) {
      pending.delete(side);
      if (![0, 1, 2, 3].every(index => Number.isFinite(frame.readFloatLE(130 + index * 4)))) continue;
      pairs += 1;
      matchedPackets += 2;
    } else pending.delete(side);
  }
  const packetCount = frames.filter(frame => !(frame.length === 1 && frame[0] === 3)).length;
  const matchRatio = packetCount ? matchedPackets / packetCount : 0;
  return { matched: pairs >= minCompleteFrames && matchRatio >= minMatchRatio,
    preset: { id: 'glove-segmented', label: '手套分包（130 + 146 字节）', protocol: { baudRate } },
    evidence: { id: 'glove-segmented', baudRate, validFrames: pairs, completeFrames: packetCount, matchRatio } };
}

/** 在本档波特率上检查所有已知线协议；识别结果只报告兼容性，不替换系统或解析器。 */
function detectNativeCapture(bytes, baudRate, config, options) {
  const detection = detectProtocolFromCaptures({
    presets: BUILTIN_PRESETS.map(preset => ({ ...preset, protocol: { ...preset.protocol, baudRate } })),
    capturesByBaud: new Map([[baudRate, bytes]]), ...options,
  });
  const glove = scoreGloveSegments(bytes, baudRate, options);
  const matches = detection.status === 'matched' ? [{ ...detection.match, evidence: detection.evidence }]
    : detection.candidates || [];
  if (glove.matched) matches.push({ ...glove.preset, evidence: glove.evidence });
  if (matches.length === 1) {
    const match = matches[0];
    return { status: 'matched', reason: 'unique-match', match, evidence: match.evidence, candidates: [],
      compatible: config.compatibleIds.includes(match.id), protocol: match.protocol };
  }
  return { status: matches.length ? 'ambiguous' : 'unknown',
    reason: matches.length ? 'multiple-matches' : bytes.length ? 'no-match' : 'insufficient-data',
    match: null, candidates: matches, compatible: false };
}

module.exports = { CONNECTION_BAUD_RATES, getNativeDetectionConfig, detectNativeCapture };
