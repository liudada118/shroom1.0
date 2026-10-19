import { describe, expect, it } from 'vitest';
import { createMatrixVisualTuning, gaussianMatrixFrame, normalizeMatrixVisualTuning } from './matrixVisualTuning.js';

describe('matrix visual tuning', () => {
  it('starts unfiltered and keeps raw input and returned buffers independent', () => {
    const visual = createMatrixVisualTuning({ width: 2, height: 2 });
    const raw = [0, 10, 20, 30];
    const shown = visual.push(raw);
    expect(shown).toEqual(raw); expect(shown).not.toBe(raw);
    raw[1] = 900; shown[2] = 800;
    expect(visual.read()).toEqual([0, 10, 20, 30]);
  });

  it('changes floor and total gates on the cached frame and restores raw values at zero', () => {
    const visual = createMatrixVisualTuning({ width: 2, height: 2 });
    visual.push(Object.freeze([10, 20, 30, 0]));
    expect(visual.update({ valuef: 21 })).toEqual([0, 0, 30, 0]);
    expect(visual.update({ valuelInit: 31 })).toEqual([0, 0, 0, 0]);
    expect(visual.update({ valuelInit: 0, valuef: 0 })).toEqual([10, 20, 30, 0]);
    expect(visual.settings()).toMatchObject({ valuef: 0, valuelInit: 0 });
  });

  it('spreads an isolated peak in both axes and disabling Gaussian restores that same frame', () => {
    const visual = createMatrixVisualTuning({ width: 3, height: 3 });
    const raw = Object.freeze([0, 0, 0, 0, 90, 0, 0, 0, 0]);
    visual.push(raw);
    const blurred = visual.update({ valueg: 1 });
    expect(blurred[4]).toBeGreaterThan(0); expect(blurred[4]).toBeLessThan(90);
    expect(blurred[1]).toBeGreaterThan(0); expect(blurred[3]).toBeCloseTo(blurred[1], 12);
    expect(blurred[7]).toBeCloseTo(blurred[1], 12); expect(blurred[5]).toBeCloseTo(blurred[1], 12);
    expect(visual.update({ valueg: 0 })).toEqual(raw);
    expect(gaussianMatrixFrame(new Array(6).fill(5), 3, 2, 8).every((value) => Math.abs(value - 5) < 1e-10)).toBe(true);
  });

  it('smooths successive frames without advancing time on repeated parameter redraws', () => {
    const visual = createMatrixVisualTuning({ width: 2, height: 1 });
    visual.update({ valuel: 4 }); visual.push([0, 0]);
    expect(visual.push([100, 0])).toEqual([25, 0]);
    expect(visual.update({ valuel: 4 })).toEqual([25, 0]);
    expect(visual.update({ valuej: 300 })).toEqual([25, 0]);
    expect(visual.update({ valuel: 2 })).toEqual([50, 0]);
    expect(visual.update({ valuel: 0 })).toEqual([100, 0]);
  });

  it('clears a gated frame immediately rather than keeping a temporal ghost', () => {
    const visual = createMatrixVisualTuning({ width: 1, height: 1 });
    visual.update({ valuel: 10 }); visual.push([100]);
    expect(visual.update({ valuelInit: 101 })).toEqual([0]);
    expect(visual.update({ valuelInit: 0 })).toEqual([100]);
  });

  it('clamps finite sliders and ignores missing or invalid input', () => {
    const visual = createMatrixVisualTuning({ width: 1, height: 1 });
    visual.update({ valuej: 0, valueg: 1000, valuel: 1000, valuef: -8, valuelInit: Infinity });
    expect(visual.settings()).toEqual({ valuej: 1, valueg: 8, valuel: 100, valuef: 0, valuelInit: 0 });
    expect(normalizeMatrixVisualTuning(visual.settings(), { valueg: NaN, valuef: '100', valuelInit: 1e20 })).toMatchObject({ valueg: 8, valuef: 0, valuelInit: 1e15 });
    expect(visual.push([NaN])).toEqual([0]);
  });
});
