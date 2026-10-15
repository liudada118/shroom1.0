const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const acorn = createRequire(path.join(__dirname, '../client/package.json'))('acorn');

const { expandLicenseFile, LICENSE_SENSOR_GROUPS } = require('../licenseScopes');
const { decodeLicenseKey, generateLicenseKey } = require('../crypto-lib.cjs');
const { LicenseService } = require('../sdk/src/license/LicenseService');
const { resolveProfile, getDefaultBaudRate } = require('../sdk/src/profiles');
const { ProtocolRegistry } = require('../sdk/src/protocol/ProtocolRegistry');
const { getSensor, findByFrameLength } = require('../sdk/src/sensors');

const storeSource = fs.readFileSync(path.join(__dirname, '..', 'sensorTypeStore.js'), 'utf8');

// Exercise the real store with in-memory cache and HTTP adapters; no user cache or network access.
function loadStore({ cache, remote } = {}) {
  const writes = [];
  const fileSystem = {
    existsSync: () => cache !== undefined,
    readFileSync: () => JSON.stringify(cache),
    mkdirSync: () => {},
    writeFileSync: (file, contents) => writes.push(JSON.parse(contents)),
  };
  const http = {
    request: (url, options, onResponse) => {
      const request = new EventEmitter();
      request.end = () => queueMicrotask(() => {
        const response = new EventEmitter();
        onResponse(response);
        response.emit('data', JSON.stringify(remote));
        response.emit('end');
      });
      request.destroy = () => {};
      return request;
    },
  };
  const sandbox = {
    module: { exports: {} }, URL,
    require: (name) => {
      if (name === 'fs') return fileSystem;
      if (name === 'path') return path;
      if (name === './logger') return { warn: () => {}, info: () => {} };
      if (name === './configManager') return { APP_DATA_DIR: 'in-memory-cache' };
      if (name === 'http' || name === 'https') return http;
      throw new Error(`unexpected dependency: ${name}`);
    },
  };
  vm.runInNewContext(storeSource, sandbox, { filename: 'sensorTypeStore.js' });
  return { store: sandbox.module.exports, writes };
}

function assertGloveNames(store) {
  const snapshot = store.getSnapshot();
  for (const [value, label] of [['hand0205', '触觉手套'], ['hand0205Double', '触觉手套2']]) {
    assert.equal(store.getSensorLabel(value), label);
    assert.equal(snapshot.map[value], label);
    assert.equal(snapshot.flat.filter((item) => item.value === value).length, 1);
    assert.equal(snapshot.flat.find((item) => item.value === value).label, label);
  }
  assert.equal(snapshot.flat.some((item) => item.value === 'hand0205Single'), false, 'compatibility alias is not a third runtime menu item');
  assert.equal(store.getSensorLabel('hand0205Single'), '触觉手套（兼容）');
}

test('offline built-in sensor catalog contains distinct single and dual glove display names', () => {
  const { store } = loadStore();
  assertGloveNames(store);
  assert.equal(store.getSensorLabel('hand0205Double'), '触觉手套2');
});

test('legacy cached sensor catalog keeps both local gloves and corrects stale labels without replacing other entries', () => {
  const cache = {
    time: 12,
    flat: [{ value: 'customRemote', label: '远程系统', group: '远程分组' }, { value: 'hand0205', label: '触觉手套2', group: '精密' }, { value: 'hand0205Single', label: '触觉手套', group: '精密' }],
    map: { customRemote: '远程名字', hand0205: '旧名字', hand0205Single: '错误名字' },
  };
  const { store, writes } = loadStore({ cache });
  assertGloveNames(store);
  assert.equal(store.getSnapshot().time, 12);
  assert.equal(store.getSensorLabel('customRemote'), '远程名字');
  assert.equal(store.getSensorArr()[0].group, '远程分组');
  assert.equal(writes.length, 0);
  assert.equal(cache.flat.length, 3);
  assert.equal(cache.flat[1].label, '触觉手套2', 'normalization does not mutate the source snapshot');
});

test('remote refresh corrects a stale canonical glove name and supplies the dual entry without a third menu item', async () => {
  const remote = { time: 50, flat: [{ value: 'hand0205', label: '旧手套', group: '精密' }, { value: 'serverOnly', label: '服务端新增', group: '其他' }], map: { hand0205: '旧手套' } };
  const { store, writes } = loadStore({ remote });
  assert.equal(await store.initSensorTypes('https://test.invalid'), true);
  assertGloveNames(store);
  assert.equal(store.getSensorLabel('serverOnly'), '服务端新增');
  assert.equal(store.getSnapshot().time, 50);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].map.hand0205Single, '触觉手套（兼容）');
  assert.equal(writes[0].map.hand0205, '触觉手套');
  assert.equal(writes[0].map.hand0205Double, '触觉手套2');
});

test('current 27-entry remote catalog keeps its size and canonical glove keys without injecting the compatibility alias', async () => {
  const flat = [
    { value: 'hand0205', label: '触觉手套', group: '精密' },
    { value: 'hand0205Double', label: '触觉手套2', group: '精密' },
    ...Array.from({ length: 25 }, (_, index) => ({ value: `remote${index}`, label: `远程${index}`, group: '其他' })),
  ];
  const { store } = loadStore({ remote: { time: 27, flat } });
  await store.initSensorTypes('https://test.invalid');
  assertGloveNames(store);
  assert.equal(store.getSensorArr().length, 27);
});

test('remote catalog missing both gloves is supplemented, and failed refresh preserves the current names', async () => {
  const { store } = loadStore({ remote: { time: 9, flat: [{ value: 'remoteOnly', label: '远程', group: '其他' }] } });
  await store.initSensorTypes('https://test.invalid');
  assertGloveNames(store);
  assert.equal(store.getSensorLabel('remoteOnly'), '远程');
  assert.equal(await store.initSensorTypes(''), false);
  assertGloveNames(store);
});

test('canonical glove licenses remain distinct and the compatibility alias grants only the original single system', () => {
  assert.deepEqual(expandLicenseFile('hand0205').sensorTypes, ['hand0205']);
  assert.deepEqual(expandLicenseFile('hand0205Double').sensorTypes, ['hand0205Double']);
  assert.deepEqual(expandLicenseFile('hand0205Single').sensorTypes, ['hand0205']);
  assert.deepEqual(decodeLicenseKey(generateLicenseKey('hand0205', 30), Date.now()).sensorTypes, ['hand0205']);
  assert.deepEqual(decodeLicenseKey(generateLicenseKey('hand0205Single', 30), Date.now()).sensorTypes, ['hand0205']);
  const service = new LicenseService();
  assert.equal(service.getSelectFlag('hand0205'), 'hand0205');
  assert.equal(service.getSelectFlag('hand0205Double'), 'hand0205Double');
  assert.equal(service.getSelectFlag('hand0205Single'), 'hand0205');
  const precision = LICENSE_SENSOR_GROUPS.find((group) => group.key === 'precision');
  assert.equal(precision.items.find((item) => item.value === 'hand0205Single').labelKey, 'sensorHand0205Single');
  const expanded = expandLicenseFile('@group:precision').sensorTypes;
  assert.ok(expanded.includes('hand0205'));
  assert.ok(expanded.includes('hand0205Double'));
  assert.equal(expanded.includes('hand0205Single'), false);
  assert.equal(expanded.filter((type) => type === 'hand0205').length, 1);
});

test('restored single glove SDK profile and frame parsing match the historical glove protocol for both channels', () => {
  const single = resolveProfile('hand0205');
  const { aliasOf, ...alias } = resolveProfile('hand0205Single');
  assert.equal(aliasOf, 'hand0205');
  assert.deepEqual({ ...alias, sensorType: 'hand0205' }, single);
  assert.equal(getDefaultBaudRate('hand0205Single'), 921600);
  assert.equal(getSensor('hand0205Single').label, '触觉手套（兼容）');
  assert.equal(getSensor('hand0205Single').aliasOf, 'hand0205');
  assert.equal(getSensor('hand0205').label, '触觉手套');
  assert.equal(getSensor('hand0205Double').label, '触觉手套2');
  assert.deepEqual(getSensor('hand0205Single').protocol, getSensor('hand0205').protocol);
  assert.ok(findByFrameLength(256).includes('hand0205Single'));
  const protocols = new ProtocolRegistry();
  const frame = Buffer.from([...Array.from({ length: 256 }, (_, i) => i), 10, 20, 30, 40]);
  for (const [sensorType, channel] of ['hand0205', 'hand0205Single'].flatMap((type) => ['sit', 'back'].map((channel) => [type, channel]))) {
    const parsed = protocols.parse(sensorType, frame, { channel });
    assert.equal(parsed.sensorType, sensorType);
    assert.equal(parsed.channel, channel);
    assert.deepEqual(parsed.data, Array.from({ length: 256 }, (_, i) => i));
    assert.deepEqual(parsed.rotate, [10, 20, 30, 40]);
    assert.deepEqual(parsed.matrix, { width: 16, height: 16 });
  }
});

test('actual main-process metadata declares both canonical gloves and the compatibility key as 16 by 16 two-port systems', () => {
  // Extract only the real metadata declarations; do not initialize Electron, user directories or runtime config.
  const configSource = fs.readFileSync(path.join(__dirname, '..', 'configManager.js'), 'utf8');
  const ast = acorn.parse(configSource, { ecmaVersion: 'latest' });
  const names = new Set(['CAR_TYPES', 'SENSOR_MATRIX_MAP', 'isCar', 'getSensorMatrix']);
  const declarations = ast.body.filter((node) => (
    node.type === 'FunctionDeclaration' && names.has(node.id.name)
  ) || (
    node.type === 'VariableDeclaration' && node.declarations.some((item) => names.has(item.id.name))
  ));
  assert.equal(declarations.length, names.size);
  const config = vm.runInNewContext(`${declarations.map((node) => configSource.slice(node.start, node.end)).join('\n')}\n({ isCar, getSensorMatrix });`);
  for (const type of ['hand0205', 'hand0205Double', 'hand0205Single']) {
    assert.equal(config.isCar(type), true, `${type} needs both serial channels`);
    assert.deepEqual({ ...config.getSensorMatrix(type) }, { width: 16, height: 16, total: 256 });
  }
  assert.deepEqual({ ...config.getSensorMatrix('car10') }, { width: 32, height: 32, total: 1024 });
  assert.equal(config.isCar('unknown'), false);
});
