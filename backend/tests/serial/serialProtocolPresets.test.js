const assert = require('assert');
const path = require('path');
const {
  BUILTIN_PRESET_DIRECTORY,
  PRESET_SOURCES,
  getSerialProtocolPreset,
  loadSerialProtocolPresets,
  normalizePreset,
  resolveUserPresetDirectory,
} = require('../../serial/protocols');
const {
  decodeProtocolValues,
  validateProtocolConfig,
} = require('../../displaySystems/displaySystemProtocol');
const { createParserFromProtocol } = require('../../serial/serialParserManager');

// ---------------------------------------------------------------------------
// 内置预设：全部必须通过现有 manifest 协议校验
//
// 这条是整个预设库的地基。预设的意义就是「选中就能用」，
// 所以任何一份内置 JSON 过不了 validateProtocolConfig，都是必须当场失败的事故。
// ---------------------------------------------------------------------------
const loaded = loadSerialProtocolPresets();
assert.strictEqual(loaded.invalid.length, 0, `内置预设有校验失败的: ${JSON.stringify(loaded.invalid)}`);
assert.ok(loaded.presets.length >= 6, '内置预设数量少于预期');
assert.strictEqual(loaded.directories[0], BUILTIN_PRESET_DIRECTORY);

loaded.presets.forEach((preset) => {
  assert.strictEqual(preset.source, PRESET_SOURCES.BUILTIN);
  assert.deepStrictEqual(
    validateProtocolConfig(preset.protocol, { source: preset.id }),
    [],
    `${preset.id} 的 protocol 段校验失败`,
  );
  // 每份预设都要指向自己的字节说明文档，否则用户选中后无从查证。
  assert.ok(preset.doc.endsWith('.md'), `${preset.id} 缺少 doc`);
  assert.ok(preset.label, `${preset.id} 缺少 label`);
});

// ---------------------------------------------------------------------------
// 关键预设的字节结构：这些数字是从运行时源码里挖出来的，改动必须是有意的
// ---------------------------------------------------------------------------
const standard = getSerialProtocolPreset('standard-1024');
assert.deepStrictEqual(standard.protocol.framing.delimiter, [170, 85, 3, 153]);
assert.strictEqual(standard.protocol.framing.type, 'delimiter');
assert.strictEqual(standard.protocol.framing.includeDelimiter, false);
assert.strictEqual(standard.protocol.decoding.valueType, 'uint8');
assert.strictEqual(standard.protocol.decoding.valueCount, 1024);
assert.strictEqual(standard.protocol.baudRate, 1000000);
assert.deepStrictEqual(standard.channels, ['sit', 'back', 'head']);
assert.deepStrictEqual(standard.matrix, { width: 32, height: 32, total: 1024 });

// 小床 12B 是唯一的双字节协议，字节序配错会得到一堆看似干扰的乱跳值 —— 锁住它。
const smallBed = getSerialProtocolPreset('small-bed-12b');
assert.deepStrictEqual(smallBed.protocol.framing.delimiter, [170, 0, 85, 0, 3, 0, 153, 0]);
assert.strictEqual(smallBed.protocol.decoding.valueType, 'uint16le');
assert.strictEqual(smallBed.protocol.decoding.valueCount, 1024);
assert.strictEqual(smallBed.protocol.baudRate, 1500000);

const bed4096 = getSerialProtocolPreset('bed-4096');
assert.strictEqual(bed4096.protocol.decoding.valueCount, 4096);
assert.strictEqual(bed4096.protocol.baudRate, 3000000);
// 大床和标准帧共用同一个分隔符 —— 这不是笔误，两者只能靠帧长和类型名区分。
assert.deepStrictEqual(bed4096.protocol.framing.delimiter, standard.protocol.framing.delimiter);

// 低密度协议本身不决定矩阵形状，matrix 必须是 null 而不是瞎猜一个形状。
['low-density-72', 'low-density-144'].forEach((id) => {
  const preset = getSerialProtocolPreset(id);
  assert.strictEqual(preset.matrix, null, `${id} 不应该声明矩阵形状`);
});
assert.strictEqual(getSerialProtocolPreset('low-density-72').protocol.decoding.valueCount, 72);
assert.strictEqual(getSerialProtocolPreset('low-density-144').protocol.decoding.valueCount, 144);

assert.strictEqual(getSerialProtocolPreset('matrix-256').protocol.decoding.valueCount, 256);

// 找不到和空 id 都返回 null，不抛。
assert.strictEqual(getSerialProtocolPreset('no-such-preset'), null);
assert.strictEqual(getSerialProtocolPreset(''), null);
assert.strictEqual(getSerialProtocolPreset(null), null);

// ---------------------------------------------------------------------------
// 预设真的能驱动 parser：这是「选中就能用」的端到端证明
//
// 只断言长度和类型对得上不够 —— 得证明这份 protocol 交给
// createParserFromProtocol 能切出帧、交给 decodeProtocolValues 能解出值。
// ---------------------------------------------------------------------------
const parser = createParserFromProtocol(standard.protocol);
const frames = [];
parser.on('data', (chunk) => frames.push(decodeProtocolValues(chunk, standard.protocol.decoding)));

const delimiter = Buffer.from(standard.protocol.framing.delimiter);
const payload = Buffer.alloc(1024);
payload[0] = 7;
payload[1] = 8;
payload[1023] = 9;
parser.write(Buffer.concat([delimiter, payload, delimiter, payload, delimiter]));

assert.strictEqual(frames.length, 2, '标准预设应该切出 2 帧');
assert.strictEqual(frames[0].length, 1024);
assert.strictEqual(frames[0][0], 7);
assert.strictEqual(frames[0][1], 8);
assert.strictEqual(frames[0][1023], 9);

// 小床的 uint16LE：低字节在前。配成 be 会得到 0x3412，这条断言就是在守这个。
const smallBedParser = createParserFromProtocol(smallBed.protocol);
const smallBedFrames = [];
smallBedParser.on('data', (chunk) => {
  smallBedFrames.push(decodeProtocolValues(chunk, smallBed.protocol.decoding));
});
const smallBedPayload = Buffer.alloc(2048);
smallBedPayload[0] = 0x34;
smallBedPayload[1] = 0x12;
smallBedParser.write(Buffer.concat([
  smallBedPayload,
  Buffer.from(smallBed.protocol.framing.delimiter),
  Buffer.alloc(1),
]));
assert.strictEqual(smallBedFrames.length, 1);
assert.strictEqual(smallBedFrames[0].length, 1024);
assert.strictEqual(smallBedFrames[0][0], 0x1234);

// ---------------------------------------------------------------------------
// normalizePreset 的校验规则
// ---------------------------------------------------------------------------
const minimal = {
  id: 'demo',
  protocol: {
    baudRate: 921600,
    framing: { type: 'fixedLength', frameLength: 6 },
    decoding: { valueType: 'uint8', valueCount: 6 },
  },
};
const normalized = normalizePreset(minimal, { source: 'demo.json' });
assert.deepStrictEqual(normalized.errors, []);
// label 省略时回落成 id，不留空字符串给下拉框。
assert.strictEqual(normalized.preset.label, 'demo');
assert.strictEqual(normalized.preset.matrix, null);
assert.deepStrictEqual(normalized.preset.channels, []);

// 缺 id。
assert.ok(normalizePreset({ protocol: minimal.protocol }, { source: 'x.json' })
  .errors.some((message) => message.includes('id is required')));

// 缺 protocol —— 一份不带 protocol 的预设选中后什么都不会发生，必须报错而不是静默通过。
assert.ok(normalizePreset({ id: 'x' }, { source: 'x.json' })
  .errors.some((message) => message.includes('protocol is required')));

// protocol 有错时把 displaySystemProtocol 的原始错误信息透出来，不自己另编一套。
const badProtocol = normalizePreset({
  id: 'x',
  protocol: { framing: { type: 'delimiter' }, decoding: { valueType: 'float128' } },
}, { source: 'x.json' });
assert.ok(badProtocol.errors.some((message) => message.includes('valueType')));
assert.ok(badProtocol.errors.some((message) => message.includes('baudRate')));
assert.ok(badProtocol.errors.some((message) => message.includes('delimiter')));
assert.strictEqual(badProtocol.preset, null);

// matrix 三个字段必须自洽，width*height !== total 是画不出来的形状。
assert.ok(normalizePreset({
  ...minimal,
  matrix: { width: 32, height: 32, total: 999 },
}, { source: 'x.json' }).errors.some((message) => message.includes('matrix.total')));

assert.ok(normalizePreset({
  ...minimal,
  matrix: { width: 0, height: 32, total: 0 },
}, { source: 'x.json' }).errors.some((message) => message.includes('matrix.width')));

// channels 类型不对。
assert.ok(normalizePreset({ ...minimal, channels: 'sit' }, { source: 'x.json' })
  .errors.some((message) => message.includes('channels')));

// 不是对象的整份内容。
assert.ok(normalizePreset([], { source: 'x.json' }).errors.length);
assert.ok(normalizePreset(null, { source: 'x.json' }).errors.length);

// ---------------------------------------------------------------------------
// 用户目录：覆盖内置、坏文件不拖垮整次加载
//
// 这是「打包之后能二开」的核心行为：用户改一个波特率不该动源码，
// 而用户写错一个 JSON 也不该让协议列表整体变空。
// ---------------------------------------------------------------------------
const fakeFiles = {
  [path.join('/user', 'standard-1024.json')]: JSON.stringify({
    id: 'standard-1024',
    label: '我的标准帧',
    doc: 'standard-1024.md',
    protocol: {
      baudRate: 921600,
      framing: { type: 'delimiter', delimiter: [170, 85, 3, 153] },
      decoding: { valueType: 'uint8', valueCount: 1024 },
    },
  }),
  [path.join('/user', 'broken.json')]: '{ this is not json',
  [path.join('/user', 'no-protocol.json')]: JSON.stringify({ id: 'no-protocol' }),
  [path.join('/user', 'mine.json')]: JSON.stringify({
    id: 'my-sensor',
    label: '自研传感器',
    matrix: { width: 8, height: 8, total: 64 },
    channels: ['sit'],
    protocol: {
      baudRate: 115200,
      framing: { type: 'fixedLength', frameLength: 64 },
      decoding: { valueType: 'uint8', valueCount: 64 },
    },
  }),
  [path.join('/user', 'notes.txt')]: 'ignored',
};

const fakeFs = {
  existsSync: (target) => target === '/user' || target === BUILTIN_PRESET_DIRECTORY,
  readdirSync: (target) => {
    if (target === '/user') {
      return ['standard-1024.json', 'broken.json', 'no-protocol.json', 'mine.json', 'notes.txt'];
    }
    return require('fs').readdirSync(target);
  },
  readFileSync: (target, encoding) => {
    if (Object.prototype.hasOwnProperty.call(fakeFiles, target)) return fakeFiles[target];
    return require('fs').readFileSync(target, encoding);
  },
};

const merged = loadSerialProtocolPresets({ extraDirectories: ['/user'], fileSystem: fakeFs });

// 用户版覆盖了内置版：同 id 只出现一次，且波特率是用户改的那个。
const overridden = merged.presets.filter((preset) => preset.id === 'standard-1024');
assert.strictEqual(overridden.length, 1, '同 id 应该只保留一份');
assert.strictEqual(overridden[0].protocol.baudRate, 921600);
assert.strictEqual(overridden[0].label, '我的标准帧');
assert.strictEqual(overridden[0].source, PRESET_SOURCES.USER);
// 被覆盖掉的那份路径要留痕，否则用户排错时不知道内置预设去哪了。
assert.ok(overridden[0].overrides.includes('standard-1024.json'));

// 用户新增的预设正常出现。
const mine = merged.presets.find((preset) => preset.id === 'my-sensor');
assert.ok(mine, '用户新增预设没有被加载');
assert.strictEqual(mine.source, PRESET_SOURCES.USER);
assert.strictEqual(mine.protocol.framing.type, 'fixedLength');
assert.strictEqual(mine.protocol.framing.frameLength, 64);

// 没被覆盖的内置预设仍然在。
assert.ok(merged.presets.find((preset) => preset.id === 'bed-4096'));

// 两个坏文件各自带原因进 invalid，好文件照常返回。
assert.strictEqual(merged.invalid.length, 2, JSON.stringify(merged.invalid));
assert.ok(merged.invalid.some((entry) => entry.errors[0].includes('invalid JSON')));
assert.ok(merged.invalid.some((entry) => entry.errors.some((m) => m.includes('protocol is required'))));
merged.invalid.forEach((entry) => {
  assert.strictEqual(entry.source, PRESET_SOURCES.USER);
  assert.ok(entry.filePath);
});

// .txt 不参与加载。
assert.ok(!merged.presets.some((preset) => preset.id === 'notes'));

// 目录不存在不是错误 —— 用户目录默认就不存在。
const missingDir = loadSerialProtocolPresets({
  extraDirectories: ['/nope'],
  fileSystem: { ...fakeFs, existsSync: (target) => target === BUILTIN_PRESET_DIRECTORY },
});
assert.strictEqual(missingDir.invalid.length, 0);
assert.ok(missingDir.presets.length >= 6);

// readdir 抛异常时降级成一条 invalid，不炸整次加载。
const throwingFs = {
  existsSync: () => true,
  readdirSync: (target) => {
    if (target === '/boom') throw new Error('EACCES');
    return require('fs').readdirSync(target);
  },
  readFileSync: (target, encoding) => require('fs').readFileSync(target, encoding),
};
const boom = loadSerialProtocolPresets({ extraDirectories: ['/boom'], fileSystem: throwingFs });
assert.ok(boom.presets.length >= 6);
assert.strictEqual(boom.invalid.length, 1);
assert.ok(boom.invalid[0].errors[0].includes('unable to read directory'));

// ---------------------------------------------------------------------------
// 用户目录路径拼装
// ---------------------------------------------------------------------------
assert.strictEqual(
  resolveUserPresetDirectory('/data'),
  path.join('/data', 'serial-protocols'),
);
assert.strictEqual(resolveUserPresetDirectory(''), '');
assert.strictEqual(resolveUserPresetDirectory(null), '');
assert.strictEqual(resolveUserPresetDirectory(undefined), '');

console.log('serialProtocolPresets.test.js passed');
