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
      list: [...new Set(care.items.map((item) => item.value === 'hand0205Single' ? 'hand0205' : item.value))],
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

  it('keeps both legacy glove selections and only normalizes the single-glove alias', () => {
    expect(describeLicenseFile(['hand0205', 'hand0205Double']).list).toEqual(['hand0205', 'hand0205Double']);
    expect(describeLicenseFile(['hand0205Single', 'hand0205']).list).toEqual(['hand0205']);
    expect(describeLicenseFile('hand0205Single').list).toEqual(['hand0205']);
  });
});
