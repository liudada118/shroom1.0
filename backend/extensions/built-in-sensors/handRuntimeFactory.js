const { createHandPacketRuntime } = require('./handPacketRuntime');

const HAND_RUNTIME_SNAPSHOT_KEYS = Object.freeze([
  'file',
  'port1',
  'port2',
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
    handL,
    handR,
    handRVideo1470506,
    publishSit,
    publishBack,
    getRuntime: () => runtimeStateStore.snapshot(HAND_RUNTIME_SNAPSHOT_KEYS),
    setRuntime: (next = {}) => runtimeStateStore.patch(next),
  });

  /**
   * 完整手套包入口（转发给 handPacketRuntime）。
   *
   * 这层薄壳存在的意义只有一个：给旧 server 侧一个**稳定的具名函数**，
   * 让它不必持有 handPacketRuntime 实例、也不必知道方法叫 handleFullPacket。
   * 换实现时只改这里的函数体，旧调用点不动。
   *
   * @param {Buffer|Uint8Array|number[]} buffer 完整手套协议包。
   * @param {'left'|'right'} fallbackSide 包内无明确侧别时使用的默认侧。
   * @returns {boolean} 当前包是否被完整手套协议消费。
   */
  function handleHandGloveFullPacket(buffer, fallbackSide) {
    return handPacketRuntime.handleFullPacket(buffer, fallbackSide);
  }

  /**
   * 双包手套入口（转发给 handPacketRuntime）。
   *
   * 与上面同理，是给旧 server 的稳定入口。比完整包多一个 `sourcePort`，
   * 但它**不参与左右手判定** —— 侧别由包内第 2 字节决定
   * （`sdk/backend/sensors/handGloveDouble.js` 的 `PACKET_SIDE_BY_TYPE`：1=left、2=right），
   * 判不出来才退到 `fallbackSide`。`sourcePort` 只是被原样带到实时 payload 的
   * `packetSourcePort` 字段上当来源标记，供上层区分「这一帧来自哪个物理口」。
   *
   * @param {Buffer|Uint8Array|number[]} buffer 双包协议中的一包。
   * @param {'left'|'right'} fallbackSide 包内第 2 字节判不出侧别时使用的默认侧。
   * @param {string} sourcePort 来源串口标识，仅作为来源标记透传，不影响路由。
   * @returns {boolean} 当前包是否被双包手套协议消费。
   */
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
