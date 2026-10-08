// 触觉手套 2D 数字手形布局：按硬件点位表把原始 16x16（256 点）数据摆成手指 + 手掌的形状。
// 点位编号为 1 起（与 server.js 的 HAND_GLOVE_CSV_SEGMENT_POINTS 一致），读取时减 1。

export const GLOVE_HAND_POINTS = {
  left: {
    littleFinger: { rows: [[31, 30, 29], [15, 14, 13], [255, 254, 253], [239, 238, 237]], pulp: 222 },
    ringFinger: { rows: [[28, 27, 26], [12, 11, 10], [252, 251, 250], [236, 235, 234]], pulp: 219 },
    middleFinger: { rows: [[25, 24, 23], [9, 8, 7], [249, 248, 247], [233, 232, 231]], pulp: 216 },
    indexFinger: { rows: [[22, 21, 20], [6, 5, 4], [246, 245, 244], [230, 229, 228]], pulp: 213 },
    thumb: { rows: [[19, 18, 17], [3, 2, 1], [243, 242, 241], [227, 226, 225]], pulp: 210 },
    palm: [
      [207, 206, 205, 204, 203, 202, 201, 200, 199, 198, 197, 196],
      [191, 190, 189, 188, 187, 186, 185, 184, 183, 182, 181, 180, 179, 178, 177],
      [175, 174, 173, 172, 171, 170, 169, 168, 167, 166, 165, 164, 163, 162, 161],
      [159, 158, 157, 156, 155, 154, 153, 152, 151, 150, 149, 148, 147, 146, 145],
      [143, 142, 141, 140, 139, 138, 137, 136, 135, 134, 133, 132, 131, 130, 129],
    ],
  },
  right: {
    thumb: { rows: [[240, 239, 238], [256, 255, 254], [16, 15, 14], [32, 31, 30]], pulp: 47 },
    indexFinger: { rows: [[237, 236, 235], [253, 252, 251], [13, 12, 11], [29, 28, 27]], pulp: 44 },
    middleFinger: { rows: [[234, 233, 232], [250, 249, 248], [10, 9, 8], [26, 25, 24]], pulp: 41 },
    ringFinger: { rows: [[231, 230, 229], [247, 246, 245], [7, 6, 5], [23, 22, 21]], pulp: 38 },
    littleFinger: { rows: [[228, 227, 226], [244, 243, 242], [4, 3, 2], [20, 19, 18]], pulp: 35 },
    palm: [
      [61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50],
      [80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66],
      [96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82],
      [112, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100, 99, 98],
      [128, 127, 126, 125, 124, 123, 122, 121, 120, 119, 118, 117, 116, 115, 114],
    ],
  },
}

// 屏幕上从左到右的手指顺序（左手小拇指在左、右手大拇指在左）
const FINGER_ORDER = {
  left: ['littleFinger', 'ringFinger', 'middleFinger', 'indexFinger', 'thumb'],
  right: ['thumb', 'indexFinger', 'middleFinger', 'ringFinger', 'littleFinger'],
}

// 各手指相对中指的下沉量（格），模拟手指长短
const FINGER_DROP = {
  middleFinger: 0,
  ringFinger: 1,
  indexFinger: 1,
  littleFinger: 2,
  thumb: 2.5,
}

const FINGER_COLS = 3
const FINGER_ROWS = 4
const FINGER_GAP = 0.5
const PALM_COLS = 15
const LABEL_H = 0.8
const SUM_H = 0.75
const SUM_GAP = 0.15
const PULP_GAP = 0.6
const PALM_TOP_GAP = 0.6
const TITLE_GAP = 0.4
const TITLE_H = 0.8

export const HAND_GAP = 2.5
export const HAND_WIDTH = FINGER_COLS * 5 + FINGER_GAP * 4

const FINGER_BLOCK_H = LABEL_H + SUM_H + SUM_GAP + FINGER_ROWS + PULP_GAP + 1
const MAX_DROP = Math.max(...Object.values(FINGER_DROP))
const PALM_LABEL_Y = MAX_DROP + FINGER_BLOCK_H + PALM_TOP_GAP
const PALM_ROWS_Y = PALM_LABEL_Y + LABEL_H + SUM_H + SUM_GAP
const PALM_ROWS = 5

export const HAND_HEIGHT = PALM_ROWS_Y + PALM_ROWS + TITLE_GAP + TITLE_H

/**
 * 生成单只手的布局（单位：格）。
 * cells: 每个传感点的位置与 0 起数据下标；parts: 每个分区的名称/求和框位置及包含的下标。
 */
export function buildGloveHandLayout(side) {
  const points = GLOVE_HAND_POINTS[side]
  const cells = []
  const parts = []

  FINGER_ORDER[side].forEach((key, order) => {
    const finger = points[key]
    const x0 = order * (FINGER_COLS + FINGER_GAP)
    const y0 = FINGER_DROP[key]
    const gridY = y0 + LABEL_H + SUM_H + SUM_GAP
    const indices = []

    finger.rows.forEach((row, r) => {
      row.forEach((point, c) => {
        cells.push({ x: x0 + c, y: gridY + r, index: point - 1, part: key })
        indices.push(point - 1)
      })
    })

    const pulpY = gridY + FINGER_ROWS + PULP_GAP
    cells.push({ x: x0 + 1, y: pulpY, index: finger.pulp - 1, part: key, pulp: true })

    parts.push({
      key,
      labelX: x0 + FINGER_COLS / 2,
      labelY: y0,
      sumBox: { x: x0, y: y0 + LABEL_H, w: FINGER_COLS, h: SUM_H },
      pulpLabel: { x: x0 + FINGER_COLS / 2, y: gridY + FINGER_ROWS },
      indices,
    })
  })

  // 手掌与小拇指一侧对齐：左手靠左、右手靠右；首行 12 点同样贴向小拇指一侧
  const palmX = side === 'left' ? 0 : HAND_WIDTH - PALM_COLS
  const palmIndices = []
  points.palm.forEach((row, r) => {
    const rowOffset = side === 'left' ? 0 : PALM_COLS - row.length
    row.forEach((point, c) => {
      cells.push({ x: palmX + rowOffset + c, y: PALM_ROWS_Y + r, index: point - 1, part: 'palm' })
      palmIndices.push(point - 1)
    })
  })

  parts.push({
    key: 'palm',
    labelX: palmX + PALM_COLS / 2,
    labelY: PALM_LABEL_Y,
    sumBox: { x: palmX, y: PALM_LABEL_Y + LABEL_H, w: PALM_COLS, h: SUM_H },
    indices: palmIndices,
  })

  return {
    cells,
    parts,
    width: HAND_WIDTH,
    height: HAND_HEIGHT,
    titleY: PALM_ROWS_Y + PALM_ROWS + TITLE_GAP,
  }
}

// 与 Num2D 着色器一致的 jet 色带
export function jetColor(value, maxValue) {
  const dv = maxValue > 0 ? maxValue : 1
  let t = value / dv
  if (t < 0) t = 0
  if (t > 1) t = 1
  let r = 1, g = 1, b = 1
  if (t < 0.25) {
    r = 0; g = 4 * t; b = 1
  } else if (t < 0.5) {
    r = 0; g = 1; b = 1 - 4 * (t - 0.25)
  } else if (t < 0.75) {
    r = 4 * (t - 0.5); g = 1; b = 0
  } else {
    r = 1; g = 1 - 4 * (t - 0.75); b = 0
  }
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
}
