import { describe, expect, it } from 'vitest';
import { createJqbedLiveLogState, isJqbedLogMissing, jqbedAlgorithmLogFrameKey, mergeJqbedAlgorithmLogFrame } from './jqbedAlgorithmLogState';

const frame = (sequence, outputs = { breath_rate: -1, in_bed: 0 }) => ({
  sensorType: 'jqbed', sequence, receivedAt: `frame-${sequence}`, outputs,
});

describe('jqbed live output state', () => {
  it('holds each field independently through -1 gaps, with zero remaining a valid update', () => {
    const state = createJqbedLiveLogState(null);
    expect(state.observe(frame(1, { rate: 0, state: 0 }), true)).toEqual(frame(1, { rate: 0, state: 0 }));
    expect(state.observe(frame(2, { rate: -1, future: null }), true)).toEqual(frame(2, { rate: 0, state: 0, future: null }));
    const outputs = Object.freeze({ matrix: Object.freeze(Array.from({ length: 1024 }, (_, index) => index)), reserved_bytes: [0, -1, 4, 5, 6, 7, 8, 999999] });
    const latest = frame(3, outputs);
    const displayed = state.observe(latest, true);
    expect(displayed.sequence).toBe(3);
    expect(displayed.outputs.matrix).toBe(outputs.matrix);
    expect(displayed.outputs.reserved_bytes).toBe(outputs.reserved_bytes);
  });

  it('rejects non-jqbed and invalid outputs instead of retaining data from a different source', () => {
    [null, {}, { ...frame(1), sensorType: 'smallBed' }, frame(1, null), frame(1, [1, 2])].forEach((invalid) => {
      expect(jqbedAlgorithmLogFrameKey(invalid)).toBe(null);
      const state = createJqbedLiveLogState(null);
      state.observe(frame(2), true);
      expect(state.observe(invalid, true)).toBe(null);
    });
  });

  it('waits for a new received frame after activation or reset, rather than reusing an old prop', () => {
    const old = frame(1);
    const state = createJqbedLiveLogState(old);
    expect(state.observe(old, true)).toBe(null);
    expect(state.observe(frame(2), true)).toEqual(frame(2));
    expect(state.reset(frame(2))).toBe(null);
    expect(state.observe(frame(2), true)).toBe(null);
    expect(state.observe(frame(3), true)).toEqual(frame(3));
  });

  it('does not replay a frame received before authorization or while the log tab is inactive', () => {
    const state = createJqbedLiveLogState(null);
    expect(state.observe(frame(1), false)).toBe(null);
    expect(state.observe(frame(1), true)).toBe(null);
    expect(state.observe(frame(2), true)).toEqual(frame(2));
    expect(state.observe(null, false)).toBe(null);
    expect(state.observe(frame(2), true)).toBe(null);
    expect(state.observe(frame(3), true)).toEqual(frame(3));
  });
});

describe('per-field non-minus-one output merge', () => {
  it('handles interleaved fields and omitted keys without clearing another field', () => {
    let latest = mergeJqbedAlgorithmLogFrame(null, frame(1, { breath: 12, posture: -1, future: null }));
    latest = mergeJqbedAlgorithmLogFrame(latest, frame(2, { breath: -1, posture: 0 }));
    expect(latest).toEqual(frame(2, { breath: 12, posture: 0, future: null }));
    latest = mergeJqbedAlgorithmLogFrame(latest, frame(3, { breath: 0, posture: -1, unknown: false }));
    expect(latest).toEqual(frame(3, { breath: 0, posture: 0, future: null, unknown: false }));
  });

  it('keeps first-seen missing field names as placeholders while never overwriting a valid value with -1', () => {
    const initial = mergeJqbedAlgorithmLogFrame(null, frame(1, { breath: -1, matrix: [[-1], [-1, -1]] }));
    expect(Object.keys(initial.outputs)).toEqual(['breath', 'matrix']);
    expect(isJqbedLogMissing(initial.outputs.breath)).toBe(true);
    expect(isJqbedLogMissing(initial.outputs.matrix)).toBe(true);
    const valid = mergeJqbedAlgorithmLogFrame(initial, frame(2, { breath: 0, matrix: [0, 5] }));
    const held = mergeJqbedAlgorithmLogFrame(valid, frame(3, { breath: -1, matrix: [[-1, -1], [-1]] }));
    expect(held.outputs.breath).toBe(0);
    expect(held.outputs.matrix).toBe(valid.outputs.matrix);
  });

  it('replaces a mixed matrix as a whole instead of mixing channel values across frames', () => {
    const oldMatrix = [40, 50, 60, 70];
    const newMatrix = [-1, 0, 8, -1];
    const previous = mergeJqbedAlgorithmLogFrame(null, frame(1, { matrix: oldMatrix }));
    const next = mergeJqbedAlgorithmLogFrame(previous, frame(2, { matrix: newMatrix }));
    expect(next.outputs.matrix).toBe(newMatrix);
    expect(next.outputs.matrix).toEqual([-1, 0, 8, -1]);
    expect(previous.outputs.matrix).toBe(oldMatrix);
  });

  it('treats only numeric -1 leaves as missing and preserves valid zero, null, text, and empty arrays', () => {
    [-1, [-1], [[-1], [], [-1, -1]]].forEach((value) => expect(isJqbedLogMissing(value)).toBe(true));
    [0, null, false, '-1', [], [0, -1], [null, -1], [{ value: -1 }], { value: -1 }]
      .forEach((value) => expect(isJqbedLogMissing(value)).toBe(false));
  });

  it('uses the latest reply metadata without mutating either source and clears an invalid source', () => {
    const previous = Object.freeze(frame(1, Object.freeze({ breath: 14, state: 0 })));
    const incoming = Object.freeze(frame(2, Object.freeze({ breath: -1, future: null })));
    expect(mergeJqbedAlgorithmLogFrame(previous, incoming)).toEqual(frame(2, { breath: 14, state: 0, future: null }));
    expect(previous.outputs).toEqual({ breath: 14, state: 0 });
    expect(incoming.outputs).toEqual({ breath: -1, future: null });
    expect(mergeJqbedAlgorithmLogFrame(previous, null)).toBe(null);
    expect(mergeJqbedAlgorithmLogFrame(previous, { ...incoming, sensorType: 'other' })).toBe(null);
  });

  it('does not carry held fields past a new log session', () => {
    const state = createJqbedLiveLogState(null);
    state.observe(frame(1, { breath: 14, posture: 2 }), true);
    state.reset(null);
    expect(state.observe(frame(2, { breath: -1 }), true).outputs).toEqual({ breath: -1 });
  });
});
