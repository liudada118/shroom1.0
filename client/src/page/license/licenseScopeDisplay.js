import licenseSensorGroups from '../../../../licenseSensorGroups.json';

export const GROUP_SCOPE_PREFIX = '@group:';

const groupsByKey = new Map(
  licenseSensorGroups.map((group) => [group.key, group]),
);

const normalizeSensorType = (value) => value === 'hand0205Single' ? 'hand0205' : value;

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
        const sensorType = normalizeSensorType(item.value);
        if (!seenTypes.has(sensorType)) {
          seenTypes.add(sensorType);
          list.push(sensorType);
        }
      });
      return;
    }
    const sensorType = normalizeSensorType(normalized);
    if (!seenTypes.has(sensorType)) {
      seenTypes.add(sensorType);
      list.push(sensorType);
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
