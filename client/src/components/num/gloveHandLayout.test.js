import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildGloveHandLayout, GLOVE_HAND_POINTS, HAND_WIDTH } from './gloveHandLayout'

const serverSource = readFileSync(fileURLToPath(new URL('../../../../server.js', import.meta.url)), 'utf8')

function readServerSegmentPoints(side, key) {
  const sideStart = serverSource.indexOf(`${side}: {`, serverSource.indexOf('const HAND_GLOVE_CSV_SEGMENT_POINTS'))
  const match = serverSource.slice(sideStart).match(new RegExp(`${key}: \\[([\\d,\\s]+)\\]`))
  return match[1].split(',').map((value) => value.trim()).filter(Boolean).map(Number)
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

    it(`${side}: 点位与 server.js CSV 分指表一致`, () => {
      const points = GLOVE_HAND_POINTS[side]
      for (const key of ['littleFinger', 'ringFinger', 'middleFinger', 'indexFinger', 'thumb']) {
        expect(points[key].rows.flat()).toEqual(readServerSegmentPoints(side, key))
      }
      const pulps = ['littleFinger', 'ringFinger', 'middleFinger', 'indexFinger', 'thumb'].map((key) => points[key].pulp)
      expect(pulps).toEqual(readServerSegmentPoints(side, 'fingerRoot'))
      expect(points.palm.flat()).toEqual(readServerSegmentPoints(side, 'palm'))
    })
  }
})
