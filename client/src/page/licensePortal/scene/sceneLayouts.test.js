import { describe, expect, it } from 'vitest';
import { createLayoutPositions, sampleFootImage, SCENE_LAYOUTS } from './sceneLayouts';

describe('真实场景的非模型预览', () => {
  it('OneStep 是正方形平面、高速矩阵有深度，小床保留横向两倍比例', () => {
    const flat = createLayoutPositions('heatmap64').positions;
    expect(Math.max(...flat.filter((_, index) => index % 3 === 2))).toBeLessThan(1e-6);
    const grid = createLayoutPositions('matrix64').positions;
    expect(Math.max(...grid.filter((_, index) => index % 3 === 2))).toBeGreaterThan(.5);
    expect(SCENE_LAYOUTS.smallBed.width / SCENE_LAYOUTS.smallBed.depth).toBe(2);
    for (const key of Object.keys(SCENE_LAYOUTS)) {
      const { positions, grid: shape } = createLayoutPositions(key);
      expect(positions.length).toBe(3600 * 3);
      expect(positions.every(Number.isFinite)).toBe(true);
      expect(shape.rows * shape.cols).toBe(positions.length / 3);
      expect(positions[0]).toBe(positions[3]); // 原生 x 为外层槽，邻点先沿深度变化。
      expect(positions[shape.cols * 3]).toBeGreaterThan(positions[0]);
    }
    expect(createLayoutPositions('unregistered')).toBeNull();
  });
  it('双足底图采样只取非透明轮廓，并保留左右位置、上下方向', () => {
    const data = new Uint8ClampedArray(2 * 2 * 4);
    data[3] = 255;
    data[15] = 255;
    const image = { data, width: 2, height: 2 };
    const left = sampleFootImage(image, { x: -10, width: 10, height: 20 }, 2);
    const right = sampleFootImage(image, { x: 10, width: 10, height: 20 }, 2);
    expect([...left]).toEqual([-15, 10, 0, -5, -10, 0]);
    expect([...right]).toEqual([5, 10, 0, 15, -10, 0]);
    expect(() => sampleFootImage({ ...image, data: new Uint8ClampedArray(16) }, { x: 0 }, 2)).toThrow('足底轮廓为空');
  });
});
