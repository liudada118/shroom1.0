/**
 * 创建旧实时帧发送函数的兼容适配层。
 *
 * 旧串口 runtime 仍使用 colOrSendData / colOrSendData1 / colOrSendData2
 * 这组三个函数名；本服务把这些历史命名收敛到 frameOutputPipeline。
 *
 * @param {object} options 创建参数。
 * @param {object} options.frameOutputPipeline 实时帧输出管线。
 * @returns {{ colOrSendData: Function, colOrSendData1: Function, colOrSendData2: Function }} 旧函数名适配器。
 */
function createRealtimeFrameDispatchService({ frameOutputPipeline }) {
  /**
   * 发送坐面实时帧。
   *
   * @param {string|object} jsonData 坐面实时帧。
   * @returns {object} 输出管线结果。
   */
  function colOrSendData(jsonData) {
    return frameOutputPipeline.publishSit(jsonData);
  }

  /**
   * 发送靠背实时帧。
   *
   * @param {string|object} jsonData 靠背实时帧。
   * @returns {object} 输出管线结果。
   */
  function colOrSendData1(jsonData) {
    return frameOutputPipeline.publishBack(jsonData);
  }

  /**
   * 发送头枕实时帧。
   *
   * @param {string|object} jsonData 头枕实时帧。
   * @returns {object} 输出管线结果。
   */
  function colOrSendData2(jsonData) {
    return frameOutputPipeline.publishHead(jsonData);
  }

  return {
    colOrSendData,
    colOrSendData1,
    colOrSendData2,
  };
}

module.exports = {
  createRealtimeFrameDispatchService,
};
