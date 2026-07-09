/**
 * 创建旧 262 字节手套帧处理器。
 *
 * 该协议历史上写在 legacySerialFrameRuntime 的 sit 分支里。拆出后，
 * legacySerialFrameRuntime 只负责按帧长度分发，具体点位映射和输出由本处理器完成。
 *
 * @param {object} options 依赖。
 * @param {Function} options.gloves0123Res 手套原始点位整理函数。
 * @param {Function} options.gloves0123 手套展示点位映射函数。
 * @param {Function} options.publishSystemEvent 系统事件发布函数。
 * @returns {{ processSit262Frame: Function }} 处理器。
 */
function createLegacyGloveFrameProcessor({
  gloves0123Res,
  gloves0123,
  publishSystemEvent,
}) {
  function processSit262Frame(buffer, {
    port1,
    port2,
  } = {}) {
    if (!buffer || buffer.length !== 262) return null;

    let pointArr = Array.from(buffer);
    const rotate = pointArr.splice(pointArr.length - 6, pointArr.length);
    pointArr = gloves0123Res(pointArr);
    pointArr = gloves0123(pointArr);

    const payload = {
      sitData: pointArr,
      rotate,
      sitFlag: port1?.isOpen,
      backFlag: port2?.isOpen,
    };
    publishSystemEvent(JSON.stringify(payload));

    return {
      pointArr,
      rotate,
      payload,
    };
  }

  return {
    processSit262Frame,
  };
}

module.exports = {
  createLegacyGloveFrameProcessor,
};
