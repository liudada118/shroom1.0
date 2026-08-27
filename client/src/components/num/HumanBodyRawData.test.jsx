import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../i18n'

const rawDataCss = readFileSync(
  new URL('./HumanBodyRawData.css', import.meta.url),
  'utf8',
)

let HumanBodyRawData
let getHumanBodyRawPartStats
let orientHumanBodyRawPartValues

beforeAll(async () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
  })
  ;({
    default: HumanBodyRawData,
    getHumanBodyRawPartStats,
    orientHumanBodyRawPartValues,
  } = await import('./HumanBodyRawData'))
})

afterAll(() => {
  delete globalThis.localStorage
})

const renderRawDataView = () => renderToStaticMarkup(
  <HumanBodyRawData data={{ current: null }} />,
)

describe('HumanBodyRawData', () => {
  it('renders one canvas for each of the ten raw-data slots', () => {
    const markup = renderRawDataView()
    const canvasCount = (markup.match(/<canvas/g) || []).length
    const slotCount = (markup.match(/data-slot-key=/g) || []).length

    expect(canvasCount).toBe(10)
    expect(slotCount).toBe(10)
  })

  it('renders both anatomy regions without nested overview cards or English map labels', () => {
    const markup = renderRawDataView()

    expect(markup).toContain('>正面</h2>')
    expect(markup).toContain('>背面</h2>')
    expect((markup.match(/human-body-raw__view-heading/g) || []).length).toBe(2)
    expect((markup.match(/human-body-raw__lower/g) || []).length).toBe(2)
    expect(markup).not.toContain('ANATOMY MAP')
    expect(markup).not.toContain('human-body-raw__intro')
    expect(markup).not.toContain('human-body-raw__view-header')
    expect(markup).not.toContain('human-body-raw__lower-panel')
    expect(markup).not.toContain('humanBodyRaw.')
    expect(markup).not.toContain('<button')
  })

  it('renders front left-side slots before the chest and right-side slots after it', () => {
    const markup = renderRawDataView()
    const orderedSlots = [
      'front-left-arm',
      'front-left-shoulder',
      'front-chest',
      'front-right-shoulder',
      'front-right-arm',
      'front-left-leg',
      'front-right-leg',
    ]
    const positions = orderedSlots.map((slotKey) => (
      markup.indexOf(`data-slot-key="${slotKey}"`)
    ))

    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((left, right) => left - right))
  })

  it('sizes the wide front row from matrix column counts so every displayed cell stays equal', () => {
    const markup = renderRawDataView()

    expect(markup).toMatch(
      /data-slot-key="front-left-arm"[^>]*style="[^"]*--human-body-part-columns:7/,
    )
    expect(markup).toMatch(
      /data-slot-key="front-left-shoulder"[^>]*style="[^"]*--human-body-part-columns:3/,
    )
    expect(markup).toMatch(
      /data-slot-key="front-chest"[^>]*style="[^"]*--human-body-part-columns:10/,
    )
    expect(rawDataCss).toMatch(
      /flex:\s*var\(--human-body-part-columns\)\s+1\s+16px/,
    )
  })

  it('flips the back raw matrix vertically while preserving its horizontal rule', () => {
    const orientedValues = orientHumanBodyRawPartValues(
      [1, 2, 3, 4, 5, 6],
      { key: 'back', width: 3, height: 2 },
    )

    expect(orientedValues).toEqual([6, 5, 4, 3, 2, 1])
  })

  it('flips both front-leg raw matrices horizontally without swapping rows', () => {
    ;['frontPantsLeft', 'frontPantsRight'].forEach((partKey) => {
      const orientedValues = orientHumanBodyRawPartValues(
        [1, 2, 3, 4, 5, 6],
        { key: partKey, width: 3, height: 2 },
      )

      expect(orientedValues).toEqual([3, 2, 1, 6, 5, 4])
    })
  })

  it('derives card and view summaries without changing the source values', () => {
    const values = [0, 12, -3, 7]

    expect(getHumanBodyRawPartStats(values)).toEqual({
      total: 4,
      active: 2,
      peak: 12,
    })
    expect(values).toEqual([0, 12, -3, 7])
  })

  it('renders the established crossed back-leg data sources in their anatomical slots', () => {
    const markup = renderRawDataView()

    expect(markup).toMatch(
      /data-slot-key="back-left-leg"[^>]*data-display-part-key="backPantsLeft"[^>]*data-part-key="backPantsRight"/,
    )
    expect(markup).toMatch(
      /data-slot-key="back-right-leg"[^>]*data-display-part-key="backPantsRight"[^>]*data-part-key="backPantsLeft"/,
    )
  })
})
