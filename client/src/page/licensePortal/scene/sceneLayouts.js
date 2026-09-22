import { FOOT_SCENE_PLANES } from '../../../displays/nativeSceneAssets';

/** 与原生布局保持相同的宽高和展示平面；预览固定采样 3600 点，不包含压力值。 */
export const SCENE_LAYOUTS = Object.freeze({
  matrix: { rows: 60, cols: 60, width: 4.4, depth: 3.4, tilt: Math.PI / 3 },
  matrix64: { rows: 60, cols: 60, width: 4.2, depth: 4.2, tilt: Math.PI / 3 },
  heatmap64: { rows: 60, cols: 60, width: 3.8, depth: 3.8, tilt: Math.PI / 2 },
  smallBed: { rows: 60, cols: 60, width: 4.6, depth: 2.3, tilt: Math.PI / 3 },
  tempFullBed: { rows: 60, cols: 60, width: 4.2, depth: 4.2 * 12 / 15, tilt: Math.PI / 3 },
});

/** 生成矩阵展示的几何布局；x 为外层槽、深度为内层槽，与原生点图一致。 */
export function createLayoutPositions(key) {
  const layout = SCENE_LAYOUTS[key];
  if (!layout) return null;
  const { rows, cols, width, depth, tilt } = layout;
  const positions = new Float32Array(rows * cols * 3);
  for (let x = 0; x < rows; x++) {
    for (let z = 0; z < cols; z++) {
      const index = (x * cols + z) * 3;
      const distance = (z / (cols - 1) - .5) * depth;
      positions[index] = (x / (rows - 1) - .5) * width;
      positions[index + 1] = -Math.sin(tilt) * distance;
      positions[index + 2] = Math.cos(tilt) * distance;
    }
  }
  return { positions, grid: { rows, cols } };
}

/** 按足底图的透明区域采样，保留与原生平面相同的位置和图像朝向。 */
export function sampleFootImage({ data, width, height }, plane, count) {
  const pixels = [];
  for (let pixel = 0; pixel < width * height; pixel++) {
    if (data[pixel * 4 + 3] >= 32) pixels.push(pixel);
  }
  if (!pixels.length) throw new Error('足底轮廓为空');
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const pixel = pixels[Math.floor(index * pixels.length / count)];
    positions[index * 3] = plane.x + ((pixel % width) / (width - 1) - .5) * plane.width;
    positions[index * 3 + 1] = (.5 - Math.floor(pixel / width) / (height - 1)) * plane.height;
  }
  return positions;
}

/** 只读取原生双足底图，加载失败由预览统一显示错误，不替换为无关矩阵。 */
export async function loadFootLayout(count = 3600) {
  const parts = await Promise.all(FOOT_SCENE_PLANES.map(async (plane, index) => {
    const image = new Image();
    image.src = plane.url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 192;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('无法读取足底轮廓');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const amount = Math.floor(count / 2) + (index === 1 ? count % 2 : 0);
    return sampleFootImage(context.getImageData(0, 0, canvas.width, canvas.height), plane, amount);
  }));
  const positions = new Float32Array(count * 3);
  let cursor = 0;
  for (const part of parts) { positions.set(part, cursor); cursor += part.length; }
  // 原生平面总宽 55，整体等比缩放到预览空间，保留双足间距。
  for (let index = 0; index < positions.length; index++) positions[index] *= 4.4 / 55;
  return { positions };
}
