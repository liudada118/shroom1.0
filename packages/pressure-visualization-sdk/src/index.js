export { createPressureFrame, isPressureFrame } from './core/frame.js'
export {
  applyThreshold,
  clearMatrixEdges,
  clearMatrixOutsideBounds,
  mirrorMatrixHorizontal,
} from './core/matrix.js'
export { bed4096Preset, createBed4096Frame, normalizeBed4096Values } from './sensors/bed4096.js'
export { renderBed4096HeatmapToCanvas } from './renderers/webgl/bed4096Heatmap.js'
export { createLegacyBed4096Handle } from './adapters/legacyBed4096.js'
export { Bed4096WebGLCanvas } from './react/Bed4096WebGLCanvas.jsx'
