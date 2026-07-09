const { createBackHead1024FrameProcessor } = require('../sensors/runtime/backHead1024FrameProcessor');
const { createSit1024FrameProcessor } = require('../sensors/runtime/sit1024FrameProcessor');

/**
 * 创建 server 侧传感器帧处理器集合。
 *
 * 这里只负责把启动期依赖注入到 1024 坐垫、靠背、头枕 processor。
 * 具体帧处理逻辑仍在 sensors/runtime 下，避免 server.js 继续膨胀。
 *
 * @param {object} deps 线序、算法、常量和判断函数。
 * @returns {{sit1024FrameProcessor: object, backHead1024FrameProcessor: object}}
 */
function createServerSensorProcessors(deps) {
  return {
    sit1024FrameProcessor: createSit1024FrameProcessor({
      HAND_SINGLE_POINT_TYPE: deps.HAND_SINGLE_POINT_TYPE,
      MINZHEN_TYPE: deps.MINZHEN_TYPE,
      WHOLE_CHAIR_TYPE: deps.WHOLE_CHAIR_TYPE,
      arrToRealLine: deps.arrToRealLine,
      car10Sit: deps.car10Sit,
      carCol: deps.carCol,
      carSitLine: deps.carSitLine,
      carYLine: deps.carYLine,
      endiSit1024: deps.endiSit1024,
      gloves: deps.gloves,
      gloves1: deps.gloves1,
      gloves2: deps.gloves2,
      handBlue: deps.handBlue,
      handSinglePoint: deps.handSinglePoint,
      isCar: deps.isCar,
      isPetCareSystem: deps.isPetCareSystem,
      isSmallBedMatrixType: deps.isSmallBedMatrixType,
      jqbed: deps.jqbed,
      matColLine: deps.matColLine,
      maskMinzhenMatrixValues: deps.maskMinzhenMatrixValues,
      newHand: deps.newHand,
      normalizeWholeChairFrame: deps.normalizeWholeChairFrame,
      numLessZeroToZero: deps.numLessZeroToZero,
      press6sit: deps.press6sit,
      pressNew1220: deps.pressNew1220,
      pressNew12203131: deps.pressNew12203131,
      rect: deps.rect,
      short: deps.short,
      sit10Line: deps.sit10Line,
      sit100Line: deps.sit100Line,
      smallBed1: deps.smallBed1,
      smallM1: deps.smallM1,
      tempFullBed: deps.tempFullBed,
      wowSitLine: deps.wowSitLine,
      xiyueReal1: deps.xiyueReal1,
      yanfeng10sit: deps.yanfeng10sit,
    }),
    backHead1024FrameProcessor: createBackHead1024FrameProcessor({
      HAND_SINGLE_POINT_TYPE: deps.HAND_SINGLE_POINT_TYPE,
      WHOLE_CHAIR_TYPE: deps.WHOLE_CHAIR_TYPE,
      arrToRealLine: deps.arrToRealLine,
      car10Back: deps.car10Back,
      carBackLine: deps.carBackLine,
      carYLine: deps.carYLine,
      handSinglePoint: deps.handSinglePoint,
      isCar: deps.isCar,
      normalizeWholeChairFrame: deps.normalizeWholeChairFrame,
      numLessZeroToZero: deps.numLessZeroToZero,
      wowBackLine: deps.wowBackLine,
      wowhead: deps.wowhead,
      yanfeng10back: deps.yanfeng10back,
    }),
  };
}

module.exports = {
  createServerSensorProcessors,
};
