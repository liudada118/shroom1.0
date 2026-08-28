const assert = require('assert');

const {
  createSerialPortOrchestrator,
} = require('../../kernel/serial/serialPortOrchestrator');

const registered = new Map();
const started = [];
const stopped = [];
const reconnectChanges = [];
const warnings = [];
let sensorType = 'custom-system';
let minzhenResetCount = 0;
let failingStartRole = null;

const serialManager = {
  getPort: (role) => ({ role, config: registered.get(role) }),
  getStatus: (role) => {
    if (role) {
      return registered.has(role) ? { role, isRegistered: true } : null;
    }
    return [...registered.keys()].map((registeredRole) => ({
      role: registeredRole,
      isRegistered: true,
    }));
  },
  registerPort: (role, config) => {
    registered.set(role, config);
    return config;
  },
  setReconnect: (role, reconnect) => reconnectChanges.push({ role, reconnect }),
  start: (role) => {
    if (role === failingStartRole) throw new Error(`failed to start ${role}`);
    started.push(role);
    return { role };
  },
  stop: async (role, reason) => {
    stopped.push({ role, reason });
  },
};

const serialRoles = {
  SIT: 'sit',
  BACK: 'back',
  HEAD: 'head',
  SENSOR: 'sensor',
};

const configuredChannels = [
  { serialRole: 'sit', baudRate: 1500000, parserChannel: 'custom:sit' },
  { serialRole: 'back', baudRate: 1000000, parserChannel: 'custom:back' },
  { serialRole: 'head', baudRate: 921600, parserChannel: 'custom:head' },
  { serialRole: 'armLeft', baudRate: 3000000, parserChannel: 'custom:armLeft' },
  { serialRole: 'armRight', baudRate: 3000000, parserChannel: 'custom:armRight' },
];

const orchestrator = createSerialPortOrchestrator({
  getBaudRate: () => 921600,
  getSerialConfig: (_type, role) => (
    configuredChannels.find((channel) => channel.serialRole === role) || null
  ),
  getSensorType: () => sensorType,
  handleMinzhenSensorPortData: () => {},
  logger: { warn: (...args) => warnings.push(args) },
  minzhenType: 'minzhen',
  serialManager,
  serialParserManager: {
    channels: {
      BACK: 'back',
      BIG_BED_SIT: 'bigBedSit',
      HEAD: 'head',
      SIT: 'sit',
      SMALL_BED_12B: 'smallBed12B',
    },
  },
  serialRoles,
  smallBed12BType: 'smallBed12B',
  listSerialChannels: () => configuredChannels,
  resetMinzhenSensorExtractor: () => { minzhenResetCount += 1; },
});

orchestrator.openSitSerialPort('COM3');
orchestrator.openBackSerialPort('COM4');
orchestrator.openHeadSerialPort('COM5');
orchestrator.openManifestSerialPort('armLeft', 'COM6');

assert.deepStrictEqual(started, ['sit', 'back', 'head', 'armLeft']);
assert.deepStrictEqual(
  [...registered.entries()].map(([role, config]) => ({
    role,
    path: config.path,
    baudRate: config.baudRate,
    parserChannel: config.parserChannel,
  })),
  [
    { role: 'sit', path: 'COM3', baudRate: 1500000, parserChannel: 'custom:sit' },
    { role: 'back', path: 'COM4', baudRate: 1000000, parserChannel: 'custom:back' },
    { role: 'head', path: 'COM5', baudRate: 921600, parserChannel: 'custom:head' },
    { role: 'armLeft', path: 'COM6', baudRate: 3000000, parserChannel: 'custom:armLeft' },
  ],
);
assert.strictEqual(orchestrator.getManagedSerialPort('back').config.path, 'COM4');

sensorType = 'minzhen';
orchestrator.openBackSerialPort('COM7');
assert.strictEqual(minzhenResetCount, 1);
assert.strictEqual(registered.get('back').parserChannel, undefined);
assert.strictEqual(typeof registered.get('back').dataHandler, 'function');

assert.strictEqual(orchestrator.openManifestSerialPort('missing', 'COM8'), null);
assert.strictEqual(warnings.length, 1);

const startedBeforeInvalidBatch = [...started];
assert.throws(
  () => orchestrator.openManifestSerialPorts({ armLeft: 'COM8', missing: 'COM9' }),
  /not declared by current manifest: missing/,
);
assert.deepStrictEqual(started, startedBeforeInvalidBatch);

failingStartRole = 'armRight';
assert.throws(
  () => orchestrator.openManifestSerialPorts({ armLeft: 'COM10', armRight: 'COM11' }, 'batch'),
  /failed to start armRight/,
);
failingStartRole = null;
assert.deepStrictEqual(stopped.slice(-2), [
  { role: 'armLeft', reason: 'batch rollback' },
  { role: 'armRight', reason: 'batch rollback' },
]);
assert.deepStrictEqual(reconnectChanges.slice(-2), [
  { role: 'armLeft', reconnect: false },
  { role: 'armRight', reconnect: false },
]);

assert.throws(
  () => orchestrator.closeManagedSerialPorts(['missing'], 'strict close', { strict: true }),
  /not declared by current manifest: missing/,
);

void orchestrator.closeManagedSerialPort('sit', 'test close');
assert.deepStrictEqual(reconnectChanges.at(-1), { role: 'sit', reconnect: false });
assert.deepStrictEqual(stopped.at(-1), { role: 'sit', reason: 'test close' });

const closeAllStartIndex = stopped.length;
orchestrator.closeAllManagedSerialPorts('display system switch');
assert.deepStrictEqual(
  stopped.slice(closeAllStartIndex).map(({ role }) => role).sort(),
  [...registered.keys()].sort(),
);

console.log('serialPortOrchestrator.test.js passed');
