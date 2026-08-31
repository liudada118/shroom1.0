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
  zeroFrameAdapter,
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
   * 将对象帧转换为内部管线沿用的 JSON 字符串。
   * WebSocket 边界会再把它投影为唯一 `sensor.frame`，这不是 wire 契约。
   *
   * @param {string | object} frame 实时帧对象或字符串。
   * @returns {string} JSON 字符串。
   */
  function stringifyFrame(frame) {
    return typeof frame === 'string' ? frame : JSON.stringify(frame);
  }

  /**
   * 在入库和网络发布之前统一应用 legacy channel 零点。
   * Manifest 帧已携带 channelId，adapter 会保持原样，避免重复扣零。
   */
  function prepareFrame(channel, frame, options = {}) {
    const parsed = parseFrame(frame);
    const adapterResult = zeroFrameAdapter?.prepare
      ? zeroFrameAdapter.prepare(channel, parsed, {
        sourceStages: options?.zeroSources,
      })
      : {
        frame: zeroFrameAdapter?.process
          ? zeroFrameAdapter.process(channel, parsed, {
            sourceStages: options?.zeroSources,
          })
          : parsed,
        zeroedStages: {},
      };
    return {
      frame: adapterResult.frame,
      payloadText: stringifyFrame(adapterResult.frame),
      zeroedStages: adapterResult.zeroedStages || {},
    };
  }

  /**
   * 发布坐垫实时帧。
   *
   * @param {string|object} jsonData 坐垫实时帧，兼容旧调用传入 JSON 字符串。
   * @returns {{ stored: boolean, sent: number, jsonData: string, frame: object }} 输出结果。
   */
  function publishSit(jsonData, options = {}) {
    const prepared = prepareFrame('sit', jsonData, options);
    let payloadText = prepared.payloadText;
    let frameToStore = prepared.frame;

    if (getSensorType() === minzhenType && Array.isArray(frameToStore.sitData)) {
      frameToStore = {
        ...frameToStore,
        sitData: applyMinzhenBackendGauss(frameToStore.sitData),
      };
      payloadText = JSON.stringify(frameToStore);
    }

    const stored = options?.store === false
      ? false
      : collectionFrameStorage.storeSit(frameToStore);
    const sent = options?.publish === false
      ? 0
      : publishRealtimeChannel('sit', payloadText);
    return {
      stored,
      sent,
      jsonData: payloadText,
      frame: frameToStore,
      zeroedStages: prepared.zeroedStages,
    };
  }

  /**
   * 发布靠背实时帧。
   *
   * @param {string|object} jsonData 靠背实时帧，兼容旧调用传入 JSON 字符串。
   * @returns {{ stored: boolean, sent: number, jsonData: string, frame: object }} 输出结果。
   */
  function publishBack(jsonData, options = {}) {
    const { frame, payloadText, zeroedStages } = prepareFrame('back', jsonData, options);
    const stored = collectionFrameStorage.storeBack(frame);
    const sent = publishRealtimeChannel('back', payloadText);
    return { stored, sent, jsonData: payloadText, frame, zeroedStages };
  }

  /**
   * 发布头枕实时帧。
   *
   * 头枕历史上不走发送频率限制，因此这里保留 `respectFrequency: false`。
   *
   * @param {string|object} jsonData 头枕实时帧，兼容旧调用传入 JSON 字符串。
   * @returns {{ stored: boolean, sent: number, jsonData: string, frame: object }} 输出结果。
   */
  function publishHead(jsonData, options = {}) {
    const { frame, payloadText, zeroedStages } = prepareFrame('head', jsonData, options);
    const stored = collectionFrameStorage.storeHead(frame);
    const sent = publishRealtimeChannel('head', payloadText, { respectFrequency: false });
    return { stored, sent, jsonData: payloadText, frame, zeroedStages };
  }

  /**
   * 发布 sit/back/head 之外的实时帧。
   *
   * 展示系统的 manifest 可以声明任意数量的传感器，它们统一存入主库并由
   * canonical channelId 隔离；outputChannel 只是展示别名，不再决定数据库数量。
   *
   * @param {string} channel 输出通道名，例如 armLeft。
   * @param {string|object} jsonData 实时帧。
   * @returns {{ stored: boolean, sent: number, jsonData: string, frame: object }} 输出结果。
   */
  function publishAux(channel, jsonData, options = {}) {
    const { frame, payloadText, zeroedStages } = prepareFrame(channel, jsonData, options);
    const stored = options?.store === false
      ? false
      : collectionFrameStorage.storeFrame(frame, { fallbackChannel: channel });
    const sent = options?.publish === false
      ? 0
      : publishRealtimeChannel(channel, payloadText);
    return { stored, sent, jsonData: payloadText, frame, zeroedStages };
  }

  return {
    publishAux,
    publishBack,
    publishHead,
    publishSit,
  };
}

module.exports = {
  createFrameOutputPipeline,
};
