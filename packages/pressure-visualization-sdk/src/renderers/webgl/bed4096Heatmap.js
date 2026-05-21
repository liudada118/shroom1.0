import { bed4096Preset, normalizeBed4096Values } from '../../sensors/bed4096.js'

export function renderBed4096HeatmapToCanvas({
  canvas,
  values,
  options = {},
  createHeatmapCanvas,
}) {
  if (!canvas || typeof createHeatmapCanvas !== 'function') {
    return null
  }

  const mergedOptions = {
    ...bed4096Preset.defaultOptions,
    ...options,
  }
  const normalizedValues = normalizeBed4096Values(values, mergedOptions)
  const heatmapCanvas = createHeatmapCanvas(
    normalizedValues,
    mergedOptions.max,
    mergedOptions.size,
    bed4096Preset.canvasWidth,
    bed4096Preset.canvasHeight
  )
  const ctx = canvas.getContext('2d')

  if (!ctx || !heatmapCanvas) {
    return null
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(heatmapCanvas, 0, 0, canvas.width, canvas.height)

  return canvas
}
