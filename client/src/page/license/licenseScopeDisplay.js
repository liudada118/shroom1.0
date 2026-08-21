import licenseSensorGroups from '../../../../licenseSensorGroups.json';

export const GROUP_SCOPE_PREFIX = '@group:';

const groupsByKey = new Map(
  licenseSensorGroups.map((group) => [group.key, group]),
);

export function describeLicenseFile(licenseFile) {
  if (licenseFile === 'all') {
    return { type: 'all', list: [], groupKeys: [] };
  }

  const entries = Array.isArray(licenseFile) ? licenseFile : [licenseFile];
  const list = [];
  const groupKeys = [];
  const seenTypes = new Set();
  const seenGroups = new Set();

  entries.forEach((entry) => {
    if (typeof entry !== 'string' || !entry.trim()) return;
    const normalized = entry.trim();
    if (normalized.startsWith(GROUP_SCOPE_PREFIX)) {
      const groupKey = normalized.slice(GROUP_SCOPE_PREFIX.length).trim();
      const group = groupsByKey.get(groupKey);
      if (!group) throw new Error(`unknown license group: ${groupKey || '(empty)'}`);
      if (!seenGroups.has(groupKey)) {
        seenGroups.add(groupKey);
        groupKeys.push(groupKey);
      }
      group.items.forEach((item) => {
        if (!seenTypes.has(item.value)) {
          seenTypes.add(item.value);
          list.push(item.value);
        }
      });
      return;
    }
    if (!seenTypes.has(normalized)) {
      seenTypes.add(normalized);
      list.push(normalized);
    }
  });

  if (!list.length) throw new Error('license does not contain any display system');
  return {
    type: groupKeys.length ? 'group' : list.length > 1 ? 'multi' : 'single',
    list,
    groupKeys,
  };
}

export { licenseSensorGroups };
