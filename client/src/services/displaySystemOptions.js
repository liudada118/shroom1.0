/** 首页与运行页共用的内置系统入口；这里只描述分类，不决定授权或传感器协议。 */
export const BUILTIN_SYSTEM_ENTRIES = Object.freeze([
  ['hand', 'sensorHand', 'embodied'],
  ['hand0205', 'sensorHand0205', 'embodied'],
  ['hand0205Double', 'sensorHand0205Double', 'embodied'],
  ['handGlove115200', 'sensorHandGlove115200', 'embodied'],
  ['handGloveFullPacket', 'sensorHandGloveFullPacket', 'embodied'],
  ['smallSample', 'sensorSmallSample', 'custom'],
  ['robot1', 'sensorRobot1', 'embodied'],
  ['robotSY', 'sensorRobotSY', 'embodied'],
  ['robotLCF', 'sensorRobotLCF', 'embodied'],
  ['footVideo', 'sensorFootVideo', 'care'],
  ['daliegu', 'sensorDaliegu', 'custom'],
  ['bed4096num', 'sensorBed4096num', 'care'],
  ['bed4096', 'sensorBed4096', 'care'],
  ['jqbed', 'sensorJqbed', 'care'],
  ['smallBedNoAlg', 'sensorSmallBedNoAlg', 'care'],
  ['smallBed12B', 'sensorSmallBed12B', 'care'],
  ['matCol', 'sensorMatCol', 'care'],
  ['tempFullBed', 'sensorTempFullBed', 'care'],
  ['petCare', 'sensorPetCare', 'care'],
  ['petCareMini', 'sensorPetCareMini', 'care'],
  ['wholeChair', 'sensorWholeChair', 'vehicle'],
  ['minzhen', 'sensorMinzhen', 'vehicle'],
  ['fast256', 'sensorFast256', 'custom'],
  ['fast1024', 'sensorFast1024', 'custom'],
  ['handSinglePoint', 'sensorHandSinglePoint', 'embodied'],
  ['normal', 'sensorNormal', 'custom'],
  ['carQX', 'chairQX', 'vehicle'],
  ['humanBodyOptimized', 'sensorHumanBodyOptimized', 'embodied'],
]);

/** 返回与旧运行页顺序、翻译完全一致的系统选项。 */
export function getBuiltinSystemOptions(t) {
  return BUILTIN_SYSTEM_ENTRIES.map(([value, labelKey, category]) => ({
    value, label: t(labelKey), category, source: 'builtin',
  }));
}
