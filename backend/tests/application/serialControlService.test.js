const assert = require('assert');
const {
  registerSerialControlHandlers,
} = require('../../kernel/serial/serialControlService');

const handlers = [];
const publishedEvents = [];
let rebindCount = 0;
const runtime = {
  backTotal: 1024,
  endDate: 200,
  file: 'hand0205',
  nowDate: 100,
  sitTotal: 1024,
};

registerSerialControlHandlers({
  register(handler) {
    handlers.push(handler);
  },
}, {
  HAND_GLOVE_DOUBLE: 'hand0205Double',
  closeManagedSerialPort: () => {},
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
assert.deepStrictEqual(publishedEvents.at(-1), {
  currentSensorType: 'custom-pressure-map',
});

console.log('serialControlService.test.js passed');
