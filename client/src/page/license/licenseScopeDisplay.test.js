import { describe, expect, it } from 'vitest';
import { describeLicenseFile, licenseSensorGroups } from './licenseScopeDisplay';

describe('license category display', () => {
  it('expands precision-all using the shared registry', () => {
    const precision = licenseSensorGroups.find((group) => group.key === 'precision');
    expect(describeLicenseFile('@group:precision')).toEqual({
      type: 'group',
      groupKeys: ['precision'],
      list: [...new Set(precision.items.map((item) => item.value === 'hand0205Single' ? 'hand0205' : item.value))],
    });
  });

  it('keeps all and legacy explicit lists compatible', () => {
    expect(describeLicenseFile('all')).toEqual({ type: 'all', list: [], groupKeys: [] });
    expect(describeLicenseFile(['hand', 'jqbed'])).toEqual({
      type: 'multi',
      list: ['hand', 'jqbed'],
      groupKeys: [],
    });
  });

  it('rejects an unknown category instead of treating it as a sensor', () => {
    expect(() => describeLicenseFile('@group:unknown')).toThrow(/unknown license group/);
  });

  it('keeps both legacy glove selections and only normalizes the single-glove alias', () => {
    expect(describeLicenseFile(['hand0205', 'hand0205Double']).list).toEqual(['hand0205', 'hand0205Double']);
    expect(describeLicenseFile(['hand0205Single', 'hand0205']).list).toEqual(['hand0205']);
    expect(describeLicenseFile('hand0205Single').list).toEqual(['hand0205']);
  });
});
