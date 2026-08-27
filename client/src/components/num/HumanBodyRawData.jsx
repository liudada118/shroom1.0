import React, { useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { findMax } from '../../assets/util/util'
import { HUMAN_BODY_RAW_VIEWS } from './humanBodyRawLayout'
import { orientPartMatrix } from '../video/humanBodyOrientation'
import './HumanBodyRawData.css'

const BACK_IDX = [
  [619, 620, 621, 622, 623, 609, 610, 611, 612, 613],
  [651, 652, 653, 654, 655, 641, 642, 643, 644, 645],
  [683, 684, 685, 686, 687, 673, 674, 675, 676, 677],
  [75, 76, 77, 78, 79, 65, 66, 67, 68, 69],
  [43, 44, 45, 46, 47, 33, 34, 35, 36, 37],
  [11, 12, 13, 14, 15, 1, 2, 3, 4, 5],
]

const CHEST_IDX = [
  [692, 691, 690, 689, 688, 682, 681, 680, 679, 678],
  [660, 659, 658, 657, 656, 650, 649, 648, 647, 646],
  [628, 627, 626, 625, 624, 618, 617, 616, 615, 614],
  [20, 19, 18, 17, 16, 10, 9, 8, 7, 6],
  [52, 51, 50, 49, 48, 42, 41, 40, 39, 38],
  [84, 83, 82, 81, 80, 74, 73, 72, 71, 70],
]

const RIGHT_ARM_IDX = [
  [736, 768, 800, 832, 864, 1024, 992],
  [735, 767, 799, 831, 863, 1023, 991],
  [734, 766, 798, 830, 862, 1022, 990],
  [733, 765, 797, 829, 861, 1021, 989],
  [732, 764, 796, 828, 860, 1020, 988],
  [731, 763, 795, 827, 859, 1019, 987],
]

const RIGHT_SHOULDER_IDX = [
  [960, 928, 896],
  [959, 927, 895],
  [958, 926, 894],
  [957, 925, 893],
  [956, 924, 892],
  [955, 923, 891],
]

const LEFT_ARM_IDX = [
  [1013, 981, 853, 821, 789, 757, 725],
  [1014, 982, 854, 822, 790, 758, 726],
  [1015, 983, 855, 823, 791, 759, 727],
  [1016, 984, 856, 824, 792, 760, 728],
  [1017, 985, 857, 825, 793, 761, 729],
  [1018, 986, 858, 826, 794, 762, 730],
]

const LEFT_SHOULDER_IDX = [
  [885, 917, 949],
  [886, 918, 950],
  [887, 919, 951],
  [888, 920, 952],
  [889, 921, 953],
  [890, 922, 954],
]

const BACK_PANTS_RIGHT_IDX = [
  [197, 196, 195, 194, 193],
  [165, 164, 163, 162, 161],
  [133, 132, 131, 130, 129],
  [101, 100, 99, 98, 97],
  [229, 228, 227, 226, 225],
  [261, 260, 259, 258, 257],
  [293, 292, 291, 290, 289],
  [325, 324, 323, 322, 321],
].reverse()

const BACK_PANTS_LEFT_IDX = [
  [495, 494, 493, 492, 491],
  [527, 526, 525, 524, 523],
  [559, 558, 557, 556, 555],
  [591, 590, 589, 588, 587],
  [463, 462, 461, 460, 459],
  [431, 430, 429, 428, 427],
  [399, 398, 397, 396, 395],
  [367, 366, 365, 364, 363],
].reverse()

const FRONT_PANTS_LEFT_IDX = [
  [500, 499, 498, 497, 496],
  [532, 531, 530, 529, 528],
  [564, 563, 562, 561, 560],
  [596, 595, 594, 593, 592],
  [468, 467, 466, 465, 464],
  [436, 435, 434, 433, 432],
  [404, 403, 402, 401, 400],
  [372, 371, 370, 369, 368],
]

const FRONT_PANTS_RIGHT_IDX = [
  [202, 201, 200, 199, 198],
  [170, 169, 168, 167, 166],
  [138, 137, 136, 135, 134],
  [106, 105, 104, 103, 102],
  [234, 233, 232, 231, 230],
  [266, 265, 264, 263, 262],
  [298, 297, 296, 295, 294],
  [330, 329, 328, 327, 326],
]

const PART_CONFIGS = [
  { key: 'back', titleKey: 'bodyParts.back', fallbackLabel: '背部', indexMatrix: BACK_IDX },
  { key: 'chest', titleKey: 'bodyParts.chest', fallbackLabel: '胸部', indexMatrix: CHEST_IDX },
  { key: 'rightArm', titleKey: 'bodyParts.rightArm', fallbackLabel: '右臂', indexMatrix: RIGHT_ARM_IDX },
  { key: 'rightShoulder', titleKey: 'bodyParts.rightShoulder', fallbackLabel: '右肩', indexMatrix: RIGHT_SHOULDER_IDX },
  { key: 'leftArm', titleKey: 'bodyParts.leftArm', fallbackLabel: '左臂', indexMatrix: LEFT_ARM_IDX },
  { key: 'leftShoulder', titleKey: 'bodyParts.leftShoulder', fallbackLabel: '左肩', indexMatrix: LEFT_SHOULDER_IDX },
  { key: 'backPantsRight', titleKey: 'bodyParts.rightBackLeg', fallbackLabel: '右后腿', indexMatrix: BACK_PANTS_RIGHT_IDX },
  { key: 'backPantsLeft', titleKey: 'bodyParts.leftBackLeg', fallbackLabel: '左后腿', indexMatrix: BACK_PANTS_LEFT_IDX },
  { key: 'frontPantsLeft', titleKey: 'bodyParts.rightFrontLeg', fallbackLabel: '右前腿', indexMatrix: FRONT_PANTS_LEFT_IDX },
  { key: 'frontPantsRight', titleKey: 'bodyParts.leftFrontLeg', fallbackLabel: '左前腿', indexMatrix: FRONT_PANTS_RIGHT_IDX },
].map((part) => ({
  ...part,
  width: part.indexMatrix[0].length,
  height: part.indexMatrix.length,
}))

const PART_CONFIGS_BY_KEY = Object.freeze(Object.fromEntries(
  PART_CONFIGS.map((part) => [part.key, part]),
))

const normalizeSourceData = (value) => {
  const source = Array.isArray(value) ? value : []
  return new Array(1024).fill(0).map((_, index) => {
    const numberValue = Number(source[index])
    return Number.isFinite(numberValue) ? numberValue : 0
  })
}

const createDefaultSource = () => new Array(1024).fill(0)

const HORIZONTAL_FLIP_PARTS = new Set([
  'back',
  'chest',
  'rightArm',
  'rightShoulder',
  'leftArm',
  'leftShoulder',
  'frontPantsLeft',
  'frontPantsRight',
])

export const orientHumanBodyRawPartValues = (values, part) => {
  let matrix = Array.from({ length: part.height }, (_, rowIndex) =>
    values.slice(rowIndex * part.width, (rowIndex + 1) * part.width)
  )

  if (HORIZONTAL_FLIP_PARTS.has(part.key)) {
    matrix = matrix.map((row) => [...row].reverse())
  }

  matrix = orientPartMatrix(part.key, matrix)

  return matrix.flat()
}

const PART_DISPLAY_POSITIONS_BY_KEY = Object.freeze(Object.fromEntries(
  PART_CONFIGS.map((part) => [
    part.key,
    Object.freeze(orientHumanBodyRawPartValues(part.indexMatrix.flat(), part)),
  ]),
))

export const getHumanBodyRawPartStats = (values = []) => ({
  total: values.length,
  active: values.filter((value) => value > 0).length,
  peak: findMax(values),
})

const getViewStats = (view, parts) => getHumanBodyRawPartStats(
  [...view.upperSlots, ...view.lowerSlots].flatMap(
    (slot) => parts[slot.dataPartKey] || [],
  ),
)

const getPartValues = (source, part) => {
  const values = part.indexMatrix.flatMap((row) =>
    row.map((position) => source[position - 1] || 0)
  )

  return orientHumanBodyRawPartValues(values, part)
}

const getPartCanvasMetrics = (part) => {
  const cellWidth = 28
  const cellHeight = 28
  return {
    cellWidth,
    cellHeight,
    width: part.width * cellWidth,
    height: part.height * cellHeight,
  }
}

const traceRoundedRect = (ctx, x, y, width, height, radius) => {
  const safeRadius = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + safeRadius, y)
  ctx.lineTo(x + width - safeRadius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  ctx.lineTo(x + width, y + height - safeRadius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  ctx.lineTo(x + safeRadius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  ctx.lineTo(x, y + safeRadius)
  ctx.quadraticCurveTo(x, y, x + safeRadius, y)
  ctx.closePath()
}

const getCellPalette = (value, viewPeak) => {
  if (value <= 0) {
    return { fill: '#12527f', text: '#f2f9ff', channel: '#d9efff' }
  }

  const intensity = Math.min(1, value / Math.max(viewPeak, 1))
  if (intensity >= 0.85) {
    return { fill: '#b7434b', text: '#fff8f4', channel: '#ffe9e6' }
  }
  if (intensity >= 0.62) {
    return { fill: '#e2bf4f', text: '#17202b', channel: '#453b17' }
  }
  if (intensity >= 0.38) {
    return { fill: '#3f796b', text: '#f6fffb', channel: '#f6fffb' }
  }
  return { fill: '#216b95', text: '#f3fbff', channel: '#d9efff' }
}

const drawPart = (canvas, part, values, positions, viewPeak) => {
  if (!canvas) return

  const { cellWidth, cellHeight, width, height } = getPartCanvasMetrics(part)
  const ratio = Math.min(window.devicePixelRatio || 1, 2)

  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const ctx = canvas.getContext('2d')
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let row = 0; row < part.height; row++) {
    for (let col = 0; col < part.width; col++) {
      const index = row * part.width + col
      const value = Math.round(values[index] || 0)
      const position = positions[index] || 0
      const x = col * cellWidth + 2
      const y = row * cellHeight + 2
      const tileWidth = cellWidth - 4
      const tileHeight = cellHeight - 4
      const palette = getCellPalette(value, viewPeak)
      const isPeak = viewPeak > 0 && value === viewPeak

      traceRoundedRect(ctx, x, y, tileWidth, tileHeight, 7)
      ctx.fillStyle = palette.fill
      ctx.fill()
      ctx.strokeStyle = isPeak ? '#fff0a6' : 'rgba(220, 242, 255, 0.24)'
      ctx.lineWidth = isPeak ? 1.5 : 0.75
      ctx.stroke()

      ctx.fillStyle = palette.channel
      ctx.font = '600 6.5px ui-monospace, SFMono-Regular, Consolas, monospace'
      ctx.fillText(`#${position}`, x + tileWidth / 2, y + 7.5)
      ctx.fillStyle = palette.text
      ctx.font = '700 10px ui-monospace, SFMono-Regular, Consolas, monospace'
      ctx.fillText(String(value), x + tileWidth / 2, y + 17.5)
    }
  }
}

const HumanBodyRawData = React.forwardRef((props, refs) => {
  const { t } = useTranslation()
  const instanceId = useId().replace(/:/g, '')
  const canvasRefs = useRef({})
  const [sourceData, setSourceData] = useState(() => createDefaultSource())
  const parts = useMemo(() => PART_CONFIGS.reduce((result, part) => {
    result[part.key] = getPartValues(sourceData, part)
    return result
  }, {}), [sourceData])
  const viewStatsByKey = useMemo(() => Object.fromEntries(
    HUMAN_BODY_RAW_VIEWS.map((view) => [view.key, getViewStats(view, parts)]),
  ), [parts])

  const updateStats = (nextSourceData) => {
    const point = nextSourceData.filter((value) => value > 0).length
    const totalPres = nextSourceData.reduce((sum, value) => sum + value, 0)
    const maxPres = findMax(nextSourceData)
    const meanPres = totalPres / (point || 1)

    props.data.current?.changeData({
      meanPres: meanPres.toFixed(2),
      maxPres,
      point,
      totalPres: totalPres.toFixed(0),
    })
  }

  const changeHumanBodyData = (nextData = []) => {
    const nextSourceData = normalizeSourceData(nextData)
    updateStats(nextSourceData)
    setSourceData(nextSourceData)
  }

  useImperativeHandle(refs, () => ({
    changeHumanBodyData,
  }))

  useEffect(() => {
    HUMAN_BODY_RAW_VIEWS.forEach((view) => {
      const viewPeak = viewStatsByKey[view.key]?.peak || 0
      ;[...view.upperSlots, ...view.lowerSlots].forEach((slot) => {
        const dataPart = PART_CONFIGS_BY_KEY[slot.dataPartKey]
        drawPart(
          canvasRefs.current[slot.slotKey],
          dataPart,
          parts[slot.dataPartKey] || [],
          PART_DISPLAY_POSITIONS_BY_KEY[slot.dataPartKey] || [],
          viewPeak,
        )
      })
    })
  }, [parts, viewStatsByKey])

  const renderPart = (slot) => {
    const displayPart = PART_CONFIGS_BY_KEY[slot.displayPartKey]
    const dataPart = PART_CONFIGS_BY_KEY[slot.dataPartKey]
    const values = parts[slot.dataPartKey] || []
    const stats = getHumanBodyRawPartStats(values)
    const { width } = getPartCanvasMetrics(dataPart)
    const label = t(displayPart.titleKey, { defaultValue: displayPart.fallbackLabel })
    const captionId = `${instanceId}-${slot.slotKey}-caption`

    return (
      <figure
        key={slot.slotKey}
        className="human-body-raw__part"
        data-slot-key={slot.slotKey}
        data-display-part-key={slot.displayPartKey}
        data-part-key={slot.dataPartKey}
        style={{
          '--human-body-part-width': `${width}px`,
          '--human-body-part-columns': dataPart.width,
        }}
      >
        <figcaption id={captionId} className="human-body-raw__caption">
          <span className="human-body-raw__caption-copy">
            <strong className="human-body-raw__part-name">{label}</strong>
            <span className="human-body-raw__dimensions">
              {dataPart.width} × {dataPart.height} · {stats.total}
              {t('humanBodyRaw.points', { defaultValue: '点' })}
            </span>
          </span>
          <span className="human-body-raw__part-peak">
            {t('humanBodyRaw.peak', { defaultValue: '峰值' })} {stats.peak}
          </span>
          <span className="human-body-raw__part-scale" aria-hidden="true" />
        </figcaption>
        <span className="human-body-raw__canvas-frame">
          <canvas
            ref={(canvas) => {
              canvasRefs.current[slot.slotKey] = canvas
            }}
            className="human-body-raw__canvas"
            role="img"
            aria-labelledby={captionId}
          />
        </span>
      </figure>
    )
  }

  return (
    <div className="human-body-raw">
      <main
        className="human-body-raw__atlas"
        aria-label={t('humanBodyRaw.title', { defaultValue: '人体原始数据' })}
      >
        <div className="human-body-raw__views">
          {HUMAN_BODY_RAW_VIEWS.map((view) => {
            const titleId = `${instanceId}-${view.key}-title`
            const viewLabel = t(view.titleKey, {
              defaultValue: view.key === 'front' ? '正面' : '背面',
            })
            const lowerTitle = view.key === 'front'
              ? t('humanBodyRaw.frontLowerTitle', { defaultValue: '前腿' })
              : t('humanBodyRaw.backLowerTitle', { defaultValue: '后腿' })

            return (
              <section
                key={view.key}
                className={`human-body-raw__view human-body-raw__view--${view.key}`}
                aria-labelledby={titleId}
              >
                <h2 id={titleId} className="human-body-raw__view-heading">
                  {viewLabel}
                </h2>
                <div className="human-body-raw__figure">
                  <div className="human-body-raw__upper">
                    {view.upperSlots.map(renderPart)}
                  </div>
                  <div className="human-body-raw__lower" role="group" aria-label={lowerTitle}>
                    {view.lowerSlots.map(renderPart)}
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </main>
    </div>
  )
})

export default HumanBodyRawData
