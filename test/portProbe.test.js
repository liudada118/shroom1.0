const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPortProbe,
  analyzeSample,
  formatProbeResult,
  candidateBaudRates,
  candidateDelimiters,
} = require('../sdk/src/serial/PortProbe');
const { resolveDelimiter } = require('../sdk/src/sensors');

const STANDARD = resolveDelimiter('standard');

/** 造一段「定界符 + payloadBytes 字节负载」重复 n 次的流。 */
function synthesize(delimiter, payloadBytes, frames, fill = 0x11) {
  const parts = [];
  for (let i = 0; i < frames; i += 1) {
    parts.push(delimiter, Buffer.alloc(payloadBytes, fill));
  }
  return Buffer.concat(parts);
}

test('没有数据时说清楚是「口能开但没字节」', () => {
  const r = analyzeSample(Buffer.alloc(0), { baudRate: 1000000, windowMs: 600 });
  assert.equal(r.verdict, 'no-data');
  assert.match(r.reason, /没上电|TX|传感器口/);
  assert.deepEqual(r.candidates, []);
});

test('标准定界 + 256 字节负载能认成 16x16 手套', () => {
  const buffer = synthesize(STANDARD, 256, 20);
  const r = analyzeSample(buffer, { baudRate: 921600, windowMs: 500 });
  assert.equal(r.verdict, 'identified');
  assert.equal(r.payloadBytes, 256);
  assert.equal(r.frameStrideBytes, 260);
  assert.ok(r.candidates.includes('hand0205'));
  assert.equal(r.hz, 38); // 19 帧 / 0.5 s
});

test('已知波特率会收窄候选 —— 921600 下不该再列 handGlove115200', () => {
  const buffer = synthesize(STANDARD, 256, 20);
  const fast = analyzeSample(buffer, { baudRate: 921600, windowMs: 500 });
  assert.ok(!fast.candidates.includes('handGlove115200'), '这个型号只跑 115200');
  assert.ok(fast.candidates.includes('hand0205'));

  const slow = analyzeSample(buffer, { baudRate: 115200, windowMs: 500 });
  assert.deepEqual(slow.candidates, ['handGlove115200']);
});

test('波特率一个都对不上时保留全部候选，不空手', () => {
  const r = analyzeSample(synthesize(STANDARD, 256, 20), { baudRate: 57600, windowMs: 500 });
  assert.ok(r.candidates.length >= 4, '宁可多列几个让人自己判，也别报「不认识」');
});

test('1024 字节负载能认成 32x32 那几个候选，而不是硬选一个', () => {
  const r = analyzeSample(synthesize(STANDARD, 1024, 10), { baudRate: 1000000, windowMs: 600 });
  assert.equal(r.verdict, 'identified');
  assert.ok(r.candidates.length > 1, '1024 点有多个类型共用，应该都列出来');
  assert.ok(r.candidates.includes('hand'));
  assert.ok(r.candidates.includes('fast1024'));
});

test('4096 字节负载认成 64x64 床垫', () => {
  const r = analyzeSample(synthesize(STANDARD, 4096, 6), { baudRate: 3000000, windowMs: 600 });
  assert.equal(r.verdict, 'identified');
  assert.ok(r.candidates.includes('bed4096'));
});

test('帧长陌生时明说是新型号或波特率不对，不硬套', () => {
  const r = analyzeSample(synthesize(STANDARD, 333, 10), { baudRate: 1000000, windowMs: 600 });
  assert.equal(r.verdict, 'unknown-frame-length');
  assert.deepEqual(r.candidates, []);
  assert.match(r.reason, /新型号|波特率/);
});

test('乱码（波特率不对）不会被认成任何传感器，并给出前 16 字节', () => {
  const noise = Buffer.alloc(4096);
  for (let i = 0; i < noise.length; i += 1) noise[i] = (i * 37 + 13) % 251;
  const r = analyzeSample(noise, { baudRate: 115200, windowMs: 600 });
  assert.equal(r.verdict, 'unrecognized');
  assert.equal(r.firstBytesHex.length, 32);
  assert.match(r.reason, /波特率/);
});

test('定界符只出现一两次不算找到帧结构 —— 免得拿噪声量帧长', () => {
  const buffer = Buffer.concat([
    Buffer.alloc(50, 0x01), STANDARD, Buffer.alloc(50, 0x02), STANDARD, Buffer.alloc(50, 0x03),
  ]);
  const r = analyzeSample(buffer, { baudRate: 1000000, windowMs: 600 });
  assert.equal(r.verdict, 'unrecognized');
});

test('偶发丢字节不会带偏帧长（取众数间隔）', () => {
  const clean = synthesize(STANDARD, 256, 12);
  // 抠掉一个定界符，制造一个双倍间隔
  const broken = Buffer.concat([
    clean.subarray(0, 260 * 5),
    clean.subarray(260 * 5 + 4),
  ]);
  const r = analyzeSample(broken, { baudRate: 921600, windowMs: 600 });
  assert.equal(r.verdict, 'identified');
  assert.equal(r.payloadBytes, 256, '一个坏间隔不应该改变结论');
});

test('文本协议（民振的 yroscope:）能被认出来', () => {
  const line = 'Gyroscope: 1,2,3\r\n' + '0,'.repeat(100) + '\r\n';
  const r = analyzeSample(Buffer.from(line.repeat(8), 'latin1'), { baudRate: 115200, windowMs: 800 });
  assert.equal(r.verdict, 'identified');
  assert.equal(r.protocolKind, 'text');
  assert.deepEqual(r.candidates, ['minzhen']);
  assert.equal(r.frameCount, 8);
  assert.equal(r.hz, 10);
});

test('候选波特率覆盖注册表里出现过的全部值', () => {
  const bauds = candidateBaudRates();
  [115200, 921600, 1000000, 1500000, 3000000].forEach((b) => {
    assert.ok(bauds.includes(b), `缺波特率 ${b}`);
  });
  assert.equal(new Set(bauds).size, bauds.length, '不该有重复');
  assert.equal(bauds[0], 1000000, '最常见的应该排第一，减少探测耗时');
});

test('候选定界符去重且包含标准帧头与小床帧尾', () => {
  const hexes = candidateDelimiters().map((d) => d.bytes.toString('hex'));
  assert.ok(hexes.includes('aa550399'));
  assert.ok(hexes.includes('aa005500030099 00'.replace(/\s/g, '')));
  assert.equal(new Set(hexes).size, hexes.length);
});

test('probePort 试到第一个能认出来的波特率就停', () => {
  const tried = [];
  const probe = createPortProbe({
    windowMs: 500,
    openPort: async (path, baudRate) => {
      tried.push(baudRate);
      // 只有 921600 下才是干净的手套帧，其余是噪声
      if (baudRate !== 921600) return Buffer.alloc(2048, 0x5a);
      return synthesize(STANDARD, 256, 20);
    },
  });
  return probe.probePort('COM36').then((r) => {
    assert.equal(r.verdict, 'identified');
    assert.equal(r.baudRate, 921600);
    assert.ok(r.candidates.includes('hand0205'));
    assert.equal(tried[tried.length - 1], 921600, '认出来之后就不该再试后面的波特率');
  });
});

test('全都认不出时，返回信息量最大的那次而不是最后一次', async () => {
  const probe = createPortProbe({
    windowMs: 500,
    // 第一个波特率有乱码数据，之后的都没数据 —— 应该报「有数据但认不出」
    openPort: async (path, baudRate) =>
      (baudRate === 1000000 ? Buffer.alloc(2048, 0x5a) : Buffer.alloc(0)),
  });
  const r = await probe.probePort('COM36');
  assert.equal(r.verdict, 'unrecognized');
  assert.equal(r.baudRate, 1000000);
});

test('打不开口时不抛错，而是把系统错误原文带回来', async () => {
  const probe = createPortProbe({
    windowMs: 10,
    openPort: async () => { throw new Error('Access denied'); },
  });
  const r = await probe.probePort('COM36', { baudRates: [1000000] });
  assert.equal(r.verdict, 'open-failed');
  assert.match(r.reason, /Access denied/);
  assert.match(formatProbeResult('COM36', r), /打不开.*Access denied/);
});

test('formatProbeResult 渲染出人能直接读的一行', () => {
  const identified = analyzeSample(synthesize(STANDARD, 256, 20), { baudRate: 921600, windowMs: 500 });
  const line = formatProbeResult('COM36', identified);
  assert.match(line, /^COM36 {2}✓/);
  assert.match(line, /16x16/);
  assert.match(line, /921600 baud/);
  assert.match(line, /38 Hz/);

  const empty = analyzeSample(Buffer.alloc(0), { baudRate: 1000000, windowMs: 500 });
  assert.match(formatProbeResult('COM3', empty), /^COM3 {2}✗ 无数据/);
});

test('未验证画像的候选会被打上标记，不冒充可用', () => {
  const r = {
    verdict: 'identified', baudRate: 115200, hz: 10, candidates: ['minzhen'],
  };
  assert.match(formatProbeResult('COM7', r), /未验证画像/);
});
