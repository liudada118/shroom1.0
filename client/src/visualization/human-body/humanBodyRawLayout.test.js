import { describe, expect, it } from 'vitest'
import {
  HUMAN_BODY_RAW_DATA_PART_KEYS,
  HUMAN_BODY_RAW_SLOTS,
  HUMAN_BODY_RAW_SOURCE_MATRICES,
  HUMAN_BODY_RAW_VIEWS,
  projectHumanBodyRawMatrix,
} from './humanBodyRawLayout'

const EXPECTED_SOURCE_KEYS = [
  'back',
  'chest',
  'rightArm',
  'rightShoulder',
  'leftArm',
  'leftShoulder',
  'backPantsRight',
  'backPantsLeft',
  'frontPantsLeft',
  'frontPantsRight',
]

const getView = (key) => HUMAN_BODY_RAW_VIEWS.find((view) => view.key === key)
const getSlot = (slotKey) => HUMAN_BODY_RAW_SLOTS.find((slot) => slot.slotKey === slotKey)

describe('human body raw-data atlas projection', () => {
  it('keeps all ten physical source matrices and exposes fourteen display slots', () => {
    expect(HUMAN_BODY_RAW_DATA_PART_KEYS).toHaveLength(10)
    expect([...HUMAN_BODY_RAW_DATA_PART_KEYS].sort()).toEqual([...EXPECTED_SOURCE_KEYS].sort())
    expect(HUMAN_BODY_RAW_SLOTS).toHaveLength(14)
    expect(new Set(HUMAN_BODY_RAW_SLOTS.map((slot) => slot.slotKey)).size).toBe(14)
  })

  it('uses the exact 7 + 3 + 10 + 3 + 7 unfolded upper-body order', () => {
    const front = getView('front')
    const back = getView('back')

    expect(front.upperSlots.map((slot) => slot.sourcePartKey)).toEqual([
      'rightArm',
      'rightShoulder',
      'chest',
      'leftShoulder',
      'leftArm',
    ])
    expect(front.upperSlots.map((slot) => slot.width)).toEqual([7, 3, 10, 3, 7])

    expect(back.upperSlots.map((slot) => slot.sourcePartKey)).toEqual([
      'leftArm',
      'leftShoulder',
      'back',
      'rightShoulder',
      'rightArm',
    ])
    expect(back.upperSlots.map((slot) => slot.width)).toEqual([7, 3, 10, 3, 7])
  })

  it('projects every upper-body first row with the calibrated back-right override', () => {
    const expectedFirstRows = {
      'front-right-arm': [733, 765, 797, 829, 861, 1021, 989],
      'front-right-shoulder': [957, 925, 893],
      'front-chest': [692, 691, 690, 689, 688, 682, 681, 680, 679, 678],
      'front-left-shoulder': [888, 920, 952],
      'front-left-arm': [984, 1016, 856, 824, 792, 760, 728],
      'back-left-arm': [727, 759, 791, 823, 855, 1015, 983],
      'back-left-shoulder': [951, 919, 887],
      'back-torso': [5, 4, 3, 2, 1, 15, 14, 13, 12, 11],
      'back-right-shoulder': [894, 926, 958],
      'back-right-arm': [990, 1022, 862, 830, 798, 766, 734],
    }

    Object.entries(expectedFirstRows).forEach(([slotKey, expected]) => {
      expect(getSlot(slotKey).indexMatrix[0]).toEqual(expected)
    })
  })

  it('flips only the three back-right shoulder and arm rows after physical calibration', () => {
    const rightShoulder = getSlot('back-right-shoulder')
    const rightArm = getSlot('back-right-arm')

    expect(rightShoulder.rowOrder).toEqual([2, 1, 0])
    expect(rightShoulder.colOrder).toEqual([2, 1, 0])
    expect(rightShoulder.indexMatrix).toEqual([
      [894, 926, 958],
      [895, 927, 959],
      [896, 928, 960],
    ])

    expect(rightArm.rowOrder).toEqual([2, 1, 0])
    expect(rightArm.colOrder).toEqual([6, 5, 4, 3, 2, 1, 0])
    expect(rightArm.indexMatrix).toEqual([
      [990, 1022, 862, 830, 798, 766, 734],
      [991, 1023, 863, 831, 799, 767, 735],
      [992, 1024, 864, 832, 800, 768, 736],
    ])
  })

  it('uses the exact front/back pants rows and preserves crossed back display semantics', () => {
    const front = getView('front')
    const back = getView('back')

    expect(front.lowerSlots.map((slot) => slot.slotKey)).toEqual([
      'front-right-leg',
      'front-left-leg',
    ])
    expect(front.lowerSlots.map((slot) => slot.sourcePartKey)).toEqual([
      'frontPantsLeft',
      'frontPantsRight',
    ])
    expect(front.lowerSlots.map((slot) => slot.indexMatrix[0])).toEqual([
      [500, 499, 498, 497, 496],
      [202, 201, 200, 199, 198],
    ])

    expect(back.lowerSlots.map((slot) => ({
      slotKey: slot.slotKey,
      sourcePartKey: slot.sourcePartKey,
      displayPartKey: slot.displayPartKey,
    }))).toEqual([
      {
        slotKey: 'back-left-leg',
        sourcePartKey: 'backPantsRight',
        displayPartKey: 'backPantsLeft',
      },
      {
        slotKey: 'back-right-leg',
        sourcePartKey: 'backPantsLeft',
        displayPartKey: 'backPantsRight',
      },
    ])
    expect(back.lowerSlots.map((slot) => slot.indexMatrix[0])).toEqual([
      [197, 196, 195, 194, 193],
      [495, 494, 493, 492, 491],
    ])
  })

  it('repeats only chest and back source rows to form twelve visual rows', () => {
    const chest = getSlot('front-chest')
    const back = getSlot('back-torso')

    expect(chest.rowRepeat).toBe(2)
    expect(back.rowRepeat).toBe(2)
    expect(chest.height).toBe(12)
    expect(back.height).toBe(12)

    ;[chest, back].forEach((slot) => {
      for (let rowIndex = 0; rowIndex < slot.height; rowIndex += 2) {
        expect(slot.indexMatrix[rowIndex + 1]).toEqual(slot.indexMatrix[rowIndex])
      }
    })
    HUMAN_BODY_RAW_SLOTS
      .filter((slot) => !['front-chest', 'back-torso'].includes(slot.slotKey))
      .forEach((slot) => expect(slot.rowRepeat).toBe(1))
  })

  it('contains 520 visible cells backed by exactly 400 physical channels', () => {
    const visibleChannels = HUMAN_BODY_RAW_SLOTS.flatMap((slot) => slot.indexMatrix.flat())
    const channelCounts = visibleChannels.reduce((counts, channel) => {
      counts.set(channel, (counts.get(channel) ?? 0) + 1)
      return counts
    }, new Map())

    expect(visibleChannels).toHaveLength(520)
    expect(channelCounts.size).toBe(400)
    expect([...channelCounts.values()].filter((count) => count === 2)).toHaveLength(120)
    expect([...channelCounts.values()].filter((count) => count === 1)).toHaveLength(280)
    expect([...channelCounts.values()].every((count) => count === 1 || count === 2)).toBe(true)
  })

  it('projects rows and columns without mutating the source matrix', () => {
    const source = [[1, 2, 3], [4, 5, 6]]
    const projected = projectHumanBodyRawMatrix(source, {
      rowOrder: [1, 0],
      colOrder: [2, 0],
      rowRepeat: 2,
    })

    expect(projected).toEqual([
      [6, 4],
      [6, 4],
      [3, 1],
      [3, 1],
    ])
    expect(source).toEqual([[1, 2, 3], [4, 5, 6]])
    expect(projected[0]).not.toBe(projected[1])
  })

  it('deep-freezes source matrices, views, projections and descriptor metadata', () => {
    expect(Object.isFrozen(HUMAN_BODY_RAW_SOURCE_MATRICES)).toBe(true)
    Object.values(HUMAN_BODY_RAW_SOURCE_MATRICES).forEach((matrix) => {
      expect(Object.isFrozen(matrix)).toBe(true)
      matrix.forEach((row) => expect(Object.isFrozen(row)).toBe(true))
    })

    expect(Object.isFrozen(HUMAN_BODY_RAW_VIEWS)).toBe(true)
    expect(Object.isFrozen(HUMAN_BODY_RAW_SLOTS)).toBe(true)
    HUMAN_BODY_RAW_VIEWS.forEach((view) => {
      expect(Object.isFrozen(view)).toBe(true)
      expect(Object.isFrozen(view.upperSlots)).toBe(true)
      expect(Object.isFrozen(view.lowerSlots)).toBe(true)
    })
    HUMAN_BODY_RAW_SLOTS.forEach((slot) => {
      expect(Object.isFrozen(slot)).toBe(true)
      expect(Object.isFrozen(slot.rowOrder)).toBe(true)
      expect(Object.isFrozen(slot.colOrder)).toBe(true)
      expect(Object.isFrozen(slot.indexMatrix)).toBe(true)
      slot.indexMatrix.forEach((row) => expect(Object.isFrozen(row)).toBe(true))
      expect(slot.width).toBe(slot.indexMatrix[0].length)
      expect(slot.height).toBe(slot.indexMatrix.length)
      expect(typeof slot.titleKey).toBe('string')
      expect(typeof slot.fallbackLabel).toBe('string')
    })
  })
})
