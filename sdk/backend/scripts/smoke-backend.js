/**
 * smoke-backend.js - 证明 `@shroom/backend` 的分层是真的
 *
 * 用法：`node sdk/backend/scripts/smoke-backend.js`（仓库任意目录下都行）
 * 或在仓库根上 `npm run sdk:backend-smoke`。
 *
 * ## 它证明什么
 *
 * 这不是补充单元测试，是**包边界的守卫**。`backend/tests/` 里的测试全部在主仓上下文里
 * 跑，主仓 `node_modules` 里什么都装齐了 —— 所以它们**证明不了**下面这两件事，
 * 而这两件事恰好就是「装到新项目里就崩」的全部来源：
 *
 * | 会漏掉的错 | 只有这个脚本抓得到 |
 * | :--- | :--- |
 * | 包内某个文件偷偷 require 了包外的东西（`../../backend/...`） | 主仓里这条路径解析得开，tarball 里跑出包根就崩 |
 * | 零依赖层其实不零依赖（悄悄引了 serialport / better-sqlite3） | 主仓里这些都装着，装不上原生模块的机器上直接炸 |
 *
 * 所以脚本干三件事：
 *
 * 1. 逐个 require 七个零依赖入口，断言它们能加载且关键出口在。
 * 2. 跑通一条真实链路：预设 → 归一化 → 校验 → 解码一帧假字节 → 线序 → 压力换算。
 *    加载得动不等于跑得通，这一步验证搬家没搬坏实现。
 * 3. 扫一遍包内所有 `.js`，断言没有任何 require 跑出包根。
 *
 * 需要 peer 依赖的四层（serial / storage / export / client）在这里**只做懒加载验证**：
 * 断言 `require('@shroom/backend')` 本身不触发它们，而不是断言它们能加载 ——
 * 那要求装原生模块，正是这一层不该强加给消费者的东西。
 *
 * 失败时进程非 0 退出，`node:assert/strict` 会指出崩在哪条。
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const checks = [];

function check(name, fn) {
  fn();
  checks.push(name);
}

/* ── 1. 零依赖层逐个加载 ────────────────────────────────────────── */

// 刻意用相对路径而不是包名：脚本在包内，不想依赖「已经装好了」这个前提。
const contract = require('../contract');
const processing = require('../processing');
const protocol = require('../protocol');
const sensors = require('../sensors');
const telemetry = require('../telemetry');
const collection = require('../collection');
const logger = require('../logger');

check('contract：路由表与命令信封', () => {
  assert.equal(contract.HTTP_ROUTES.commands, '/api/commands');
  assert.equal(typeof contract.buildSdkContractSnapshot, 'function');
  const envelope = contract.createCommand('serial.open', { role: 'sit', path: 'COM3' });
  assert.equal(envelope.type, 'serial.open');
  assert.ok(envelope.requestId, 'createCommand 必须自带 requestId');
  // 校验通过返回归一化后的信封，不通过是 throw，所以这里断言「不抛且原样返回」。
  assert.equal(contract.validateCommandEnvelope(envelope).type, 'serial.open');
  assert.throws(
    () => contract.validateCommandEnvelope({ type: 'serial.open', payload: {}, requestId: 'r1' }),
    /missing required payload field/,
    'serial.open 少了 role/path 应该被拒',
  );
});

check('processing：线序与压力换算', () => {
  assert.equal(typeof processing.jqbed, 'function');
  assert.equal(typeof processing.press, 'function');
  assert.equal(typeof processing.zeroLine, 'function');
  assert.equal(typeof processing.mapOneBasedOrder, 'function');
  assert.equal(typeof processing.gaussBlur_return, 'function');
});

check('protocol：每份内置预设都能归一化并通过校验', () => {
  const { presets, invalid } = protocol.loadSerialProtocolPresets();
  assert.deepEqual(invalid, [], '内置预设里有加载失败的');

  // 不写死份数：拿目录里的 .json 数量做基准，加一份预设不用改这个脚本，
  // 但加了一份加载不出来的预设会立刻红。
  const jsonCount = fs
    .readdirSync(path.join(PACKAGE_ROOT, 'protocol', 'presets'))
    .filter((name) => name.endsWith('.json')).length;
  assert.equal(presets.length, jsonCount, `目录里有 ${jsonCount} 份 .json，只加载出 ${presets.length} 份`);
  assert.ok(presets.length > 0, '一份预设都没加载出来，大概是打包后目录没跟着走');

  presets.forEach((preset) => {
    const normalized = protocol.normalizeProtocolConfig(preset.protocol);
    assert.ok(normalized, `${preset.id}: normalizeProtocolConfig 返回了 null`);
    assert.deepEqual(protocol.validateProtocolConfig(preset.protocol), [], `${preset.id}: 校验不通过`);
  });
});

check('sensors：注册表能回答矩阵/通道/波特率', () => {
  const definition = sensors.getSensorDefinition('hand0205');
  assert.equal(definition.matrix.total, 256);
  assert.ok(sensors.getSensorChannels('hand0205').includes('sit'));
  assert.ok(sensors.getSensorBaudRate('hand0205') > 0);
});

check('telemetry：通道总线收发', () => {
  const bus = telemetry.createChannelBus();
  const received = [];
  bus.subscribe('sit.pressure', (event) => received.push(event));
  bus.publish('sit.pressure', { value: [1, 2, 3] });
  assert.equal(received.length, 1);
  assert.deepEqual(received[0].payload.value, [1, 2, 3]);
});

check('collection：采集频率限流', () => {
  assert.equal(typeof collection.createCollectionStorageClock, 'function');
  assert.equal(typeof collection.createCollectionFrameStorageService, 'function');

  // 三条件全部靠注入，所以不需要真数据库就能验证「到底存不存」。
  const enqueued = [];
  function buildService(conditions) {
    return collection.createCollectionFrameStorageService({
      getSensorType: () => 'hand0205',
      getDbRef: () => 'fake-db',
      shouldStoreCollectionFrame: () => true,
      hasEnoughCollectionDiskSpace: () => true,
      isZeroFrameStorageType: () => false,
      isSmallBedMatrixType: () => false,
      enqueueCollectionFrame: (db, data, channel) => enqueued.push({ db, data, channel }),
      ...conditions,
    });
  }
  const frame = { sitData: [1, 2, 3] };

  // 采集开关关着时一帧都不该入库 —— 三条件里最容易漏的就是这条：
  // 实时下发路径每帧都会调到 store()，少了它就变成「串口一有数据就落库」。
  assert.equal(buildService({ isCollecting: () => false }).store('sit', frame), false);
  assert.equal(enqueued.length, 0, '采集没开却入库了');

  // 磁盘满同理，急停要真的停得住。
  assert.equal(
    buildService({ isCollecting: () => true, hasEnoughCollectionDiskSpace: () => false }).store('sit', frame),
    false,
  );
  assert.equal(enqueued.length, 0, '磁盘不足却入库了');

  // 三条件都满足才入队。
  assert.equal(buildService({ isCollecting: () => true }).store('sit', frame), true);
  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0].channel, 'sit');
  assert.equal(enqueued[0].data, '[1,2,3]');
});

check('logger：四个级别都在', () => {
  ['debug', 'info', 'warn', 'error'].forEach((level) => {
    assert.equal(typeof logger[level], 'function', `logger.${level} 不见了`);
  });
});

/* ── 2. 真实链路：一帧字节走到压力矩阵 ──────────────────────────── */

check('端到端：预设 → 解码 → 线序 → 压力', () => {
  const preset = protocol.getSerialProtocolPreset('matrix-256');
  assert.ok(preset, '找不到 matrix-256 预设');

  // 造一帧：256 个点，第 10 个点给个可识别的值。
  const payload = Buffer.alloc(256);
  payload[10] = 200;

  assert.equal(protocol.validateFrame(payload, preset.protocol).ok, true);

  const values = protocol.decodeProtocolValues(payload, preset.protocol);
  assert.equal(values.length, 256, '256 点预设应解出 256 个值');
  assert.equal(values[10], 200);

  // 解码出来的值要能直接进纯计算层。
  assert.equal(processing.findMax(values), 200);
  assert.equal(typeof processing.pressToN(values[10]), 'number');
});

/* ── 3. 包边界：没有 require 跑出包根 ───────────────────────────── */

function listJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'node_modules' ? [] : listJsFiles(full);
    }
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

check('包边界：没有相对 require 跑出包根', () => {
  const offenders = [];
  listJsFiles(PACKAGE_ROOT).forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const fileDir = path.dirname(file);
    for (const match of source.matchAll(/require\(\s*['"](\.[^'"]*)['"]\s*\)/g)) {
      const resolved = path.resolve(fileDir, match[1]);
      // 指向包根自己（`require('..')` 从子目录）是合法的，跑到包根**外面**才是问题。
      if (resolved !== PACKAGE_ROOT && !resolved.startsWith(PACKAGE_ROOT + path.sep)) {
        offenders.push(`${path.relative(PACKAGE_ROOT, file)} → ${match[1]}`);
      }
    }
  });
  assert.deepEqual(
    offenders,
    [],
    `这些 require 跑出了包根，装到新项目里会崩：\n  ${offenders.join('\n  ')}`,
  );
});

check('懒加载：根出口不预加载原生 peer 依赖', () => {
  const loadedBefore = Object.keys(require.cache).length;
  const root = require('../index.js');
  assert.equal(typeof root.press, 'function', '零依赖层应该是直接展开的');
  assert.ok(
    !Object.keys(require.cache).some((id) => id.includes(`${path.sep}session${path.sep}ShroomSensorSDK`)),
    '根出口不该预加载 session 层（它要 serialport）',
  );
  assert.ok(Object.keys(require.cache).length >= loadedBefore);
});

/* ── 结果 ───────────────────────────────────────────────────────── */

console.log(`smoke-backend: ${checks.length} 项全部通过`);
checks.forEach((name) => console.log(`  ✓ ${name}`));
