import pressureVestSensorMap from "../../../../pressureVestSensorMap.json"
import { Box3, Matrix3, Raycaster, Vector3 } from 'three'

export const PRESSURE_VEST_MATRIX = 'pressureVest'

/** 固定背心原始通道矩阵，编号沿用设备的一基序号。 */
const freezeMatrix = (rows) => Object.freeze(rows.map((row) => Object.freeze([...row])))

export const PRESSURE_VEST_SOURCE_MATRICES = Object.freeze(Object.fromEntries(
  Object.entries(pressureVestSensorMap).map(([key, rows]) => [key, freezeMatrix(rows)]),
))

export const PRESSURE_VEST_SENSOR_INDICES = Object.freeze([
  ...new Set(Object.values(PRESSURE_VEST_SOURCE_MATRICES).flatMap((rows) => rows.flat().map((channel) => channel - 1))),
])

const PART_LABELS = Object.freeze({ chest: '前胸', back: '后背', leftShoulder: '左肩', rightShoulder: '右肩' })

// 只复用胸背表面；旧人体肩区跨过颈根，不符合背心两侧肩带。
const MODEL_PARTS = Object.freeze({
  chest: { region: '前胸' },
  back: { region: '后背', flipCol: true },
})

// 图中没有物理尺寸；在高度归一化为8的人体上拟合胸背两侧的三列肩带。
const SHOULDER_STRAPS = Object.freeze({
  front: { innerX: 0.75, columnStep: 0.09, rowDrift: 0.015 },
  back: { innerX: 0.68, columnStep: 0.105, rowDrift: 0.015 },
})

/** 在现有人体表面的网格中插值坐标，使用新的背心行列而非旧通道编号。 */
function sampleSurface(grid, rows, cols, row, col) {
  const row0 = Math.floor(row)
  const col0 = Math.floor(col)
  const row1 = Math.min(rows - 1, row0 + 1)
  const col1 = Math.min(cols - 1, col0 + 1)
  const rowWeight = row - row0
  const colWeight = col - col0
  const samples = [
    [row0, col0, (1 - rowWeight) * (1 - colWeight)],
    [row0, col1, (1 - rowWeight) * colWeight],
    [row1, col0, rowWeight * (1 - colWeight)],
    [row1, col1, rowWeight * colWeight],
  ]
  const result = { x: 0, y: 0, z: 0 }
  samples.forEach(([sampleRow, sampleCol, weight]) => {
    if (weight <= 0) return
    const point = grid.get(`${sampleRow},${sampleCol}`)
    if (!point) throw new Error(`人体表面缺少 R${sampleRow + 1} C${sampleCol + 1} 点位`)
    for (const axis of ['x', 'y', 'z']) {
      const coordinate = Number(point[axis])
      if (!Number.isFinite(coordinate)) throw new Error('人体表面坐标无效')
      result[axis] += coordinate * weight
    }
  })
  return result
}

/** 将肩带投影到加载后的实际人体表面，避免外移后悬空或穿过胸背。 */
function createShoulderProjector(model) {
  if (!model?.isObject3D) throw new Error('背心肩带需要已归一化的人体模型')
  model.updateMatrixWorld(true)
  const meshes = []
  model.traverse((child) => {
    if (child.isMesh && child.geometry?.attributes?.position?.count >= 100) meshes.push(child)
  })
  if (!meshes.length) throw new Error('人体模型缺少肩带投影表面')
  const bounds = new Box3().setFromObject(model)
  const raycaster = new Raycaster()
  raycaster.far = bounds.max.z - bounds.min.z + 2
  return (x, y, front) => {
    const side = front ? 1 : -1
    const originZ = front ? bounds.max.z + 1 : bounds.min.z - 1
    raycaster.set(new Vector3(x, y, originZ), new Vector3(0, 0, -side))
    const hit = raycaster.intersectObjects(meshes, false)[0]
    if (!hit || hit.face.normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(hit.object.matrixWorld)).z * side <= 0) {
      throw new Error(`背心${front ? '前' : '后'}肩带未命中对应人体表面`)
    }
    return { x: hit.point.x, y: hit.point.y, z: hit.point.z }
  }
}

/** 将背心每个原始通道映射到共用人体的胸、背及肩带表面。 */
export function buildPressureVestSensorLayout(archive, model) {
  if (Number(archive?.version) !== 7 || !Array.isArray(archive?.flat)) {
    throw new Error('背心需要 v7 人体表面点位')
  }
  const surfaces = Object.fromEntries(Object.entries(MODEL_PARTS).map(([key, placement]) => {
    const physical = archive.flat.filter((point) => point.region === placement.region)
    if (!physical.length) throw new Error(`人体点位缺少${placement.region}区域`)
    const rows = Math.max(...physical.map((point) => Number(point.row)))
    const cols = Math.max(...physical.map((point) => Number(point.col)))
    if (!Number.isInteger(rows) || !Number.isInteger(cols)) throw new Error('人体表面网格尺寸无效')
    return [key, { rows, cols, grid: new Map(physical.map((point) => [`${Number(point.row) - 1},${Number(point.col) - 1}`, point])) }]
  }))
  const torsoPosition = (key, row, col) => {
    const matrix = PRESSURE_VEST_SOURCE_MATRICES[key]
    const { rows, cols, grid } = surfaces[key]
    const surfaceRow = row / (matrix.length - 1) * (rows - 1)
    const surfaceCol = (MODEL_PARTS[key].flipCol ? matrix[0].length - 1 - col : col) / (matrix[0].length - 1) * (cols - 1)
    return sampleSurface(grid, rows, cols, surfaceRow, surfaceCol)
  }
  const projectShoulder = createShoulderProjector(model)
  const sensors = []
  Object.entries(PRESSURE_VEST_SOURCE_MATRICES).forEach(([key, matrix]) => {
    matrix.forEach((channels, row) => channels.forEach((channel, col) => {
      let position
      if (MODEL_PARTS[key]) {
        position = torsoPosition(key, row, col)
      } else {
        const front = row >= 3
        const diagramRow = front ? row - 3 : 2 - row
        const innerToOuterCol = key === 'leftShoulder' ? col : 2 - col
        const strap = SHOULDER_STRAPS[front ? 'front' : 'back']
        const x = (key === 'leftShoulder' ? 1 : -1) * (strap.innerX + strap.rowDrift * diagramRow + strap.columnStep * innerToOuterCol)
        const y = torsoPosition(front ? 'chest' : 'back', diagramRow, 0).y
        position = projectShoulder(x, y, front)
      }
      sensors.push({
        index: sensors.length,
        logicalIndex: channel - 1,
        row,
        col,
        part: PART_LABELS[key],
        partKey: key,
        placementSide: 'single',
        position,
        sample: [{ index: channel - 1, weight: 1 }],
      })
    }))
  })
  return sensors
}

export const PRESSURE_VEST_PROFILE = Object.freeze({
  key: PRESSURE_VEST_MATRIX,
  title: '压力传感背心',
  settingsKey: 'pressureVest.renderSettings.v1',
  buildSensorLayout: buildPressureVestSensorLayout,
  parts: Object.freeze(Object.entries(PRESSURE_VEST_SOURCE_MATRICES).map(([key, matrix]) => Object.freeze({
    key, width: matrix[0].length, height: matrix.length, positions: Object.freeze(matrix.flat()),
  }))),
  partLabels: PART_LABELS,
  numberMatrixOrientation: 'source',
  numberViews: Object.freeze({ overview: Object.keys(PART_LABELS), chest: ['chest'], back: ['back'], leftShoulder: ['leftShoulder'], rightShoulder: ['rightShoulder'] }),
  regionViews: Object.freeze({
    overview: { label: '全身', position: [0, 4, 12], target: [0, 4, 0] },
    chest: { label: '前胸', position: [0, 5.5, 6], target: [0, 5.5, 0] },
    back: { label: '后背', position: [0, 5.5, -6], target: [0, 5.5, 0] },
    leftShoulder: { label: '左肩', position: [3, 7, 4], target: [0.5, 6.5, 0] },
    rightShoulder: { label: '右肩', position: [-3, 7, 4], target: [-0.5, 6.5, 0] },
  }),
})

/** 构造原始数据视图的一块矩阵；gapAfterColumn 给前胸留下拉链位置。 */
function createSlot(slotKey, sourcePartKey, matrix, { gapAfterColumn } = {}) {
  return Object.freeze({
    slotKey, sourcePartKey, displayPartKey: sourcePartKey,
    titleKey: `pressureVest.parts.${sourcePartKey}`,
    fallbackLabel: PART_LABELS[sourcePartKey],
    indexMatrix: freezeMatrix(matrix), width: matrix[0].length, height: matrix.length,
    gapAfterColumn, pixelRatioScale: 2,
  })
}

/** 取背面肩带半片并沿背面观察方向反转行列。 */
function backShoulder(matrix) {
  return matrix.slice(0, 3).reverse().map((row) => [...row].reverse())
}

const FRONT_SLOTS = Object.freeze([
  createSlot('front-right-shoulder', 'rightShoulder', PRESSURE_VEST_SOURCE_MATRICES.rightShoulder.slice(3)),
  createSlot('front-chest', 'chest', PRESSURE_VEST_SOURCE_MATRICES.chest, { gapAfterColumn: 5 }),
  createSlot('front-left-shoulder', 'leftShoulder', PRESSURE_VEST_SOURCE_MATRICES.leftShoulder.slice(3)),
])
const BACK_SLOTS = Object.freeze([
  createSlot('back-left-shoulder', 'leftShoulder', backShoulder(PRESSURE_VEST_SOURCE_MATRICES.leftShoulder)),
  createSlot('back-torso', 'back', PRESSURE_VEST_SOURCE_MATRICES.back),
  createSlot('back-right-shoulder', 'rightShoulder', backShoulder(PRESSURE_VEST_SOURCE_MATRICES.rightShoulder)),
])

export const PRESSURE_VEST_RAW_LAYOUT = Object.freeze({
  key: PRESSURE_VEST_MATRIX, titleKey: 'pressureVest.rawTitle', fallbackTitle: '背心原始数据',
  className: 'human-body-raw--vest',
  slots: Object.freeze([...FRONT_SLOTS, ...BACK_SLOTS]),
  views: Object.freeze([
    Object.freeze({ key: 'front', titleKey: 'humanBodyRaw.frontView', upperSlots: FRONT_SLOTS, lowerSlots: Object.freeze([]) }),
    Object.freeze({ key: 'back', titleKey: 'humanBodyRaw.backView', upperSlots: BACK_SLOTS, lowerSlots: Object.freeze([]) }),
  ]),
})
