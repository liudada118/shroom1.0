import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { deriveGridSize, normalizePointGridParams } from '../../../../sdk/frontend/renderers/pointGrid/core/params.js';
import { buildPointGridBasePositions, runPointGridPipeline } from '../../../../sdk/frontend/renderers/pointGrid/core/pipeline.js';
import { gridSelectionStats, projectGridSensors } from '../../../../sdk/frontend/renderers/shared/gridSelection.js';
import {
  buildManifestWidgetRendererParams,
  buildManifestWidgetSourceOptions,
  resolveManifestWidgetGeometry,
  resolveManifestWidgetSourceValue,
} from './manifestWidgetGeometry.js';

const leftCoordinates = {
  coordinates: [
    [[0, 0], [1, 0], [3, 0]],
    [[0, 2], [1, 2], [3, 2]],
  ],
};

const rightCoordinates = {
  coordinates: [
    [[10, 0], [12, 0]],
    [[10, 1], [12, 1]],
    [[10, 4], [12, 4]],
  ],
};

const sensors = [
  {
    id: 'left-pad',
    label: '左手',
    outputChannel: 'leftPressure',
    matrix: { rows: 2, cols: 3 },
    coordinateMap: leftCoordinates,
  },
  {
    id: 'right-pad',
    label: '右手',
    outputChannel: 'rightPressure',
    matrix: { rows: 3, cols: 2 },
    coordinateMap: rightCoordinates,
  },
];

describe('manifest widget per-sensor geometry', () => {
  it('每个 widget 按自己的 source 取得矩阵和坐标布局', () => {
    const definition = {
      sourceMatrix: sensors[0].matrix,
      sourceCoordinateMap: leftCoordinates,
    };
    const left = resolveManifestWidgetGeometry({
      source: 'leftPressure.data',
      sensors,
      definition,
    });
    const right = resolveManifestWidgetGeometry({
      source: 'right-padData',
      sensors,
      definition,
    });

    expect(left.sourceSensor).toBe(sensors[0]);
    expect(left.sourceMatrix).toBe(sensors[0].matrix);
    expect(left.coordinatePointLayout).toMatchObject({ rows: 2, cols: 3, pointCount: 6 });
    expect(right.sourceSensor).toBe(sensors[1]);
    expect(right.sourceMatrix).toBe(sensors[1].matrix);
    expect(right.coordinatePointLayout).toMatchObject({ rows: 3, cols: 2, pointCount: 6 });
    expect(right.coordinatePointLayout.bounds).toMatchObject({ minX: 10, maxX: 12, maxY: 4 });
  });

  it('第二路缺少坐标时退回自身规则矩阵，不复用第一路顶层坐标', () => {
    const rightWithoutCoordinates = { ...sensors[1], coordinateMap: null };
    const result = resolveManifestWidgetGeometry({
      source: 'rightPressure',
      sensors: [sensors[0], rightWithoutCoordinates],
      definition: {
        sourceMatrix: sensors[0].matrix,
        sourceCoordinateMap: leftCoordinates,
      },
    });

    expect(result.sourceMatrix).toBe(rightWithoutCoordinates.matrix);
    expect(result.coordinateMap).toBeNull();
    expect(result.coordinatePointLayout).toBeNull();
  });

  it('旧单传感器定义仍可使用顶层 coordinateMap 兼容投影', () => {
    const singleSensor = { ...sensors[0], coordinateMap: null };
    const result = resolveManifestWidgetGeometry({
      source: 'data',
      sensors: [singleSensor],
      definition: {
        sourceMatrix: singleSensor.matrix,
        sourceCoordinateMap: leftCoordinates,
      },
    });

    expect(result.sourceSensor).toBe(singleSensor);
    expect(result.coordinatePointLayout).toMatchObject({ rows: 2, cols: 3 });
  });

  it('逐路坐标与逐路矩阵一起执行展示插值', () => {
    const result = resolveManifestWidgetGeometry({
      source: 'rightPressure',
      sensors,
      definition: {},
      matrixTransform: { type: 'interpolate', factor: 2 },
    });

    expect(result.coordinatePointLayout).toMatchObject({ rows: 6, cols: 4, pointCount: 24 });
  });
});

describe('manifest widget source choices', () => {
  it('数据源选项展示业务名称并以 outputChannel 为稳定值', () => {
    expect(buildManifestWidgetSourceOptions(sensors)).toEqual([
      { value: 'leftPressure', label: '左手 · leftPressure' },
      { value: 'rightPressure', label: '右手 · rightPressure' },
    ]);
  });

  it('旧 Data/metrics source 能映射回对应的可编辑选项', () => {
    expect(resolveManifestWidgetSourceValue('left-padData', sensors)).toBe('leftPressure');
    expect(resolveManifestWidgetSourceValue('rightPressure.metrics', sensors)).toBe('rightPressure');
    expect(resolveManifestWidgetSourceValue('custom', sensors)).toBe('custom');
  });
});

describe('manifest widget renderer params', () => {
  it.each([
    ['numMatrix', { backend: 'sprite3d', frameInput: 'raw' }],
    ['numMatrix', { backend: 'webgl', webgl: { variant: 'original', whiteOnZero: true, zeroTextColor: '#999' } }],
    ['numMatrix2d', { backend: 'webgl', frameInput: 'raw' }],
    ['numMatrix', {}],
  ])('旧原始数字%s在运行时统一蓝底及索引，不改变输入方向、精度或点位', (rendererId, legacy) => {
    const matrix = { rows: 16, cols: 23 }, coordinateMap = [[[3, 9], [4, 8]]];
    const params = { ...legacy, gridWidth: 1, gridHeight: 1, decimalScale: 10, coordinateMap,
      webgl: { ...legacy.webgl, rawTranspose: true, indexRow: false } };
    const before = structuredClone({ params, matrix, coordinateMap });
    const result = buildManifestWidgetRendererParams({ rendererId, params, matrix, coordinateMap });
    expect(result).toMatchObject({ backend: 'webgl', frameInput: 'raw', gridWidth: 23, gridHeight: 16,
      decimalScale: 10, coordinateMap, webgl: { rawTranspose: true, whiteOnZero: false,
        zeroTextColor: null, textColor: '#4ec7ff', indexRow: true, indexColumn: true } });
    expect({ params, matrix, coordinateMap }).toEqual(before);
  });

  it.each([
    { backend: 'sprite3d', frameInput: 'filtered' },
    { backend: 'canvas2d', frameInput: 'raw', canvas2d: { baseTiltDeg: 30 } },
  ])('显式三维数字配置仍沿用原后端$backend', (params) => {
    expect(buildManifestWidgetRendererParams({ rendererId: 'numMatrix', params, matrix: { rows: 4, cols: 5 } }))
      .toEqual({ ...params, gridWidth: 5, gridHeight: 4 });
  });

  it('3D 点图按当前卡片覆写行列和坐标，不沿用第一路 points', () => {
    const params = buildManifestWidgetRendererParams({
      rendererId: 'pointGrid',
      params: {
        fps: 20,
        sit: { num1: 2, num2: 3, interp: 2 },
        back: { num1: 2, num2: 3, interp: 2 },
        points: [[0, 0]],
      },
      matrix: sensors[1].matrix,
      coordinateMap: rightCoordinates,
    });

    expect(params.fps).toBe(20);
    expect(params.sit).toMatchObject({ num1: 3, num2: 2, interp: 1, order: 0 });
    expect(params.back).toMatchObject({ num1: 3, num2: 2, interp: 1, order: 0 });
    expect(params.points).toEqual(rightCoordinates.coordinates.flat());
    expect(params.transposeAxes).toBe(false);
  });

  it('当前路没有坐标时删除方案级旧 points，并为其它矩阵渲染器覆写尺寸', () => {
    const pointGrid = buildManifestWidgetRendererParams({
      rendererId: 'pointGrid',
      params: { points: [[99, 99]] },
      matrix: { rows: 4, cols: 5 },
    });
    const numMatrix = buildManifestWidgetRendererParams({
      rendererId: 'numMatrix',
      params: { backend: 'sprite3d', gridWidth: 2, gridHeight: 3 },
      matrix: { rows: 4, cols: 5 },
    });
    const heatmap = buildManifestWidgetRendererParams({
      rendererId: 'blobHeatmap',
      params: { max: 200, dataWidth: 2, dataHeight: 3 },
      matrix: { rows: 4, cols: 5 },
    });

    expect(pointGrid).not.toHaveProperty('points');
    expect(pointGrid.transposeAxes).toBe(true);
    expect(numMatrix).toMatchObject({ backend: 'sprite3d', gridWidth: 5, gridHeight: 4 });
    expect(numMatrix).not.toHaveProperty('transposeAxes');
    expect(heatmap).toMatchObject({ max: 200, dataWidth: 5, dataHeight: 4, transposeAxes: true });
  });

  it('显示方向只为矩阵点图和柔和热力图注入，不改变行列或原配置', () => {
    const matrix = Object.freeze({ rows: 2, cols: 3 });
    const params = Object.freeze({ fps: 20, transposeAxes: false });
    const pointGrid = buildManifestWidgetRendererParams({ rendererId: 'pointGrid', matrix, params });
    const heatmap = buildManifestWidgetRendererParams({ rendererId: 'blobHeatmap', matrix, params });
    const webglHeatmap = buildManifestWidgetRendererParams({ rendererId: 'webglHeatmap', matrix });

    expect(pointGrid).toMatchObject({ transposeAxes: true, sit: { num1: 2, num2: 3 } });
    expect(heatmap).toMatchObject({ transposeAxes: true, dataWidth: 3, dataHeight: 2 });
    expect(webglHeatmap).toMatchObject({ dataWidth: 3, dataHeight: 2, minFrameLength: 6 });
    expect(webglHeatmap).not.toHaveProperty('transposeAxes');
    expect(matrix).toEqual({ rows: 2, cols: 3 });
    expect(params).toEqual({ fps: 20, transposeAxes: false });
  });

  it('旧规则矩阵使用两倍渲染插值，非方阵框选仍只统计原始传感点', () => {
    const source = Object.freeze([5, 10, 20, 30, 40, 90]);
    const saved = Object.freeze({ sit: Object.freeze({ interp: 1, order: 4 }) });
    const config = normalizePointGridParams(buildManifestWidgetRendererParams({
      rendererId: 'pointGrid', params: saved, matrix: { rows: 2, cols: 3 },
    }));
    const grid = deriveGridSize(config.sit);
    const values = runPointGridPipeline(source, config.sit, 2);
    expect(grid).toMatchObject({ amountX: 12, amountY: 14 });
    expect(values).toHaveLength(grid.total);
    expect(values.every(Number.isFinite)).toBe(true);
    expect(source).toEqual([5, 10, 20, 30, 40, 90]);
    expect(saved.sit).toEqual({ interp: 1, order: 4 });

    const camera = new THREE.OrthographicCamera(-1000, 1000, 1000, -1000, 1, 10000);
    camera.position.set(0, 1000, 1000); camera.lookAt(0, 0, 0);
    for (const transposeAxes of [false, true]) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(buildPointGridBasePositions({
        ...grid, separation: 100, transposeAxes,
      }), 3));
      const points = new THREE.Points(geometry);
      const projected = projectGridSensors({ points, camera,
        canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
        columns: 3, rows: 2, interpolation: config.sit.interp, padding: config.sit.order });
      expect(projected).toHaveLength(24);
      expect(projected.filter(point => point.sensor).map(point => point.index)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(gridSelectionStats(source, new Set(projected.map(point => point.index))))
        .toMatchObject({ totalPres: 195, maxPres: 90, point: 6, selectedPoints: 6 });
      geometry.dispose(); points.material.dispose();
    }
  });

  it.each([undefined, 0])('旧规则点图补足默认四层零边，保存值 %s 不改变原配置或原始点数', (order) => {
    const matrix = Object.freeze({ rows: 32, cols: 32 });
    const saved = Object.freeze({ sit: Object.freeze({ interp: 1, ...(order !== undefined ? { order } : {}) }) });
    const source = Object.freeze(Array.from({ length: 1024 }, (_, index) => index + 1));
    const config = normalizePointGridParams(buildManifestWidgetRendererParams({ rendererId: 'pointGrid', params: saved, matrix }));
    expect(config.sit).toMatchObject({ num1: 32, num2: 32, interp: 2, order: 4 });
    expect(config.back).toMatchObject({ num1: 32, num2: 32, interp: 2, order: 4 });
    const grid = deriveGridSize(config.sit);
    expect(grid).toEqual({ amountX: 72, amountY: 72, total: 5184 });
    const displayed = runPointGridPipeline(source, config.sit, 0);
    expect(displayed).toHaveLength(5184);
    expect(displayed.slice(0, 72 * 4).every(value => value === 0)).toBe(true);
    expect(displayed.slice(-72 * 4).every(value => value === 0)).toBe(true);
    const camera = new THREE.OrthographicCamera(-4000, 4000, 4000, -4000, 1, 10000);
    camera.position.set(0, 5000, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(buildPointGridBasePositions({ ...grid, separation: 100, transposeAxes: true }), 3));
    const points = new THREE.Points(geometry);
    const projected = projectGridSensors({ points, camera,
      canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) },
      columns: 32, rows: 32, interpolation: config.sit.interp, padding: config.sit.order });
    expect(projected).toHaveLength(4096);
    expect(projected.filter(point => point.sensor).map(point => point.index)).toEqual(Array.from({ length: 1024 }, (_, index) => index));
    expect(gridSelectionStats(source, new Set(projected.map(point => point.index))))
      .toMatchObject({ totalPres: 524800, point: 1024, selectedPoints: 1024 });
    expect(source).toHaveLength(1024);
    expect(matrix).toEqual({ rows: 32, cols: 32 });
    expect(saved.sit).toEqual({ interp: 1, ...(order !== undefined ? { order } : {}) });
    geometry.dispose(); points.material.dispose();
  });

  it.each([2, 6])('规则矩阵保留已明确配置的正数补边 %s', (order) => {
    const config = buildManifestWidgetRendererParams({ rendererId: 'pointGrid',
      matrix: { rows: 2, cols: 3 }, params: { sit: { order }, back: { order } } });
    expect(config.sit.order).toBe(order);
    expect(config.back.order).toBe(order);
  });

  it('物理点位表即使继承旧插值参数也保留真实形状', () => {
    const config = normalizePointGridParams(buildManifestWidgetRendererParams({
      rendererId: 'pointGrid', matrix: { rows: 3, cols: 2 }, coordinateMap: rightCoordinates,
      params: { sit: { interp: 2, order: 4 } },
    }));
    const grid = deriveGridSize(config.sit);
    expect(grid.total).toBe(6);
    expect(Array.from(buildPointGridBasePositions({ ...grid, points: config.points, separation: 100 })))
      .toEqual([-50, 0, 100, 50, 0, 100, -50, 0, 50, 50, 0, 50, -50, 0, -100, 50, 0, -100]);
  });
});
