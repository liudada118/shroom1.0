import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { buildGloveHandLayout, GLOVE_HAND_POINTS, HAND_WIDTH } from './gloveHandLayout'

const { buildHandGloveCsvSegments } = createRequire(import.meta.url)('../../../../backend/kernel/csv/gloveCsv.js')
const indexedPressure = Array.from({ length: 256 }, (_, index) => index + 1)

/** 用唯一压力值验证实际 CSV 导出点序，不依赖后端源码位置或文本格式。 */
function readCsvSegmentPoints(side, key) {
  return JSON.parse(buildHandGloveCsvSegments(indexedPressure, side)[key])
}

describe('glove hand 2D layout', () => {
  for (const side of ['left', 'right']) {
    const layout = buildGloveHandLayout(side)

    it(`${side}: 137 个点位全部落在 256 点范围内且不重复`, () => {
      const indices = layout.cells.map((cell) => cell.index)
      expect(indices).toHaveLength(5 * 12 + 5 + 12 + 15 * 4)
      expect(new Set(indices).size).toBe(indices.length)
      indices.forEach((index) => {
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(256)
      })
    })

    it(`${side}: 格子位置不重叠且不超出手宽`, () => {
      const positions = layout.cells.map((cell) => `${cell.x},${cell.y}`)
      expect(new Set(positions).size).toBe(positions.length)
      layout.cells.forEach((cell) => {
        expect(cell.x).toBeGreaterThanOrEqual(0)
        expect(cell.x + 1).toBeLessThanOrEqual(HAND_WIDTH)
      })
    })

    it(`${side}: 点位与后端 CSV 实际导出顺序一致`, () => {
      const points = GLOVE_HAND_POINTS[side]
      for (const key of ['littleFinger', 'ringFinger', 'middleFinger', 'indexFinger', 'thumb']) {
        expect(points[key].rows.flat()).toEqual(readCsvSegmentPoints(side, key))
      }
      const pulps = ['littleFinger', 'ringFinger', 'middleFinger', 'indexFinger', 'thumb'].map((key) => points[key].pulp)
      expect(pulps).toEqual(readCsvSegmentPoints(side, 'fingerRoot'))
      expect(points.palm.flat()).toEqual(readCsvSegmentPoints(side, 'palm'))
    })
  }
})
