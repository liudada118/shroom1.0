const freezeMatrix = (matrix) => Object.freeze(
  matrix.map((row) => Object.freeze([...row])),
)

const createSourceMatrix = (rows) => freezeMatrix(rows)

/**
 * The ten physical sensor matrices before any screen-layout projection.
 * Channel numbers are one-based because they are shown to operators as-is.
 */
export const HUMAN_BODY_RAW_SOURCE_MATRICES = Object.freeze({
  back: createSourceMatrix([
    [619, 620, 621, 622, 623, 609, 610, 611, 612, 613],
    [651, 652, 653, 654, 655, 641, 642, 643, 644, 645],
    [683, 684, 685, 686, 687, 673, 674, 675, 676, 677],
    [75, 76, 77, 78, 79, 65, 66, 67, 68, 69],
    [43, 44, 45, 46, 47, 33, 34, 35, 36, 37],
    [11, 12, 13, 14, 15, 1, 2, 3, 4, 5],
  ]),
  chest: createSourceMatrix([
    [692, 691, 690, 689, 688, 682, 681, 680, 679, 678],
    [660, 659, 658, 657, 656, 650, 649, 648, 647, 646],
    [628, 627, 626, 625, 624, 618, 617, 616, 615, 614],
    [20, 19, 18, 17, 16, 10, 9, 8, 7, 6],
    [52, 51, 50, 49, 48, 42, 41, 40, 39, 38],
    [84, 83, 82, 81, 80, 74, 73, 72, 71, 70],
  ]),
  rightArm: createSourceMatrix([
    [736, 768, 800, 832, 864, 1024, 992],
    [735, 767, 799, 831, 863, 1023, 991],
    [734, 766, 798, 830, 862, 1022, 990],
    [733, 765, 797, 829, 861, 1021, 989],
    [732, 764, 796, 828, 860, 1020, 988],
    [731, 763, 795, 827, 859, 1019, 987],
  ]),
  rightShoulder: createSourceMatrix([
    [960, 928, 896],
    [959, 927, 895],
    [958, 926, 894],
    [957, 925, 893],
    [956, 924, 892],
    [955, 923, 891],
  ]),
  leftArm: createSourceMatrix([
    [1013, 981, 853, 821, 789, 757, 725],
    [1014, 982, 854, 822, 790, 758, 726],
    [1015, 983, 855, 823, 791, 759, 727],
    [1016, 984, 856, 824, 792, 760, 728],
    [1017, 985, 857, 825, 793, 761, 729],
    [1018, 986, 858, 826, 794, 762, 730],
  ]),
  leftShoulder: createSourceMatrix([
    [885, 917, 949],
    [886, 918, 950],
    [887, 919, 951],
    [888, 920, 952],
    [889, 921, 953],
    [890, 922, 954],
  ]),
  backPantsRight: createSourceMatrix([
    [197, 196, 195, 194, 193],
    [165, 164, 163, 162, 161],
    [133, 132, 131, 130, 129],
    [101, 100, 99, 98, 97],
    [229, 228, 227, 226, 225],
    [261, 260, 259, 258, 257],
    [293, 292, 291, 290, 289],
    [325, 324, 323, 322, 321],
  ]),
  backPantsLeft: createSourceMatrix([
    [495, 494, 493, 492, 491],
    [527, 526, 525, 524, 523],
    [559, 558, 557, 556, 555],
    [591, 590, 589, 588, 587],
    [463, 462, 461, 460, 459],
    [431, 430, 429, 428, 427],
    [399, 398, 397, 396, 395],
    [367, 366, 365, 364, 363],
  ]),
  frontPantsLeft: createSourceMatrix([
    [500, 499, 498, 497, 496],
    [532, 531, 530, 529, 528],
    [564, 563, 562, 561, 560],
    [596, 595, 594, 593, 592],
    [468, 467, 466, 465, 464],
    [436, 435, 434, 433, 432],
    [404, 403, 402, 401, 400],
    [372, 371, 370, 369, 368],
  ]),
  frontPantsRight: createSourceMatrix([
    [202, 201, 200, 199, 198],
    [170, 169, 168, 167, 166],
    [138, 137, 136, 135, 134],
    [106, 105, 104, 103, 102],
    [234, 233, 232, 231, 230],
    [266, 265, 264, 263, 262],
    [298, 297, 296, 295, 294],
    [330, 329, 328, 327, 326],
  ]),
})

/**
 * Selects and reorders a source matrix for one unfolded-atlas display slot.
 * rowRepeat is a nearest-neighbour visual expansion; it never invents channels.
 */
export const projectHumanBodyRawMatrix = (
  sourceMatrix,
  { rowOrder, colOrder, rowRepeat = 1 } = {},
) => {
  if (!Array.isArray(sourceMatrix) || sourceMatrix.length === 0) {
    return freezeMatrix([])
  }

  const projectedRowOrder = rowOrder ?? sourceMatrix.map((_, index) => index)
  const projectedColOrder = colOrder
    ?? sourceMatrix[0].map((_, index) => index)

  if (!Number.isInteger(rowRepeat) || rowRepeat < 1) {
    throw new RangeError('rowRepeat must be a positive integer')
  }

  const projected = []
  projectedRowOrder.forEach((rowIndex) => {
    const sourceRow = sourceMatrix[rowIndex]
    if (!sourceRow) {
      throw new RangeError(`row index ${rowIndex} is outside the source matrix`)
    }

    const row = projectedColOrder.map((colIndex) => {
      if (colIndex < 0 || colIndex >= sourceRow.length) {
        throw new RangeError(`column index ${colIndex} is outside source row ${rowIndex}`)
      }
      return sourceRow[colIndex]
    })

    for (let repeatIndex = 0; repeatIndex < rowRepeat; repeatIndex += 1) {
      projected.push(row)
    }
  })

  return freezeMatrix(projected)
}

const createSlot = ({
  slotKey,
  sourcePartKey,
  displayPartKey = sourcePartKey,
  titleKey,
  fallbackLabel,
  rowOrder,
  colOrder,
  rowRepeat = 1,
}) => {
  const frozenRowOrder = Object.freeze([...rowOrder])
  const frozenColOrder = Object.freeze([...colOrder])
  const indexMatrix = projectHumanBodyRawMatrix(
    HUMAN_BODY_RAW_SOURCE_MATRICES[sourcePartKey],
    {
      rowOrder: frozenRowOrder,
      colOrder: frozenColOrder,
      rowRepeat,
    },
  )

  return Object.freeze({
    slotKey,
    sourcePartKey,
    displayPartKey,
    titleKey,
    fallbackLabel,
    rowOrder: frozenRowOrder,
    colOrder: frozenColOrder,
    rowRepeat,
    indexMatrix,
    width: indexMatrix[0]?.length ?? 0,
    height: indexMatrix.length,
  })
}

const createView = (key, titleKey, upperSlots, lowerSlots) => Object.freeze({
  key,
  titleKey,
  upperSlots: Object.freeze(upperSlots),
  lowerSlots: Object.freeze(lowerSlots),
})

const FRONT_UPPER_SLOTS = [
  createSlot({
    slotKey: 'front-right-arm',
    sourcePartKey: 'rightArm',
    titleKey: 'humanBodyRaw.rightArmFromShoulder',
    fallbackLabel: '右手臂（肩膀到手）',
    rowOrder: [3, 4, 5],
    colOrder: [0, 1, 2, 3, 4, 5, 6],
  }),
  createSlot({
    slotKey: 'front-right-shoulder',
    sourcePartKey: 'rightShoulder',
    titleKey: 'humanBodyRaw.rightShoulder',
    fallbackLabel: '右肩膀',
    rowOrder: [3, 4, 5],
    colOrder: [0, 1, 2],
  }),
  createSlot({
    slotKey: 'front-chest',
    sourcePartKey: 'chest',
    titleKey: 'humanBodyRaw.frontChest',
    fallbackLabel: '前胸',
    rowOrder: [0, 1, 2, 3, 4, 5],
    colOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    rowRepeat: 2,
  }),
  createSlot({
    slotKey: 'front-left-shoulder',
    sourcePartKey: 'leftShoulder',
    titleKey: 'humanBodyRaw.leftShoulder',
    fallbackLabel: '左肩膀',
    rowOrder: [3, 4, 5],
    colOrder: [0, 1, 2],
  }),
  createSlot({
    slotKey: 'front-left-arm',
    sourcePartKey: 'leftArm',
    titleKey: 'humanBodyRaw.leftArmFromShoulder',
    fallbackLabel: '左手臂（肩膀到手）',
    rowOrder: [3, 4, 5],
    colOrder: [1, 0, 2, 3, 4, 5, 6],
  }),
]

const FRONT_LOWER_SLOTS = [
  createSlot({
    slotKey: 'front-right-leg',
    sourcePartKey: 'frontPantsLeft',
    titleKey: 'bodyParts.rightFrontLeg',
    fallbackLabel: '右前腿',
    rowOrder: [0, 1, 2, 3, 4, 5, 6, 7],
    colOrder: [0, 1, 2, 3, 4],
  }),
  createSlot({
    slotKey: 'front-left-leg',
    sourcePartKey: 'frontPantsRight',
    titleKey: 'bodyParts.leftFrontLeg',
    fallbackLabel: '左前腿',
    rowOrder: [0, 1, 2, 3, 4, 5, 6, 7],
    colOrder: [0, 1, 2, 3, 4],
  }),
]

const BACK_UPPER_SLOTS = [
  createSlot({
    slotKey: 'back-left-arm',
    sourcePartKey: 'leftArm',
    titleKey: 'humanBodyRaw.leftArmFromShoulder',
    fallbackLabel: '左手臂（肩膀到手）',
    rowOrder: [2, 1, 0],
    colOrder: [6, 5, 4, 3, 2, 0, 1],
  }),
  createSlot({
    slotKey: 'back-left-shoulder',
    sourcePartKey: 'leftShoulder',
    titleKey: 'humanBodyRaw.leftShoulder',
    fallbackLabel: '左肩膀',
    rowOrder: [2, 1, 0],
    colOrder: [2, 1, 0],
  }),
  createSlot({
    slotKey: 'back-torso',
    sourcePartKey: 'back',
    titleKey: 'humanBodyRaw.backTorso',
    fallbackLabel: '后背',
    rowOrder: [5, 4, 3, 2, 1, 0],
    colOrder: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    rowRepeat: 2,
  }),
  createSlot({
    slotKey: 'back-right-shoulder',
    sourcePartKey: 'rightShoulder',
    titleKey: 'humanBodyRaw.rightShoulder',
    fallbackLabel: '右肩膀',
    rowOrder: [2, 1, 0],
    colOrder: [2, 1, 0],
  }),
  createSlot({
    slotKey: 'back-right-arm',
    sourcePartKey: 'rightArm',
    titleKey: 'humanBodyRaw.rightArmFromShoulder',
    fallbackLabel: '右手臂（肩膀到手）',
    rowOrder: [2, 1, 0],
    colOrder: [6, 5, 4, 3, 2, 1, 0],
  }),
]

const BACK_LOWER_SLOTS = [
  createSlot({
    slotKey: 'back-left-leg',
    sourcePartKey: 'backPantsRight',
    displayPartKey: 'backPantsLeft',
    titleKey: 'bodyParts.leftBackLeg',
    fallbackLabel: '左后腿',
    rowOrder: [0, 1, 2, 3, 4, 5, 6, 7],
    colOrder: [0, 1, 2, 3, 4],
  }),
  createSlot({
    slotKey: 'back-right-leg',
    sourcePartKey: 'backPantsLeft',
    displayPartKey: 'backPantsRight',
    titleKey: 'bodyParts.rightBackLeg',
    fallbackLabel: '右后腿',
    rowOrder: [0, 1, 2, 3, 4, 5, 6, 7],
    colOrder: [0, 1, 2, 3, 4],
  }),
]

export const HUMAN_BODY_RAW_VIEWS = Object.freeze([
  createView(
    'front',
    'humanBodyRaw.frontView',
    FRONT_UPPER_SLOTS,
    FRONT_LOWER_SLOTS,
  ),
  createView(
    'back',
    'humanBodyRaw.backView',
    BACK_UPPER_SLOTS,
    BACK_LOWER_SLOTS,
  ),
])

export const HUMAN_BODY_RAW_SLOTS = Object.freeze(
  HUMAN_BODY_RAW_VIEWS.flatMap((view) => [...view.upperSlots, ...view.lowerSlots]),
)

// Backwards-compatible source-key export; unlike the 14 display slots, these
// ten keys identify each physical matrix exactly once.
export const HUMAN_BODY_RAW_DATA_PART_KEYS = Object.freeze(
  Object.keys(HUMAN_BODY_RAW_SOURCE_MATRICES),
)
