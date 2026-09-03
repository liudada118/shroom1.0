/**
 * 授权范围的展示侧解析 —— 根目录 `licenseScopes.js` 的 ESM 孪生。
 *
 * ⚠️ 是**复制不是共享**：根目录那份是 CJS，客户端构建吃不进去。展开规则改了两边都要改，
 * 否则界面显示的型号和后端实际放行的对不上（现象是「界面写着有，点进去说没授权」）。
 * 两边各有测试：`backend/tests/license/licenseScopes.test.js` 与同目录的 `.test.js`。
 */

import licenseSensorGroups from '../../../../licenseSensorGroups.json';

export const GROUP_SCOPE_PREFIX = '@group:';

const groupsByKey = new Map(
  licenseSensorGroups.map((group) => [group.key, group]),
);

/**
 * 把授权 `file` 展开成界面要用的形状；`type` 决定文案走「全部 / 整类 / 多型号 / 单型号」哪一支。
 *
 * 与后端 `expandLicenseFile` 的唯一区别：这里不接 `allSensorTypes`，`"all"` 直接返回空 `list`，
 * 由界面自己显示「全部」—— 前端拿不到运行期注册的全量型号表。
 *
 * @param {string|string[]} licenseFile 授权的 `file` 字段。
 * @returns {{type: 'all'|'group'|'multi'|'single', list: string[], groupKeys: string[]}} 展示数据。
 * @throws {Error} 引用了未知组、或一个型号都展不出来时抛。
 */
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

/**
 * 按组 key 取组定义（`items` 里带中文名，界面用来渲染标签）。
 *
 * 未知组返回 `null` 而不是抛 —— 这里只负责显示，遇到不认识的组要能降级成灰字，不能整页崩。
 *
 * @param {string} groupKey 组 key。
 * @returns {object|null} 组定义，或 null。
 */
export function getLicenseGroup(groupKey) {
  return groupsByKey.get(groupKey) || null;
}

export { licenseSensorGroups };
