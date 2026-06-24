/**
 * 小床 12B 串口运行时。
 *
 * 该模块只负责小床 12B 的实时串口帧处理：原始 buffer 解析、零点扣除、
 * 压力值标定、运行时状态同步和实时通道输出。串口事件绑定仍留在 server.js，
 * 但 onData 回调不再承载具体业务逻辑。
 */

/**
 * 创建小床 12B 串口运行时。
 * @param {object} options 运行时依赖。
 * @returns {{handleFrame: Function}} 小床 12B runtime。
 */
function createSmallBed12BRuntime({
  smallBed12B,
  sensorType,
  getSensorType,
  getLineOrder,
  getZeroFrame,
  subtractZero,
  calibration,
  getDisplayOptions,
  getHz,
  transposeSquareMatrix,
  getNowDate,
  getEndDate,
  setCurrentPressureFrame,
  setZeroSourceFrame,
  setCurrentDisplayData,
  sendSitFrame,
}) {
  /**
   * 处理一帧小床 12B 串口数据。
   *
   * @param {Buffer|number[]|Uint8Array} data 串口 parser 输出的原始帧数据。
   * @returns {boolean} 是否成功生成并发送实时帧。
   */
  function handleFrame(data) {
    const frame = smallBed12B.buildRealtimeFrameFromBuffer(Buffer.from(data), {
      lineOrder: getLineOrder(),
      zeroFrame: getZeroFrame(),
      subtractZero,
      calibration,
      displayOptions: getDisplayOptions(),
      hz: getHz(),
      transposeSquareMatrix,
    });

    if (!(getNowDate() < getEndDate() && getSensorType() === sensorType && frame)) {
      return false;
    }

    setZeroSourceFrame([...frame.orderedFrame]);
    setCurrentPressureFrame(frame.pressureData);
    setCurrentDisplayData([...frame.pressureData]);
    sendSitFrame(JSON.stringify(frame.realtimeFrame));
    return true;
  }

  return {
    handleFrame,
  };
}

module.exports = {
  createSmallBed12BRuntime,
};
