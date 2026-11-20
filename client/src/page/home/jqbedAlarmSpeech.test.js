import { describe, expect, it } from 'vitest';
import { createJqbedAlarmSpeechState } from './jqbedAlarmSpeech';

describe('jqbed alarm speech transitions', () => {
  it('announces leaving the bed on the bed-state change, however short the stay', () => {
    const state = createJqbedAlarmSpeechState();
    expect(state.observe({ stateInBbed: 0, merged_alarm: 0 })).toEqual([]);
    expect(state.observe({ stateInBbed: 1, merged_alarm: 11 })).toEqual([]);
    expect(state.observe({ stateInBbed: 0, merged_alarm: 0 })).toEqual(['leftBed']);
    expect(state.observe({ stateInBbed: 0, merged_alarm: 0 })).toEqual([]);
    for (const inBed of [1, 3]) {
      expect(state.observe({ stateInBbed: inBed })).toEqual([]);
      expect(state.observe({ stateInBbed: 0 })).toEqual(['leftBed']);
    }
    expect(state.observe({ stateInBbed: 4 })).toEqual(['satUp']);
    expect(state.observe({ stateInBbed: 0 })).toEqual(['leftBed']);
  });

  it('announces sitting on the bed edge as soon as the bed state becomes 4, without waiting for merged alarm 14', () => {
    const state = createJqbedAlarmSpeechState();
    expect(state.observe({ stateInBbed: 1, merged_alarm: 0 })).toEqual([]);
    expect(state.observe({ stateInBbed: 4, merged_alarm: 0 })).toEqual(['satUp']);
    expect(state.observe({ stateInBbed: 4, merged_alarm: 0 })).toEqual([]);
    for (const value of [-1, undefined, 2, '4']) expect(state.observe({ stateInBbed: value })).toEqual([]);
    expect(state.observe({ stateInBbed: 4 })).toEqual([]);
    for (const from of [1, 3, 0]) {
      state.observe({ stateInBbed: from });
      expect(state.observe({ stateInBbed: 4 })).toEqual(['satUp']);
    }
  });

  it('does not repeat the same bed-edge sitting when merged alarm 14 arrives with or after the state change', () => {
    const state = createJqbedAlarmSpeechState();
    expect(state.observe({ stateInBbed: 1, merged_alarm: 0 })).toEqual([]);
    expect(state.observe({ stateInBbed: 4, merged_alarm: 14 })).toEqual(['satUp']);
    expect(state.observe({ stateInBbed: 4, merged_alarm: 0 })).toEqual([]);
    expect(state.observe({ stateInBbed: 4, merged_alarm: 14 })).toEqual([]);
    expect(state.observe({ stateInBbed: 1, merged_alarm: 0 })).toEqual([]);
    expect(state.observe({ stateInBbed: 4, merged_alarm: 0 })).toEqual(['satUp']);
    expect(state.observe({ stateInBbed: 4, merged_alarm: 14 })).toEqual([]);
    expect(state.observe({ stateInBbed: 4, merged_alarm: 10 })).toEqual(['leftBed']);
  });

  it('keeps merged alarm 14 for a session that starts on the bed edge, and resets the state memory', () => {
    const state = createJqbedAlarmSpeechState();
    expect(state.observe({ stateInBbed: 4, merged_alarm: 0 })).toEqual([]);
    expect(state.observe({ stateInBbed: 4, merged_alarm: 14 })).toEqual(['satUp']);
    expect(state.observe({ stateInBbed: 1, merged_alarm: 0 })).toEqual([]);
    state.reset();
    expect(state.observe({ stateInBbed: 4 })).toEqual([]);
    expect(state.observe({ stateInBbed: 1, sosflag: 0 })).toEqual([]);
    expect(state.observe({ stateInBbed: 4, sosflag: 1 })).toEqual(['emergency']);
    expect(state.observe({ stateInBbed: 4, merged_alarm: 14, sosflag: 2 })).toEqual([]);
  });

  it('does not repeat the same leave when the merged alarm 10 arrives with or after the state change', () => {
    const state = createJqbedAlarmSpeechState();
    expect(state.observe({ stateInBbed: 1, merged_alarm: 0 })).toEqual([]);
    expect(state.observe({ stateInBbed: 0, merged_alarm: 10 })).toEqual(['leftBed']);
    expect(state.observe({ stateInBbed: 0, merged_alarm: 0 })).toEqual([]);
    expect(state.observe({ stateInBbed: 1, merged_alarm: 0 })).toEqual([]);
    expect(state.observe({ stateInBbed: 0, merged_alarm: 0 })).toEqual(['leftBed']);
    expect(state.observe({ stateInBbed: 0, merged_alarm: 10 })).toEqual([]);
    expect(state.observe({ stateInBbed: 0, merged_alarm: 0 })).toEqual([]);
    expect(state.observe({ stateInBbed: 0, merged_alarm: 10 })).toEqual([]);
  });

  it('ignores invalid bed states and never treats the first known state as a leave', () => {
    const state = createJqbedAlarmSpeechState();
    for (const value of [-1, undefined, null, '0', 0.5, 2, 5, NaN]) {
      expect(state.observe({ stateInBbed: value })).toEqual([]);
    }
    expect(state.observe({ stateInBbed: 0 })).toEqual([]);
    expect(state.observe({ stateInBbed: 1 })).toEqual([]);
    for (const value of [-1, undefined, 2, '0']) expect(state.observe({ stateInBbed: value })).toEqual([]);
    expect(state.observe({ stateInBbed: 0 })).toEqual(['leftBed']);
    state.reset();
    expect(state.observe({ stateInBbed: 0 })).toEqual([]);
  });

  it('still uses merged alarms when no bed state is available, and never guesses from other fields', () => {
    const state = createJqbedAlarmSpeechState();
    expect(state.observe({ stateInBbed: 0, state_in_bed: 3 })).toEqual([]);
    expect(state.observe({ merged_alarm: 10 })).toEqual(['leftBed']);
    expect(state.observe({ merged_alarm: 14 })).toEqual(['satUp']);
    expect(state.observe({ merged_alarm: 11 })).toEqual([]);
    expect(state.observe({ merged_alarm: 13 })).toEqual([]);
    expect(state.observe({ merged_alarm: 12 })).toEqual([]);
    expect(state.observe({ merged_alarm: 15 })).toEqual([]);
  });

  it('retains the alarm across missing, -1, unknown and malformed frames, with zero rearming it', () => {
    const state = createJqbedAlarmSpeechState();
    expect(state.observe({ merged_alarm: 10 })).toEqual(['leftBed']);
    for (const value of [-1, undefined, null, '10', 10.5, NaN, Infinity, 11, 13, 99, true]) {
      expect(state.observe({ merged_alarm: value })).toEqual([]);
      expect(state.observe({ merged_alarm: 10 })).toEqual([]);
    }
    expect(state.observe({ merged_alarm: 0 })).toEqual([]);
    expect(state.observe({ merged_alarm: 10 })).toEqual(['leftBed']);
  });

  it('announces SOS sequence starts, ignores continuation points and retains the last point across -1', () => {
    const state = createJqbedAlarmSpeechState();
    for (const value of [-1, undefined, null, '1', true, 0.5, NaN, Infinity, 255]) {
      expect(state.observe({ sosflag: value })).toEqual([]);
    }
    expect(state.observe({ sosflag: 2 })).toEqual([]);
    expect(state.observe({ sosflag: 254 })).toEqual([]);
    expect(state.observe({ sosflag: 1 })).toEqual(['emergency']);
    for (const value of [1, -1, undefined, 1, 2, 3, 254]) {
      expect(state.observe({ sosflag: value })).toEqual([]);
    }
    expect(state.observe({ sosflag: 1 })).toEqual(['emergency']);
    expect(state.observe({ sosflag: 255 })).toEqual([]);
    expect(state.observe({ sosflag: 1 })).toEqual([]);
    expect(state.observe({ sosflag: 0 })).toEqual([]);
    expect(state.observe({ sosflag: 1 })).toEqual(['emergency']);
  });

  it('prioritizes SOS when both alarms first arrive together without replaying the suppressed bed alert', () => {
    const state = createJqbedAlarmSpeechState();
    expect(state.observe({ merged_alarm: 14, sosflag: 1 })).toEqual(['emergency']);
    expect(state.observe({ merged_alarm: 14, sosflag: 2 })).toEqual([]);
    expect(state.observe({ merged_alarm: 0, sosflag: 0 })).toEqual([]);
    expect(state.observe({ merged_alarm: 14, sosflag: 0 })).toEqual(['satUp']);
  });

  it('starts fresh after a real monitoring-session reset and keeps instances independent', () => {
    const first = createJqbedAlarmSpeechState();
    const second = createJqbedAlarmSpeechState();
    expect(first.observe({ merged_alarm: 14, sosflag: 0 })).toEqual(['satUp']);
    expect(second.observe({ merged_alarm: 14, sosflag: 0 })).toEqual(['satUp']);
    expect(first.observe({ sosflag: 1 })).toEqual(['emergency']);
    first.reset();
    expect(first.observe({ merged_alarm: 14, sosflag: 1 })).toEqual(['emergency']);
    expect(second.observe({ merged_alarm: 14, sosflag: 0 })).toEqual([]);
  });
});
