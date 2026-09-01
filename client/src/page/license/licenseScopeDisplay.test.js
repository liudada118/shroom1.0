import { describe, expect, it } from 'vitest';
import {
  describeLicenseFile,
  licenseSensorGroups,
} from './licenseScopeDisplay';

describe('licenseScopeDisplay', () => {
  it('expands a category token for preview', () => {
    const care = licenseSensorGroups.find((group) => group.key === 'care');

    expect(describeLicenseFile('@group:care')).toEqual({
      type: 'group',
      groupKeys: ['care'],
      list: care.items.map((item) => item.value),
    });
  });

  it('deduplicates mixed category and explicit scopes', () => {
    const result = describeLicenseFile(['jqbed', '@group:care']);

    expect(result.groupKeys).toEqual(['care']);
    expect(result.list.filter((value) => value === 'jqbed')).toHaveLength(1);
  });

  it('keeps legacy all/single/list previews and rejects unknown groups', () => {
    expect(describeLicenseFile('all')).toEqual({ type: 'all', list: [], groupKeys: [] });
    expect(describeLicenseFile('hand0205').type).toBe('single');
    expect(describeLicenseFile(['hand0205', 'jqbed']).type).toBe('multi');
    expect(() => describeLicenseFile('@group:missing')).toThrow(/unknown license group/);
  });
});
