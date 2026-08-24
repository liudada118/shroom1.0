const test = require('node:test');
const assert = require('node:assert/strict');

const licenseGroups = require('../licenseSensorGroups.json');
const {
  registry,
  SENSORS,
  listSensorTypes,
  listVerifiedSensorTypes,
  listUnverifiedSensorTypes,
  getSensor,
  resolveDelimiter,
  findByFrameLength,
  coverage,
} = require('../sdk/src/sensors');
const {
  DEFAULT_SENSOR_PROFILES,
  STANDARD_FRAME_DELIMITER,
  SMALL_BED_12B_FRAME_TAIL,
  getDefaultBaudRate,
} = require('../sdk/src/profiles');

const licensableTypes = licenseGroups.flatMap((group) => group.items.map((item) => item.value));

/**
 * 这组测试守的是一句话：
 *   客户能买到的每一种传感器，SDK 都必须知道它长什么样。
 * 「知道」允许暂时不完整（verified:false），但不允许根本没有条目 ——
 * 那种情况下客户插上设备，SDK 只能沉默，而沉默是最贵的失败方式。
 */

test('每个可售传感器都在注册表里有条目', () => {
  const missing = licensableTypes.filter((type) => !SENSORS[type]);
  assert.deepEqual(
    missing,
    [],
    `licenseSensorGroups.json 里这些类型可售，但 registry.json 里没有：${missing.join(', ')}`
  );
});

test('注册表里没有卖不出去的类型', () => {
  const licensable = new Set(licensableTypes);
  const orphans = listSensorTypes().filter((type) => !licensable.has(type));
  assert.deepEqual(
    orphans,
    [],
    `registry.json 里这些类型不在任何授权分组里，是不是漏加授权了：${orphans.join(', ')}`
  );
});

test('注册表的授权分组标注与 licenseSensorGroups.json 一致', () => {
  const expected = new Map();
  licenseGroups.forEach((group) => {
    group.items.forEach((item) => expected.set(item.value, group.key));
  });
  const wrong = listSensorTypes()
    .filter((type) => SENSORS[type].licenseGroup !== expected.get(type))
    .map((type) => `${type}: registry=${SENSORS[type].licenseGroup} license=${expected.get(type)}`);
  assert.deepEqual(wrong, [], `分组标注不一致：${wrong.join('; ')}`);
});

test('每个条目都有 label、licenseGroup、verified 和来源说明', () => {
  const bad = [];
  listSensorTypes().forEach((type) => {
    const entry = SENSORS[type];
    if (typeof entry.label !== 'string' || !entry.label) bad.push(`${type}.label`);
    if (typeof entry.licenseGroup !== 'string' || !entry.licenseGroup) bad.push(`${type}.licenseGroup`);
    if (typeof entry.verified !== 'boolean') bad.push(`${type}.verified`);
    if (typeof entry.source !== 'string' || !entry.source) bad.push(`${type}.source`);
  });
  assert.deepEqual(bad, [], `缺字段：${bad.join(', ')}`);
});

test('verified:true 的条目必须能真解出一帧所需的全部字段', () => {
  const incomplete = [];
  listVerifiedSensorTypes().forEach((type) => {
    const entry = SENSORS[type];
    const p = entry.protocol || {};
    if (!Number.isFinite(p.baudRate)) incomplete.push(`${type}.protocol.baudRate`);
    if (!p.valueType) incomplete.push(`${type}.protocol.valueType`);
    if (!p.delimiter) incomplete.push(`${type}.protocol.delimiter`);
    if (!Number.isFinite(p.pressureLength)) incomplete.push(`${type}.protocol.pressureLength`);
    const hasMatrix = entry.matrix || entry.channelMatrix;
    if (!hasMatrix) incomplete.push(`${type}.matrix`);
    if (!Array.isArray(entry.channels) || entry.channels.length === 0) {
      incomplete.push(`${type}.channels`);
    }
    if (entry.unknown) incomplete.push(`${type} 标了 verified 又留着 unknown`);
  });
  assert.deepEqual(incomplete, [], `verified 但字段不全：${incomplete.join(', ')}`);
});

test('verified:false 的条目必须写清楚缺什么', () => {
  const silent = listUnverifiedSensorTypes().filter((type) => {
    const { unknown } = SENSORS[type];
    return !Array.isArray(unknown) || unknown.length === 0;
  });
  assert.deepEqual(
    silent,
    [],
    `这些条目未验证却没列 unknown，会被误当成完整数据用：${silent.join(', ')}`
  );
});

test('matrix 的宽高乘积等于 pressureLength', () => {
  const mismatched = [];
  listSensorTypes().forEach((type) => {
    const entry = SENSORS[type];
    const len = entry.protocol && entry.protocol.pressureLength;
    if (!entry.matrix || !Number.isFinite(len)) return;
    const { width, height } = entry.matrix;
    if (width * height !== len) {
      mismatched.push(`${type}: ${width}x${height}=${width * height} != ${len}`);
    }
  });
  assert.deepEqual(mismatched, [], `矩阵尺寸和帧长对不上：${mismatched.join('; ')}`);
});

test('注册表与 profiles.js 在共有类型上不冲突', () => {
  const conflicts = [];
  Object.keys(DEFAULT_SENSOR_PROFILES).forEach((type) => {
    if (type === 'default') return;
    const entry = SENSORS[type];
    assert.ok(entry, `profiles.js 有 ${type} 的画像，registry.json 却没有条目`);
    const profile = DEFAULT_SENSOR_PROFILES[type];
    const p = entry.protocol || {};
    if (profile.baudRate !== p.baudRate) {
      conflicts.push(`${type}.baudRate: profile=${profile.baudRate} registry=${p.baudRate}`);
    }
    if (profile.valueType && profile.valueType !== p.valueType) {
      conflicts.push(`${type}.valueType: profile=${profile.valueType} registry=${p.valueType}`);
    }
    if (Number.isFinite(profile.pressureLength) && profile.pressureLength !== p.pressureLength) {
      conflicts.push(
        `${type}.pressureLength: profile=${profile.pressureLength} registry=${p.pressureLength}`
      );
    }
    if (profile.delimiter && p.delimiter) {
      const registryDelimiter = resolveDelimiter(p.delimiter);
      if (!profile.delimiter.equals(registryDelimiter)) {
        conflicts.push(
          `${type}.delimiter: profile=${profile.delimiter.toString('hex')} registry=${registryDelimiter.toString('hex')}`
        );
      }
    }
  });
  assert.deepEqual(conflicts, [], `画像与注册表冲突：${conflicts.join('; ')}`);
});

test('注册表里的定界字节和 profiles.js 的常量一致', () => {
  assert.ok(resolveDelimiter('standard').equals(STANDARD_FRAME_DELIMITER));
  assert.ok(resolveDelimiter('smallBed12BTail').equals(SMALL_BED_12B_FRAME_TAIL));
});

test('resolveDelimiter 拒绝不合法的 hex', () => {
  assert.throws(() => resolveDelimiter('aa5'), /not a valid hex string/);
  assert.throws(() => resolveDelimiter('zzzz'), /not a valid hex string/);
  assert.equal(resolveDelimiter(null), null);
});

test('getSensor 对未知类型返回 null 而不是抛错或瞎猜', () => {
  assert.equal(getSensor('这个类型不存在'), null);
  assert.equal(getSensor(''), null);
  assert.equal(getSensor(undefined), null);
  assert.equal(getSensor('hand').sensorType, 'hand');
});

test('findByFrameLength 能按帧长反查候选类型', () => {
  assert.deepEqual(findByFrameLength(274), ['handGloveFullPacket']);
  assert.ok(findByFrameLength(2048).includes('smallBed12B'));
  assert.ok(findByFrameLength(4096).includes('bed4096'));
  assert.ok(findByFrameLength(256).includes('hand0205'));
  assert.deepEqual(findByFrameLength(7), []);
  assert.deepEqual(findByFrameLength(NaN), []);
  assert.deepEqual(findByFrameLength(undefined), []);
});

test('minzhen 的波特率以注册表为准，不用 getDefaultBaudRate 的兜底值', () => {
  // 这是一条真实的回归：server.js:122 用 115200 打开民振传感器，
  // 而 getDefaultBaudRate('minzhen') 走 else 分支返回 1000000。
  // 谁按 SDK 的兜底值去开口，读到的就是一串乱码 —— 而且不报错。
  assert.equal(SENSORS.minzhen.protocol.baudRate, 115200);
  assert.notEqual(
    getDefaultBaudRate('minzhen'),
    SENSORS.minzhen.protocol.baudRate,
    '如果这条不再冲突了，说明 profiles.js 已经修好，删掉这个测试'
  );
});

test('getDefaultBaudRate 与注册表在其余类型上一致', () => {
  const knownDivergence = new Set(['minzhen']);
  const conflicts = listSensorTypes()
    .filter((type) => !knownDivergence.has(type))
    .filter((type) => {
      const registryBaud = SENSORS[type].protocol && SENSORS[type].protocol.baudRate;
      return Number.isFinite(registryBaud) && getDefaultBaudRate(type) !== registryBaud;
    })
    .map((type) => `${type}: default=${getDefaultBaudRate(type)} registry=${SENSORS[type].protocol.baudRate}`);
  assert.deepEqual(conflicts, [], `波特率冲突：${conflicts.join('; ')}`);
});

test('注册表自带的 invariants 说明没被删空', () => {
  assert.ok(Array.isArray(registry._meta.invariants) && registry._meta.invariants.length > 0);
});

test('打印协议覆盖率', () => {
  const stats = coverage();
  assert.equal(stats.total, licensableTypes.length);
  console.log(
    `\n  协议覆盖率：${stats.verified}/${stats.total} (${stats.percent}%) 可解，` +
      `${stats.unverified} 个可售但无画像：\n    ${listUnverifiedSensorTypes().join(', ')}\n`
  );
});
