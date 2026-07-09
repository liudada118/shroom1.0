const assert = require('assert');
const {
  HAND_RUNTIME_SNAPSHOT_KEYS,
  createServerHandRuntime,
} = require('../../server/handRuntimeFactory');

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

console.log('handRuntimeFactory.test.js passed');
