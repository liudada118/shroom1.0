/**
 * 创建旧 262 字节手套帧处理器。
 *
 * 该协议历史上写在 legacySerialFrameRuntime 的 sit 分支里。拆出后，
 * legacySerialFrameRuntime 只负责按帧长度分发，具体点位映射和输出由本处理器完成。
 *
 * @param {object} options 依赖。
 * @param {Function} options.gloves0123Res 手套原始点位整理函数。
 * @param {Function} options.gloves0123 手套展示点位映射函数。
 * @returns {{ processSit262Frame: Function }} 处理器。
 */
function createLegacyGloveFrameProcessor({
  gloves0123Res,
  gloves0123,
}) {
  /**
   * 处理一帧 262 字节的旧手套数据。
   *
   * 帧结构 = 256 点压力 + 尾部 6 字节姿态。**长度不等于 262 直接返回 null 交回上层**，
   * 不做容错解析：同一条串口上还跑着 1024 矩阵、分段帧等别的帧长，猜错比不认更糟。
   *
   * 两道映射顺序不能换：`gloves0123Res` 整理原始点序 → `gloves0123` 转展示点位。
   *
   * @param {Buffer|Uint8Array|number[]} buffer 原始帧。
   * @param {{port1?: {isOpen?: boolean}, port2?: {isOpen?: boolean}}} [options] 串口状态，用于给 payload 附加开合标记。
   * @returns {{pointArr: number[], rotate: number[], payload: object, jsonData: string}|null}
   *          解析结果；帧长不符时为 null。
   */
  function processSit262Frame(buffer, {
    port1,
    port2,
  } = {}) {
    if (!buffer || buffer.length !== 262) return null;

    let pointArr = Array.from(buffer);
    // splice 的第二个参数是 deleteCount，这里传的是 length 而不是 6。行为上没问题
    // （deleteCount 超出剩余长度就取到末尾，等价于取那 6 个字节），但读起来容易误解成
    // 「取到 length 位置」。保持原样是为了不动已验证过的旧行为，看的时候按「取尾部 6 字节」理解。
    const rotate = pointArr.splice(pointArr.length - 6, pointArr.length);
    pointArr = gloves0123Res(pointArr);
    pointArr = gloves0123(pointArr);

    const payload = {
      sitData: pointArr,
      rotate,
      sitFlag: port1?.isOpen,
      backFlag: port2?.isOpen,
    };
    return {
      pointArr,
      rotate,
      payload,
      jsonData: JSON.stringify(payload),
    };
  }

  return {
    processSit262Frame,
  };
}

module.exports = {
  createLegacyGloveFrameProcessor,
};
