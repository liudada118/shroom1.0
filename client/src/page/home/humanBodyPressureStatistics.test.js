import { describe, expect, it } from 'vitest'
import { getHumanBodyPressureStatistics } from './humanBodyPressureStatistics'
import { PRESSURE_VEST_SENSOR_INDICES } from '../../components/video/pressureVestConfig'

describe('人体与背心的原始压力统计', () => {
  it('人体默认保留原有1024通道统计，忽略非有限值和非正值', () => {
    const frame = new Array(1024).fill(0)
    frame[0] = '12.5'
    frame[1] = 7.5
    frame[2] = -5
    frame[3] = Number.NaN
    frame[4] = Number.POSITIVE_INFINITY
    expect(getHumanBodyPressureStatistics(frame)).toEqual({
      point: 2, area: 2, totalPres: 20, maxPres: 12.5, meanPres: 10,
    })
  })

  it('背心只统计436个实际点，未接入通道的高值不影响压力和面积', () => {
    const frame = new Array(1024).fill(255)
    PRESSURE_VEST_SENSOR_INDICES.forEach((index) => { frame[index] = 0 })
    frame[692 - 1] = 80
    frame[69 - 1] = 40
    frame[1024 - 1] = 20
    frame[789 - 1] = 60
    expect(getHumanBodyPressureStatistics(frame, PRESSURE_VEST_SENSOR_INDICES)).toEqual({
      point: 4, area: 4, totalPres: 200, maxPres: 80, meanPres: 50,
    })
    expect(getHumanBodyPressureStatistics(frame).point).toBeGreaterThan(4)
  })

  it('重复投影不会重复计数，统计不会修改原帧', () => {
    const frame = new Array(1024).fill(0)
    frame[0] = 30
    frame[1] = 10
    const original = frame.slice()
    expect(getHumanBodyPressureStatistics(frame, [0, 0, 1]).totalPres).toBe(40)
    expect(getHumanBodyPressureStatistics(frame, [0, 0, 1]).point).toBe(2)
    expect(frame).toEqual(original)
  })

  it('实时帧和采集回放的JSON帧使用相同点位与统计，不完整帧不更新', () => {
    const frame = new Array(1024).fill(0)
    PRESSURE_VEST_SENSOR_INDICES.forEach((index, order) => { frame[index] = order % 256 })
    const replayFrame = JSON.parse(JSON.stringify(frame))
    expect(getHumanBodyPressureStatistics(replayFrame, PRESSURE_VEST_SENSOR_INDICES))
      .toEqual(getHumanBodyPressureStatistics(frame, PRESSURE_VEST_SENSOR_INDICES))
    expect(getHumanBodyPressureStatistics(frame.slice(0, 1023), PRESSURE_VEST_SENSOR_INDICES)).toBeNull()
    expect(getHumanBodyPressureStatistics(null)).toBeNull()
    expect(getHumanBodyPressureStatistics(new Array(1024).fill(0), PRESSURE_VEST_SENSOR_INDICES))
      .toEqual({ point: 0, area: 0, totalPres: 0, maxPres: 0, meanPres: 0 })
  })
})
