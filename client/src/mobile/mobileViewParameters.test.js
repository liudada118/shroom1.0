import { describe, expect, it } from 'vitest';
import {
  commitMobileViewParameter,
  createMobileViewDrafts,
  createMobileViewParameters,
  getMobileViewFields,
  mobileRendererParameters,
  normalizeMobileViewParameters,
} from './mobileViewParameters.js';

describe('移动视图参数', () => {
  it('每个视图有独立参数，重置不会污染其他会话或默认值', () => {
    const first = createMobileViewParameters();
    first.points.colorMax = 80;
    first.heatmap.radius = 30;
    const second = createMobileViewParameters();
    expect(second.points).toEqual({ colorMax: 255, height: 0.1, spatialSmooth: 2,
      temporalSmooth: 2, pointFilter: 0, totalFilter: 0 });
    expect(second.heatmap).toEqual({ colorMax: 255, radius: 18, pointFilter: 0 });
    expect(second.numbers).toEqual({ colorMax: 255 });
  });

  it('三维色带换算内部两次放大，过滤为零也能覆盖原渲染器已有阈值', () => {
    const points = createMobileViewParameters().points;
    expect(mobileRendererParameters('points', points)).toEqual({ valuej: 25500,
      value: 0.1, valueg: 2, valuel: 2, valuef: Number.EPSILON, valuelInit: Number.EPSILON });
    expect(mobileRendererParameters('points', { ...points, colorMax: 120,
      pointFilter: 35, totalFilter: 500 })).toMatchObject({ valuej: 12000, valuef: 35, valuelInit: 500 });
    expect(points).toEqual(createMobileViewParameters().points);
  });

  it('热力图直接提供可重画最后一帧的参数，数字只改变色带', () => {
    expect(mobileRendererParameters('heatmap', { colorMax: 80, radius: 25, pointFilter: 0 }))
      .toEqual({ max: 80, size: 25, filter: 0 });
    expect(mobileRendererParameters('numbers', { colorMax: 90, pointFilter: 20 }))
      .toEqual({ valuej: 90 });
    expect(getMobileViewFields('numbers').map((field) => field.key)).toEqual(['colorMax']);
  });

  it('拒绝空白和非有限值，限制范围并移除不属于当前视图的字段', () => {
    expect(normalizeMobileViewParameters('points', { colorMax: Infinity, height: -3,
      spatialSmooth: '3.4', temporalSmooth: 25.4, pointFilter: '', totalFilter: null, radius: 50 }))
      .toEqual({ colorMax: 255, height: 0.02, spatialSmooth: 3.4, temporalSmooth: 20,
        pointFilter: 0, totalFilter: 0 });
    expect(normalizeMobileViewParameters('heatmap', { colorMax: 1.3, radius: 200, pointFilter: -2 }))
      .toEqual({ colorMax: 1, radius: 50, pointFilter: 0 });
    expect(normalizeMobileViewParameters('numbers', { colorMax: '  ' })).toEqual({ colorMax: 255 });
  });

  it('未知视图不会悄悄提供另一种视图的控制项', () => {
    expect(getMobileViewFields('unknown')).toEqual([]);
    expect(normalizeMobileViewParameters('unknown', { colorMax: 50 })).toEqual({});
    expect(mobileRendererParameters('unknown', {})).toEqual({});
  });

  it('编辑小数完成后才归一化，空白或非法文本保留之前已应用的值', () => {
    const points = { ...createMobileViewParameters().points, height: 0.4 };
    expect(commitMobileViewParameter('points', points, 'height', '0.2').height).toBe(0.2);
    expect(commitMobileViewParameter('points', points, 'height', '1.7').height).toBe(1);
    for (const raw of ['', '  ', 'NaN', '-', '.']) {
      expect(commitMobileViewParameter('points', points, 'height', raw).height).toBe(0.4);
    }
    expect(points.height).toBe(0.4);
  });

  it('切换视图和恢复默认从已应用参数重新生成文本，不携带其他视图的草稿', () => {
    expect(createMobileViewDrafts('heatmap', { colorMax: 80, radius: 25, pointFilter: 2 }))
      .toEqual({ colorMax: '80', radius: '25', pointFilter: '2' });
    expect(createMobileViewDrafts('points', createMobileViewParameters().points).height).toBe('0.1');
    expect(commitMobileViewParameter('numbers', { colorMax: 90 }, 'height', '0.2'))
      .toEqual({ colorMax: 90 });
  });
});
