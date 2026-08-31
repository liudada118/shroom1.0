const assert = require('assert');
const {
  HAND_RUNTIME_SNAPSHOT_KEYS,
  createServerHandRuntime,
} = require('../../extensions/built-in-sensors/handRuntimeFactory');

const calls = [];
const runtimeStateStore = {
  snapshot(keys) {
    calls.push(['snapshot', keys]);
    return {
      file: 'fullPacket',
      port1: { isOpen: true },
      port2: { isOpen: false },
    };
  },
  patch(next) {
    calls.push(['patch', next]);
  },
};

const runtime = createServerHandRuntime({
  fullPacketType: 'fullPacket',
  doublePacketType: 'doublePacket',
  parseFullPacket: () => null,
  mapFullPacketModelMatrix: (frame) => frame,
  createDoublePacketParser: () => ({ handlePacket: () => null }),
  normalizeFiniteFrame: (frame) => frame,
  bytes4ToInt10: () => [],
  numLessZeroToZero: (value) => Math.max(0, value),
  handL: (frame) => frame,
  handR: (frame) => frame,
  handRVideo1470506: (frame) => frame,
  publishSit: () => {},
  publishBack: () => {},
  runtimeStateStore,
});

assert.strictEqual(typeof runtime.handPacketRuntime.handleFullPacket, 'function');
assert.strictEqual(typeof runtime.handleHandGloveFullPacket, 'function');
assert.strictEqual(typeof runtime.handleHandGloveDoublePacket, 'function');

runtime.handleHandGloveFullPacket(Buffer.alloc(1), 'left');
assert.deepStrictEqual(calls[0], ['snapshot', HAND_RUNTIME_SNAPSHOT_KEYS]);

const patched = [];
const preparedRuntime = createServerHandRuntime({
  fullPacketType: 'fullPacket',
  doublePacketType: 'doublePacket',
  parseFullPacket: () => ({
    pressureData: [10, 20],
    mappedData: [3, 4],
    frameIndex: 1,
    packetType: 'full',
    side: 'left',
  }),
  mapFullPacketModelMatrix: (frame) => frame,
  createDoublePacketParser: () => ({ handlePacket: () => null }),
  normalizeFiniteFrame: (frame) => frame,
  bytes4ToInt10: () => [],
  handL: (frame) => frame,
  handR: (frame) => frame,
  handRVideo1470506: (frame) => frame,
  publishSit: () => ({ frame: { rawPressureData: [1, 2], sitData: [0, 0] } }),
  publishBack: () => ({ frame: { rawPressureData: [3, 4], backData: [0, 0] } }),
  runtimeStateStore: {
    snapshot: () => ({
      file: 'fullPacket',
      port1: { isOpen: true },
      port2: { isOpen: true },
    }),
    patch: (next) => patched.push(next),
  },
});

assert.strictEqual(preparedRuntime.handleHandGloveFullPacket(Buffer.alloc(1), 'left'), true);
assert.deepStrictEqual(
  patched.at(-1),
  { pointArr: [1, 2] },
  'hand runtime state must use the zeroed raw pressure stage returned by the output pipeline',
);

console.log('handRuntimeFactory.test.js passed');
