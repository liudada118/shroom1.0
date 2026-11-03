const assert = require('assert');
const {
  registerSerialControlHandlers,
} = require('../../kernel/serial/serialControlService');
const { createControlCommandRouter } = require('../../kernel/platform/commands/controlCommandRouter');
const { registerRuntimeCommandHandlers } = require('../../kernel/platform/commands/registerRuntimeCommandHandlers');
const { createLicenseAccessPolicy } = require('../../kernel/platform/license/licenseAccessPolicy');
const { createPlaybackTimerService } = require('../../kernel/playback/playbackTimerService');

const handlers = [];
const publishedEvents = [];
let rebindCount = 0;
const openedManifestPorts = [];
const openedLegacyPorts = [];
let collectionBusy = false;
let packetResetCount = 0;
const closedManagedPorts = [];
const closeAllReasons = [];
let selectedHistory = { length: 428, availableChannels: ['back'] };
let carMode = false, threePortMode = false;
const runtime = {
  backTotal: 1024,
  endDate: 200,
  file: 'hand0205',
  nowDate: 100,
  sitTotal: 1024,
};

registerSerialControlHandlers({
  /**
   * 假的命令注册表：按注册顺序把 handler 收进数组，供断言检查「注册了几个、是哪几个」。
   *
   * 注册数量就是对外的命令面，加减都该是明确决定，不该悄悄发生。
   *
   * @param {object} handler 命令处理器描述（含 name/when/handle）。
   */
  register(handler) {
    handlers.push(handler);
  },
}, {
  HAND_GLOVE_DOUBLE: 'hand0205Double',
  closeAllManagedSerialPorts: (reason) => closeAllReasons.push(reason),
  closeManagedSerialPort: (...args) => closedManagedPorts.push(args),
  closeManagedSerialPorts: (roles, reason, options) => {
    if (roles.includes('missing')) {
      const error = new Error('serial role is not declared by current manifest: missing');
      error.code = 'INVALID_COMMAND';
      error.httpStatus = 400;
      throw error;
    }
    roles.forEach((role) => closedManagedPorts.push([role, reason, options]));
  },
  closeMinzhenSensorPort: () => {},
  getPort: () => [],
  getRuntime: () => runtime,
  requireSerialConfigurationIdle: () => {
    if (collectionBusy) throw Object.assign(new Error('collection is active'), { code: 'COLLECTION_ACTIVE' });
  },
  resetHandPacketRuntime: () => { packetResetCount += 1; },
  getSensorBaudRate: () => 921600,
  initDb: () => ({ db: 'sit-db', db1: 'back-db', db2: 'head-db' }),
  isCar: () => carMode,
  isThreePortFile: () => threePortMode,
  listPorts: async () => [],
  loadSelectedHistory: () => {
    if (selectedHistory instanceof Error) throw selectedHistory;
    return selectedHistory;
  },
  logSerialPortList: () => {},
  logger: { error: () => {}, warn: () => {} },
  openBackSerialPort: (...args) => openedLegacyPorts.push(['back', ...args]),
  openHeadSerialPort: (...args) => openedLegacyPorts.push(['head', ...args]),
  openManifestSerialPort: (...args) => {
    openedManifestPorts.push(args);
    return args[0] === 'missing' ? null : { isOpen: true };
  },
  openManifestSerialPorts: (channelPorts, reason, options = {}) => {
    const entries = Object.entries(channelPorts);
    if (entries.some(([role]) => role === 'missing')) {
      const error = new Error('serial role is not declared by current manifest: missing');
      error.code = 'INVALID_COMMAND';
      error.httpStatus = 400;
      throw error;
    }
    entries.forEach(([role, path]) => openedManifestPorts.push([role, path, `${reason} ${role}`, ...(options.baudRate ? [options] : [])]));
  },
  openMinzhenSensorPort: () => {},
  openSitSerialPort: (...args) => openedLegacyPorts.push(['sit', ...args]),
  petCareRuntimeService: { resetAll: () => {} },
  publishHistoryDateList: () => {},
  publishSystemEvent: (event) => publishedEvents.push(event),
  rebindDisplaySystemRuntime: () => { rebindCount += 1; },
  serialRoles: {
    SIT: 'sit',
    BACK: 'back',
    HEAD: 'head',
    SENSOR: 'sensor',
  },
  setRuntime: (patch) => Object.assign(runtime, patch),
  stopPlaybackTimer: () => {},
});

const switchHandler = handlers.find((handler) => handler.name === 'sensor-file-switch');
assert.ok(switchHandler);
switchHandler.handle({ file: 'custom-pressure-map' });

assert.strictEqual(runtime.file, 'custom-pressure-map');
assert.strictEqual(runtime.baudRate, 921600);
assert.strictEqual(rebindCount, 1);
assert.deepStrictEqual(closeAllReasons, ['file switch']);
assert.deepStrictEqual(publishedEvents.at(-1), {
  currentSensorType: 'custom-pressure-map',
});

const serialPortHandler = handlers.find((handler) => handler.name === 'serial-port-control');
assert.ok(serialPortHandler);
serialPortHandler.handle({ channelPorts: { armLeft: 'COM11', armRight: 'COM12' } }, { scope: 'http' });
assert.deepStrictEqual(openedManifestPorts, [
  ['armLeft', 'COM11', 'http armLeft'],
  ['armRight', 'COM12', 'http armRight'],
]);
serialPortHandler.handle({ channelClose: ['armLeft', 'armRight'] }, { scope: 'http' });
assert.deepStrictEqual(closedManagedPorts.slice(-2), [
  ['armLeft', 'http manual close', { strict: true }],
  ['armRight', 'http manual close', { strict: true }],
]);
const openedCountBeforeInvalidBatch = openedManifestPorts.length;
assert.throws(
  () => serialPortHandler.handle({
    channelPorts: { armLeft: 'COM13', missing: 'COM14' },
  }, { scope: 'http' }),
  /not declared by current manifest/,
);
assert.strictEqual(openedManifestPorts.length, openedCountBeforeInvalidBatch);
serialPortHandler.handle({ sitPort: 'COM21', backPort: 'COM22', headPort: 'COM23', baudRate: 921600 }, { scope: 'http' });
assert.deepStrictEqual(openedLegacyPorts, [
  ['sit', 'COM21', 'http sitPort', { baudRate: 921600 }],
  ['head', 'COM23', 'http headPort', { baudRate: 921600 }],
  ['back', 'COM22', 'http backPort', { baudRate: 921600 }],
]);
serialPortHandler.handle({ channelPorts: { armLeft: 'COM24' }, baudRate: 6000000 }, { scope: 'http' });
assert.deepStrictEqual(openedManifestPorts.at(-1), ['armLeft', 'COM24', 'http armLeft', { baudRate: 6000000 }]);
collectionBusy = true;
const resetCountBeforeRejection = packetResetCount;
for (const message of [{ sitPort: 'COM21', baudRate: 1500000 }, { channelPorts: { armLeft: 'COM24' }, baudRate: 1500000 }]) {
  assert.throws(() => serialPortHandler.handle(message), error => error.code === 'COLLECTION_ACTIVE');
}
for (const name of ['exchange-sit-back-ports', 'auto-connect-hand-glove-double']) {
  assert.throws(() => handlers.find(handler => handler.name === name).handle({}), error => error.code === 'COLLECTION_ACTIVE');
}
assert.strictEqual(openedLegacyPorts.length, 3);
assert.strictEqual(packetResetCount, resetCountBeforeRejection, 'rejected reconfiguration must preserve the active packet accumulator');
collectionBusy = false;
assert.throws(
  () => serialPortHandler.handle({ channelClose: ['missing'] }, { scope: 'http' }),
  /not declared by current manifest/,
);

const historyLoadHandler = handlers.find((handler) => handler.name === 'history-load-date');
assert.deepStrictEqual(historyLoadHandler.handle({ getTime: 'right-only' }), {
  stop: true, length: 428, availableChannels: ['back'],
});
selectedHistory = new Error('所选记录没有可回放的数据');
assert.throws(() => historyLoadHandler.handle({ getTime: 'missing' }), /没有可回放的数据/);

const playbackSwitch = handlers.find(handler => handler.name === 'local-playback-switch');
for (const [car, three, fields] of [[false, false, ['sitData']], [true, false, ['sitData', 'backData']],
  [true, true, ['sitData', 'backData', 'headData']]]) {
  carMode = car; threePortMode = three;
  const start = publishedEvents.length;
  playbackSwitch.handle({ local: false });
  const cleared = publishedEvents.slice(start);
  assert.equal(runtime.localFlag, false);
  assert.equal(cleared.length, fields.length);
  cleared.forEach((event, index) => {
    assert.equal(event.synthetic, true, 'realtime-mode display clears must not prove device readiness');
    assert.ok(event[fields[index]].length > 0);
    assert.ok(event[fields[index]].every(value => value === 0));
  });
}
for (const local of [true, false]) {
  playbackSwitch.handle({ local }, { scope: 'back' });
  assert.equal(publishedEvents.at(-1).synthetic, true, 'legacy back-only clears are synthetic too');
}
runtime.port1 = runtime.port2 = runtime.portHead = { isOpen: true };
const switchStart = publishedEvents.length;
switchHandler.handle({ file: 'next-system' });
const switchClears = publishedEvents.slice(switchStart).filter(event => !event.currentSensorType);
assert.equal(switchClears.length, 3);
assert.ok(switchClears.every(event => event.synthetic === true));

/** 用真实命令归一、权限和回放计时器验证系统切换，只替换数据库与串口 I/O。 */
function createPlaybackSwitchFixture() {
  const state = { file: 'hand', localFlag: true, history: true, playFlag: false,
    localData: [1, 2], localDataBack: [3], localDataHead: [4], historyChannels: [{}],
    nowIndex: 1, indexArr: [0, 1], detectedInterval: 10, interval: 10 };
  const scheduled = new Map();
  let nextTimer = 0, closedPorts = 0, openedPorts = 0, collectionPhase = null;
  const timer = createPlaybackTimerService({
    getInterval: () => state.interval,
    schedule: callback => { const id = ++nextTimer; scheduled.set(id, callback); return id; },
    cancel: id => scheduled.delete(id),
    onStop: () => { state.playFlag = false; },
  });
  const access = createLicenseAccessPolicy({
    clock: { now: () => 1000, synchronize() {} }, setTimer: () => null,
  });
  access.update({ ok: true, expiresAt: 2000 });
  const router = createControlCommandRouter();
  const deps = {
    getRuntime: () => ({ ...state }),
    setRuntime: patch => Object.assign(state, patch),
    requireAccess: access.requireAccess,
    startPlaybackTimer: () => { state.playFlag = true; timer.start(); },
    stopPlaybackTimer: () => timer.stop(),
  };
  registerRuntimeCommandHandlers(router, deps);
  registerSerialControlHandlers(router, {
    ...deps,
    resolveSystemSelection: id => {
      if (collectionPhase) throw Object.assign(new Error('请先停止采集，再切换系统。'), { code: 'AGENT_DEVICE_BUSY' });
      return { id, sourceType: id };
    },
    closeAllManagedSerialPorts: () => { closedPorts += 1; },
    closeMinzhenSensorPort: () => {},
    getSensorBaudRate: () => 921600,
    initDb: () => ({ db: 'fixture-db' }),
    petCareRuntimeService: { resetAll() {} },
    publishSystemEvent: () => {},
    publishHistoryDateList: () => {},
    openSitSerialPort: () => { openedPorts += 1; },
    openBackSerialPort: () => { openedPorts += 1; },
    openHeadSerialPort: () => { openedPorts += 1; },
    openMinzhenSensorPort: () => { openedPorts += 1; },
    loadSelectedHistory: () => {
      timer.stop();
      Object.assign(state, { localData: [10, 20], nowIndex: 0 });
      return { length: 2, availableChannels: ['sit'] };
    },
  });
  return { state, timer, scheduled, access,
    execute: (type, payload) => router.handle({ type, payload, requestId: 'playback-switch-test' }, { scope: 'http' }),
    setCollectionPhase: phase => { collectionPhase = phase; },
    portCounts: () => ({ closedPorts, openedPorts }),
  };
}

for (const playing of [true, false]) {
  for (const sensorType of ['hand', 'smallBed']) {
    const fixture = createPlaybackSwitchFixture();
    assert.equal(fixture.execute('playback.control', { play: playing }).ok, true);
    assert.equal(fixture.execute('sensor.switch', { sensorType }).ok, true);
    const { state } = fixture;
    assert.equal(state.file, sensorType);
    assert.equal(state.localFlag, false, '重新进入相同或不同系统都回到实时模式');
    assert.equal(state.history, false);
    assert.equal(state.playFlag, false);
    assert.equal(state.nowIndex, 0);
    assert.deepEqual(state.indexArr, [0, 0]);
    for (const field of ['localData', 'localDataBack', 'localDataHead', 'historyChannels']) assert.deepEqual(state[field], []);
    assert.equal(fixture.scheduled.size, 0);
    assert.deepEqual(fixture.portCounts(), { closedPorts: 1, openedPorts: 0 }, '重新进入不会隐式打开设备');
    fixture.access.dispose();
  }
}

{
  const fixture = createPlaybackSwitchFixture();
  fixture.execute('playback.control', { play: true });
  const before = { ...fixture.state };
  for (const phase of ['collecting', 'finalizing']) {
    fixture.setCollectionPhase(phase);
    const rejected = fixture.execute('sensor.switch', { sensorType: 'hand' });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.results[0].code, 'AGENT_DEVICE_BUSY');
    assert.deepEqual(fixture.state, before, '采集拒绝必须先于清理回放状态');
  }
  fixture.setCollectionPhase(null);
  fixture.access.update({ ok: false, code: 'LICENSE_REQUIRED' });
  const rejected = fixture.execute('sensor.switch', { sensorType: 'hand' });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.results[0].code, 'LICENSE_REQUIRED');
  assert.deepEqual(fixture.state, before, '授权拒绝不能修改原系统状态');
  assert.equal(fixture.scheduled.size, 1);
  assert.deepEqual(fixture.portCounts(), { closedPorts: 0, openedPorts: 0 });
  assert.equal(fixture.execute('playback.control', { play: false }).ok, true, '停止回放无需有效采集授权');
  assert.equal(fixture.scheduled.size, 0);
  fixture.access.dispose();
}

{
  const fixture = createPlaybackSwitchFixture();
  fixture.access.update({ ok: false, historyAllowed: true, expiresAt: 500, code: 'LICENSE_EXPIRED' });
  assert.equal(fixture.execute('playback.control', { play: false, history: false }).ok, true);
  assert.equal(fixture.execute('sensor.switch', { sensorType: 'hand' }).ok, true, '到期许可仍可重新进入系统查看历史');
  assert.equal(fixture.execute('history.mode', { local: true, history: false, play: false }).ok, true,
    '门户的原子暂停及历史模式命令不要求采集权限');
  assert.equal(fixture.execute('history.load', { date: 'fixture-record', index: 0 }).ok, true);
  assert.equal(fixture.state.localFlag, true);
  assert.equal(fixture.state.history, false);
  assert.equal(fixture.state.playFlag, false, '载入记录保持暂停');
  assert.deepEqual(fixture.state.localData, [10, 20]);
  assert.equal(fixture.execute('playback.control', { value: 0, play: true }).ok, true);
  assert.equal(fixture.scheduled.size, 1, '重进后仍可显式播放历史');
  assert.equal(fixture.execute('playback.control', { play: false, history: false }).ok, true,
    '历史专用许可也能按门户退出命令停止回放');
  assert.equal(fixture.scheduled.size, 0);
  assert.equal(fixture.state.playFlag, false);
  assert.equal(fixture.state.history, false);
  assert.equal(fixture.access.read().canAcquire, false, '重进及查看历史不提升采集权限');
  assert.deepEqual(fixture.portCounts(), { closedPorts: 1, openedPorts: 0 });
  fixture.access.dispose();
}

console.log('serialControlService.test.js passed');
