const assert = require('assert');
const {
  createRuntimeStatePatchers,
  setIfPresent,
} = require('../../kernel/platform/runtime/runtimeStatePatchFactory');

let directValue = 'old';
const collectionState = {};
const playbackState = {};
const serialState = {};

setIfPresent({ value: 'new' }, 'value', (value) => {
  directValue = value;
});
setIfPresent({}, 'value', () => {
  throw new Error('must not be called');
});

const patchers = createRuntimeStatePatchers({
  mutableSetters: {
    file: (value) => { directValue = value; },
  },
  setCollectionState: (key, value) => { collectionState[key] = value; },
  setPlaybackState: (key, value) => { playbackState[key] = value; },
  setSerialPortState: (key, value) => { serialState[key] = value; },
});

patchers.applyRuntimeCommandPatch({
  collectOptions: { frequencyMode: 'serial' },
  file: 'smallBed12B',
  localData: [1, 2],
  historyChannels: [{ channelId: 'demo:leftHand' }],
  serialport: { a: 1 },
});

assert.strictEqual(directValue, 'smallBed12B');
assert.deepStrictEqual(collectionState.collectOptions, { frequencyMode: 'serial' });
assert.deepStrictEqual(playbackState.localData, [1, 2]);
assert.deepStrictEqual(playbackState.historyChannels, [{ channelId: 'demo:leftHand' }]);
assert.deepStrictEqual(serialState.serialport, { a: 1 });

patchers.applySerialCommandPatch({
  colHZ: 99,
  file: 'jqbed',
  nowIndex: 3,
});

assert.strictEqual(directValue, 'jqbed');
assert.strictEqual(collectionState.colHZ, undefined);
assert.strictEqual(playbackState.nowIndex, 3);

const storeWrites = {};
const storeBackedPatchers = createRuntimeStatePatchers({
  mutableSetters: {
    file: (value) => { directValue = value; },
    baudRate: (value) => { directValue = value; },
  },
});
storeBackedPatchers.bindRuntimeStateStore({
  set: (key, value) => { storeWrites[key] = value; },
}, ['file', 'baudRate']);

storeBackedPatchers.applySerialCommandPatch({
  file: 'smallBed12B',
  baudRate: 230400,
});

assert.strictEqual(directValue, 'jqbed');
assert.deepStrictEqual(storeWrites, {
  file: 'smallBed12B',
  baudRate: 230400,
});

console.log('runtimeStatePatchFactory.test.js passed');
