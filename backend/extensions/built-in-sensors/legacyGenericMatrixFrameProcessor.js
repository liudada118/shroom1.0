/**
 * 遗留通用矩阵帧处理器。
 *
 * 负责从 legacy runtime 中拆出的纯字节矩阵协议：
 * 72/144 低密度坐垫帧、256 单帧矩阵、4096 大床矩阵。
 * 这里只做字节读取、零点扣除、线序修正和 payload 构造，不直接发送 WebSocket。
 */
function createLegacyGenericMatrixFrameProcessor({
  isCar,
  isSmallBedMatrixType,
  numLessZeroToZero,
  zeroLineMatrix,
}) {
  /**
   * 将 Buffer/Uint8Array 按无符号字节读取成普通数组。
   * @param {Buffer | Uint8Array | number[]} data 原始串口帧。
   * @returns {number[]} 字节数组。
   */
  function readUInt8Frame(data) {
    const buffer = Buffer.from(data);
    const frame = new Array(buffer.length);
    for (let index = 0; index < buffer.length; index++) {
      frame[index] = buffer.readUInt8(index);
    }
    return frame;
  }

  /**
   * 按零点帧扣除压力值，并把负值强制归零。
   * @param {number[]} frame 原始或线序修正后的压力帧。
   * @param {number[]} zeroFrame 零点帧。
   * @returns {number[]} 扣零后的压力帧。
   */
  function subtractZeroFrame(frame, zeroFrame = []) {
    return Array.isArray(zeroFrame) && zeroFrame.length
      ? frame.map((value, index) => numLessZeroToZero(value - zeroFrame[index]))
      : frame;
  }

  /**
   * 构造 legacy SIT 通道实时 payload。
   * @param {number[]} frame 要输出的坐垫矩阵。
   * @param {object} context 当前运行时上下文。
   * @returns {string} JSON 字符串。
   */
  function buildSitPayload(frame, context) {
    const {
      colHZ,
      file,
      newArr,
      port1,
      port2,
    } = context;

    if (isCar(file)) {
      return JSON.stringify({
        sitData: frame,
        sitFlag: port1?.isOpen,
        backFlag: port2?.isOpen,
        hz: colHZ,
      });
    }

    return JSON.stringify({
      sitData: isSmallBedMatrixType(file) || file === 'smallBed1' ? newArr : frame,
      hz: colHZ,
    });
  }

  /**
   * 处理 72/144 字节低密度坐垫矩阵帧。
   * @param {Buffer | Uint8Array | number[]} data 原始串口帧。
   * @param {object} context 当前运行时上下文。
   * @returns {null | {frame: number[], zeroSourceFrame: number[], jsonData: string}} 处理结果。
   */
  function processLowDensitySitFrame(data, context) {
    const buffer = Buffer.from(data);
    if (buffer.length !== 72 && buffer.length !== 144) return null;

    const zeroSourceFrame = readUInt8Frame(buffer);
    const frame = subtractZeroFrame(zeroSourceFrame, context.pointArr1zero);

    return {
      frame,
      zeroSourceFrame: [...zeroSourceFrame],
      jsonData: buildSitPayload(frame, context),
    };
  }

  /**
   * 处理 256 字节单帧矩阵。
   * @param {Buffer | Uint8Array | number[]} data 原始串口帧。
   * @param {object} context 当前运行时上下文。
   * @returns {null | {frame: number[], jsonData: string}} 处理结果。
   */
  function processSit256Frame(data, context) {
    const buffer = Buffer.from(data);
    if (buffer.length !== 256) return null;

    const frame = readUInt8Frame(buffer);
    return {
      frame,
      jsonData: buildSitPayload(frame, context),
    };
  }

  /**
   * 处理 bed4096 64x64 大矩阵帧。
   * @param {Buffer | Uint8Array | number[]} data 原始串口帧。
   * @param {object} context 当前运行时上下文。
   * @returns {null | {frame: number[], jsonData: string}} 处理结果。
   */
  function processBed4096Frame(data, context) {
    const buffer = Buffer.from(data);
    if (!String(context.file || '').includes('bed4096') || buffer.length !== 4096) {
      return null;
    }

    const frame = zeroLineMatrix(readUInt8Frame(buffer), 64);
    return {
      frame,
      jsonData: buildSitPayload(frame, context),
    };
  }

  return {
    processBed4096Frame,
    processLowDensitySitFrame,
    processSit256Frame,
  };
}

module.exports = {
  createLegacyGenericMatrixFrameProcessor,
};
