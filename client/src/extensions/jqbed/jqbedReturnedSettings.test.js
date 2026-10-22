import { describe, expect, it } from 'vitest';
import { mergeJqbedReturnedSettings, readJqbedReturnedSettings, sameJqbedReturnedSettings } from './jqbedReturnedSettings';

describe('jqbed returned algorithm settings', () => {
  it('reads the fifth and sixth returned values and preserves valid zeroes', () => {
    expect(readJqbedReturnedSettings([91, 92, 93, 94, 0, 0])).toEqual({
      sensitivity: 0, bedType: 0,
    });
    expect(readJqbedReturnedSettings([0, 0, 0, 0, 3, 1])).toEqual({
      sensitivity: 3, bedType: 1,
    });
  });

  it('keeps a valid returned setting when the other is missing or invalid', () => {
    expect(readJqbedReturnedSettings([0, 0, 0, 0, 2])).toEqual({
      sensitivity: 2, bedType: null,
    });
    expect(readJqbedReturnedSettings([0, 0, 0, 0, -1, 1])).toEqual({
      sensitivity: null, bedType: 1,
    });
    expect(readJqbedReturnedSettings([0, 0, 0, 0, 0, 2])).toEqual({
      sensitivity: 0, bedType: null,
    });
  });

  it.each([undefined, null, '', '0,0,0,0,3,1', {}, { 4: 3, 5: 1 }, new Uint8Array([0, 0, 0, 0, 3, 1])])(
    'does not coerce a non-array result into returned settings', (value) => {
      expect(readJqbedReturnedSettings(value)).toEqual({ sensitivity: null, bedType: null });
    },
  );

  it.each([undefined, null, '0', '1', true, false, -1, 0.5, NaN, Infinity, {}, []])(
    'does not coerce an invalid returned value %s into a setting', (value) => {
      expect(readJqbedReturnedSettings([0, 0, 0, 0, value, value])).toEqual({
        sensitivity: null, bedType: null,
      });
    },
  );

  it('does not use saved configuration or mutate the returned array', () => {
    const values = Object.freeze([0, 0, 0, 0, 2, 1, 7, 8]);
    expect(readJqbedReturnedSettings(values)).toEqual({ sensitivity: 2, bedType: 1 });
    expect(readJqbedReturnedSettings({ sensitivity_threshold: 3, isLowBed: 1 })).toEqual({
      sensitivity: null, bedType: null,
    });
  });

  it('retains the latest valid values when later frames omit settings or contain sentinels', () => {
    const previous = Object.freeze({ sensitivity: 3, bedType: 1 });
    for (const reservedBytes of [undefined, null, [], [0, 0, 0, 0, -1, -1], [0, 0, 0, 0, null, null],
      [0, 0, 0, 0, '0', false], [0, 0, 0, 0, 4, 2]]) {
      expect(mergeJqbedReturnedSettings(previous, reservedBytes)).toEqual(previous);
    }
    expect(mergeJqbedReturnedSettings(previous, Object.freeze([0, 0, 0, 0, 0, 0]))).toEqual({
      sensitivity: 0, bedType: 0,
    });
    expect(previous).toEqual({ sensitivity: 3, bedType: 1 });
  });

  it('accumulates the two returned fields independently across frames', () => {
    const initial = mergeJqbedReturnedSettings(null, [0, 0, 0, 0, 2]);
    expect(initial).toEqual({ sensitivity: 2, bedType: null });
    const second = mergeJqbedReturnedSettings(initial, [0, 0, 0, 0, -1, 1]);
    expect(second).toEqual({ sensitivity: 2, bedType: 1 });
    expect(mergeJqbedReturnedSettings(second, [0, 0, 0, 0, 0, -1])).toEqual({
      sensitivity: 0, bedType: 1,
    });
  });

  it('starts empty after a session reset and never creates fallback values from configuration', () => {
    expect(mergeJqbedReturnedSettings(null, [0, 0, 0, 0, -1, -1])).toEqual({
      sensitivity: null, bedType: null,
    });
    expect(mergeJqbedReturnedSettings({ sensitivity_threshold: 3, isLowBed: 1 }, [])).toEqual({
      sensitivity: null, bedType: null,
    });
    expect(mergeJqbedReturnedSettings({ sensitivity: '2', bedType: false }, null)).toEqual({
      sensitivity: null, bedType: null,
    });
  });

  it('compares only the two nullable returned fields for state deduplication', () => {
    expect(sameJqbedReturnedSettings(null, undefined)).toBe(true);
    expect(sameJqbedReturnedSettings(undefined, { sensitivity: null, bedType: null })).toBe(true);
    expect(sameJqbedReturnedSettings({}, { sensitivity: undefined, bedType: null })).toBe(true);
    expect(sameJqbedReturnedSettings({ sensitivity: 0, bedType: 0 }, { sensitivity: 0, bedType: 0 })).toBe(true);
    expect(sameJqbedReturnedSettings({ sensitivity: 0, bedType: 0 }, { sensitivity: null, bedType: 0 })).toBe(false);
    expect(sameJqbedReturnedSettings({ sensitivity: 2, bedType: 0 }, { sensitivity: 2, bedType: 1 })).toBe(false);
    expect(sameJqbedReturnedSettings({ sensitivity: 2, bedType: null }, { sensitivity: 3, bedType: null })).toBe(false);
    expect(sameJqbedReturnedSettings({ sensitivity: 2, bedType: 0, other: 1 }, { sensitivity: 2, bedType: 0, other: 9 })).toBe(true);
  });
});
