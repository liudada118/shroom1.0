import { createPressureFrame } from '../core/frame.js'
import { applyThreshold, clearMatrixOutsideBounds, mirrorMatrixHorizontal } from '../core/matrix.js'

export const bed4096Preset = {
  sensorType: 'bed4096',
  rows: 64,
  cols: 64,
  activeBounds: {
    minRow: 6,
    maxRow: 58,
    minCol: 6,
    maxCol: 58,
  },
  canvasWidth: 1024,
  canvasHeight: 1024,
  defaultOptions: {
    max: 200,
    filter: 0,
    size: 24,
  },
}

export function createBed4096Frame(values, meta = {}) {
  return createPressureFrame({
    values,
    rows: bed4096Preset.rows,
    cols: bed4096Preset.cols,
    sensorType: bed4096Preset.sensorType,
    meta,
  })
}

export function normalizeBed4096Values(values, options = {}) {
  const preset = { ...bed4096Preset, ...options }
  const frame = createBed4096Frame(values)
  const edgeCleared = clearMatrixOutsideBounds(
    frame.values,
    preset.rows,
    preset.cols,
    preset.activeBounds,
    0
  )
  const mirrored = mirrorMatrixHorizontal(edgeCleared, preset.rows, preset.cols)

  return applyThreshold(mirrored, preset.filter ?? bed4096Preset.defaultOptions.filter)
}
