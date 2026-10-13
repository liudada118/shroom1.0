const sensorMap = require('../pressureVestSensorMap.json');

const SENSOR_INDICES = Object.freeze([
  ...new Set(Object.values(sensorMap).flatMap(rows => rows.flat().map(channel => channel - 1))),
]);

/** 统计背心实际接入的唯一通道；只计有限正值，完整原始帧不做修改。 */
function getPressureVestStatistics(frame) {
  const activeValues = Array.isArray(frame) && frame.length >= 1024
    ? SENSOR_INDICES.map(index => Number(frame[index])).filter(value => Number.isFinite(value) && value > 0)
    : [];
  const point = activeValues.length;
  const totalPres = activeValues.reduce((sum, value) => sum + value, 0);
  return {
    point,
    area: point,
    totalPres,
    maxPres: activeValues.length ? Math.max(...activeValues) : 0,
    meanPres: totalPres / (point || 1),
  };
}

module.exports = { SENSOR_INDICES, getPressureVestStatistics };
