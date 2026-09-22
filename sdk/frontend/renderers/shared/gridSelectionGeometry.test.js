import { describe, expect, it } from 'vitest';
import { createGridSelectionGesture, projectSelectionRegion, snapGridRect } from './gridSelectionGeometry.js';

const bounds = { x1: 120, y1: 80, x2: 320, y2: 170 };
const region = { x: 1, y: 1, width: 3, height: 3 };

/** 模拟非正方形格点画布，保留真实屏幕偏移。 */
function gesture(mode, start, dir) {
  return createGridSelectionGesture({ bounds, projected: [], columns: 10, rows: 6, region, mode, start, dir });
}

describe('与参考项目一致的矩阵框选手势', () => {
  it('拖动过程中即贴格边，正反向一致，格内小框可以选中一个完整单元', () => {
    expect(snapGridRect({ x1: 143, y1: 96, x2: 199, y2: 136 }, bounds, 10, 6)).toEqual(region);
    expect(snapGridRect({ x1: 199, y1: 136, x2: 143, y2: 96 }, bounds, 10, 6)).toEqual(region);
    expect(projectSelectionRegion(region, [], bounds, 10, 6)).toEqual({ x1: 140, y1: 95, x2: 200, y2: 140 });
    expect(snapGridRect({ x1: 143, y1: 96, x2: 145, y2: 98 }, bounds, 10, 6)).toEqual({ x: 1, y: 1, width: 1, height: 1 });
    expect(snapGridRect({ x1: 1, y1: 1, x2: 20, y2: 20 }, bounds, 10, 6)).toBe(null);
  });
  it('整框按格移动，格内抖动不涨列数，到边缘仍保持 3×3', () => {
    const move = gesture('move', { x: 170, y: 115 });
    expect(move({ x: 178, y: 119 })).toEqual(region);
    expect(move({ x: 193, y: 131 })).toEqual({ ...region, x: 2, y: 2 });
    expect(move({ x: 2000, y: 2000 })).toEqual({ ...region, x: 7, y: 3 });
    expect(move({ x: -2000, y: -2000 })).toEqual({ ...region, x: 0, y: 0 });
  });
  it('八个手柄只改变指定边，横向手柄不能意外改变行数', () => {
    for (const dir of ['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se']) {
      const resize = gesture('resize', { x: 170, y: 115 }, dir);
      const next = resize({ x: dir.includes('w') ? 150 : 190, y: dir.includes('n') ? 100 : 130 });
      expect(next.width).toBe(dir.includes('w') || dir.includes('e') ? 4 : 3);
      expect(next.height).toBe(dir.includes('n') || dir.includes('s') ? 4 : 3);
      expect(next.x).toBe(dir.includes('w') ? 0 : 1);
      expect(next.y).toBe(dir.includes('n') ? 0 : 1);
    }
    expect(gesture('resize', { x: 200, y: 110 }, 'e')({ x: 1, y: 1000 })).toEqual({ ...region, width: 1 });
  });
});
