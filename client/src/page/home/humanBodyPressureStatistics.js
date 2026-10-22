/** 从原始压力帧统计实际通道；点位索引为 0-based，重复索引只计一次。 */
export function getHumanBodyPressureStatistics(frame, sensorIndices) {
  if (!Array.isArray(frame) || frame.length < 1024) return null

  const indices = sensorIndices ? [...new Set(sensorIndices)] : Array.from({ length: 1024 }, (_, index) => index)
  const activeValues = indices.map((index) => Number(frame[index]))
    .filter((value) => Number.isFinite(value) && value > 0)
  const point = activeValues.length
  const totalPres = activeValues.reduce((sum, value) => sum + value, 0)
  return {
    point,
    area: point,
    totalPres,
    maxPres: activeValues.length ? Math.max(...activeValues) : 0,
    meanPres: totalPres / (point || 1),
  }
}
