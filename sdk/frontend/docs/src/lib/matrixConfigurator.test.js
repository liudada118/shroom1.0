import { describe, expect, it } from 'vitest';

import {
  createCoordinateMatrix,
  createDefaultMatrixSample,
  orientFrame,
  parseCoordinateMap,
  parseFrameValues,
} from './matrixConfigurator.js';

describe('matrixConfigurator', () => {
  it('从坐标矩阵自动识别行列和点数', () => {
    const coordinates = createCoordinateMatrix(2, 3);
    const result = parseCoordinateMap(JSON.stringify(coordinates));

    expect(result.layout).toMatchObject({ rows: 2, cols: 3, pointCount: 6 });
  });

  it('为所有矩阵渲染页提供同一份 8×8 和 1..64 默认输入', () => {
    const sample = createDefaultMatrixSample();

    expect(sample).toMatchObject({ rows: 8, cols: 8, pointCount: 64, valueMax: 64 });
    expect(sample.values).toEqual(Array.from({ length: 64 }, (_, index) => index + 1));
    expect(sample.coordinateMap).toHaveLength(8);
    expect(sample.coordinateMap[0]).toHaveLength(8);
  });

  it('同时接受一维帧和二维矩阵', () => {
    expect(parseFrameValues('[1,2,3,4]', 4)).toEqual([1, 2, 3, 4]);
    expect(parseFrameValues('[[1,2],[3,4]]', 4)).toEqual([1, 2, 3, 4]);
    expect(() => parseFrameValues('[1,2,3]', 4)).toThrow('需要 4 个数');
  });

  it.each([
    ['identity', 2, 3, [1, 2, 3, 4, 5, 6]],
    ['flip-x', 2, 3, [3, 2, 1, 6, 5, 4]],
    ['flip-y', 2, 3, [4, 5, 6, 1, 2, 3]],
    ['rotate-180', 2, 3, [6, 5, 4, 3, 2, 1]],
    ['rotate-cw', 3, 2, [4, 1, 5, 2, 6, 3]],
    ['rotate-ccw', 3, 2, [3, 6, 2, 5, 1, 4]],
  ])('%s 保持正确的 row-major 顺序', (direction, rows, cols, values) => {
    expect(orientFrame([1, 2, 3, 4, 5, 6], 2, 3, direction)).toEqual({
      rows,
      cols,
      values,
    });
  });
});
