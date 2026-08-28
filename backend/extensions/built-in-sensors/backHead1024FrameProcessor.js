/**
 * BACK/HEAD 1024 字节矩阵帧处理器。
 *
 * 负责靠背和头枕单帧矩阵链路：
 * 原始字节读取 -> 区域线序转换 -> 零点扣除 -> 实时 payload 构造。
 */
function createBackHead1024FrameProcessor(deps) {
  const {
    HAND_SINGLE_POINT_TYPE,
    WHOLE_CHAIR_TYPE,
    arrToRealLine,
    car10Back,
    carBackLine,
    carYLine,
    handSinglePoint,
    isCar,
    normalizeWholeChairFrame,
    numLessZeroToZero,
    wowBackLine,
    wowhead,
    yanfeng10back,
  } = deps;

  /**
   * 将 1024 字节 Buffer 读取成普通字节数组。
   * @param {Buffer} buffer 原始帧。
   * @returns {number[]} 字节矩阵。
   */
  function readUInt8Frame(buffer) {
    const frame = new Array(buffer.length);
    for (let index = 0; index < buffer.length; index++) {
      frame[index] = buffer.readUInt8(index);
    }
    return frame;
  }

  /**
   * 根据传感器类型映射 BACK 区域线序。
   * @param {number[]} frame 原始矩阵。
   * @param {string} file 传感器类型。
   * @returns {number[]} 映射后的 BACK 矩阵。
   */
  function mapBackFrame(frame, file) {
    if (file === 'car10') return car10Back(frame);
    if (file === 'yanfeng10') return yanfeng10back(frame);
    if (file === 'volvo') return wowBackLine(frame);
    if (file === 'carQX') return frame;
    if (file === WHOLE_CHAIR_TYPE) return normalizeWholeChairFrame('back', frame);
    if (file === HAND_SINGLE_POINT_TYPE) return handSinglePoint(frame);
    if (file === 'sofa') return arrToRealLine(frame, [[7, 0], [8, 15]], [[0, 15]], 32);
    if (file === 'carY') return carYLine(frame);
    return carBackLine(frame);
  }

  /**
   * 根据传感器类型映射 HEAD 区域线序。
   * @param {number[]} frame 原始矩阵。
   * @param {string} file 传感器类型。
   * @returns {number[]} 映射后的 HEAD 矩阵。
   */
  function mapHeadFrame(frame, file) {
    if (file === 'volvo') return wowhead(frame);
    if (file === WHOLE_CHAIR_TYPE) return normalizeWholeChairFrame('head', frame);
    return frame;
  }

  /**
   * 扣除零点帧，并将负值归零。
   * @param {number[]} frame 原始矩阵。
   * @param {number[]} zeroFrame 零点矩阵。
   * @returns {number[]} 扣零后的矩阵。
   */
  function applyZero(frame, zeroFrame = []) {
    return Array.isArray(zeroFrame) && zeroFrame.length
      ? frame.map((value, index) => numLessZeroToZero(value - zeroFrame[index]))
      : frame;
  }

  /**
   * 构造 BACK/HEAD 实时输出 payload。
   * @param {'back'|'head'} channel 业务通道。
   * @param {number[]} frame 矩阵数据。
   * @param {object} context 运行时上下文。
   * @returns {object} payload 对象。
   */
  function buildPayload(channel, frame, context) {
    const key = channel === 'head' ? 'headData' : 'backData';
    if (isCar(context.file)) {
      return {
        [key]: frame,
        sitFlag: context.port1?.isOpen,
        backFlag: context.port2?.isOpen,
      };
    }
    return { [key]: frame };
  }

  /**
   * 处理一帧 BACK 1024 字节矩阵数据。
   * @param {Buffer | Uint8Array | number[]} data 原始帧。
   * @param {object} context 运行时上下文。
   * @returns {null | {frame:number[], zeroSourceFrame:number[], jsonData:string}} 处理结果。
   */
  function processBackFrame(data, context) {
    const buffer = Buffer.from(data);
    if (buffer.length !== 1024) return null;

    const zeroSourceFrame = mapBackFrame(readUInt8Frame(buffer), context.file);
    const frame = applyZero(zeroSourceFrame, context.zeroFrame);
    return {
      frame,
      zeroSourceFrame: [...zeroSourceFrame],
      jsonData: JSON.stringify(buildPayload('back', frame, context)),
    };
  }

  /**
   * 处理一帧 HEAD 1024 字节矩阵数据。
   * @param {Buffer | Uint8Array | number[]} data 原始帧。
   * @param {object} context 运行时上下文。
   * @returns {null | {frame:number[], zeroSourceFrame:number[], jsonData:string}} 处理结果。
   */
  function processHeadFrame(data, context) {
    const buffer = Buffer.from(data);
    if (buffer.length !== 1024) return null;

    const zeroSourceFrame = mapHeadFrame(readUInt8Frame(buffer), context.file);
    const frame = applyZero(zeroSourceFrame, context.zeroFrame);
    return {
      frame,
      zeroSourceFrame: [...zeroSourceFrame],
      jsonData: JSON.stringify(buildPayload('head', frame, context)),
    };
  }

  return {
    processBackFrame,
    processHeadFrame,
  };
}

module.exports = {
  createBackHead1024FrameProcessor,
};
