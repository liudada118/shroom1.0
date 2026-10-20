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
import { deriveGridSize, normalizePointGridParams } from '../renderers/pointGrid/core/params.js';
import { buildPointGridBasePositions, runPointGridPipeline } from '../renderers/pointGrid/core/pipeline.js';

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

  it('规则 32×32 点图只在渲染副本内扩为 64×64，原始输入保持 1024 点', () => {
    const matrix = { rows: 32, cols: 32 };
    const input = createDirectionCheckFrame(1024), original = input.slice();
    const generated = createMatrixDisplayRenderers({ matrix }).find(item => item.id === 'pointGrid');
    const builtin = createBuiltinMatrixRendererParams('pointGrid', { matrix });
    for (const params of [normalizePointGridParams(generated.params), builtin]) {
      for (const channel of [params.sit, params.back]) {
        expect(channel.num1 * channel.num2).toBe(1024);
        expect(channel).toMatchObject({ interp: 2, order: 0 });
        expect(deriveGridSize(channel)).toEqual({ amountX: 64, amountY: 64, total: 4096 });
        const displayed = runPointGridPipeline(input, channel, 2);
        expect(displayed).toHaveLength(4096);
        expect(displayed.every(Number.isFinite)).toBe(true);
      }
    }
    expect(input).toEqual(original);
    expect(matrix).toEqual({ rows: 32, cols: 32 });
  });

  it('非方阵只加密显示点，不改变行列与输入点数', () => {
    const matrix = { rows: 2, cols: 3 }, input = [1, 2, 3, 4, 5, 6];
    const generated = createMatrixDisplayRenderers({ matrix }).find(item => item.id === 'pointGrid');
    for (const params of [normalizePointGridParams(generated.params), createBuiltinMatrixRendererParams('pointGrid', { matrix })]) {
      expect(params.sit).toMatchObject({ num1: 2, num2: 3, interp: 2, order: 0 });
      expect(deriveGridSize(params.sit)).toEqual({ amountX: 4, amountY: 6, total: 24 });
      expect(runPointGridPipeline(input, params.sit, 1)).toHaveLength(24);
    }
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('有效物理坐标保持逐点形状和原有点数，不做规则网格插点', () => {
    const matrix = { rows: 2, cols: 3 };
    const coordinateMap = [[[0, 0], [2, 0], [8, 1]], [[1, 4], [4, 7], [9, 10]]];
    const original = coordinateMap.map(row => row.map(point => point.slice()));
    const generated = createMatrixDisplayRenderers({ matrix, coordinateMap }).find(item => item.id === 'pointGrid');
    for (const params of [normalizePointGridParams(generated.params), createBuiltinMatrixRendererParams('pointGrid', { matrix, coordinateMap })]) {
      expect(params.sit).toMatchObject({ num1: 2, num2: 3, interp: 1, order: 0 });
      expect(params.back).toMatchObject({ interp: 1, order: 0 });
      const grid = deriveGridSize(params.sit);
      expect(grid).toEqual({ amountX: 2, amountY: 3, total: 6 });
      expect(params.points).toEqual(coordinateMap.flat());
      expect(Array.from(buildPointGridBasePositions({ ...grid, separation: 100, points: params.points })))
        .toEqual([-90, 0, 100, -50, 0, 100, 70, 0, 80, -70, 0, 20, -10, 0, -40, 90, 0, -100]);
    }
    expect(coordinateMap).toEqual(original);
  });

  it('不完整的物理坐标不会把规则网格误判为保形点位', () => {
    const context = { matrix: { rows: 2, cols: 3 }, coordinateMap: [[[0, 0]]] };
    const generated = createMatrixDisplayRenderers(context).find(item => item.id === 'pointGrid');
    for (const params of [normalizePointGridParams(generated.params), createBuiltinMatrixRendererParams('pointGrid', context)]) {
      expect(params.points).toBeNull();
      expect(params.sit).toMatchObject({ num1: 2, num2: 3, interp: 2, order: 0 });
    }
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
