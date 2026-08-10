/**
 * 触觉手套双包协议解析模块。
 *
 * 该协议由 130 字节首包和 146 字节尾包组成，尾包中包含 16 字节 IMU。
 * 模块只负责分包缓存和压力/IMU 数据合并，不处理线序映射、清零和 WebSocket 输出。
 */
const TYPE = 'hand0205Double';
const FIRST_PACKET_LENGTH = 130;
const SECOND_PACKET_LENGTH = 146;
const PACKET_SIDE_BY_TYPE = Object.freeze({
  1: 'left',
  2: 'right',
});

/**
 * 将串口 Buffer 转成普通字节数组，便于后续 slice 和拼接。
 * @param {Buffer | Uint8Array | number[]} buffer 原始串口包。
 * @returns {number[]} 字节数组。
 */
function toPacketBytes(buffer) {
  return Array.from(Buffer.from(buffer || []));
}

/**
 * 根据协议包类型推断左右手，无法识别时使用 fallback。
 * @param {number|string} packetType 协议包类型字段。
 * @param {'left'|'right'} fallbackSide 默认手侧。
 * @returns {'left'|'right'} 包所属手侧。
 */
function getPacketSide(packetType, fallbackSide = 'left') {
  return PACKET_SIDE_BY_TYPE[Number(packetType)] || fallbackSide;
}

/**
 * 创建双包解析器实例。
 *
 * 解析器内部按 left/right 缓存首包，因此同一个实例应绑定到同一条运行时链路。
 * @returns {object} 双包解析器。
 */
function createHandGloveDoublePacketParser() {
  const chunks = {
    left: [],
    right: [],
  };

  /**
   * 清空指定手侧或全部手侧的首包缓存。
   * @param {'left'|'right'} [side] 要清空的手侧。
   */
  function reset(side) {
    if (side === 'left' || side === 'right') {
      chunks[side] = [];
      return;
    }
    chunks.left = [];
    chunks.right = [];
  }

  /**
   * 处理 130 字节首包，只缓存压力前半段，不返回完整帧。
   * @param {Buffer | Uint8Array | number[]} buffer 首包数据。
   * @param {'left'|'right'} fallbackSide 默认手侧。
   * @returns {null | {complete: false, packetType: number, side: string}} 首包处理结果。
   */
  function handleFirstPacket(buffer, fallbackSide = 'left') {
    if (!buffer || buffer.length !== FIRST_PACKET_LENGTH) return null;

    const bytes = toPacketBytes(buffer);
    const side = getPacketSide(bytes[1], fallbackSide);
    chunks[side] = bytes.slice(2);
    return {
      complete: false,
      packetType: bytes[1],
      side,
    };
  }

  /**
   * 处理 146 字节尾包，合并首包压力数据并拆出 IMU 字节。
   * @param {Buffer | Uint8Array | number[]} buffer 尾包数据。
   * @param {'left'|'right'} fallbackSide 默认手侧。
   * @param {string} sourcePort 数据来源端口。
   * @returns {null | object} 完整压力帧和 IMU 数据。
   */
  function handleSecondPacket(buffer, fallbackSide = 'left', sourcePort = 'sit') {
    if (!buffer || buffer.length !== SECOND_PACKET_LENGTH) return null;

    const bytes = toPacketBytes(buffer);
    const side = getPacketSide(bytes[1], fallbackSide);
    const firstChunk = chunks[side] || [];
    const rest = bytes.slice(2);
    const imuBytes = rest.slice(rest.length - 16);
    const secondChunk = rest.slice(0, rest.length - 16);
    const pressureData = [...firstChunk, ...secondChunk];
    chunks[side] = [];

    return {
      complete: true,
      packetType: bytes[1],
      side,
      sourcePort,
      pressureData,
      imuBytes,
    };
  }

  /**
   * 根据包长度自动分派首包或尾包处理。
   * @param {Buffer | Uint8Array | number[]} buffer 原始串口包。
   * @param {'left'|'right'} fallbackSide 默认手侧。
   * @param {string} sourcePort 数据来源端口。
   * @returns {null | object} 分包处理结果。
   */
  function handlePacket(buffer, fallbackSide = 'left', sourcePort = 'sit') {
    if (!buffer) return null;
    if (buffer.length === FIRST_PACKET_LENGTH) {
      return handleFirstPacket(buffer, fallbackSide);
    }
    if (buffer.length === SECOND_PACKET_LENGTH) {
      return handleSecondPacket(buffer, fallbackSide, sourcePort);
    }
    return null;
  }

  return {
    handleFirstPacket,
    handlePacket,
    handleSecondPacket,
    reset,
  };
}

module.exports = {
  TYPE,
  FIRST_PACKET_LENGTH,
  SECOND_PACKET_LENGTH,
  PACKET_SIDE_BY_TYPE,
  createHandGloveDoublePacketParser,
  getPacketSide,
};
