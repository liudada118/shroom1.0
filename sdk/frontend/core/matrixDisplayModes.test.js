import { describe, expect, it } from 'vitest';

import {
  BUILTIN_MATRIX_RENDERER_OPTIONS,
  MATRIX_DISPLAY_MODES,
  createBuiltinMatrixRendererParams,
  createDirectionCheckFrame,
  createMatrixDisplayRenderers,
  inferMatrixDisplayModeId,
  getMatrixDisplayMode,
  resolveMatrixRendererType,
} from './matrixDisplayModes.js';
import { normalizeNumMatrixParams } from '../renderers/numMatrix/core/params.js';

describe('matrixDisplayModes', () => {
  it('只提供原生矩阵展示形式，默认 3D 点图', () => {
    expect(MATRIX_DISPLAY_MODES.map((mode) => mode.rendererId)).toEqual([
      'pointGrid',
      'numMatrix',
      'webglHeatmap',
      'blobHeatmap',
    ]);
  });

  it('根据矩阵尺寸和坐标生成 3D 渲染参数', () => {
    const coordinateMap = {
      coordinates: [
        [[0, 0], [2, 0], [4, 0]],
        [[0, 3], [2, 3], [4, 3]],
      ],
    };
    const renderers = createMatrixDisplayRenderers({
      matrix: { rows: 2, cols: 3 },
      coordinateMap,
    });

    expect(renderers.find((item) => item.id === 'pointGrid').params).toMatchObject({
      sit: { num1: 2, num2: 3, interp: 1, order: 0 },
      points: [[0, 0], [2, 0], [4, 0], [0, 3], [2, 3], [4, 3]],
    });
    expect(renderers.find((item) => item.id === 'numMatrix').params).toMatchObject({
      backend: 'sprite3d',
      frameInput: 'raw',
      gridWidth: 3,
      gridHeight: 2,
    });
    expect(renderers.find((item) => item.id === 'webglHeatmap').params).toMatchObject({
      dataWidth: 3, dataHeight: 2, minFrameLength: 6, edgeClear: null, mirrorX: false, valueScale: 1,
    });
  });

  it('生成方向校验帧并兼容旧 renderer id', () => {
    expect(createDirectionCheckFrame(5)).toEqual([1, 2, 3, 4, 5]);
    expect(inferMatrixDisplayModeId('pointGrid')).toBe('matrix-points-3d');
    expect(inferMatrixDisplayModeId('unknown')).toBe('matrix-points-3d');
    expect(inferMatrixDisplayModeId('heatmap')).toBe('matrix-points-3d');
    expect(inferMatrixDisplayModeId('matrix')).toBe('matrix-points-3d');
  });

  it('只提供原生平面数字矩阵，旧三维名称和重复数字别名都指向同一个二维模式', () => {
    const renderer = createMatrixDisplayRenderers({ matrix: { rows: 23, cols: 23 } })
      .find((item) => item.id === 'numMatrix');
    expect(normalizeNumMatrixParams(renderer.params)).toMatchObject({
      backend: 'sprite3d', frameInput: 'raw', gridWidth: 23, gridHeight: 23,
    });
    expect(renderer.label).toBe('2D 数字');
    expect(MATRIX_DISPLAY_MODES.filter((mode) => mode.kind === 'values')).toHaveLength(1);
    expect(getMatrixDisplayMode('matrix-values-3d')).toMatchObject({ rendererId: 'numMatrix', dimension: '2d' });
    expect(inferMatrixDisplayModeId('numMatrix2d')).toBe('matrix-values-2d');
    expect(resolveMatrixRendererType('numMatrix2d')).toBe('numMatrix');
    expect(normalizeNumMatrixParams({ backend: 'webgl', webgl: { variant: 'original' } }).webgl)
      .toMatchObject({ whiteOnZero: true, zeroTextColor: '#999' });
  });

  it('为所有通用矩阵渲染器生成同一份 2×3 输入参数', () => {
    const coordinateMap = [
      [[0, 1], [1, 1], [2, 1]],
      [[0, 0], [1, 0], [2, 0]],
    ];
    const context = {
      matrix: { rows: 2, cols: 3 },
      coordinateMap,
      valueMax: 6,
    };

    expect(BUILTIN_MATRIX_RENDERER_OPTIONS.map((item) => item.id)).toEqual([
      'numMatrix',
      'pointGrid',
      'webglHeatmap',
      'blobHeatmap',
    ]);
    expect(createBuiltinMatrixRendererParams('numMatrix', context)).toMatchObject({
      gridWidth: 3,
      gridHeight: 2,
      textureValueMax: 6,
    });
    expect(createBuiltinMatrixRendererParams('pointGrid', context)).toMatchObject({
      sit: { num1: 2, num2: 3, interp: 1, order: 0 },
      points: [[0, 1], [1, 1], [2, 1], [0, 0], [1, 0], [2, 0]],
    });
    expect(createBuiltinMatrixRendererParams('webglHeatmap', context)).toMatchObject({
      dataWidth: 3,
      dataHeight: 2,
      max: 6,
      minFrameLength: 6,
    });
    expect(createBuiltinMatrixRendererParams('blobHeatmap', context)).toMatchObject({
      dataWidth: 3,
      dataHeight: 2,
      max: 6,
    });
    expect(() => createBuiltinMatrixRendererParams('unknown', context)).toThrow('不支持');
  });
});
