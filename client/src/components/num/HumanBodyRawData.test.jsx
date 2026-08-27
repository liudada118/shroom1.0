import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import '../../i18n'
import {
  HUMAN_BODY_RAW_SLOTS,
  HUMAN_BODY_RAW_VIEWS,
} from './humanBodyRawLayout'

const rawDataCss = readFileSync(
  new URL('./HumanBodyRawData.css', import.meta.url),
  'utf8',
)

let HumanBodyRawData
let getHumanBodyRawPartStats
let getHumanBodyRawProjectedValues

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
    getHumanBodyRawProjectedValues,
  } = await import('./HumanBodyRawData'))
})

afterAll(() => {
  delete globalThis.localStorage
})

const renderRawDataView = () => renderToStaticMarkup(
  <HumanBodyRawData data={{ current: null }} />,
)

describe('HumanBodyRawData', () => {
  it('renders only the seven front-view canvases by default', () => {
    const markup = renderRawDataView()
    const canvasCount = (markup.match(/<canvas/g) || []).length
    const slotCount = (markup.match(/data-slot-key=/g) || []).length

    expect(HUMAN_BODY_RAW_SLOTS).toHaveLength(14)
    expect(canvasCount).toBe(7)
    expect(slotCount).toBe(7)
  })

  it('offers front and back view buttons while keeping only the front atlas mounted initially', () => {
    const markup = renderRawDataView()
    const frontButton = markup.match(/<button[^>]*>正面<\/button>/)?.[0]
    const backButton = markup.match(/<button[^>]*>背面<\/button>/)?.[0]

    expect(frontButton).toContain('aria-pressed="true"')
    expect(backButton).toContain('aria-pressed="false"')
    expect((markup.match(/<button/g) || []).length).toBe(2)
    expect(markup).toContain('>正面</h2>')
    expect(markup).not.toContain('>背面</h2>')
    expect(markup).toContain('前裤（中线分开）')
    expect(markup).not.toContain('后裤（中线分开）')
    expect((markup.match(/human-body-raw__view-heading/g) || []).length).toBe(1)
    expect((markup.match(/human-body-raw__lower-heading/g) || []).length).toBe(1)
    expect(markup).not.toContain('humanBodyRaw.')
  })

  it('renders the front slots in the exact screen-left to screen-right table order', () => {
    const markup = renderRawDataView()
    const orderedSlots = [
      'front-right-arm',
      'front-right-shoulder',
      'front-chest',
      'front-left-shoulder',
      'front-left-arm',
      'front-right-leg',
      'front-left-leg',
    ]
    const positions = orderedSlots.map((slotKey) => (
      markup.indexOf(`data-slot-key="${slotKey}"`)
    ))

    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((left, right) => left - right))
    expect(markup).not.toMatch(/data-slot-key="back-/)
  })

  it('uses matrix column counts for the 7:3:10:3:7 upper atlas widths', () => {
    const markup = renderRawDataView()

    expect(markup).toMatch(
      /data-slot-key="front-right-arm"[^>]*style="[^"]*--human-body-part-columns:7/,
    )
    expect(markup).toMatch(
      /data-slot-key="front-right-shoulder"[^>]*style="[^"]*--human-body-part-columns:3/,
    )
    expect(markup).toMatch(
      /data-slot-key="front-chest"[^>]*style="[^"]*--human-body-part-columns:10/,
    )
  })

  it('uses a single-view atlas and compensates each upper card shell equally', () => {
    expect(rawDataCss).not.toMatch(/grid-template-columns:\s*repeat\(67,/)
    expect(rawDataCss).toMatch(
      /human-body-raw__views\s*{[^}]*width:\s*100%/s,
    )
    expect(rawDataCss).toMatch(
      /human-body-raw__view\s*{[^}]*width:\s*100%/s,
    )
    expect(rawDataCss).toMatch(
      /human-body-raw__upper\s*>\s*\.human-body-raw__part\s*{[^}]*flex:\s*var\(--human-body-part-columns\)\s+1\s+16px/s,
    )
    expect(rawDataCss).toMatch(
      /human-body-raw__lower[^}]*first-child\s*{[^}]*grid-column:\s*10\s*\/\s*span\s*5/s,
    )
    expect(rawDataCss).toMatch(
      /human-body-raw__lower[^}]*last-child\s*{[^}]*grid-column:\s*17\s*\/\s*span\s*5/s,
    )
  })

  it('projects channel numbers and values through the same display matrix', () => {
    const source = Array.from({ length: 1024 }, (_, index) => index + 1)
    const slot = HUMAN_BODY_RAW_SLOTS.find(({ slotKey }) => slotKey === 'front-right-arm')

    expect(getHumanBodyRawProjectedValues(source, slot.indexMatrix)).toEqual(
      slot.indexMatrix.flat(),
    )
    expect(getHumanBodyRawProjectedValues(source, slot.indexMatrix).slice(0, 7)).toEqual([
      733, 765, 797, 829, 861, 1021, 989,
    ])
  })

  it('reports real source-point counts even when torso rows repeat visually', () => {
    const markup = renderRawDataView()
    const chestFigure = markup.match(
      /<figure[^>]*data-slot-key="front-chest"[\s\S]*?<\/figure>/,
    )?.[0]

    expect(chestFigure).toContain('10 × 12 · 60')
  })

  it('derives summaries without changing the source values', () => {
    const values = [0, 12, -3, 7]

    expect(getHumanBodyRawPartStats(values)).toEqual({
      total: 4,
      active: 2,
      peak: 12,
    })
    expect(values).toEqual([0, 12, -3, 7])
  })

  it('keeps the established crossed source matrices for the back-leg display slots', () => {
    const backView = HUMAN_BODY_RAW_VIEWS.find(({ key }) => key === 'back')
    const backLeftLeg = backView.lowerSlots.find(({ slotKey }) => slotKey === 'back-left-leg')
    const backRightLeg = backView.lowerSlots.find(({ slotKey }) => slotKey === 'back-right-leg')

    expect(backLeftLeg).toMatchObject({
      displayPartKey: 'backPantsLeft',
      sourcePartKey: 'backPantsRight',
    })
    expect(backRightLeg).toMatchObject({
      displayPartKey: 'backPantsRight',
      sourcePartKey: 'backPantsLeft',
    })
  })
})
