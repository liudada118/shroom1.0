import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { findMax } from '../../assets/util/util'

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
  { key: 'back', titleKey: 'bodyParts.back', indexMatrix: BACK_IDX },
  { key: 'chest', titleKey: 'bodyParts.chest', indexMatrix: CHEST_IDX },
  { key: 'rightArm', titleKey: 'bodyParts.rightArm', indexMatrix: RIGHT_ARM_IDX },
  { key: 'rightShoulder', titleKey: 'bodyParts.rightShoulder', indexMatrix: RIGHT_SHOULDER_IDX },
  { key: 'leftArm', titleKey: 'bodyParts.leftArm', indexMatrix: LEFT_ARM_IDX },
  { key: 'leftShoulder', titleKey: 'bodyParts.leftShoulder', indexMatrix: LEFT_SHOULDER_IDX },
  { key: 'backPantsRight', titleKey: 'bodyParts.backPantsRight', indexMatrix: BACK_PANTS_RIGHT_IDX },
  { key: 'backPantsLeft', titleKey: 'bodyParts.backPantsLeft', indexMatrix: BACK_PANTS_LEFT_IDX },
  { key: 'frontPantsLeft', titleKey: 'bodyParts.frontPantsLeft', indexMatrix: FRONT_PANTS_LEFT_IDX },
  { key: 'frontPantsRight', titleKey: 'bodyParts.frontPantsRight', indexMatrix: FRONT_PANTS_RIGHT_IDX },
].map((part) => ({
  ...part,
  width: part.indexMatrix[0].length,
  height: part.indexMatrix.length,
}))

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
])

const VERTICAL_FLIP_PARTS = new Set([
  'backPantsRight',
  'backPantsLeft',
])

const orientPartValues = (values, part) => {
  let matrix = Array.from({ length: part.height }, (_, rowIndex) =>
    values.slice(rowIndex * part.width, (rowIndex + 1) * part.width)
  )

  if (HORIZONTAL_FLIP_PARTS.has(part.key)) {
    matrix = matrix.map((row) => [...row].reverse())
  }

  if (VERTICAL_FLIP_PARTS.has(part.key)) {
    matrix = [...matrix].reverse()
  }

  return matrix.flat()
}

const getPartValues = (source, part) => {
  const values = part.indexMatrix.flatMap((row) =>
    row.map((position) => source[position - 1] || 0)
  )

  return orientPartValues(values, part)
}

const drawPart = (canvas, part, values, title) => {
  if (!canvas) return

  const cellSize = part.width >= 32 ? 18 : 20
  const titleHeight = 28
  const gridWidth = part.width * cellSize
  const width = Math.max(gridWidth, 150)
  const height = part.height * cellSize + titleHeight
  const ratio = window.devicePixelRatio || 1

  canvas.width = width * ratio
  canvas.height = height * ratio
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const ctx = canvas.getContext('2d')
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#151933'
  ctx.font = 'bold 14px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${title} ${part.width}x${part.height}`, width / 2, titleHeight / 2)

  const gridTop = titleHeight
  const gridLeft = (width - gridWidth) / 2
  ctx.strokeStyle = '#e4e7f2'
  ctx.lineWidth = 1
  ctx.font = `${part.width >= 32 ? 8 : 10}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let row = 0; row < part.height; row++) {
    for (let col = 0; col < part.width; col++) {
      const index = row * part.width + col
      const value = Math.round(values[index] || 0)
      const x = gridLeft + col * cellSize
      const y = gridTop + row * cellSize

      ctx.strokeRect(x, y, cellSize, cellSize)
      ctx.fillStyle = value > 0 ? '#1f5eff' : '#9aa0ad'
      ctx.fillText(String(value), x + cellSize / 2, y + cellSize / 2)
    }
  }
}

const HumanBodyRawData = React.forwardRef((props, refs) => {
  const { t } = useTranslation()
  const canvasRefs = useRef({})
  const [sourceData, setSourceData] = useState(() => createDefaultSource())
  const parts = useMemo(() => PART_CONFIGS.reduce((result, part) => {
    result[part.key] = getPartValues(sourceData, part)
    return result
  }, {}), [sourceData])

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
    PART_CONFIGS.forEach((part) => {
      drawPart(canvasRefs.current[part.key], part, parts[part.key] || [], t(part.titleKey))
    })
  }, [parts, t])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'auto',
        background: '#ffffff',
        padding: '96px 40px 40px 420px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, max-content))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {PART_CONFIGS.map((part) => (
          <canvas
            key={part.key}
            ref={(canvas) => {
              canvasRefs.current[part.key] = canvas
            }}
            style={{
              border: '1px solid #d7dce8',
              borderRadius: 6,
              boxShadow: '0 8px 24px rgba(20, 26, 48, 0.08)',
            }}
          />
        ))}
      </div>
    </div>
  )
})

export default HumanBodyRawData
