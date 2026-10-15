"use strict";

const LICENSE_SENSOR_GROUPS = require("./licenseSensorGroups.json");

const GROUP_SCOPE_PREFIX = "@group:";

/** 旧单手兼容 key 与正式手套类型表达同一授权，不额外授予双手版。 */
function normalizeLicenseSensorType(value) {
  const sensorType = typeof value === "string" ? value.trim() : value;
  return sensorType === "hand0205Single" ? "hand0205" : sensorType;
}

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
  LICENSE_SENSOR_GROUPS.map((group) => [group.key, group])
);

function createGroupScopeToken(groupKey) {
  const normalized = String(groupKey || "").trim();
  if (!GROUPS_BY_KEY.has(normalized)) {
    throw new Error(`unknown license group: ${normalized || "(empty)"}`);
  }
  return `${GROUP_SCOPE_PREFIX}${normalized}`;
}

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

function expandLicenseFile(licenseFile, { allSensorTypes = [] } = {}) {
  if (licenseFile === "all") {
    return {
      isAllTypes: true,
      groupKeys: [],
      sensorTypes: [...new Set(allSensorTypes.filter(Boolean).map(normalizeLicenseSensorType))],
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
        const sensorType = normalizeLicenseSensorType(item.value);
        if (!seenTypes.has(sensorType)) {
          seenTypes.add(sensorType);
          sensorTypes.push(sensorType);
        }
      }
      continue;
    }
    const sensorType = normalizeLicenseSensorType(normalized);
    if (!seenTypes.has(sensorType)) {
      seenTypes.add(sensorType);
      sensorTypes.push(sensorType);
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
  normalizeLicenseSensorType,
  parseGroupScopeToken,
  validateLicenseSensorGroups,
};
