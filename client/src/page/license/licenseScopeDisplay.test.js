import { describe, expect, it } from 'vitest';
import { describeLicenseFile, licenseSensorGroups } from './licenseScopeDisplay';

describe('license category display', () => {
  it('expands precision-all using the shared registry', () => {
    const precision = licenseSensorGroups.find((group) => group.key === 'precision');
    expect(describeLicenseFile('@group:precision')).toEqual({
      type: 'group',
      groupKeys: ['precision'],
      list: precision.items.map((item) => item.value),
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
});
