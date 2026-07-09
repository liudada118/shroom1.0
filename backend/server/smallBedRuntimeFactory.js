const { createSmallBed12BRuntime } = require('../sensors/runtime/smallBed12BRuntime');

/**
 * 创建 server 侧小床 12B runtime 装配入口。
 *
 * 这里仅注入运行时状态、零点状态和实时输出函数。
 * 小床帧解析与 payload 生成仍由 sensors/runtime/smallBed12BRuntime.js 负责。
 *
 * @param {object} options 装配依赖。
 * @returns {{handleFrame: Function}} 小床 12B runtime。
 */
function createServerSmallBedRuntime({
  smallBed12B,
  smallBed12BType,
  runtimeContext,
  getLineOrder,
  getZeroFrame,
  subtractZero,
  calibration,
  getDisplayOptions,
  getHz,
  transposeSquareMatrix,
  getEndDate,
  setCurrentPressureFrame,
  setZeroSourceFrame,
  setCurrentDisplayData,
  sendSitFrame,
}) {
  return createSmallBed12BRuntime({
    smallBed12B,
    sensorType: smallBed12BType,
    getSensorType: runtimeContext.getSensorType,
    getLineOrder,
    getZeroFrame,
    subtractZero,
    calibration,
    getDisplayOptions,
    getHz,
    transposeSquareMatrix,
    getNowDate: runtimeContext.getNowDate,
    getEndDate,
    setCurrentPressureFrame,
    setZeroSourceFrame,
    setCurrentDisplayData,
    sendSitFrame,
  });
}

module.exports = {
  createServerSmallBedRuntime,
};
