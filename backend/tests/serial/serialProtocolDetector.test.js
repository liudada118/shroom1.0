const assert = require('assert');
const {
  detectProtocolFromCaptures,
  getDetectablePayloadLength,
  isDetectableProtocolPreset,
  splitCompleteFrames,
} = require('@shroom/backend/protocol/serialProtocolDetector.js');
const { loadSerialProtocolPresets } = require('@shroom/backend/protocol/presets/index.js');

const DELIMITER = Buffer.from([0xaa, 0x55, 0x03, 0x99]);

function buildCapture(payloadLength, { validFrames = 5, invalidFrames = 0 } = {}) {
  const parts = [Buffer.from([0x44, 0x45]), DELIMITER];
  for (let index = 0; index < validFrames; index += 1) {
    parts.push(Buffer.alloc(payloadLength, (index % 0x40) + 1), DELIMITER);
  }
  for (let index = 0; index < invalidFrames; index += 1) {
    parts.push(Buffer.alloc(payloadLength - 1, 0x66), DELIMITER);
  }
  parts.push(Buffer.from([0x77, 0x78, 0x79]));
  return Buffer.concat(parts);
}

function splitAcrossDelimiter(capture) {
  const firstDelimiter = capture.indexOf(DELIMITER);
  return [
    capture.subarray(0, firstDelimiter + 2),
    capture.subarray(firstDelimiter + 2, firstDelimiter + 3),
    capture.subarray(firstDelimiter + 3, firstDelimiter + 100),
    capture.subarray(firstDelimiter + 100),
  ];
}

function main() {
  const presets = loadSerialProtocolPresets().presets;
  const standard = presets.find((preset) => preset.id === 'standard-1024');
  assert.ok(standard);

  const capture = buildCapture(1024, { validFrames: 5 });
  const chunks = splitAcrossDelimiter(capture);
  assert.strictEqual(splitCompleteFrames(chunks, DELIMITER).length, 5);

  const matched = detectProtocolFromCaptures({
    presets,
    capturesByBaud: new Map([[1000000, chunks]]),
  });
  assert.strictEqual(matched.status, 'matched');
  assert.strictEqual(matched.match.id, 'standard-1024');
  assert.deepStrictEqual(matched.match.protocol.framing.delimiter, [170, 85, 3, 153]);
  assert.strictEqual(matched.match.protocol.validation, null);
  assert.strictEqual(matched.evidence.validFrames, 5);
  assert.strictEqual(matched.evidence.matchRatio, 1);

  // 5 个好帧 + 1 个坏长度仍达到 0.8；再多一个坏帧则比例不足，不能猜。
  const tolerant = detectProtocolFromCaptures({
    presets: [standard],
    capturesByBaud: { 1000000: buildCapture(1024, { validFrames: 5, invalidFrames: 1 }) },
  });
  assert.strictEqual(tolerant.status, 'matched');
  const noisy = detectProtocolFromCaptures({
    presets: [standard],
    capturesByBaud: { 1000000: buildCapture(1024, { validFrames: 5, invalidFrames: 2 }) },
  });
  assert.strictEqual(noisy.status, 'unknown');
  assert.strictEqual(noisy.reason, 'no-match');

  const duplicate = {
    ...standard,
    id: 'standard-1024-copy',
    label: 'same bytes, different meaning',
    protocol: JSON.parse(JSON.stringify(standard.protocol)),
  };
  const ambiguous = detectProtocolFromCaptures({
    presets: [standard, duplicate],
    capturesByBaud: { 1000000: capture },
  });
  assert.strictEqual(ambiguous.status, 'ambiguous');
  assert.deepStrictEqual(ambiguous.candidates.map((candidate) => candidate.id), [
    'standard-1024',
    'standard-1024-copy',
  ]);
  assert.strictEqual(ambiguous.match, null);

  const fixedLength = {
    id: 'fixed-without-boundary',
    label: 'fixed',
    protocol: {
      baudRate: 115200,
      framing: { type: 'fixedLength', frameLength: 64 },
      decoding: { valueType: 'uint8', byteOffset: 0, valueCount: 64 },
    },
  };
  assert.strictEqual(isDetectableProtocolPreset(fixedLength), false);
  assert.strictEqual(getDetectablePayloadLength({
    baudRate: 115200,
    framing: { type: 'delimiter', delimiter: [0xaa] },
    decoding: { valueType: 'bit', byteOffset: 2, valueCount: 9 },
  }), 4, '9 bit values need two payload bytes after the byte offset');
  const checksumPreset = {
    id: 'checksum-tail',
    label: 'checksum tail',
    protocol: {
      baudRate: 115200,
      framing: { type: 'delimiter', delimiter: [0xaa], includeDelimiter: false },
      decoding: { valueType: 'uint8', byteOffset: 0, valueCount: 4 },
      validation: { checksum: { type: 'xor8', byteOffset: -1 } },
    },
  };
  assert.strictEqual(getDetectablePayloadLength(checksumPreset.protocol), 5);
  const checksumCapture = Buffer.concat([
    Buffer.from([0x00, 0xaa]),
    ...Array.from({ length: 5 }, () => Buffer.from([1, 2, 3, 4, 4, 0xaa])),
  ]);
  assert.strictEqual(detectProtocolFromCaptures({
    presets: [checksumPreset],
    capturesByBaud: { 115200: checksumCapture },
  }).status, 'matched');
  const fixedResult = detectProtocolFromCaptures({
    presets: [fixedLength],
    capturesByBaud: { 115200: Buffer.alloc(640, 1) },
  });
  assert.strictEqual(fixedResult.status, 'unknown');
  assert.strictEqual(fixedResult.reason, 'insufficient-data');

  const noData = detectProtocolFromCaptures({
    presets: [standard],
    capturesByBaud: { 1000000: Buffer.alloc(0) },
  });
  assert.strictEqual(noData.status, 'unknown');
  assert.strictEqual(noData.reason, 'insufficient-data');
}

main();
console.log('serialProtocolDetector.test.js passed');
