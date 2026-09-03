"use strict";

/**
 * 授权范围解析：把授权 `file` 字段里的 `@group:xxx` 组令牌展开成具体的传感器类型清单。
 *
 * 发证工具和运行期校验共用这一份，别在别处再写一遍展开逻辑 —— 两边算出不同的范围，
 * 现象是「发证时勾了一整类，装机后少几个型号打不开」。
 *
 * ⚠️ 前端另有一份 ESM 孪生 `client/src/page/license/licenseScopeDisplay.js`，是**复制不是共享**
 * （客户端构建吃不进 CJS）。改了展开规则两边都要改，两套测试各盯一边。
 */

const LICENSE_SENSOR_GROUPS = require("./licenseSensorGroups.json");

const GROUP_SCOPE_PREFIX = "@group:";

/**
 * 自检分组注册表：组 key 与传感器类型都必须全局唯一，且每组至少一个型号。
 *
 * ⚠️ 模块加载时立刻跑一次，注册表写坏应用直接起不来 —— 这是故意的。重复的 sensorType 会让
 * 授权静默多放行一个型号，那种错必须在启动时炸，不能拖到发证之后。
 *
 * @param {Array} groups 待校验的分组，默认是打包进来的注册表。
 * @returns {{groupCount: number, sensorTypeCount: number}} 计数，仅用于自检输出。
 * @throws {Error} 注册表非法时抛，消息里带具体的组 key 或型号。
 */
function validateLicenseSensorGroups(groups = LICENSE_SENSOR_GROUPS) {
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error("license sensor groups must be a non-empty array");
  }

  const groupKeys = new Set();
  const sensorTypes = new Set();
  for (const group of groups) {
    const groupKey = typeof group?.key === "string" ? group.key.trim() : "";
    if (!groupKey || groupKeys.has(groupKey)) {
      throw new Error(`duplicate or invalid license group: ${groupKey || "(empty)"}`);
    }
    if (!Array.isArray(group.items) || group.items.length === 0) {
      throw new Error(`license group has no display systems: ${groupKey}`);
    }
    groupKeys.add(groupKey);

    for (const item of group.items) {
      const sensorType = typeof item?.value === "string" ? item.value.trim() : "";
      if (!sensorType || sensorTypes.has(sensorType)) {
        throw new Error(`duplicate or invalid display system: ${sensorType || "(empty)"}`);
      }
      sensorTypes.add(sensorType);
    }
  }

  return { groupCount: groupKeys.size, sensorTypeCount: sensorTypes.size };
}

validateLicenseSensorGroups();

const GROUPS_BY_KEY = new Map(
  LICENSE_SENSOR_GROUPS.map((group) => [group.key, group]),
);

/**
 * 把组 key 包成授权里实际存的 `@group:xxx` 令牌 —— 发证工具勾选「整类」时用。
 *
 * @param {string} groupKey 组 key。
 * @returns {string} 组令牌。
 * @throws {Error} 组不存在时抛，避免发出一张永远展不开的证。
 */
function createGroupScopeToken(groupKey) {
  const normalized = String(groupKey || "").trim();
  if (!GROUPS_BY_KEY.has(normalized)) {
    throw new Error(`unknown license group: ${normalized || "(empty)"}`);
  }
  return `${GROUP_SCOPE_PREFIX}${normalized}`;
}

/**
 * 判一条授权条目是不是组令牌：是就返回组 key，是普通传感器类型就返回 `null`。
 *
 * ⚠️ 「不是令牌」返回 null 而「是令牌但组不认识」抛异常 —— 这两种不能合并。后者说明授权引用了
 * 本版本已删掉的组，静默当成普通型号放过去会让整张证的范围算少，装机后少几个型号打不开。
 *
 * @param {*} value 授权 `file` 里的一条。
 * @returns {string|null} 组 key，或 null 表示不是组令牌。
 */
function parseGroupScopeToken(value) {
  if (typeof value !== "string" || !value.startsWith(GROUP_SCOPE_PREFIX)) {
    return null;
  }
  const groupKey = value.slice(GROUP_SCOPE_PREFIX.length).trim();
  if (!GROUPS_BY_KEY.has(groupKey)) {
    throw new Error(`unknown license group: ${groupKey || "(empty)"}`);
  }
  return groupKey;
}

/**
 * 把授权的 `file` 字段展开成最终放行的传感器类型清单 —— 本模块的主出口。
 *
 * 入参三种形状都收：`"all"`、单个字符串、字符串数组；数组里组令牌和裸型号可以混排。
 * 去重后**保持首次出现的顺序**，界面就按这个顺序显示，别改成排序。
 *
 * ⚠️ `"all"` 展开成 `allSensorTypes`（运行期实际注册的型号），所以同一张证在不同版本上展开
 * 结果不同 —— 这是有意的「以后新增型号也放行」。
 * ⚠️ 展不出任何型号时抛异常而不是返回空数组：放行 0 个型号的证是配置事故，不是合法状态。
 *
 * @param {string|string[]} licenseFile 授权的 `file` 字段。
 * @param {{allSensorTypes?: string[]}} [options] `"all"` 时用来填充的全量型号表。
 * @returns {{isAllTypes: boolean, groupKeys: string[], sensorTypes: string[]}} 展开结果。
 */
function expandLicenseFile(licenseFile, { allSensorTypes = [] } = {}) {
  if (licenseFile === "all") {
    return {
      isAllTypes: true,
      groupKeys: [],
      sensorTypes: [...new Set(allSensorTypes.filter(Boolean))],
    };
  }

  const entries = Array.isArray(licenseFile) ? licenseFile : [licenseFile];
  const groupKeys = [];
  const sensorTypes = [];
  const seenGroups = new Set();
  const seenTypes = new Set();

  for (const entry of entries) {
    if (typeof entry !== "string" || !entry.trim()) continue;
    const normalized = entry.trim();
    const groupKey = parseGroupScopeToken(normalized);
    if (groupKey) {
      if (!seenGroups.has(groupKey)) {
        seenGroups.add(groupKey);
        groupKeys.push(groupKey);
      }
      for (const item of GROUPS_BY_KEY.get(groupKey).items) {
        if (!seenTypes.has(item.value)) {
          seenTypes.add(item.value);
          sensorTypes.push(item.value);
        }
      }
      continue;
    }
    if (!seenTypes.has(normalized)) {
      seenTypes.add(normalized);
      sensorTypes.push(normalized);
    }
  }

  if (sensorTypes.length === 0) {
    throw new Error("license does not contain any display system");
  }

  return { isAllTypes: false, groupKeys, sensorTypes };
}

module.exports = {
  GROUP_SCOPE_PREFIX,
  LICENSE_SENSOR_GROUPS,
  createGroupScopeToken,
  expandLicenseFile,
  parseGroupScopeToken,
  validateLicenseSensorGroups,
};
