const { createHandPacketRuntime } = require('./handPacketRuntime');

const HAND_RUNTIME_SNAPSHOT_KEYS = Object.freeze([
  'file',
  'port1',
  'port2',
  'pointArr1zero',
  'pointArr1RawZero',
  'pointArr2zero',
  'pointArr2RawZero',
  'pointArr147zero',
  'pointArr147zero_2',
]);

/**
 * 创建手套分包 runtime 和 legacy runtime 需要的兼容处理函数。
 *
 * 这个 factory 把旧状态快照访问集中在 runtimeStateStore，server.js 不再直接拼接
 * full packet / double packet 的运行时依赖。
 *
 * @param {object} options 装配依赖。
 * @returns {{handPacketRuntime: object, handleHandGloveFullPacket: Function, handleHandGloveDoublePacket: Function}}
 */
function createServerHandRuntime({
  fullPacketType,
  doublePacketType,
  parseFullPacket,
  mapFullPacketModelMatrix,
  createDoublePacketParser,
  normalizeFiniteFrame,
  bytes4ToInt10,
  numLessZeroToZero,
  handL,
  handR,
  handRVideo1470506,
  publishSit,
  publishBack,
  runtimeStateStore,
}) {
  const handPacketRuntime = createHandPacketRuntime({
    fullPacketType,
    doublePacketType,
    parseFullPacket,
    mapFullPacketModelMatrix,
    createDoublePacketParser,
    normalizeFiniteFrame,
    bytes4ToInt10,
    numLessZeroToZero,
    handL,
    handR,
    handRVideo1470506,
    publishSit,
    publishBack,
    getRuntime: () => runtimeStateStore.snapshot(HAND_RUNTIME_SNAPSHOT_KEYS),
    setRuntime: (next = {}) => runtimeStateStore.patch(next),
  });

  function handleHandGloveFullPacket(buffer, fallbackSide) {
    return handPacketRuntime.handleFullPacket(buffer, fallbackSide);
  }

  function handleHandGloveDoublePacket(buffer, fallbackSide, sourcePort) {
    return handPacketRuntime.handleDoublePacket(buffer, fallbackSide, sourcePort);
  }

  return {
    handPacketRuntime,
    handleHandGloveDoublePacket,
    handleHandGloveFullPacket,
  };
}

module.exports = {
  HAND_RUNTIME_SNAPSHOT_KEYS,
  createServerHandRuntime,
};
