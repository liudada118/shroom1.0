export const DISPLAY_MODES = ['heatmap', 'numbers'];

/** 使用现有 SDK 画布显示原始矩阵，两个视图保持相同点位方向。 */
export function mobileDisplayConfig(mode, parameters = {}) {
  if (mode === 'numbers') {
    return { rendererId: 'numMatrix', label: '原始数字矩阵', params: {
      backend: 'webgl', frameInput: 'raw', gridWidth: 32, gridHeight: 32,
      manageSidebar: false, cameraControls: false,
      webgl: { variant: 'original', rawTranspose: false, widthRatio: 0.8,
        cellPadding: 0, overlayPad: 0, indexRow: false },
    } };
  }
  return { rendererId: 'webglHeatmap', label: '压力热力图', params: {
    dataWidth: 32, dataHeight: 32, canvasWidth: 512, canvasHeight: 512,
    minFrameLength: 1024, max: parameters.colorMax ?? 255, radius: parameters.radius ?? 18, filter: parameters.pointFilter ?? 0,
    valueScale: 1, mirrorX: false, edgeClear: null,
    displaySize: '100%', background: 'transparent',
  } };
}

/** 为独立网页的手动演示生成移动压力帧，演示绝不标为 USB。 */
export function createDemoPressureFrame(sequence, timestamp = Date.now()) {
  const centerX = 16 + Math.sin(sequence / 18) * 8;
  const centerY = 16 + Math.cos(sequence / 23) * 7;
  return { type: 'pressure.frame', version: 1, source: 'demo', sequence,
    timestamp, rows: 32, columns: 32,
    values: Array.from({ length: 1024 }, (_, index) => {
      const x = index % 32;
      const y = Math.floor(index / 32);
      return Math.round(245 * Math.exp(-((x - centerX) ** 2 + (y - centerY) ** 2) / 35));
    }) };
}
