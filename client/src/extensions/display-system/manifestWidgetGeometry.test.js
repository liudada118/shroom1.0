import { describe, expect, it } from 'vitest';
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
    expect(params.sit).toMatchObject({ num1: 3, num2: 2, interp: 2 });
    expect(params.back).toMatchObject({ num1: 3, num2: 2, interp: 2 });
    expect(params.points).toEqual(rightCoordinates.coordinates.flat());
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
    expect(numMatrix).toMatchObject({ backend: 'sprite3d', gridWidth: 5, gridHeight: 4 });
    expect(heatmap).toMatchObject({ max: 200, dataWidth: 5, dataHeight: 4 });
  });
});
