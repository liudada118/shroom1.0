const assert = require('assert');
const {
  computeChecksum,
  decodeProtocolValues,
  normalizeProtocolConfig,
  validateFrame,
  validateProtocolConfig,
} = require('@shroom/backend/protocol/displaySystemProtocol.js');

// ---------------------------------------------------------------------------
// 新数据类型
// ---------------------------------------------------------------------------
const u32 = normalizeProtocolConfig({
  framing: { type: 'fixedLength', frameLength: 8 },
  decoding: { valueType: 'uint32le', valueCount: 2 },
});
assert.deepStrictEqual(
  decodeProtocolValues(Buffer.from([1, 0, 0, 0, 2, 0, 0, 0]), u32),
  [1, 2],
);

const f32 = normalizeProtocolConfig({
  framing: { type: 'fixedLength', frameLength: 8 },
  decoding: { valueType: 'float32le', valueCount: 2 },
});
const floatFrame = Buffer.alloc(8);
floatFrame.writeFloatLE(1.5, 0);
floatFrame.writeFloatLE(-2.25, 4);
assert.deepStrictEqual(decodeProtocolValues(floatFrame, f32), [1.5, -2.25]);

// 位域：每字节按位展开，用于开关量/占位传感器。
const bitfield = normalizeProtocolConfig({
  framing: { type: 'fixedLength', frameLength: 1 },
  decoding: { valueType: 'bit', valueCount: 8 },
});
assert.deepStrictEqual(
  decodeProtocolValues(Buffer.from([0b10100001]), bitfield),
  [1, 0, 0, 0, 0, 1, 0, 1],
);

// valueCount 省略时按可用字节推导，长度不足不抛错、只解出能解的部分。
const partial = normalizeProtocolConfig({
  framing: { type: 'fixedLength', frameLength: 8 },
  decoding: { valueType: 'uint16le' },
});
assert.deepStrictEqual(decodeProtocolValues(Buffer.from([1, 0, 2, 0, 3]), partial), [1, 2]);

// 旧类型不能回归。
const legacy = normalizeProtocolConfig({
  framing: { type: 'fixedLength', frameLength: 4 },
  decoding: { valueType: 'int16be', valueCount: 2 },
});
assert.deepStrictEqual(decodeProtocolValues(Buffer.from([255, 255, 0, 5]), legacy), [-1, 5]);

// ---------------------------------------------------------------------------
// checksum 算法
// ---------------------------------------------------------------------------
assert.strictEqual(computeChecksum('sum8', Buffer.from([1, 2, 3])), 6);
assert.strictEqual(computeChecksum('sum8', Buffer.from([200, 100])), 44); // 300 & 0xFF
assert.strictEqual(computeChecksum('xor8', Buffer.from([0x0F, 0xF0])), 0xFF);
// CRC16-Modbus 的标准测试向量 "123456789" -> 0x4B37
assert.strictEqual(computeChecksum('crc16modbus', Buffer.from('123456789', 'ascii')), 0x4B37);

// ---------------------------------------------------------------------------
// 帧校验：帧头 + 校验和
// ---------------------------------------------------------------------------
const guarded = normalizeProtocolConfig({
  framing: { type: 'fixedLength', frameLength: 6 },
  decoding: { valueType: 'uint8', byteOffset: 2, valueCount: 3 },
  validation: {
    header: [0xAA, 0x55],
    checksum: { type: 'sum8', byteOffset: 5, range: { start: 2, end: 5 } },
  },
});

const good = Buffer.from([0xAA, 0x55, 1, 2, 3, 6]);
assert.deepStrictEqual(validateFrame(good, guarded), { ok: true, reason: null });
assert.deepStrictEqual(decodeProtocolValues(good, guarded), [1, 2, 3]);

// 帧头不对：拒绝，并说明原因（诊断要能定位到是帧头还是校验和）。
const badHeader = Buffer.from([0xAB, 0x55, 1, 2, 3, 6]);
assert.strictEqual(validateFrame(badHeader, guarded).ok, false);
assert.strictEqual(validateFrame(badHeader, guarded).reason, 'header');

// 校验和不对：拒绝。
const badChecksum = Buffer.from([0xAA, 0x55, 1, 2, 3, 7]);
assert.strictEqual(validateFrame(badChecksum, guarded).ok, false);
assert.strictEqual(validateFrame(badChecksum, guarded).reason, 'checksum');

// 长度不足以覆盖校验字节：拒绝，不要读越界当成 0 通过。
assert.strictEqual(validateFrame(Buffer.from([0xAA, 0x55, 1]), guarded).ok, false);

// 没配 validation 的老 manifest 一律放行，保持向后兼容。
assert.deepStrictEqual(
  validateFrame(Buffer.from([9, 9, 9]), legacy),
  { ok: true, reason: null },
);

// ---------------------------------------------------------------------------
// 配置校验
// ---------------------------------------------------------------------------
assert.deepStrictEqual(validateProtocolConfig({
  baudRate: 921600,
  framing: { type: 'fixedLength', frameLength: 6 },
  decoding: { valueType: 'uint8', valueCount: 6 },
  validation: {
    header: [0xAA, 0x55],
    checksum: { type: 'sum8', byteOffset: 5, range: { start: 2, end: 5 } },
  },
}, { source: 'p' }), []);

// 未知校验算法要报错，不能静默退化成「不校验」。
assert.ok(validateProtocolConfig({
  framing: { type: 'fixedLength', frameLength: 6 },
  decoding: { valueType: 'uint8' },
  validation: { checksum: { type: 'md5', byteOffset: 5 } },
}, { source: 'p' }).some((message) => message.includes('checksum.type')));

// 未知数据类型要报错。
assert.ok(validateProtocolConfig({
  framing: { type: 'fixedLength', frameLength: 6 },
  decoding: { valueType: 'float128' },
}, { source: 'p' }).some((message) => message.includes('valueType')));

// 帧头字节必须是 0-255。
assert.ok(validateProtocolConfig({
  framing: { type: 'fixedLength', frameLength: 6 },
  decoding: { valueType: 'uint8' },
  validation: { header: [256] },
}, { source: 'p' }).some((message) => message.includes('header')));

console.log('protocolValidation.test.js passed');
