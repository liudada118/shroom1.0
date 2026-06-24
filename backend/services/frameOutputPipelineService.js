/**
 * 创建实时帧输出管线。
 *
 * 该服务统一处理传感器实时帧的三件事：
 * 1. 将 JSON 文本转换为可入库对象。
 * 2. 按传感器类型执行后端兼容处理。
 * 3. 写入采集存储并发布到实时通道。
 */
function createFrameOutputPipeline({
  collectionFrameStorage,
  publishRealtimeChannel,
  getSensorType,
  minzhenType,
  applyMinzhenBackendGauss,
}) {
  /**
   * 将旧调用传入的 JSON 字符串转换为对象。
   *
   * @param {string | object} jsonData 实时帧数据。
   * @returns {object} 可入库的帧对象。
   */
  function parseFrame(jsonData) {
    return typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
  }

  /**
   * 将对象帧转换为旧 WebSocket 兼容的 JSON 字符串。
   *
   * @param {string | object} frame 实时帧对象或字符串。
   * @returns {string} JSON 字符串。
   */
  function stringifyFrame(frame) {
    return typeof frame === 'string' ? frame : JSON.stringify(frame);
  }

  /**
   * 发布坐垫实时帧。
   *
   * @param {string|object} jsonData 坐垫实时帧，兼容旧调用传入 JSON 字符串。
   * @returns {{ stored: boolean, sent: number, jsonData: string }} 输出结果。
   */
  function publishSit(jsonData) {
    let payloadText = stringifyFrame(jsonData);
    let frameToStore = parseFrame(payloadText);

    if (getSensorType() === minzhenType && Array.isArray(frameToStore.sitData)) {
      frameToStore = {
        ...frameToStore,
        sitData: applyMinzhenBackendGauss(frameToStore.sitData),
      };
      payloadText = JSON.stringify(frameToStore);
    }

    const stored = collectionFrameStorage.storeSit(frameToStore);
    const sent = publishRealtimeChannel('sit', payloadText);
    return { stored, sent, jsonData: payloadText };
  }

  /**
   * 发布靠背实时帧。
   *
   * @param {string|object} jsonData 靠背实时帧，兼容旧调用传入 JSON 字符串。
   * @returns {{ stored: boolean, sent: number, jsonData: string }} 输出结果。
   */
  function publishBack(jsonData) {
    const payloadText = stringifyFrame(jsonData);
    const stored = collectionFrameStorage.storeBack(parseFrame(payloadText));
    const sent = publishRealtimeChannel('back', payloadText);
    return { stored, sent, jsonData: payloadText };
  }

  /**
   * 发布头枕实时帧。
   *
   * 头枕历史上不走发送频率限制，因此这里保留 `respectFrequency: false`。
   *
   * @param {string|object} jsonData 头枕实时帧，兼容旧调用传入 JSON 字符串。
   * @returns {{ stored: boolean, sent: number, jsonData: string }} 输出结果。
   */
  function publishHead(jsonData) {
    const payloadText = stringifyFrame(jsonData);
    const stored = collectionFrameStorage.storeHead(parseFrame(payloadText));
    const sent = publishRealtimeChannel('head', payloadText, { respectFrequency: false });
    return { stored, sent, jsonData: payloadText };
  }

  return {
    publishBack,
    publishHead,
    publishSit,
  };
}

module.exports = {
  createFrameOutputPipeline,
};
