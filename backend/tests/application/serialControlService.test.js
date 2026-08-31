const assert = require('assert');
const {
  registerSerialControlHandlers,
} = require('../../kernel/serial/serialControlService');

const handlers = [];
const publishedEvents = [];
let rebindCount = 0;
const openedManifestPorts = [];
const closedManagedPorts = [];
const closeAllReasons = [];
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
  getSensorBaudRate: () => 921600,
  initDb: () => ({ db: 'sit-db', db1: 'back-db', db2: 'head-db' }),
  isCar: () => false,
  isThreePortFile: () => false,
  listPorts: async () => [],
  loadSelectedHistory: () => {},
  logSerialPortList: () => {},
  logger: { error: () => {}, warn: () => {} },
  openBackSerialPort: () => {},
  openHeadSerialPort: () => {},
  openManifestSerialPort: (...args) => {
    openedManifestPorts.push(args);
    return args[0] === 'missing' ? null : { isOpen: true };
  },
  openManifestSerialPorts: (channelPorts, reason) => {
    const entries = Object.entries(channelPorts);
    if (entries.some(([role]) => role === 'missing')) {
      const error = new Error('serial role is not declared by current manifest: missing');
      error.code = 'INVALID_COMMAND';
      error.httpStatus = 400;
      throw error;
    }
    entries.forEach(([role, path]) => openedManifestPorts.push([role, path, `${reason} ${role}`]));
  },
  openMinzhenSensorPort: () => {},
  openSitSerialPort: () => {},
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
assert.throws(
  () => serialPortHandler.handle({ channelClose: ['missing'] }, { scope: 'http' }),
  /not declared by current manifest/,
);

console.log('serialControlService.test.js passed');
