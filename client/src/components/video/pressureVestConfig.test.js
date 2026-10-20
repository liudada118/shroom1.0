import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { Box3, Group, Matrix3, Raycaster, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildPressureVestSensorLayout,
  PRESSURE_VEST_PROFILE,
  PRESSURE_VEST_RAW_LAYOUT,
  PRESSURE_VEST_SENSOR_INDICES,
  PRESSURE_VEST_SOURCE_MATRICES,
} from './pressureVestConfig'

const archive = JSON.parse(readFileSync(new URL('../../../public/model/sensor_canvas_positions.json', import.meta.url), 'utf8'))
const models = new Map()

/** 加载真实人体模型并复用渲染器的归一化，验证肩带确实落在模型表面。 */
async function loadNormalizedModel(filename) {
  const bytes = readFileSync(new URL(`../../../public/model/${filename}`, import.meta.url))
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject))
  const box = new Box3().setFromObject(gltf.scene)
  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())
  const scale = 8 / Math.max(size.x, size.y, size.z)
  const model = new Group()
  model.add(gltf.scene)
  model.scale.setScalar(scale)
  model.position.set(-center.x * scale, -center.y * scale + size.y * scale * 0.5, -center.z * scale)
  model.updateMatrixWorld(true)
  return model
}

/** 从指定观察面独立射线取交点，避免仅验证布局函数生成了有限坐标。 */
function intersectSurface(model, position, front) {
  const raycaster = new Raycaster(
    new Vector3(position.x, position.y, front ? 10 : -10),
    new Vector3(0, 0, front ? -1 : 1),
  )
  return raycaster.intersectObject(model, true)[0]
}

beforeAll(async () => {
  for (const filename of ['human3-low.glb', 'human3.glb']) {
    models.set(filename, await loadNormalizedModel(filename))
  }
})

describe('pressure vest channel contract', () => {
  it('keeps 436 unique one-based channels and omits duplicated pasted rows', () => {
    expect(PRESSURE_VEST_SOURCE_MATRICES.chest).toHaveLength(18)
    expect(PRESSURE_VEST_SOURCE_MATRICES.back).toHaveLength(22)
    expect(PRESSURE_VEST_SOURCE_MATRICES.back[2]).toEqual([69, 68, 67, 66, 65, 79, 78, 77, 76, 75])
    expect(PRESSURE_VEST_SOURCE_MATRICES.chest.at(-1)).toEqual([916, 915, 914, 913, 912, 810, 809, 808, 807, 806])
    expect(PRESSURE_VEST_SOURCE_MATRICES.back.at(-1)).toEqual([357, 356, 355, 354, 353, 367, 366, 365, 364, 363])
    const channels = Object.values(PRESSURE_VEST_SOURCE_MATRICES).flatMap((matrix) => matrix.flat())
    expect(channels).toHaveLength(436)
    expect(new Set(channels).size).toBe(436)
    expect(channels.every((channel) => Number.isInteger(channel) && channel >= 1 && channel <= 1024)).toBe(true)
    expect(PRESSURE_VEST_SENSOR_INDICES).toEqual(channels.map((channel) => channel - 1))
    expect(PRESSURE_VEST_SENSOR_INDICES).toContain(1023)
  })

  it('uses only vest channels in every 3D sample, once per actual source point', () => {
    const sensors = buildPressureVestSensorLayout(archive, models.get('human3-low.glb'))
    expect(sensors).toHaveLength(436)
    expect(sensors.map((sensor) => sensor.sample)).toEqual(PRESSURE_VEST_SENSOR_INDICES.map((index) => [{ index, weight: 1 }]))
    expect(new Set(sensors.map((sensor) => sensor.index)).size).toBe(436)
    expect(new Set(sensors.map((sensor) => sensor.partKey))).toEqual(new Set(['chest', 'back', 'leftShoulder', 'rightShoulder']))
    expect(sensors.every((sensor) => ['x', 'y', 'z'].every((axis) => Number.isFinite(sensor.position[axis])))).toBe(true)
    expect(sensors.some((sensor) => sensor.sample.some(({ index }) => index === 15))).toBe(false)
  })

  it('resamples each vest row on the intended torso surface instead of the old channel location', () => {
    const sensors = buildPressureVestSensorLayout(archive, models.get('human3-low.glb'))
    const chestTop = sensors.find((sensor) => sensor.partKey === 'chest' && sensor.row === 0 && sensor.col === 0)
    const chestBottom = sensors.find((sensor) => sensor.partKey === 'chest' && sensor.row === 17 && sensor.col === 0)
    const backTop = sensors.find((sensor) => sensor.partKey === 'back' && sensor.row === 0 && sensor.col === 0)
    const physicalChestTop = archive.flat.find((sensor) => sensor.region === '前胸' && sensor.row === 1 && sensor.col === 1)
    const physicalChestBottom = archive.flat.find((sensor) => sensor.region === '前胸' && sensor.row === 12 && sensor.col === 1)
    const physicalBackTop = archive.flat.find((sensor) => sensor.region === '后背' && sensor.row === 1 && sensor.col === 10)
    expect(chestTop.position).toEqual({ x: physicalChestTop.x, y: physicalChestTop.y, z: physicalChestTop.z })
    expect(chestBottom.position).toEqual({ x: physicalChestBottom.x, y: physicalChestBottom.y, z: physicalChestBottom.z })
    expect(backTop.position).toEqual({ x: physicalBackTop.x, y: physicalBackTop.y, z: physicalBackTop.z })
    expect(chestTop.position.y).toBeGreaterThan(chestBottom.position.y)
    const leftShoulder = sensors.filter((sensor) => sensor.partKey === 'leftShoulder')
    const rightShoulder = sensors.filter((sensor) => sensor.partKey === 'rightShoulder')
    expect(leftShoulder.every((sensor) => sensor.position.x > 0)).toBe(true)
    expect(rightShoulder.every((sensor) => sensor.position.x < 0)).toBe(true)
    expect(leftShoulder.find((sensor) => sensor.row === 0).position.z).toBeLessThan(leftShoulder.find((sensor) => sensor.row === 5).position.z)
  })

  it('rejects missing or invalid surface data rather than silently mapping pressure elsewhere', () => {
    const model = models.get('human3-low.glb')
    expect(() => buildPressureVestSensorLayout({ version: 6, flat: [] }, model)).toThrow(/v7/)
    expect(() => buildPressureVestSensorLayout({ ...archive, flat: archive.flat.filter((point) => point.region !== '前胸') }, model)).toThrow(/前胸/)
    const flat = archive.flat.map((point) => point.region === '前胸' && point.row === 1 && point.col === 1 ? { ...point, x: NaN } : point)
    expect(() => buildPressureVestSensorLayout({ ...archive, flat }, model)).toThrow(/坐标/)
    expect(() => buildPressureVestSensorLayout(archive)).toThrow(/模型|model/)
    expect(() => buildPressureVestSensorLayout(archive, new Group())).toThrow(/模型|表面|肩/)
    const displacedModel = model.clone(true)
    displacedModel.position.x += 20
    expect(() => buildPressureVestSensorLayout(archive, displacedModel)).toThrow(/未命中/)
  })

  it.each(['human3-low.glb', 'human3.glb'])('projects all 36 shoulder points onto the appropriate surface of %s', (filename) => {
    const model = models.get(filename)
    const sensors = buildPressureVestSensorLayout(archive, model)
    const shoulders = sensors.filter((sensor) => sensor.partKey.endsWith('Shoulder'))
    expect(shoulders).toHaveLength(36)
    for (const sensor of shoulders) {
      const front = sensor.row >= 3
      const surface = intersectSurface(model, sensor.position, front)
      expect(surface, `surface for channel ${sensor.logicalIndex + 1}`).toBeDefined()
      expect(sensor.position.z).toBeCloseTo(surface.point.z, 5)
      const normal = surface.face.normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(surface.object.matrixWorld)).normalize()
      expect(front ? normal.z : -normal.z).toBeGreaterThan(0.3)
      const displayRow = front ? sensor.row - 3 : 2 - sensor.row
      const torsoEdge = sensors.find((point) => point.partKey === (front ? 'chest' : 'back') && point.row === displayRow && point.col === 0)
      expect(sensor.position.y).toBeCloseTo(torsoEdge.position.y, 8)
      expect(Math.abs(sensor.position.x)).toBeGreaterThan(Math.abs(torsoEdge.position.x))
      expect(Math.abs(sensor.position.x)).toBeGreaterThan(0.65)
      expect(Math.abs(sensor.position.x)).toBeLessThan(1)
    }
  })

  it('keeps every diagram channel and row orientation while placing both shoulder grids beside the torso', () => {
    const sensors = buildPressureVestSensorLayout(archive, models.get('human3-low.glb'))
    for (const partKey of ['leftShoulder', 'rightShoulder']) {
      const shoulder = sensors.filter((sensor) => sensor.partKey === partKey)
      for (let row = 0; row < 6; row += 1) {
        const points = shoulder.filter((sensor) => sensor.row === row).sort((left, right) => left.col - right.col)
        expect(points.map((sensor) => sensor.logicalIndex + 1)).toEqual(PRESSURE_VEST_SOURCE_MATRICES[partKey][row])
        expect(points.map((sensor) => sensor.col)).toEqual([0, 1, 2])
        points.forEach((sensor) => expect(sensor.position.y).toBeCloseTo(points[0].position.y, 8))
        expect(points[0].position.x).toBeLessThan(points[1].position.x)
        expect(points[1].position.x).toBeLessThan(points[2].position.x)
      }
      const rowHeight = (row) => shoulder.find((sensor) => sensor.row === row).position.y
      expect(rowHeight(0)).toBeLessThan(rowHeight(1))
      expect(rowHeight(1)).toBeLessThan(rowHeight(2))
      expect(rowHeight(3)).toBeGreaterThan(rowHeight(4))
      expect(rowHeight(4)).toBeGreaterThan(rowHeight(5))
    }
  })

  it('keeps all 400 torso coordinates unchanged and works without the historical shoulder archive', () => {
    const model = models.get('human3-low.glb')
    const sensors = buildPressureVestSensorLayout(archive, model)
    const torso = sensors.filter((sensor) => ['chest', 'back'].includes(sensor.partKey))
      .map(({ partKey, row, col, logicalIndex, position }) => ({ partKey, row, col, logicalIndex, position }))
    expect(torso).toHaveLength(400)
    // 固定改动前400个胸背点的完整坐标和通道，肩部校正不得改变它们。
    expect(createHash('sha256').update(JSON.stringify(torso)).digest('hex')).toBe('7a02235f2c54965780683a18e08cbedeb0c39d237e66c7e55d47b5e3a8bc3a6b')
    const withoutShoulders = { ...archive, flat: archive.flat.filter((point) => !['左肩', '右肩'].includes(point.region)) }
    expect(buildPressureVestSensorLayout(withoutShoulders, model)).toEqual(sensors)
  })

  it('unfolds front and back shoulder halves exactly as the supplied diagrams', () => {
    const front = PRESSURE_VEST_RAW_LAYOUT.views[0]
    const back = PRESSURE_VEST_RAW_LAYOUT.views[1]
    expect(front.upperSlots.map((slot) => slot.sourcePartKey)).toEqual(['rightShoulder', 'chest', 'leftShoulder'])
    expect(front.upperSlots[0].indexMatrix).toEqual([[1021, 989, 957], [1020, 988, 956], [1019, 987, 955]])
    expect(front.upperSlots[2].indexMatrix).toEqual([[792, 760, 728], [793, 761, 729], [794, 762, 730]])
    expect(back.upperSlots[0].indexMatrix).toEqual([[727, 759, 791], [726, 758, 790], [725, 757, 789]])
    expect(back.upperSlots[2].indexMatrix).toEqual([[958, 990, 1022], [959, 991, 1023], [960, 992, 1024]])
    expect(front.upperSlots[1].gapAfterColumn).toBe(5)
    expect(back.upperSlots[1].gapAfterColumn).toBeUndefined()
    expect(PRESSURE_VEST_RAW_LAYOUT.slots.flatMap((slot) => slot.indexMatrix.flat()).sort((a, b) => a - b)).toEqual(PRESSURE_VEST_SENSOR_INDICES.map((index) => index + 1).sort((a, b) => a - b))
    expect(Object.keys(PRESSURE_VEST_PROFILE.regionViews)).toEqual(['overview', 'chest', 'back', 'leftShoulder', 'rightShoulder'])
    expect(PRESSURE_VEST_PROFILE.numberViews.overview).toEqual(['chest', 'back', 'leftShoulder', 'rightShoulder'])
  })
})
