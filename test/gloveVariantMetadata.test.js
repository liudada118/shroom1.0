const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

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
  for (const [value, label] of [['hand0205Single', '触觉手套'], ['hand0205', '触觉手套2']]) {
    assert.equal(store.getSensorLabel(value), label);
    assert.equal(snapshot.map[value], label);
    assert.equal(snapshot.flat.filter((item) => item.value === value).length, 1);
    assert.equal(snapshot.flat.find((item) => item.value === value).label, label);
  }
}

test('offline built-in sensor catalog contains distinct single and dual glove display names', () => {
  const { store } = loadStore();
  assertGloveNames(store);
  assert.equal(store.getSensorLabel('hand0205Double'), '触觉手套2');
});

test('legacy cached sensor catalog keeps both local gloves and corrects stale labels without replacing other entries', () => {
  const cache = {
    time: 12,
    flat: [{ value: 'customRemote', label: '远程系统', group: '远程分组' }, { value: 'hand0205', label: '触觉手套', group: '精密' }],
    map: { customRemote: '远程名字', hand0205: '旧名字', hand0205Single: '错误名字' },
  };
  const { store, writes } = loadStore({ cache });
  assertGloveNames(store);
  assert.equal(store.getSnapshot().time, 12);
  assert.equal(store.getSensorLabel('customRemote'), '远程名字');
  assert.equal(store.getSensorArr()[0].group, '远程分组');
  assert.equal(writes.length, 0);
  assert.equal(cache.flat.length, 2);
  assert.equal(cache.flat[1].label, '触觉手套', 'normalization does not mutate the source snapshot');
});

test('remote refresh persists the local glove overlay even when the server has neither new entry nor dual name', async () => {
  const remote = { time: 50, flat: [{ value: 'hand0205', label: '旧手套', group: '精密' }, { value: 'serverOnly', label: '服务端新增', group: '其他' }], map: { hand0205: '旧手套' } };
  const { store, writes } = loadStore({ remote });
  assert.equal(await store.initSensorTypes('https://test.invalid'), true);
  assertGloveNames(store);
  assert.equal(store.getSensorLabel('serverOnly'), '服务端新增');
  assert.equal(store.getSnapshot().time, 50);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].map.hand0205Single, '触觉手套');
  assert.equal(writes[0].map.hand0205, '触觉手套2');
});

test('remote catalog missing both gloves is supplemented, and failed refresh preserves the current names', async () => {
  const { store } = loadStore({ remote: { time: 9, flat: [{ value: 'remoteOnly', label: '远程', group: '其他' }] } });
  await store.initSensorTypes('https://test.invalid');
  assertGloveNames(store);
  assert.equal(store.getSensorLabel('remoteOnly'), '远程');
  assert.equal(await store.initSensorTypes(''), false);
  assertGloveNames(store);
});

test('old explicit glove licenses retain their original scope and the single variant requires its own key', () => {
  assert.deepEqual(expandLicenseFile('hand0205').sensorTypes, ['hand0205']);
  assert.deepEqual(expandLicenseFile('hand0205Double').sensorTypes, ['hand0205Double']);
  assert.deepEqual(expandLicenseFile('hand0205Single').sensorTypes, ['hand0205Single']);
  assert.deepEqual(decodeLicenseKey(generateLicenseKey('hand0205', 30), Date.now()).sensorTypes, ['hand0205']);
  assert.deepEqual(decodeLicenseKey(generateLicenseKey('hand0205Single', 30), Date.now()).sensorTypes, ['hand0205Single']);
  const service = new LicenseService();
  assert.equal(service.getSelectFlag('hand0205'), 'hand0205');
  assert.equal(service.getSelectFlag('hand0205Single'), 'hand0205Single');
  const precision = LICENSE_SENSOR_GROUPS.find((group) => group.key === 'precision');
  assert.equal(precision.items.find((item) => item.value === 'hand0205Single').labelKey, 'sensorHand0205Single');
  assert.ok(expandLicenseFile('@group:precision').sensorTypes.includes('hand0205Single'));
});

test('restored single glove SDK profile and frame parsing match the historical glove protocol for both channels', () => {
  const single = resolveProfile('hand0205Single');
  const dual = resolveProfile('hand0205');
  assert.deepEqual({ ...single, sensorType: 'hand0205' }, dual);
  assert.equal(getDefaultBaudRate('hand0205Single'), 921600);
  assert.equal(getSensor('hand0205Single').label, '触觉手套');
  assert.equal(getSensor('hand0205').label, '触觉手套2');
  assert.deepEqual(getSensor('hand0205Single').protocol, getSensor('hand0205').protocol);
  assert.ok(findByFrameLength(256).includes('hand0205Single'));
  const protocols = new ProtocolRegistry();
  const frame = Buffer.from([...Array.from({ length: 256 }, (_, i) => i), 10, 20, 30, 40]);
  for (const channel of ['sit', 'back']) {
    const parsed = protocols.parse('hand0205Single', frame, { channel });
    assert.equal(parsed.sensorType, 'hand0205Single');
    assert.equal(parsed.channel, channel);
    assert.deepEqual(parsed.data, Array.from({ length: 256 }, (_, i) => i));
    assert.deepEqual(parsed.rotate, [10, 20, 30, 40]);
    assert.deepEqual(parsed.matrix, { width: 16, height: 16 });
  }
});
