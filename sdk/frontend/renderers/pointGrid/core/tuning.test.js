import { describe, expect, it } from 'vitest';
import { preparePointGridValues, updatePointGridTuning } from './tuning.js';
import { runPointGridPipeline } from './pipeline.js';

describe('点图调节与原帧隔离', () => {
  it('边缘宽度按通道取整数并保留关闭值，不串用另一通道', () => {
    const tuning = { edgeBuffer1: 2, edgeBuffer2: 4 };
    updatePointGridTuning(tuning, { edgeBuffer: 0 });
    expect(tuning).toEqual({ edgeBuffer1: 0, edgeBuffer2: 4 });
    updatePointGridTuning(tuning, { edgeBuffer: 8.8 }, 2);
    expect(tuning).toEqual({ edgeBuffer1: 0, edgeBuffer2: 9 });
    updatePointGridTuning(tuning, { edgeBuffer: NaN });
    expect(tuning.edgeBuffer1).toBe(0);
  });
  it('高斯设为零会关闭空间滤波，不产生使画布消失的 NaN', () => {
    const raw = Object.freeze([1, 2, 3, 4, 5, 6]);
    const displayed = runPointGridPipeline(raw, { num1: 2, num2: 3, interp: 1, order: 0 }, 0);
    expect(displayed).toEqual([10, 20, 30, 40, 50, 60]);
    expect(displayed.every(Number.isFinite)).toBe(true);
    expect(raw).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('过滤/总值门槛恢复时从原始缓存恢复，零值不会被忽略', () => {
    const raw = Object.freeze([1, 5, 10, 20]);
    const tuning = { valuef1: 0, valuelInit1: 0, value1: 2, valueg1: 2, valuel1: 2 };
    updatePointGridTuning(tuning, { valuef: 15, valuelInit: 0 });
    expect(preparePointGridValues(raw, tuning)).toEqual([0, 0, 0, 20]);
    updatePointGridTuning(tuning, { valuef: 0, value: 0, valueg: 0, valuelInit: 100 });
    expect(preparePointGridValues(raw, tuning)).toEqual([0, 0, 0, 0]);
    updatePointGridTuning(tuning, { valuelInit: 0 });
    expect(preparePointGridValues(raw, tuning)).toEqual(raw);
    expect(tuning).toMatchObject({ valuef1: 0, value1: 0, valueg1: 0, valuelInit1: 0 });
    expect(raw).toEqual([1, 5, 10, 20]);
  });
  it('忽略非数值并钳制除数、颜色和半径，另一通道不串值', () => {
    const tuning = { value1: 2 };
    updatePointGridTuning(tuning, { value: NaN, valuej: 0, valuel: 0, valueg: 999 });
    expect(tuning).toMatchObject({ value1: 2, valuej1: 1, valuel1: 1, valueg1: 20 });
    updatePointGridTuning(tuning, { valuef: 0, value: 0 }, 2);
    expect(tuning).toMatchObject({ value1: 2, value2: 0, valuef2: 0 });
  });
});
