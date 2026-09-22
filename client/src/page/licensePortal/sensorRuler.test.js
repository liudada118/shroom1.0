import { describe, expect, it } from 'vitest';
import { nearestSensorPoint, normalizeSensorPitch, readSensorPitch, saveSensorPitch, sensorRulerDistance, sensorRulerSpan } from './sensorRuler';
import { createPointGridSelection } from '../../renderers/pointGridSelection';

describe('传感点物理量尺', () => {
  it('相邻两点是一格，跨格数不依赖毫米校准，非整数点位不产生测量', () => {
    expect(sensorRulerSpan({ x: 2, y: 5 }, { x: 3, y: 5 })).toEqual({ columns: 1, rows: 0 });
    expect(sensorRulerSpan({ x: 5, y: 9 }, { x: 2, y: 5 })).toEqual({ columns: 3, rows: 4 });
    expect(sensorRulerDistance({ x: 2.2, y: 5 }, { x: 3, y: 5 }, { x: 6, y: 8 })).toBe(null);
  });
  it('非等距矩阵用点间隔而非点数计算，3×6 mm 与 4×8 mm 的对角线与屏幕无关', () => {
    expect(sensorRulerDistance({ x: 1, y: 2 }, { x: 4, y: 6 }, { x: 6, y: 8 })).toBeCloseTo(Math.hypot(18, 32));
    expect(sensorRulerDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 6, y: 8 })).toBe(6);
    expect(sensorRulerDistance({ x: 1, y: 2 }, { x: 1, y: 2 }, { x: 6, y: 8 })).toBe(0);
  });
  it('缺少或非法点距不报告毫米值，不以屏幕距离或点面积兜底', () => {
    for (const value of [null, {}, { x: '', y: 6 }, { x: 0, y: 6 }, { x: -1, y: 6 }, { x: Infinity, y: 6 }]) {
      expect(normalizeSensorPitch(value)).toBe(null);
      expect(sensorRulerDistance({ x: 1, y: 2 }, { x: 4, y: 6 }, value)).toBe(null);
    }
  });
  it('吸附真实可见点，画布偏移和缩放只改投影，不改传感点身份', () => {
    const points = [{ index: 7, x: 200, y: 300, visible: true }, { index: 8, x: 220, y: 300, visible: false }];
    expect(nearestSensorPoint(points, { x: 204, y: 302 }, 4)).toEqual({ x: 3, y: 1 });
    const zoomed = points.map((p) => ({ ...p, x: p.x * 2 + 10, y: p.y * 2 + 20 }));
    expect(nearestSensorPoint(zoomed, { x: 410, y: 620 }, 4)).toEqual({ x: 3, y: 1 });
    expect(nearestSensorPoint(points, { x: 900, y: 900 }, 4)).toBe(null);
  });
  it('各系统分别保存点距，损坏与写失败不伪装成保存成功', () => {
    const entries = new Map(), storage = { getItem: (key) => entries.get(key), setItem: (key, value) => entries.set(key, value) };
    expect(saveSensorPitch('system-a', { x: '6', y: '8' }, storage)).toBe(true);
    expect(readSensorPitch('system-a', storage)).toEqual({ x: 6, y: 8 });
    expect(readSensorPitch('system-b', storage)).toBe(null);
    entries.set('system-a', '{'); expect(readSensorPitch('system-a', storage)).toBe(null);
    expect(saveSensorPitch('system-a', { x: 6, y: 8 }, { setItem() { throw Error('quota'); } })).toBe(false);
  });
  it('原始矩阵投影与统计按同一索引，编辑和清除立即更新暂停帧读数', () => {
    let changes = 0;
    const api = createPointGridSelection({ columns: 4, rows: 3, onSelectionChange: () => { changes++; },
      projectSensors: () => Array.from({ length: 12 }, (_, index) => ({ index, visible: true, x: index % 4 * 20, y: Math.floor(index / 4) * 20 })) });
    api.setActive(true); api.updateValues([1, 2, 3, 4, 10, 20, 30, 40, 100, 200, 300, 400]);
    api.selectScreen({ x1: 19, y1: 39, x2: 41, y2: 41 });
    expect(api.getStats().totalPres).toBe(500);
    expect(api.getSensorPoints()).toHaveLength(12);
    api.remove(api.getSnapshot().regions[0].id);
    expect(api.getStats().totalPres).toBe(1110); expect(changes).toBe(3);
  });
});
