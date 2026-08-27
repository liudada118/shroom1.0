import { describe, expect, it } from 'vitest'
import {
  HUMAN_BODY_RAW_DATA_PART_KEYS,
  HUMAN_BODY_RAW_SLOTS,
  HUMAN_BODY_RAW_VIEWS,
} from './humanBodyRawLayout'

const EXPECTED_PART_KEYS = [
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

describe('human body raw-data layout', () => {
  it('places all ten source matrices exactly once', () => {
    expect(HUMAN_BODY_RAW_DATA_PART_KEYS).toHaveLength(10)
    expect(new Set(HUMAN_BODY_RAW_DATA_PART_KEYS).size).toBe(10)
    expect([...HUMAN_BODY_RAW_DATA_PART_KEYS].sort()).toEqual([...EXPECTED_PART_KEYS].sort())
  })

  it('places front left parts on the screen left and right parts on the screen right', () => {
    const front = HUMAN_BODY_RAW_VIEWS.find((view) => view.key === 'front')

    expect(front.upperSlots.map((slot) => slot.dataPartKey)).toEqual([
      'leftArm',
      'leftShoulder',
      'chest',
      'rightShoulder',
      'rightArm',
    ])
    expect(front.lowerSlots.map((slot) => slot.displayPartKey)).toEqual([
      'frontPantsRight',
      'frontPantsLeft',
    ])
  })

  it('uses the established crossed data sources for the back-leg display slots', () => {
    const back = HUMAN_BODY_RAW_VIEWS.find((view) => view.key === 'back')

    expect(back.lowerSlots).toEqual([
      {
        slotKey: 'back-left-leg',
        displayPartKey: 'backPantsLeft',
        dataPartKey: 'backPantsRight',
      },
      {
        slotKey: 'back-right-leg',
        displayPartKey: 'backPantsRight',
        dataPartKey: 'backPantsLeft',
      },
    ])
  })

  it('keeps every layout slot immutable and tied to one source matrix', () => {
    expect(Object.isFrozen(HUMAN_BODY_RAW_VIEWS)).toBe(true)
    expect(Object.isFrozen(HUMAN_BODY_RAW_SLOTS)).toBe(true)
    HUMAN_BODY_RAW_VIEWS.forEach((view) => {
      expect(Object.isFrozen(view)).toBe(true)
      expect(Object.isFrozen(view.upperSlots)).toBe(true)
      expect(Object.isFrozen(view.lowerSlots)).toBe(true)
    })
    HUMAN_BODY_RAW_SLOTS.forEach((slot) => {
      expect(Object.isFrozen(slot)).toBe(true)
      expect(typeof slot.dataPartKey).toBe('string')
    })
  })
})
