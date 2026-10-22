import { describe, expect, it } from 'vitest';
import { buildTerrainField, composeTerrainField, sampleTerrainField, smoothTerrainField } from './terrainField';
import { REFERENCE_TERRAIN_BASE } from './referenceTerrainBase';

describe('触觉手套真实压力地形', () => {
  it('无设备输入也显示参考初始底形，默认倍率0.6且右手镜像，统计保持零', () => {
    const empty = buildTerrainField();
    const left = composeTerrainField(empty.field), right = composeTerrainField(empty.field, 'right');
    expect(empty.pressureTotal).toBe(0);
    expect(empty.pressureMax).toBe(0);
    expect(REFERENCE_TERRAIN_BASE).toHaveLength(1024);
    expect(REFERENCE_TERRAIN_BASE.reduce((sum, value) => sum + value, 0)).toBe(25218);
    expect(Math.max(...left.field)).toBeCloseTo(99);
    for (let row = 0; row < 32; row++) {
      for (let col = 0; col < 32; col++) expect(right.field[row * 32 + col]).toBe(left.field[row * 32 + 31 - col]);
    }
  });

  it('初始底形按参考掩膜叠加两倍真实压力，保留边缘并限制显示到255', () => {
    const pressure = new Float32Array(1024).fill(10);
    const result = composeTerrainField(pressure);
    expect(result.field[0]).toBe(0);
    expect(result.field[14]).toBeCloseTo(22 * .6 + 10 * 2 * (22 * .6 / 30));
    expect(Math.max(...composeTerrainField(new Float32Array(1024).fill(1000)).field)).toBe(255);
    expect([...composeTerrainField(pressure, 'left', 0).field].every((value) => value === 0)).toBe(true);
    expect(Math.max(...composeTerrainField(new Float32Array(1024), 'left', 1.5).field)).toBeCloseTo(247.5);
  });

  it('低总压力不再整帧过滤；底形不计入真实统计且不修改输入', () => {
    const frame = { rawPressure: Array(256).fill(1), pressure: Array(147).fill(1) };
    const result = buildTerrainField(frame);
    const composed = composeTerrainField(result.field);
    expect(result.pressureTotal).toBe(256);
    expect(result.pressureMax).toBe(1);
    expect(composed.field.some((value, index) => value > composed.base[index])).toBe(true);
    expect(frame.rawPressure).toEqual(Array(256).fill(1));
  });
  it('优先显示当前扣零矩阵，旧映射压力不能残留成假山峰', () => {
    const result = buildTerrainField({ pressure: Array(147).fill(100), rawPressure: Array(256).fill(0) });
    expect(result.layout).toBe('hand');
    expect(result.pressureTotal).toBe(0);
    expect([...sampleTerrainField(smoothTerrainField(result.field))].every((value) => value === 0)).toBe(true);
  });

  it('左右手硬件点表独立读取，并保留整帧原始总和', () => {
    const raw = Array(256).fill(0);
    raw[0] = 90;
    const left = buildTerrainField({ rawPressure: raw }, 'left');
    const right = buildTerrainField({ rawPressure: raw }, 'right');
    expect(left.pressureTotal).toBe(90);
    expect(right.pressureTotal).toBe(90);
    expect(Math.max(...left.field)).toBeGreaterThan(0);
    expect(Math.max(...right.field)).toBe(0);
    expect(raw[0]).toBe(90);
  });

  it('整包195点和其256原始矩阵使用矩形数据，不虚构手形映射', () => {
    const mapped = buildTerrainField({ pressure: Array(195).fill(40) });
    const raw = buildTerrainField({ pressure: Array(195).fill(0), rawPressure: Array(256).fill(25) });
    expect(mapped.layout).toBe('matrix');
    expect(mapped.pressureTotal).toBe(7800);
    expect(Math.max(...mapped.field)).toBeCloseTo(40);
    expect(raw.layout).toBe('matrix');
    expect(raw.pressureTotal).toBe(6400);
    expect(Math.max(...raw.field)).toBeCloseTo(25);
  });

  it('147规范映射支持缺原始帧的回放，非法值不会污染地形', () => {
    const pressure = Array(147).fill(0);
    pressure[0] = 120;
    pressure[1] = NaN;
    pressure[2] = -10;
    const result = buildTerrainField({ pressure });
    const terrain = sampleTerrainField(smoothTerrainField(result.field));
    expect(result.layout).toBe('hand');
    expect(result.pressureTotal).toBe(120);
    expect(Math.max(...terrain)).toBeGreaterThan(0);
    expect([...terrain].every(Number.isFinite)).toBe(true);
  });
});
